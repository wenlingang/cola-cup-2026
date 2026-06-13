# 🥤 Cola Cup 2026 — 世界杯可乐竞猜（Rails 8 版）

同事之间「按群众投票赔率赌可口可乐」的内部竞猜小工具。赛前给球队投票下注，赛后用
**群众投票帕里-玛图尔（Pari-Mutuel）赔率**结算每个人该买/该收多少瓶饮料，并维护排行榜与额度兑换。

这是原 Next.js 16 版本的 Rails 8 现代单体重写：零 Node 构建、Hotwire 实时更新、SQLite 唯一数据库。

- **赛程**：2026 世界杯全部 104 场（数据源 [openfootball](https://github.com/openfootball/worldcup.json)）。
- **赔率**：从 [Polymarket](https://polymarket.com) 抓取单场胜平负市场（仅对比展示「群众 vs 市场」）。
- **结算**：以参与者投票的帕里-玛图尔分池为准（押中按比例分得输家的注，押错失去本注，零和）。
- **实时**：跨用户更新经 Solid Cable WebSocket 广播 HTML 片段，无需手动刷新。

## 技术栈

- **Ruby 4.0.5 + Rails 8.1**（现代单体）
- **SQLite** 唯一数据库（primary / cache / queue / cable 四库分离，全在 `storage/` 下）
- **Solid 三件套**：Solid Queue（后台任务）/ Solid Cache（缓存）/ Solid Cable（WebSocket），去 Redis 化，dev 与 prod 同构
- **零 Node**：importmap-rails + Propshaft + tailwindcss-rails（standalone 二进制）+ Turbo / Stimulus
- **认证**：Devise 5 + omniauth-twitter2（仅 Twitter OAuth 2.0，无密码）
- **部署**：单容器 Docker Compose + Thruster，沿用宿主机 8026 端口 + Tailscale 内网
- 视觉：深色为主、移动端优先的「深夜记分牌 × 汽水波普」风格

---

## 本地开发（从零开始）

下面是在一台**全新 macOS**（只有命令行）上从零跑起来的完整命令流，逐条复制即可。

```bash
# 1. 安装 Xcode 命令行工具（git / 编译器）
xcode-select --install

# 2. 安装 mise（多语言版本管理器），并在当前 shell 激活
curl https://mise.run | sh
echo 'eval "$(~/.local/bin/mise activate zsh)"' >> ~/.zshrc   # bash 用户改成 ~/.bashrc 与 activate bash
source ~/.zshrc

# 3. 克隆仓库，进入 rails/ 子目录
git clone https://github.com/griffinqiu/cola-cup-2026.git
cd cola-cup-2026/rails

# 4. 安装并启用 Ruby 4.0.5（.ruby-version 已指定，mise 会自动识别）
mise install ruby@4.0.5
mise use ruby@4.0.5
ruby -v                       # 应显示 ruby 4.0.5

# 5. 安装 Rails 与项目依赖
gem install rails -v "~> 8.1"
bundle install

# 6. 建库（一次性建好 primary/cache/queue/cable 四个 SQLite 文件）
bin/rails db:prepare

# 7. 导入赛程种子（104 场比赛 + 48 支球队中文名，幂等，可重复跑）
bin/rails db:seed

# 8. 准备环境变量（本地可留空，只有要测真实 Twitter 登录才填）
cp .env.example .env

# 9.（可选）抓一次 Polymarket 赔率用于对比展示
bin/rails cup:fetch_odds

# 10. 启动开发服务器（web + tailwind watch + jobs 三进程）
bin/dev
```

`bin/dev` 会同时拉起：

| 进程 | 作用 | 地址 |
|---|---|---|
| `web` | Rails 服务器（绑定 `0.0.0.0`，局域网/手机可访问） | http://localhost:3000 |
| `css` | Tailwind 增量编译（watch 模式） | — |
| `jobs` | Solid Queue worker（定时任务 + 广播） | — |

> 一条龙替代方案：`bin/setup` 会自动 `bundle install` + `db:prepare` 并直接启动 `bin/dev`。

### 开发注意事项

> ⚠️ **不要运行 `bin/rails stimulus:manifest:update`**。它生成的相对 import 在 propshaft + importmap 下会 404，导致全站 Stimulus 失效。本项目用 `eagerLoadControllersFrom` 自动注册控制器：新增 controller 直接放进 `app/javascript/controllers/` 即可生效，无需任何注册/manifest 命令。

### 验证实时广播（WebSocket）

开两个浏览器窗口（或一个无痕窗口）同时访问首页 / 同一场比赛详情页，在其中一个投票，另一个应在约 1 秒内自动更新赔率条、投票名单与首页卡片，**无需手动刷新**。本地的 `/cable` 走真实的 Solid Cable（SQLite），与生产同构。

---

## 运行测试

```bash
bundle exec rspec          # 全部测试（资金安全相关的 P0 用例优先）
bin/rubocop                # 代码风格检查
bin/brakeman               # 安全静态扫描
```

---

## Docker 部署（正式环境）

容器内 Thruster 监听 `80`，宿主机映射到 `8026`；SQLite 四库通过 volume 持久化到宿主机 `./storage`。
首次启动会自动建库（`db:prepare`），空库时自动导入赛程种子。

```bash
cd cola-cup-2026/rails
cp .env.example .env          # 填好 SECRET_KEY_BASE / AUTH_* 等（见下方配置）
docker compose up -d --build
# 访问 http://<宿主机>:8026
docker compose logs -f app    # 看日志
```

### Linux 宿主机首次部署注意

镜像以非 root 用户（uid/gid `1000`）运行，而 volume 由宿主机 root 创建，会导致写入 `storage/` 被拒。首次部署前先建目录并改属主：

```bash
mkdir -p storage
sudo chown -R 1000:1000 storage
```

> macOS Docker Desktop 自动处理 volume 权限，无需此步。

### 镜像构建说明（tailwind / gem 跨平台）

`Gemfile.lock` 已经 `bundle lock --add-platform aarch64-linux x86_64-linux`，因此 Debian slim 镜像里能装上 tailwindcss-ruby 的 Linux 原生二进制并在构建阶段 `assets:precompile`。如果改动了依赖后构建报缺平台，先在本机补平台再重建：

```bash
bundle lock --add-platform aarch64-linux x86_64-linux
docker compose up -d --build
```

### 新旧版本并存（端口冲突）

旧 Next.js 容器同样占用宿主机 `8026`。切换时先停旧容器（`docker stop cup2026-service`），或临时把本栈映射改成 `8027:80` 灰度验证后再切。

---

## Twitter (X) 登录配置

平台强制用 X 账号登录才能投票，走 OAuth 2.0（无密码）。

1. 在 [developer.x.com](https://developer.x.com) 建 App → **User authentication settings** → 开启 **OAuth 2.0**，拿到 **Client ID / Client Secret**（注意不是 API Key / Consumer Key，那是 OAuth 1.0a）。
2. 注册回调 URL（注意路径与旧版不同）：

   ```
   本地开发：http://localhost:3000/users/auth/twitter2/callback
   正式环境：<AUTH_URL>/users/auth/twitter2/callback
   ```

3. 在 `.env` 填写：

   ```bash
   AUTH_TWITTER_ID=<OAuth2 Client ID>
   AUTH_TWITTER_SECRET=<OAuth2 Client Secret>
   AUTH_URL=https://<你的 tailscale 域名>      # 正式环境；本地默认 http://localhost:3000
   ```

4. 登录后默认用 Twitter 头像 + 昵称；在 `/me/settings` 可改昵称、用 emoji 覆盖头像。

> **从旧版迁移**：旧回调路径是 `/api/auth/callback/twitter`，新版是 `/users/auth/twitter2/callback`。在 X 后台**并行注册两个回调 URL**，等新版上线验证通过后再删旧的，避免切换瞬间登录中断。

### Tailscale 内网访问

正式环境跑在家用机上，用 [Tailscale](https://tailscale.com) 打通网络让所有人访问：

1. 宿主机装好 Tailscale 并登录（容器无需改动，端口 8026 暴露在宿主机即可）。
2. 大家在自己设备装 Tailscale 登录同一 tailnet，访问 `http://<宿主机 Tailscale 名>:8026`。
3. 也可用 `tailscale serve` 把 8026 反代成 HTTPS 域名（此时把 `AUTH_URL` 设为该 https 域名，应用会自动启用 `assume_ssl`）。

---

## 定时任务与运维

定时任务**内置在容器里**（Solid Queue 在 Puma 进程内运行，`SOLID_QUEUE_IN_PUMA=true`），由 `config/recurring.yml` 调度，无需宿主机 crontab：

| 任务 | Job | 默认间隔 | 覆盖变量 | 说明 |
|---|---|---|---|---|
| 赔率 | `FetchOddsJob` | 60 分钟 | `CRON_ODDS_MIN` | 拉 Polymarket 概率（仅对比展示，带 UA / 退避防限流） |
| 比分/结算 | `SyncLiveScoresJob` | 1 分钟 | `CRON_LIVE_MIN` | 拉 football-data：刷新进行中比分；比赛结束（FINISHED）即录入最终结果并**自动结算** |
| 赛程 | `ImportScheduleJob` | 1440 分钟 | `CRON_SCHEDULE_MIN` | 重导赛程（淘汰赛对阵确定后按 external_key 原地更新） |
| 锁盘 | `LockDueMatchesJob` | 10 分钟 | （固定） | 给即将开赛的比赛冻结投票赔率快照，幂等 |

`CRON_*_MIN` 是「间隔分钟数」，`config/recurring.yml` 会防御性地换算成 cron 表达式（非法值回默认）。
把 `RUN_SCHEDULER=false` 可关掉内置调度（entrypoint 会自动 `export SOLID_QUEUE_SKIP_RECURRING=true`），改用宿主机 cron 调下面的运维命令。

```bash
docker compose exec app bin/rails cup:fetch_odds       # 手动刷新 Polymarket 赔率
docker compose exec app bin/rails cup:sync_live        # 手动同步 football-data 比分 + 结果（结束即结算）
docker compose exec app bin/rails cup:import_schedule  # 手动重导赛程
```

> 比赛结束（football-data 标记 FINISHED）会**自动结算**（群众投票帕里-玛图尔现算）；超出直播窗口仍未收到结果的异常比赛（取消/弃赛/数据源故障）需由结算账号在 `/admin` 后台手动结算。

### 从旧版数据库迁移

将旧 Next.js 的 `cup.db` 整体导入新 schema（保留原 id，单事务可回滚重试）：

```bash
bin/rails "legacy:import[/path/to/cup.db]"
```

导入后可再跑一次 `cup:import_schedule` 按 `external_key` 刷新赛程（id 不变）。

---

## 环境变量对照表（旧 Next.js → 新 Rails）

| 旧（Next.js / Auth.js） | 新（Rails） | 说明 |
|---|---|---|
| `AUTH_SECRET` | `SECRET_KEY_BASE` | 会话/签名密钥，可直接复用旧值（`openssl rand -hex 64`） |
| `AUTH_URL` | `AUTH_URL` | 公网访问地址：OAuth 回调基址、WS 来源、https 检测 |
| `AUTH_TRUST_HOST` | —（移除） | 由 `assume_ssl` + `action_cable.allowed_request_origins` 替代 |
| `AUTH_TWITTER_ID` | `AUTH_TWITTER_ID` | 不变 |
| `AUTH_TWITTER_SECRET` | `AUTH_TWITTER_SECRET` | 不变 |
| `DB_PATH` | `DB_PATH` | 仍兼容，仅指 primary 库；默认 `storage/production.sqlite3` |
| `SETTLER_USERNAMES` | `SETTLER_USERNAMES` | 不变（去 `@` 小写匹配） |
| `FOOTBALL_DATA_API_KEY` | `FOOTBALL_DATA_API_KEY` | 不变（留空则纯手动录比分） |
| `RUN_SCHEDULER` | `RUN_SCHEDULER` | 不变（`false` → 自动 `SOLID_QUEUE_SKIP_RECURRING=true`） |
| `CRON_ODDS_MIN` 等 | `CRON_ODDS_MIN` 等 | 不变 |
| `PORT=8026` | —（容器固定 80） | 改由 compose 端口映射 `8026:80`（Thruster 监听 80） |
| `NODE_ENV` | `RAILS_ENV` | 生产固定 `production` |
| `ASSET_PREFIX`（Cloudflare CDN） | —（移除） | Propshaft + Thruster 直接服务静态资源 |
| — | `SOLID_QUEUE_IN_PUMA=true` | 新增：后台任务在 Puma 进程内运行 |
| — | `RAILS_MAX_THREADS=5` | 新增：Puma 线程数 = 各库连接池大小（单进程，不设 `WEB_CONCURRENCY`） |
| — | `TZ=Asia/Shanghai` | 新增：DB 存 UTC，展示北京时间 |

---

## 故障排查

| 现象 | 原因与处理 |
|---|---|
| Linux 上 `storage/` 写入 `Permission denied` | 镜像以 uid 1000 运行：`sudo chown -R 1000:1000 storage` |
| 登录后 302 重定向死循环 | `AUTH_URL` 设成了 https 但实际走 http 直连。http 内网访问就保持 `AUTH_URL=http://...`；只有用 `tailscale serve` 暴露 HTTPS 时才填 https |
| WebSocket 不实时更新 | 检查 `AUTH_URL` 是否与实际访问地址一致（`allowed_request_origins` 校验来源）；Tailscale 域名需匹配 `*.ts.net` |
| Twitter 登录失败 / 429 限流 | 跳转 `/auth/error` 会显示原因（含限流恢复时间）；确认回调 URL 已在 X 后台注册 |
| `gem install` / `bundle install` 在 Ruby 4.0 下装不上某个 gem | 回退到 Ruby 3.4：`mise use ruby@3.4` 并把 `.ruby-version` 改为 `ruby-3.4.x`，其余无需改动 |
| 装好依赖后 `bin/rails` 仍报 `Bundler::GemNotFound`，或跑到了别的 Ruby 版本 | 装过 asdf 的机器上，asdf 的 shims 可能在 PATH 里抢在 mise 前面。先 `which ruby` / `ruby -v` 确认用的是不是 4.0.5；不是的话确保 shell 已 `mise activate`，或把 mise 的 ruby 前置到 PATH：`export PATH="$(dirname "$(mise which ruby)"):$PATH"` |
| `bin/jobs` 报 `solid_queue_*` 表不存在 | 检查 `storage/` 下的 `*_queue` / `*_cable` / `*_cache` 库是否为空，删掉这三个文件后重跑 `bin/rails db:prepare` 即可重建。**不要**在辅助库为空时裸跑 `bin/rails db:migrate`——它会把空 schema dump 覆盖掉 `db/*_schema.rb` |
| 命令报 python 找不到 / 路径错误（mise 环境） | mise 偶发把 python shim 指到坏路径。`mise reshim` 后重开 shell 即可恢复 |
| Docker 构建报 tailwind / gem 缺平台 | `bundle lock --add-platform aarch64-linux x86_64-linux` 后重建 |
| 新旧容器端口都占 8026 | 先停旧容器 `docker stop cup2026-service`，或临时把本栈改 `8027:80` |
