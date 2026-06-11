# 🥤 Cup — 2026 世界杯可乐竞猜平台

同事之间"根据 Polymarket 赔率赌可口可乐"的内部竞猜小工具。赛前给球队投票下注，
赛后用 **Polymarket 市场赔率**结算每个人该买/该收多少瓶可乐，并维护排行榜。

- **赛程**：2026 世界杯全部 104 场（数据源 [openfootball](https://github.com/openfootball/worldcup.json)）。
- **赔率**：从 [Polymarket](https://polymarket.com) 抓取单场胜平负市场（小组赛 3-way / 淘汰赛 2-way）。
- **两种赔率**：Polymarket 市场赔率（真实结算）+ 群众投票赔率（仅对比展示"群众 vs 市场"）。
- **结算**：押中 `+下注瓶数 × (赔率−1)`，押错 `−下注瓶数`；累计净额四舍五入为应买瓶数（如 −1.5 → 买 2 瓶）。

## 技术栈

Next.js 16 (App Router) · React 19 · SQLite (better-sqlite3) · Tailwind CSS v4。
深色为主、移动端优先的"深夜记分牌 × 汽水波普"风格（见 `DESIGN.md`）。

## 本地开发

```bash
npm install
npm run db:migrate          # 建表
npm run import:schedule     # 导入 104 场赛程 + 48 队（中文名）
npm run fetch:odds          # 抓取 Polymarket 单场赔率
npm run dev                 # http://localhost:3000 （-H 0.0.0.0 局域网可访问）
```

## Docker 部署（正式环境）

容器内监听 `8026`，SQLite 数据通过 volume 持久化到宿主机 `./data`。
首次启动会自动建表、导入赛程并抓一次赔率。

```bash
cp .env.example .env      # 填好 AUTH_* 等变量（见下方"Twitter 登录配置"）
docker compose up -d --build
# 访问 http://<宿主机>:8026
```

### Twitter (X) 登录配置

平台用 X 账号登录（强制登录才能投票），用 Auth.js 的 OAuth 2.0：

1. 在 [developer.x.com](https://developer.x.com) 建 App → **User authentication settings** → 开启 **OAuth 2.0**，拿到 **Client ID / Client Secret**（注意：不是 API Key / Consumer Key，那是 OAuth 1.0a）。
2. 在该处注册回调 URL：`<AUTH_URL>/api/auth/callback/twitter`。
3. 在 `.env` 填：
   ```
   AUTH_SECRET=<openssl rand -base64 33 生成>
   AUTH_URL=https://<你的 tailscale 域名>     # 用 tailscale serve 暴露 HTTPS
   AUTH_TWITTER_ID=<OAuth2 Client ID>
   AUTH_TWITTER_SECRET=<OAuth2 Client Secret>
   ```
4. 登录后默认用 Twitter 头像 + 昵称，在 `/identity` 可改昵称、可用 emoji 覆盖头像。

### Tailscale 内网访问

正式环境跑在家里的机器上，用 [Tailscale](https://tailscale.com) 打通网络即可让所有人访问：

1. 宿主机装好 Tailscale 并登录（容器无需任何改动，端口 8026 暴露在宿主机即可）。
2. 大家在自己设备装 Tailscale 登录同一 tailnet，访问 `http://<宿主机 Tailscale 名>:8026`。
3. 也可用 `tailscale serve` 把 8026 反代成 HTTPS 域名。

### 运维命令

```bash
docker compose exec app npm run fetch:odds      # 手动刷新 Polymarket 赔率
docker compose exec app npm run sync:results    # 手动同步 football-data 比分并结算
docker compose exec app npm run lock:snapshots  # 锁定已开赛比赛的赔率快照
docker compose logs -f app                      # 看日志
```

定时任务**内置在容器里**（`RUN_SCHEDULER=true`，docker-compose 默认开）。容器启动后自动周期运行，无需宿主机 crontab：

| 任务 | 默认间隔 | 覆盖变量 | 说明 |
|---|---|---|---|
| 赔率 `odds` | 60 分钟 | `CRON_ODDS_MIN` | 拉 Polymarket 概率（仅对比展示，带 UA / 退避防限流） |
| 比分 `results` | 15 分钟 | `CRON_RESULTS_MIN` | 拉 football-data 已结束比赛，自动结算未结算的场次 |
| 赛程 `schedule` | 1440 分钟 | `CRON_SCHEDULE_MIN` | 重导赛程（淘汰赛对阵确定后原地更新） |

把 `RUN_SCHEDULER` 设为 `false` 可关掉内置调度，改用宿主机 cron 调上面的运维命令。

> 群众赔率无需单独的锁盘定时任务：投票在开赛前 1 小时自动截止，结算时按当时（已固定）的投票分布定格作为结算依据。

> **赔率同步**：每小时一次（Polymarket 概率，仅展示）。
> **比赛结果**：默认由 **football-data.org 自动同步**比分并结算；结算账号也可在 `/admin` 手动录入或**修正比分**（不配 `FOOTBALL_DATA_API_KEY` 则纯手动）。
> **结算赔率**：用**群众投票赔率**（开赛前 1 小时锁定的投票分布），Polymarket 仅作对比。

## 结算后台

把结算账号的 X 用户名（或 `twitter_id`）配进 `SETTLER_USERNAMES`（逗号分隔）。这些账号登录后导航出现「⚙️ 结算」，访问 `/admin` 即可操作；其他人访问会被拒绝。

结算分两阶段：

- **录入结果**（线上）：比分默认由 football-data 自动同步并结算；也可手动选胜/平/负 + 比分，或对已结算比赛**修正比分**。按锁定的投票赔率写入账本、更新排名。
- **补录赔率**：Polymarket 未开盘的场次，可手动录入 0–1 概率作为结算依据。
- **线下结算可乐**：「可乐总账」按人汇总应买/应收 + 平台可乐池，每场还显示群众赔率与逐人应交/应收；线下收发后点「🥤 标记可乐已结清」或「✅ 全部平账」。`/me` 与排行榜据此区分「待结/已结清」，净瓶数（战绩）不变。

## 玩法说明

1. 用 X（Twitter）账号登录（强制），自动带入头像和昵称；在 `/identity` 可改昵称、可用 emoji 覆盖头像。
2. 在赛程页选一场**有盘口**的比赛 → 押 主胜/平/客胜（淘汰赛只有胜/负）+ 下注瓶数（0.5/1/2），开赛前可改票。
3. 开赛锁盘 → 结算账号录入结果 → 自动结算 → 线下收发可乐后标记结清。
4. `/leaderboard` 看排名，`/me` 看个人账本与应买可乐瓶数。

## 数据模型

`users` 身份 · `teams` 球队（英文名供匹配 + 中文名展示）· `matches` 104 场 ·
`poly_markets` Polymarket 市场映射 · `odds_snapshot` 赔率快照（含开赛锁定） ·
`votes` 投票 · `ledger` 结算账本（存未取整净额，排名时再四舍五入）。
