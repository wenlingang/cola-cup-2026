# 🥤 Cola Cup 2026 — 世界杯可乐竞猜平台

同事之间「赌可口可乐」的内部竞猜小工具：赛前给球队投票下注，赛后按**群众投票的帕里-玛图尔（Pari-Mutuel）赔率**结算每个人该买/该收多少瓶可乐，并维护排行榜。跑在家用机上，通过 Tailscale 内网供全员访问。

## 功能

- **赛程**：2026 世界杯全部 104 场比赛、48 支球队（中文名展示），数据源 [openfootball](https://github.com/openfootball/worldcup.json)，淘汰赛对阵确定后自动更新。
- **下注**：用 X（Twitter）账号登录后选方向下注（小组赛 胜/平/负，淘汰赛 胜/负），注额按阶段固定（小组赛 1 瓶 → 淘汰赛 2 瓶 → 半决赛起 5 瓶），开赛前 1 小时锁盘，锁盘前可改票。
- **两种赔率**：结算用**群众投票分池赔率**（押冷门赢多、押热门赢少，零和、平台不抽水）；同时抓取 [Polymarket](https://polymarket.com) 市场概率，仅作「群众 vs 市场」对比展示。
- **比分同步**：[football-data.org](https://www.football-data.org) 自动拉取已结束比赛的比分（也可在后台手动录入/修正）。
- **结算与账本**：精确小数账本，零头跨场累计；结算账号在 `/admin` 后台发起结算、查看每人净瓶数总账、标记可乐已结清。
- **额度兑换**：余额可在「我的」页面直接兑换饮料（可乐 1 / 各种茶、外星人 1.5 / 红牛 2.5 额度一瓶），兑换自动扣额度。
- **排行榜与个人页**：`/leaderboard` 看排名，`/me` 看个人账本、待结/已结清状态，可改昵称、用 emoji 覆盖头像。
- **定时任务内置**：赔率/比分/赛程/锁盘的周期任务跑在应用容器内，无需宿主机 crontab。

## 两个实现版本

同一套产品有两份完整实现，分别位于：

| 目录 | 技术栈 | 状态 |
|---|---|---|
| [`nextjs/`](nextjs/) | Next.js 16 (App Router) + React 19 + better-sqlite3 + Auth.js | 初版，已上线运行 |
| [`rails/`](rails/) | Rails 8.1 + Hotwire + Solid Stack + Devise | 重写版，功能对齐并增强 |

两版共用同一套环境变量约定（Twitter OAuth、`SETTLER_USERNAMES`、football-data key 等，对照表见 `rails/README.md`），数据可通过 `legacy:import` 从 Next.js 版的 SQLite 整库迁移到 Rails 版。部署都是单容器 Docker Compose + SQLite volume，监听宿主机 8026 端口。

### Next.js 版（`nextjs/`）的优点

- **前端生态与组件模型**：React 19 + App Router，交互组件（投票面板、赔率对比、管理后台）以客户端组件表达，前端同学上手成本低。
- **类型贯穿全栈**：TypeScript 从 DB 查询层（better-sqlite3 同步 API）到页面组件端到端覆盖。
- **静态资源可上 CDN**：支持 `ASSET_PREFIX` 把 `/_next/static` 托管到 Cloudflare Pages，公网带宽差的家用机也能快。
- **久经实战**：作为初版承载了真实玩法迭代，行为是后续重写的对照基准。

### Rails 8 版（`rails/`）的优点

- **Hotwire 是核心体验**：跨用户**实时更新**全程由 Turbo + Stimulus 驱动——任何人投票后，其他人打开的首页卡片、赔率条、投票名单约 1 秒内经 Turbo Stream 广播自动刷新，**无需手动刷新页面**；页面间导航走 Turbo Drive（进度条融入页头），局部交互用 Turbo Frame + Stimulus 控制器，几乎不写自定义前端胶水代码。
- **零 Node 构建**：importmap-rails + Propshaft + tailwindcss-rails（standalone 二进制），没有 node_modules、没有打包器，构建快、依赖面小。
- **Solid Stack 去 Redis 化**：Solid Queue（后台/定时任务）、Solid Cache、Solid Cable（WebSocket）全部落在 SQLite 上，开发与生产同构，单容器即全栈。
- **现代单体的运维简单性**：Thruster 直接服务预编译资源，发布就是 `make publish`（rebuild + restart）；迁移随容器启动自动执行。
- **测试与安全基线**：RSpec 测试金字塔（资金安全 P0 用例优先）+ RuboCop + Brakeman 静态扫描。

## 快速开始

两版各自的本地开发、Docker 部署、Twitter OAuth 配置、Tailscale 内网访问与运维细节，见各自目录下的 README：

- Next.js 版：[`nextjs/README.md`](nextjs/README.md)
- Rails 版：[`rails/README.md`](rails/README.md)（含从零搭建 Ruby 环境的完整步骤、旧版数据迁移与故障排查）
