# 首页赛程重设计方案 · Timeline（时间流）

> 目标：把"拥挤的网格卡片 + 一排 13 个组别 chip + 4 个状态 chip"换成 **按开赛时间从早到晚的时间流**，**一行一场比赛**，右侧紧凑展示 **Polymarket 赔率 + 群众投票分布**，筛选改用 **下拉框**。
>
> 移动端优先、信息密度适中、复用现有设计 token（不新造颜色）。
>
> 现状文件（将被替换/拆解）：
> - `src/app/page.tsx`（server，取数）
> - `src/app/components/ScheduleBoard.tsx`（client，状态/组别 chip 筛选 + 网格）→ **删除**
> - `src/app/components/MatchCard.tsx`（竖向网格卡片）→ **被 MatchRow 取代**
>
> 复用的现有 API / 工具（不重写）：
> - 类型：`MatchRow` / `OddsRow`（`src/db/queries/matches.ts`）、`VoteTally`（`src/db/queries/votes.ts`）
> - 取数：`getAllMatches()`（已 `ORDER BY m.kickoff_at, m.id`）、`getLatestPolymarketOdds()`、`getAllTallies()`
> - 状态机：`deriveStatus()` / `MatchStatus` / `STATUS_META`（`src/lib/matchState.ts`）
> - 文案：`stageLabel()` / `allowsDraw()`（`src/lib/stage.ts`）、`formatKickoff()` / `formatCountdown()`（`src/lib/format.ts`）
> - 视觉：`StatusBadge` / `statusBarColor()`（`src/app/components/StatusBadge.tsx`）
> - CSS：`.tabular`（等宽数字）、`.live-dot`（呼吸点）、`font-display`（Anton）、`font-mono`、`rounded-card` / `rounded-pill`

---

## 1. 整体布局概念：日期分段的时间流

把 104 场比赛按 `kickoff_at` 升序拍平成一条竖向时间线，**按"自然日"分段**（`6月11日 周四`）。每个日期是一个 **sticky 粘性日期头（DateGroup header）**，下面是当天若干 **MatchRow（一行一场）**。

分段键 = `Intl.DateTimeFormat("zh-CN", { timeZone, year/month/day })` 生成的 `YYYY-MM-DD`，避免跨时区错位（沿用 `src/lib/format.ts` 的 zh-CN 习惯）。

锚点（详见 §4）：
- **今天**：日期头高亮 + 文案"今天"。
- **最近一场可投票**：默认滚动定位/高亮（"即将开赛"锚点）。
- **已结束的日期**：默认折叠或降饱和度，时间流主体聚焦"现在→未来"。

### 桌面 ASCII 草图（≥1024px，主内容宽 max-1200，居中）

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HERO（保留现有 .bubbles 头图，不动）                                        │
└──────────────────────────────────────────────────────────────────────────┘

┌─ ScheduleFilters（一行，右对齐下拉） ─────────────────────────────────────┐
│  103 场赛程        [ 状态：全部 ▾ ]   [ 阶段/小组：全部 ▾ ]   [ ⟳ 仅可投票 ]│
└──────────────────────────────────────────────────────────────────────────┘

  ● 6月11日 周四 · 今天                              ← DateGroup sticky header
 ┌──────────────────────────────────────────────────────────────────────────┐
 │▎18:00  小组赛 A   🇲🇽 墨西哥        VS        🇨🇦 加拿大   │ 市场 52/27/21 │ →│
 │ 可投票 · 2小时后                                          │ 群众 ▆▃▁ 64% 主 │  │
 ├──────────────────────────────────────────────────────────────────────────┤
 │▎21:00  小组赛 A   🇪🇨 厄瓜多尔      VS        🏳️ 待定     │ 市场 — / — / — │ →│
 │ 未开放 · 6月11日 21:00                                    │ 群众 暂无投票    │  │
 └──────────────────────────────────────────────────────────────────────────┘
   ▎= statusBarColor 左侧 1.5px 状态色条（沿用 MatchCard 的 statusBarColor）

  ○ 6月12日 周五                                    ← 普通日期头
 ┌──────────────────────────────────────────────────────────────────────────┐
 │▎18:00  小组赛 B   🇺🇸 美国          2–1        🏴 英格兰  │ 收 60/–/40    │ →│
 │ 已结算 · 主胜                                             │ 群众 ▇▁ 71% 主 │  │
 └──────────────────────────────────────────────────────────────────────────┘
```

桌面单行三栏：**左**（时间+阶段/组别）｜**中**（两队 + VS/比分）｜**右**（赔率区 + 投票迷你条 + 状态/倒计时 + `→`）。整行是一个 `<Link>`。

### 移动端 ASCII 草图（<640px，单列，px-4）

```
┌─ ScheduleFilters（两个下拉占满宽，第二行一个 toggle） ─┐
│ [ 状态：全部           ▾ ] [ 阶段/小组：全部     ▾ ] │
│ ( ⟳ 只看可投票 )                                     │
└──────────────────────────────────────────────────────┘

 ● 6月11日 周四 · 今天        ← sticky，top 贴在 filters 下
┌────────────────────────────────────────────────────┐
│▎18:00 · 小组赛A              [可投票]                │  ← 第一行：元信息
│ 🇲🇽 墨西哥        VS        🇨🇦 加拿大               │  ← 第二行：对阵（中央对齐）
│ 市场 52% 主   ·   🥤 64% 主 领先   ·   2小时后        │  ← 第三行：赔率精简 + 倒计时
└────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────┐
│▎21:00 · 小组赛A              [未开放]                │
│ 🇪🇨 厄瓜多尔      VS        🏳️ 待定                 │
│ 暂无盘口            ·            6月11日 21:00         │
└────────────────────────────────────────────────────┘
```

移动端**单行退化为三小行的紧凑卡片**（仍是"一行一场"的逻辑单位，不是网格）：窄屏不并排塞赔率区，而是把赔率折到第三行并只显示**主胜% + 群众领先方%**（详见 §6）。

---

## 2. 单行（MatchRow）信息架构

桌面用 CSS Grid 定义三栏，列宽固定让数字列对齐（`tabular`）：

```
grid grid-cols-[auto_1fr_auto] items-center gap-3
  └ 列1: 时间/阶段（auto，约 w-[7.5rem]）
  └ 列2: 对阵（1fr，可压缩，min-w-0 + truncate）
  └ 列3: 赔率/投票/状态（auto，约 w-[14rem]）
```

### 桌面单行 ASCII（标注 token 类名）

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│▎ 18:00            🇲🇽 墨西哥        VS       🇨🇦 加拿大    │ ⚽52 27 21  [可投票] →│
│  小组赛 A         (font-display)         (font-display)   │ 🥤▆▃▁ 64%主  2小时后   │
└───────────────────────────────────────────────────────────────────────────────────┘
 ▎ statusBarColor(status)          tabular text-market     tabular   StatusBadge
   绝对定位左条 1.5px               win/draw/loss 比分用 amber          text-text-mid 倒计时
```

逐区类名思路（左→右）：

| 区 | 内容 | 关键类名 |
|---|---|---|
| 状态色条 | `▎` 1.5px | `absolute inset-y-0 left-0 w-[3px]` + `statusBarColor(status)` |
| 时间 | `18:00` | `font-mono tabular text-sm text-text-hi`（只 HH:mm，日期已在 DateGroup 头） |
| 阶段/组别 | `小组赛 A` | `text-xs text-text-mid`；阶段用 `stageLabel(stage)`，组别 `match.group_name`（淘汰赛无组则只显示阶段） |
| 主队 | 旗 + 中文名 | `flex items-center gap-2 min-w-0`；旗 `text-xl`；名 `font-display tracking-wide truncate` |
| 中央 | `VS` / 比分 | 未结算 `text-text-low text-sm VS`；已结算 `font-display tabular text-amber`，比分如 `2–1` |
| 客队 | 中文名 + 旗 | `flex-row-reverse text-right`（沿用 MatchCard 的 `TeamLine` align 思路） |
| 赔率（市场） | `⚽ 52/27/21` | `tabular text-market`；`p_home/p_draw/p_away`，`allowsDraw(stage)` 为 false 时隐藏平 `p_draw` |
| 投票（群众） | 迷你分布条 + 领先% | 见下方 CrowdMiniBar |
| 状态徽章 | `[可投票]` | 直接复用 `<StatusBadge status={status} />` |
| 倒计时/时间 | `2小时后` | `open`/`upcoming` 用 `formatCountdown(kickoff,now)`；否则 `formatKickoff` 或 `STATUS_META[status].label` |
| 进入详情 | `→` | 整行 `<Link href={\`/match/${id}\`}>`；`group-hover:translate-x-0.5` 微动效 |

**CrowdMiniBar（新增小组件，群众投票分布迷你条）**——复用 `OddsCompare` 的 `Bar` 思路但更小：

```
🥤 [▆▆▆▃▃▁] 64% 主   ← 三段堆叠条（home/draw/away 占比），text-crowd 主色，宽 w-16 h-1.5
```

类名：外层 `flex h-1.5 w-16 overflow-hidden rounded-pill bg-bg-elevated`，内部三段 `bg-crowd`（主）/ `bg-draw`（平）/ `bg-text-low`（客）按 `tally.home/draw/away ÷ total` 给 `style={{width}}`。右侧文字 `tabular text-crowd`：`{crowdHome}% 主`。`tally.total === 0` 时显示 `text-text-low 暂无投票`。

> 取值与现有 MatchCard 一致：`crowdHome = total>0 ? round(home/total*100) : null`。

### 移动端单行 ASCII（哪些隐藏/折叠）

```
┌──────────────────────────────────────────────┐
│▎18:00 · 小组赛A                    [可投票]   │  行1: 时间·阶段组别 + StatusBadge（text-xs）
│  🇲🇽 墨西哥        VS        🇨🇦 加拿大        │  行2: 对阵，flex justify-between
│  ⚽52%主 · 🥤64%主 · 2小时后                  │  行3: 精简赔率（hidden sm:flex 的反向）
└──────────────────────────────────────────────┘
```

移动端隐藏/折叠规则（用 Tailwind 响应式前缀，纯 CSS，无 JS）：
- **平局%、客胜%**：`hidden sm:inline` —— 窄屏只保留**主胜%**。
- **三项市场赔率 `52/27/21`** → 窄屏退化为单值 `⚽52%主`（`<span class="sm:hidden">` 精简版 + `<span class="hidden sm:inline">` 完整版）。
- **群众迷你条** `CrowdMiniBar`：窄屏 `hidden sm:flex`，只留文字 `🥤64%主`。
- **决赛日的 venue** 等次要信息：窄屏始终不显示（本来就没放进 row）。
- 行内布局：桌面 `grid grid-cols-[auto_1fr_auto]`，窄屏 `flex flex-col gap-1`（即 `sm:grid sm:grid-cols-... flex flex-col`）。

---

## 3. 筛选改成下拉框

**推荐：原生 `<select>`（移动端友好、零依赖、可访问性好）**，外面套统一样式壳子做成"汽水风"。理由：

- 移动端原生 `<select>` 会唤起系统滚轮选择器，体验远好于自定义下拉的滚动列表；
- 零额外依赖（项目没装 headless UI），SSR 友好，键盘/读屏天然可用；
- 选项数量可控（状态 4 项、阶段/小组 ~20 项），不需要搜索/多选，自定义下拉收益低。

> 自定义 dropdown 仅在未来要加"分组标题 + 多选 + 搜索"时再上（如用 Radix/Headless）。本次不引入。

**下拉数量：2 个 select + 1 个快捷 toggle**（默认值均为"全部"，即不过滤）：

1. **状态 select**（沿用 `ScheduleBoard` 的 `StatusFilter` 语义）
   - `全部` / `可投票`(open) / `未开放`(scheduled+upcoming) / `已结束`(locked+settled)
   - 默认 `全部`。
2. **阶段/小组 select**（合并原来的"组别 chip"+ 阶段，做成**带 optgroup 的单选**）
   ```
   全部
   ── 小组赛 ──        ← <optgroup label="小组赛">
      Group A … Group L
   ── 淘汰赛 ──        ← <optgroup label="淘汰赛">
      32强 / 16强 / 8强 / 半决赛 / 季军赛 / 决赛
   ```
   值约定：`all` / `group:A` … `group:L` / `stage:r16` …。默认 `全部`。用 `<optgroup>` 一个下拉解决"12 组 + 7 阶段"，比铺开 chip 干净得多。
3. **快捷 toggle "⟳ 只看可投票"**（可选）：等价于把状态 select 设为 `可投票`，给高频意图一个一键入口；`open` 数为 0 时禁用。

**select 样式壳子（汽水风，复用 token）**：

```tsx
<label className="relative inline-flex items-center">
  <select
    className="appearance-none rounded-pill border border-border bg-bg-surface
               py-1.5 pl-3 pr-8 text-sm text-text-hi
               hover:border-border-hi focus:border-amber focus:outline-none
               focus:ring-1 focus:ring-amber/40 transition" >
    …
  </select>
  <span className="pointer-events-none absolute right-3 text-text-mid">▾</span>
</label>
```

非默认值时给个"激活态"：`data-active` 或条件类 `border-amber text-amber`，并在 filters 行尾显示"清除筛选"链接（`text-text-low hover:text-text-hi`）。

---

## 4. "今天 / 即将开赛"锚点与时间分隔

时间线主体应聚焦"现在 → 未来"，对过去/今天/未来做清晰的视觉分隔：

- **DateGroup 头三态**（`STATUS_META` 同色系，不新造色）：
  - **今天**：`● 6月11日 周四 · 今天`，圆点 `bg-amber`，文字 `text-amber font-display`，sticky。
  - **未来普通日**：`○ 6月12日 周五`，`text-text-mid`，圆点 `border border-border-hi`。
  - **已过去日**：`text-text-low`，整段默认**折叠**（`<details>` 或 client 折叠），头部显示"已结束 · N 场"。
- **"即将开赛"锚点（置顶高亮，不重排时间序）**：在 filters 与时间线之间放一个**轻量横幅**，链接到"最近一场 open 比赛"——`找出 status==='open' 且 kickoff 最小的一场`，文案 `🥤 最近可投票：墨西哥 vs 加拿大 · 2小时后`，点击 `scrollIntoView` 到对应 row。
  - 不存在 open 比赛时，退化为指向"下一场未开赛"。
  - 该横幅是唯一"打破时间序"的元素；时间线本体始终严格按 `kickoff_at` 升序，保证心智一致。
- **LIVE / 已开赛**：`locked` 且 `now >= kickoff` 的比赛，时间处用 `.live-dot`（已存在的呼吸点）+ `text-loss` 文案"进行中"，状态条用 `statusBarColor('locked')`（amber）。
- **首屏定位**：页面挂载后默认 `scrollIntoView` 到"今天"日期头（client effect，`behavior:'smooth', block:'start'`）；用户上滑可看历史。避免 104 场全部从头堆叠造成的拥挤感。

---

## 5. 组件拆分（替换 ScheduleBoard + MatchCard）

```
src/app/page.tsx                         (server) 取数 + 派生 status，组装扁平 ViewModel
└─ ScheduleTimeline.tsx                  (client) 持有 filters state + scroll 锚点；按日期分段过滤
   ├─ ScheduleFilters.tsx                (client) 2×<select> + toggle + 清除（受控，回调上抛）
   ├─ UpcomingAnchor.tsx                 (client) "最近可投票"横幅 + scrollIntoView
   ├─ DateGroup.tsx                      (presentational) sticky 日期头 + children(rows)
   │  └─ MatchRow.tsx                    (presentational) 一行一场（替代 MatchCard）
   │     └─ CrowdMiniBar.tsx             (presentational) 群众投票迷你分布条
   └─ StatusBadge.tsx                    (复用现有，不动)
```

**Server / Client 划分**：

- **`page.tsx`（server，`export const dynamic = "force-dynamic"`，保持现状）**：
  - 调 `getAllMatches()`（已按 kickoff 排序）、`getLatestPolymarketOdds()`、`getAllTallies()`；
  - `now = Date.now()`；对每场 `deriveStatus(...)`；
  - **关键：在 server 端就计算好可序列化的扁平 ViewModel 数组**，不要再像现在这样把 `<MatchCard>` JSX 当 prop 传给 client（`ScheduleBoard` 现状的反模式）。形如：
    ```ts
    type RowVM = {
      id: number; kickoffAt: number; dateKey: string; // "2026-06-11"
      stage: string; stageLabel: string; group: string | null;
      status: MatchStatus;
      home: { name: string; flag: string | null };
      away: { name: string; flag: string | null };
      settled: boolean; homeScore: number | null; awayScore: number | null;
      market: { home: number|null; draw: number|null; away: number|null; allowsDraw: boolean } | null;
      crowd: { home: number; draw: number; away: number; total: number };
    };
    ```
    把 `RowVM[]` 传给 `<ScheduleTimeline rows={rows} now={now} />`。
- **`ScheduleTimeline`（client）**：持 `statusFilter` + `stageOrGroup` 两个 state（迁移自 `ScheduleBoard`）；`UpcomingAnchor` 的 scroll；首屏滚到"今天"。
- **`ScheduleFilters`（client）**：纯受控 UI，state 提到 Timeline，回调上抛（保持单一数据源）。
- **`DateGroup` / `MatchRow` / `CrowdMiniBar`（presentational）**：无状态，可被 client 父级直接渲染（不需各自 `"use client"`）。
- **`page.tsx` 内联格式化**：`stageLabel/allowsDraw/formatKickoff/formatCountdown` 既可在 server 算好放进 VM，也可在 presentational 里调（纯函数，两端都安全）。倒计时建议放在 client 侧轻量 `setInterval`（仅"今天/即将"的几场），避免 SSR 时间漂移。

**客户端筛选如何"不重新请求"地按日期流过滤**（核心）：

- server 一次性把全部 `RowVM[]` 注水到 client，**筛选只是内存数组的 `filter` + 重新分组**，零网络往返（与现状 `ScheduleBoard` 行为一致，只是数据从 JSX 换成 plain object）。
- 在 `ScheduleTimeline` 内用 `useMemo` 派生：
  ```ts
  const visible = useMemo(
    () => rows.filter(r =>
      matchesStatus(r.status, statusFilter) &&
      matchesStageOrGroup(r, stageOrGroup)),       // "all" | "group:A" | "stage:r16"
    [rows, statusFilter, stageOrGroup]
  );
  const byDate = useMemo(() => groupBy(visible, r => r.dateKey), [visible]);
  ```
  `matchesStatus` 直接搬现有 `ScheduleBoard` 的同名函数；`groupBy` 保持 kickoff 升序（输入已有序，`Map` 插入序即时间序）。
- 渲染：`[...byDate].map(([dateKey, rows]) => <DateGroup ...>{rows.map(r => <MatchRow .../>)}</DateGroup>)`。
- 空态：复用现有文案 `没有符合条件的比赛`（`py-12 text-center text-sm text-text-low`）。

---

## 6. 响应式退化策略

断点沿用 Tailwind 默认（`sm:640` / `lg:1024`），移动端优先（base = 窄屏样式，`sm:`/`lg:` 渐进增强）。

| 元素 | <640px（base） | ≥640px（sm） | ≥1024px（lg） |
|---|---|---|---|
| MatchRow 容器 | `flex flex-col gap-1`（三小行） | `grid grid-cols-[auto_1fr_auto]` 三栏一行 | 同 sm，列更宽 `gap-4` |
| 市场赔率 | 仅主胜 `⚽52%主`（`sm:hidden` 精简版） | 三项 `52/27/21`（`hidden sm:inline`） | 三项 + `tabular` 对齐 |
| 群众投票 | 仅文字 `🥤64%主`，迷你条 `hidden sm:flex` | 迷你条 `CrowdMiniBar` + % | 同 sm |
| 状态 | `StatusBadge`（行1 右侧） | `StatusBadge`（右栏） | 同 |
| 倒计时 | 行3 末尾 | 右栏底部 `text-text-mid` | 同 |
| 时间 | 行1 `HH:mm`（日期在头） | 左栏 `HH:mm` + 阶段组别 | 同 |
| DateGroup 头 | sticky `top-[filtersH]`，`text-sm` | sticky `text-base` | sticky `text-lg` |

赔率区窄屏退化的两条硬规则：
1. **赔率区不与对阵抢同一行**——窄屏移到第二/第三行（`flex flex-col`），从根上消除"挤"。
2. 窄屏只暴露**两个最高信息量字段**：`市场主胜%` 与 `群众领先方%`，其余（平/客、迷你条、decimal odds）`hidden sm:*`，点进 `/match/[id]` 看 `OddsCompare` 全量。

落地校验清单：
- [ ] 一行一场，时间升序，按自然日分段，sticky 日期头
- [ ] 右侧 = Polymarket 三项 + 群众迷你条（窄屏退化为主胜%+领先方%）
- [ ] 状态/组别·阶段 = 2 个原生 `<select>`（optgroup 合并 12 组 + 7 阶段）+ 可投票快捷 toggle
- [ ] "今天"高亮 + "最近可投票"锚点横幅 + 首屏滚到今天
- [ ] server 输出可序列化 `RowVM[]`（不再传 JSX prop）；client 仅内存 filter，无重新请求
- [ ] 全部复用现有 token / `StatusBadge` / `statusBarColor` / `.tabular` / `.live-dot`，不新造颜色
