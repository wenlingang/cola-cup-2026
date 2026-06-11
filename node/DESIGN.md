# 🥤 Cup — 2026 世界杯竞猜平台 · 设计系统 (DESIGN SYSTEM)

> 内部小工具 · 同事用可口可乐瓶数做赌注 · 数据源：Polymarket 赔率 + 群众投票
> 技术栈：Next.js 16 (App Router) + React 19
> 设计原则：**移动端优先 · 深色为主 · 好看有个性 · 落地性强**

---

## 1. 设计概念 / 视觉个性

### 一句话定位

> **「深夜记分牌 × 汽水波普」(Midnight Scoreboard meets Soda Pop)**
> 一块挂在午夜球场看台上、被霓虹汽水灯映红的复古翻牌记分牌。

### 为什么是这个方向

- **记分牌 (Scoreboard)** 给了它"竞猜/比分/数字"的天然骨架。竞猜平台本质是在不断刷新数字（赔率、瓶数、净值），记分牌是大家对"数字在跳动"最有共鸣的视觉母题。配合**等宽 tabular 数字 + 翻牌动效**，每次赔率变化都有"咔哒"的仪式感。
- **深色午夜场 (Midnight)** 符合体育竞猜的夜间消费场景（晚上看球、下注），深色背景让红/绿/金的强调色"发光"，对比度更强、更有赌场霓虹的高级感，也最省眼睛。
- **汽水波普 (Soda Pop)** 是这个 app 的"记忆点"与"反严肃"声明——赌注是可口可乐而不是真钱。可口可乐标志性红、汽水气泡、瓶盖齿纹，把一个看起来像金融终端的东西，变成同事之间"赌一瓶可乐"的快乐玩具。

### 气质关键词

`复古运动` · `霓虹深色` · `汽水气泡` · `大字报数字` · `轻竞技不严肃`

避免的反面：冷冰冰的券商终端、灰扑扑的企业后台、过度拟物的赌场金币雨。我们要的是「克制的深色 + 一两个让人会心一笑的汽水细节」。

---

## 2. 配色方案 (Color Tokens)

深色为主。强调色取自**可口可乐红**（品牌记忆）+ **球场绿**（世界杯）+ **记分牌金/琥珀**（复古点睛）。胜平负与涨跌色刻意区分语义，避免"满屏红绿股票焦虑"——参考 2026 竞猜趋势，涨跌色**降饱和度**使用。

```css
:root {
  /* ── 背景层级 (深色为主，三级纵深) ── */
  --color-bg-base:      #0B0F0C;  /* 最底层 · 近黑带一丝球场绿调 */
  --color-bg-surface:   #121A14;  /* 卡片 / 面板背景 */
  --color-bg-elevated:  #1B271E;  /* 悬浮卡片 / 弹窗 / hover */
  --color-bg-pitch:     #0E1A10;  /* 球场绿专用底（带球场线纹理时用） */

  /* ── 品牌主色：可口可乐红 ── */
  --color-coke-red:     #F40009;  /* 主强调 · CTA · 下注按钮 · 品牌 */
  --color-coke-red-700: #C20007;  /* 按下 / 深一档 */
  --color-coke-red-300: #FF5A5F;  /* 浅红 · 文字高亮 / 渐变上端 */

  /* ── 球场绿 (World Cup pitch) ── */
  --color-pitch-green:  #1FA75A;  /* 次强调 · 进度条 / "赢"语义可借用 */
  --color-pitch-line:   #2E7D49;  /* 球场白线降饱和的绿 / 分隔线 */

  /* ── 记分牌金 / 琥珀 (复古点睛) ── */
  --color-amber:        #FFB200;  /* 高亮数字 / 排名第一 / 徽章描边 */
  --color-amber-soft:   #FFD466;  /* 金色文字在深底上的柔和版 */

  /* ── 文字 ── */
  --color-text-hi:      #F4F7F2;  /* 主文字 (近白带暖) · 对比 bg-surface ≈ 15:1 */
  --color-text-mid:     #A8B4AB;  /* 次要文字 / 标签 · 对比 bg-surface ≈ 6.5:1 */
  --color-text-low:     #6B7A6F;  /* 占位 / 禁用 · 对比 bg-surface ≈ 3.2:1 (仅装饰) */
  --color-text-on-red:  #FFFFFF;  /* 红底白字 · 对比 ≈ 4.9:1 (AA 通过) */

  /* ── 胜 / 平 / 负 三态 (语义独立，非纯红绿) ── */
  --color-win:          #2BD576;  /* 胜 · 亮球场绿 */
  --color-draw:         #FFB200;  /* 平 · 记分牌金（中性，避免与胜负撞色） */
  --color-loss:         #FF4D57;  /* 负 · 偏珊瑚的红（与可乐红区分，更"柔"） */

  /* ── 涨 / 跌 (赔率变动，降饱和、克制) ── */
  --color-up:           #4FB477;  /* 赔率/概率上行 · 雾化绿 */
  --color-down:         #D96A6F;  /* 下行 · 雾化红 */
  --color-flat:         #7A8A7E;  /* 持平 · 灰绿 */

  /* ── 数据可视化双源对比 (核心特色) ── */
  --color-market:       #4DA3FF;  /* Polymarket 市场赔率 · 冷蓝（理性/外部） */
  --color-crowd:        #F40009;  /* 群众投票赔率 · 可乐红（我们自己/热血） */

  /* ── 边框 / 描边 / 玻璃 ── */
  --color-border:       #243029;  /* 卡片描边 · 极低对比 */
  --color-border-hi:    #3A4D3F;  /* hover / 选中描边 */
  --color-glass:        rgba(255,255,255,0.04); /* 毛玻璃叠层 */

  /* ── 阴影 / 发光 ── */
  --shadow-card:        0 4px 24px rgba(0,0,0,0.45);
  --shadow-glow-red:    0 0 24px rgba(244,0,9,0.35);   /* 下注按钮发光 */
  --shadow-glow-amber:  0 0 20px rgba(255,178,0,0.30); /* 榜首发光 */
}
```

### 对比度自检 (WCAG)

| 组合 | 用途 | 对比比 | 结论 |
|---|---|---|---|
| `--color-text-hi` on `--color-bg-surface` | 正文 | ~15:1 | AAA |
| `--color-text-mid` on `--color-bg-surface` | 次要文字 | ~6.5:1 | AA |
| `--color-text-on-red` on `--color-coke-red` | 按钮文字 | ~4.9:1 | AA (≥18px / 粗体更稳) |
| `--color-amber` on `--color-bg-base` | 数字高亮 | ~9:1 | AAA |
| `--color-win` on `--color-bg-surface` | 胜态文字 | ~8:1 | AAA |

> 关键约束：**红底按钮文字必须用纯白且 ≥16px 半粗**，可乐红做大面积小字会掉到 AA 以下。

### 浅色模式（可选，二等公民）

深色为主，但留一套 token 翻转。浅色下背景用**汽水奶白 `#FBF7F0`**（不要纯白，带复古纸感），主色仍是可乐红。通过 `[data-theme="light"]` 覆盖上面的变量即可，组件不需改。

---

## 3. 字体 (Typography)

三层分工：**标题 = 大字报记分牌感** / **数字 = 等宽 tabular** / **正文 = 易读中性**。全部 Google Fonts，用 `next/font/google` 自托管（零 CLS、不打外部请求）。

| 角色 | 字体 | 理由 |
|---|---|---|
| 展示标题 / 比分 / Hero | **Anton** (或 Bebas Neue) | 极致压缩的大写无衬线，记分牌/球衣号码的灵魂，气场拉满 |
| 数字 / 赔率 / 瓶数 | **Spline Sans Mono** (或 JetBrains Mono) | 等宽 + tabular，赔率跳动时数字不抖位，翻牌动效靠它 |
| 正文 / UI / 标签 | **Inter** | 中性高可读，UI 行业标准，中英文混排稳 |
| 装饰点缀 (可选) | **Pacifico** | 仅用于品牌 logo "Cup" 字样，致敬可口可乐 Spencerian 手写体的"汽水感"，**严禁用于正文** |

### `next/font` 集成 (App Router · `app/layout.tsx`)

```tsx
import { Anton, Inter, Spline_Sans_Mono, Pacifico } from "next/font/google";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const mono = Spline_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
const pacifico = Pacifico({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-brand",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh"
      data-theme="dark"
      className={`${anton.variable} ${inter.variable} ${mono.variable} ${pacifico.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
```

### 排版 token

```css
:root {
  --font-display: var(--font-display), "Arial Narrow", sans-serif;
  --font-body:    var(--font-body), system-ui, sans-serif;
  --font-mono:    var(--font-mono), ui-monospace, monospace;
  --font-brand:   var(--font-brand), cursive;
}
/* 数字一律开启等宽对齐，赔率/瓶数跳动不位移 */
.tabular { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
```

字号阶梯（移动端 → 桌面用 `clamp`）：

```css
--text-hero:  clamp(2.5rem, 8vw, 4.5rem);  /* Anton 比分 */
--text-h1:    clamp(1.5rem, 5vw, 2.25rem);
--text-h2:    1.25rem;
--text-body:  1rem;     /* 16px 起步，移动端不缩小 */
--text-sm:    0.8125rem;
--text-num:   clamp(1.75rem, 6vw, 2.75rem); /* mono 赔率大数字 */
```

---

## 4. 核心组件视觉规范

> 草图用 ASCII。移动端基准宽度 `375px`，桌面 `≥1024px`。

### 4.1 MatchCard — 赛程卡片

两队对阵、时间、状态徽章、小组/淘汰赛标识。整卡像一小块记分牌：深色面板 + 顶部一条极细的金色/绿色"状态色条"。

**状态徽章规则**
- `未开始` → 灰绿描边 `--color-text-mid` + 倒计时
- `进行中` → 可乐红 `LIVE` + 呼吸点动画
- `已结束` → 金色 `FT` (Full Time)
- 锁盘后 → 锁图标 🔒（停止投票）

**移动端 (竖向卡片，整宽)**

```
┌──────────────────────────────────────┐  ← 顶部 2px 状态色条 (金/红/绿)
│  🅰️ 小组赛 · A组          🔴 LIVE 67' │  ← 标签(mid) + 状态徽章(右上)
│                                        │
│   🇧🇷  BRA            2 ─ 1      ARG 🇦🇷│  ← 旗+缩写 / Anton 比分 / 旗
│   巴西                          阿根廷  │
│                                        │
│  ⚽ Polymarket: BRA 58%   📊 群众: 71% │  ← 双源一行预览(蓝/红)
│  ───────────────────────────────────  │
│            [  立即投票 →  ]            │  ← 红色 CTA，整宽
└──────────────────────────────────────┘
```

**桌面端 (横向紧凑，网格 2~3 列)**

```
┌────────────────────────────────────────────────────────────┐
│ ▎🅰️ A组 · 6/14 02:00        🇧🇷 BRA  2 ─ 1  ARG 🇦🇷    FT 金 │
│ ▎(左侧 3px 状态色条)         ───────────────                  │
│ ▎ Poly 58% │ 群众 71%        差值 +13% ↑              [投票] │
└────────────────────────────────────────────────────────────┘
```

要点：比分用 `--font-display`（Anton），两队缩写大写。淘汰赛卡片右上角加 `🏆 1/8 决赛` 标签，色条换金色。

---

### 4.2 OddsCompare — 赔率对比（★ 核心特色）

**并列展示 Polymarket 市场赔率 vs 群众投票赔率**，对比一目了然。核心手法：**同一根水平双色条 + 大数字百分比 + 差值徽章**。Polymarket = 冷蓝 `--color-market`，群众 = 可乐红 `--color-crowd`。

**移动端 (上下堆叠，强调差值)**

```
┌──────────────────────────────────────┐
│  谁会赢？ BRA vs ARG                    │
│                                        │
│  ⚽ POLYMARKET 市场                     │
│   BRA ████████████░░░░░░  58%  (蓝)    │  ← mono 大数字右对齐
│   ARG ████████░░░░░░░░░░  42%          │
│                                        │
│  🥤 群众投票  (本群 38 人)              │
│   BRA ██████████████░░░░  71%  (红)    │
│   ARG ██████░░░░░░░░░░░░  29%          │
│                                        │
│  ┌────────────────────────────────┐   │
│  │ 群众比市场更看好 BRA  ▲ +13%    │   │  ← 差值徽章(金底/up色)
│  └────────────────────────────────┘   │
└──────────────────────────────────────┘
```

**桌面端 (左右镜像对照，中间放差值)**

```
┌─────────────────────────────────────────────────────────────┐
│           ⚽ POLYMARKET   │   差值   │   🥤 群众投票           │
│  ─────────────────────────┼─────────┼───────────────────────  │
│   58%  ████████████▌(蓝)  │  ▲+13%  │  (红)▕██████████████ 71%│  BRA
│   42%  ████████▌(蓝)      │  ▼−13%  │  (红)▕██████ 29%       │  ARG
│  ─────────────────────────┴─────────┴───────────────────────  │
│  数据源 6/8 14:30 锁定 · Polymarket volume $1.2M             │
└─────────────────────────────────────────────────────────────┘
```

要点：
- 条形从中线**向两侧生长**（桌面镜像），强化"对垒"感。
- 百分比数字用 `--font-mono` + `.tabular`，刷新时数字滚动过渡（200–300ms）。
- 差值徽章颜色：群众更乐观→`--color-up` 绿；更悲观→`--color-down` 红；这是整个 app 最有"洞察感"的一块，给它最大字号的差值数字。

---

### 4.3 VotePanel — 投票面板

胜/平/负（或胜/负）选择 + 下注瓶数 0.5 / 1 / 2。像可乐贩卖机：选结果 → 投瓶数 → 红色大按钮"投！"。

**移动端 (底部抽屉 / sticky，拇指可达)**

```
┌──────────────────────────────────────┐
│  你押谁赢？                            │
│  ┌────────┐ ┌────────┐ ┌────────┐    │
│  │  BRA   │ │  平局  │ │  ARG   │    │  ← 三态分段按钮
│  │  胜🟢  │ │  🟡    │ │  胜🔴  │    │     选中=填充语义色+发光
│  └────────┘ └────────┘ └────────┘    │
│                                        │
│  下注几瓶可乐？                        │
│  ( 🥤0.5 )  ( 🥤🥤1 )  ( 🥤🥤🥤2 )   │  ← 瓶数 chip，选中=可乐红填充
│                                        │
│  潜在赢得：+1.7 瓶  (按当前群众赔率)    │  ← mono 数字，实时算
│  ╔════════════════════════════════╗   │
│  ║   🥤  投！押 BRA · 1 瓶         ║   │  ← 红色发光 CTA 整宽 sticky
│  ╚════════════════════════════════╝   │
└──────────────────────────────────────┘
```

**桌面端 (右栏常驻，与 OddsCompare 并列)**

```
┌─────────────────────────┐
│  投票面板                │
│  [BRA胜] [平] [ARG胜]    │  ← 横排，选中态高对比
│  瓶数 [0.5][1][2]        │
│  潜在赢得 +1.7 瓶        │
│  [   🥤 投！   ]         │
│  已投：BRA · 1瓶 (可改)  │
└─────────────────────────┘
```

要点：选中态用对应语义色**填充 + 内发光**，未选用描边。下注按钮是全站唯一的"满可乐红 + glow"，强调它是主行为。锁盘后整个面板变灰 + 显示 🔒。

---

### 4.4 LeaderboardTable — 排行榜

参赛者 emoji 徽章 + **净可乐瓶数**。欠可乐用红、赢用绿。榜首镀金。

**移动端 (卡片化行，避免横向滚动)**

```
┌──────────────────────────────────────┐
│  🏆 可乐榜                   本周 ▾    │
├──────────────────────────────────────┤
│  ① 🦁 老王         +12.5 瓶  🟢       │  ← 榜首金色描边+glow
│  ② 🐯 小李          +8.0 瓶  🟢       │
│  ③ 🐼 阿强          +3.5 瓶  🟢       │
│  ─────────────────────────────────    │
│  ④ 🦊 Tina           0.0 瓶  ⚪       │
│  ⑤ 🐸 老张          −5.5 瓶  🔴 欠    │  ← 负数红色，加"欠"标
│  ⑥ 🐙 mark         −11.0 瓶  🔴 欠    │
└──────────────────────────────────────┘
```

**桌面端 (真表格 + 迷你趋势)**

```
┌──────┬─────────────┬──────────┬──────────┬───────────┐
│ 排名 │ 参赛者       │ 净瓶数   │ 胜率     │ 近5场趋势 │
├──────┼─────────────┼──────────┼──────────┼───────────┤
│  ① 🥇│ 🦁 老王      │ +12.5 🟢 │ 68%      │ ▁▃▅▇█     │
│  ② 🥈│ 🐯 小李      │  +8.0 🟢 │ 61%      │ ▃▅▃▇▆     │
│  ⑤   │ 🐸 老张      │  −5.5 🔴 │ 42%      │ ▇▅▃▂▁     │
└──────┴─────────────┴──────────┴──────────┴───────────┘
```

要点：净瓶数 `--font-mono` `.tabular` 右对齐；正负用 `--color-win` / `--color-loss`；榜首整行 `--shadow-glow-amber` + 金色描边；行间用极细 `--color-border` 分隔，斑马纹用 `--color-bg-elevated` 透明叠层。

---

### 4.5 IdentityBadge — 身份徽章

emoji + 昵称。像球衣号码牌 / 瓶盖。复用于榜单、投票记录、卡片署名。

```
小尺寸 (行内)        中尺寸 (头部)             选中态
┌──────────┐        ┌────────────────┐        填充可乐红
│ 🦁 老王  │        │  🦁            │        + 白字 + glow
└──────────┘        │  老王          │
 圆角胶囊            │  +12.5 瓶 🟢   │
 bg-elevated         └────────────────┘
 emoji+昵称          圆形 emoji 头像(描边)
```

要点：emoji 放在圆形"瓶盖"容器里（`border-radius:50%` + 2px 描边，描边色随净值正负变 win/loss/amber）。胶囊背景 `--color-bg-elevated`，hover 升 `--color-border-hi`。这是把"匿名同事"变得有人格、有记忆点的关键，鼓励每人选独特 emoji。

---

## 5. 响应式策略 (Responsive)

**移动端优先**：先写窄屏样式，向上 `min-width` 增强。

### 断点

```css
/* Tailwind v4 默认即满足，额外定义 3xl 备用 */
@theme {
  --breakpoint-sm:  40rem;   /* 640px  大手机/小平板 */
  --breakpoint-md:  48rem;   /* 768px  平板竖屏 */
  --breakpoint-lg:  64rem;   /* 1024px 桌面 / 平板横屏 */
  --breakpoint-xl:  80rem;   /* 1280px 宽桌面 */
}
```

| 区间 | 设备 | 布局策略 |
|---|---|---|
| `< 640px` | 手机（基准） | 单列；卡片整宽；底部 tab 导航；VotePanel 为 sticky 底部抽屉 |
| `640–1024px` | 平板 | MatchCard 2 列网格；OddsCompare 仍上下堆叠 |
| `≥ 1024px` | 桌面 | 三栏：左赛程列表 / 中 OddsCompare / 右 VotePanel 常驻；榜单切真表格 |

### 移动端导航 → **底部 Tab Bar**

竞猜是高频、单手、拇指操作的场景，底部 tab 比顶部汉堡菜单更顺手（拇指热区），也更"app 感"。

```
┌──────────────────────────────────────┐
│              (内容区)                  │
│                                        │
├──────────────────────────────────────┤
│  ⚽       🥤       🏆       👤         │  ← 固定底栏 (safe-area-inset)
│ 赛程     竞猜     排行     我的        │     选中=可乐红 + 上方 2px 指示条
└──────────────────────────────────────┘
```

- 底栏 `position: fixed; bottom: 0;` + `padding-bottom: env(safe-area-inset-bottom)`（适配 iPhone 刘海/小白条）。
- 选中态：图标染 `--color-coke-red` + 顶部 2px 金色指示条 + 轻微放大。
- 桌面端 (`≥1024px`)：底栏隐藏，改用**顶部横向导航 + logo**。

### 卡片排布

```css
.match-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr;                 /* 手机单列 */
}
@media (min-width: 40rem) { .match-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 80rem) { .match-grid { grid-template-columns: repeat(3, 1fr); } }
```

内容主区 `max-width: 1200px; margin-inline: auto;`，桌面不要把记分牌拉得太宽（数字会松散）。

---

## 6. 样式技术选型

### 结论：**Tailwind CSS v4**（强烈推荐）

当前项目 `next 16.2.7` + `react 19.2.7`，**尚未安装任何样式方案**——这是采用 Tailwind v4 的最佳时机。

| 维度 | Tailwind v4 | 纯 CSS Modules |
|---|---|---|
| 设计 token 统一 | ✅ `@theme` 一处定义即生成工具类 + CSS 变量 | ⚠️ 需手写变量 + 自己约定 |
| 深色/语义色切换 | ✅ `dark:` / `data-[theme]` 变体开箱即用 | ⚠️ 手写媒体查询/选择器 |
| 响应式（移动优先） | ✅ `sm: md: lg:` 前缀即移动优先 | ⚠️ 手写 `@media` |
| 开发速度 / 一致性 | ✅ 极快，原子类强制一致 | ⚠️ 慢，易样式漂移 |
| 这个项目体量 | ✅ 小工具，快速迭代最重要 | — |

v4 相比 v3 的关键升级：**CSS-first 配置**（不再需要 `tailwind.config.js`，直接在 CSS 里 `@theme`），与上面的 token 表是天然映射，零胶水代码。

### Next.js App Router 集成要点

1. 安装：`npm i tailwindcss @tailwindcss/postcss postcss`
2. `postcss.config.mjs`：
   ```js
   export default { plugins: { "@tailwindcss/postcss": {} } };
   ```
3. `app/globals.css` 顶部 `@import "tailwindcss";`，并在 `app/layout.tsx` 引入它。
4. 深色为主：`<html data-theme="dark">`，默认 token 即深色；浅色用 `[data-theme="light"]` 覆盖。
5. 字体变量（第 3 节的 `next/font`）通过 `@theme` 接入，工具类直接可用 `font-display` / `font-mono`。

### `@theme` 配置（映射第 2、3 节 token）

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  /* —— 背景 —— */
  --color-bg-base:     #0B0F0C;
  --color-bg-surface:  #121A14;
  --color-bg-elevated: #1B271E;

  /* —— 品牌 / 强调 —— */
  --color-coke-red:    #F40009;
  --color-coke-red-700:#C20007;
  --color-pitch-green: #1FA75A;
  --color-amber:       #FFB200;

  /* —— 文字 —— */
  --color-text-hi:     #F4F7F2;
  --color-text-mid:    #A8B4AB;
  --color-text-low:    #6B7A6F;

  /* —— 胜平负 / 涨跌 —— */
  --color-win:   #2BD576;
  --color-draw:  #FFB200;
  --color-loss:  #FF4D57;
  --color-up:    #4FB477;
  --color-down:  #D96A6F;

  /* —— 双源对比 —— */
  --color-market: #4DA3FF;
  --color-crowd:  #F40009;

  /* —— 字体（接 next/font 注入的 CSS 变量）—— */
  --font-display: var(--font-display), "Arial Narrow", sans-serif;
  --font-body:    var(--font-body), system-ui, sans-serif;
  --font-mono:    var(--font-mono), ui-monospace, monospace;
  --font-brand:   var(--font-brand), cursive;

  /* —— 圆角 / 动画 —— */
  --radius-card: 1rem;
  --radius-pill: 9999px;
}

/* 全局基底（深色） */
@layer base {
  html { background: var(--color-bg-base); color: var(--color-text-hi); }
  body { font-family: var(--font-body); }
  .tabular { font-variant-numeric: tabular-nums; }
}
```

> 这样写完后，组件里直接 `className="bg-bg-surface text-text-hi font-display"`、`text-coke-red`、`bg-win`、`sm:grid-cols-2 lg:grid-cols-3` 全部可用，token 与 UI 完全对齐。

---

## 7. 个性化点缀（记忆点 · 轻量 CSS）

### 点缀 A：🫧 汽水气泡（背景活气，纯 CSS，无 JS）

下注成功 / hero 区，让小气泡从底部缓缓上升，呼应"可乐"主题。用伪元素 + `@keyframes`，几乎零成本。

```css
@theme {
  @keyframes bubble-rise {
    0%   { transform: translateY(0) scale(1);    opacity: 0; }
    10%  { opacity: 0.6; }
    100% { transform: translateY(-120px) scale(0.4); opacity: 0; }
  }
}
.bubbles span {
  position: absolute;
  bottom: -10px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #fff6, var(--color-coke-red-300));
  animation: bubble-rise 3.2s ease-in infinite;
}
.bubbles span:nth-child(2) { left: 40%; animation-delay: 0.8s; width: 5px; height: 5px; }
.bubbles span:nth-child(3) { left: 70%; animation-delay: 1.6s; width: 11px; height: 11px; }
/* 尊重无障碍 */
@media (prefers-reduced-motion: reduce) { .bubbles span { animation: none; display: none; } }
```

### 点缀 B：🔢 记分牌翻牌数字（赔率/比分变化时"咔哒"）

当赔率或比分更新，数字做一次轻量翻牌/上滚，强化"记分牌"母题与"数字在动"的仪式感。纯 CSS 过渡，配合 `--font-mono` `.tabular` 不抖位。

```css
.flip-num {
  display: inline-block;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  transition: transform 0.28s cubic-bezier(.2,.8,.2,1);
}
.flip-num.is-updating { animation: flip-tick 0.45s ease; }
@keyframes flip-tick {
  0%   { transform: translateY(0); }
  45%  { transform: translateY(-60%); opacity: 0.2; }
  55%  { transform: translateY(60%);  opacity: 0.2; }
  100% { transform: translateY(0);    opacity: 1; }
}
@media (prefers-reduced-motion: reduce) { .flip-num.is-updating { animation: none; } }
```

> React 用法：值变化时给元素加 `is-updating` 类，`onAnimationEnd` 移除。配合第 4.2 节"差值徽章"，整个赔率区会有"活的记分牌"质感。

### 补充小细节（可选，挑一个）

- **球场线纹理**：hero/榜首背景用极淡的 `repeating-linear-gradient` 画球场白线（透明度 4%），暗示绿茵场。
- **胜负色条**：每张 MatchCard 顶部/左侧 2–3px 色条随状态变色（红 LIVE / 金 FT / 绿未开始），扫一眼即知状态。
- **瓶盖描边**：IdentityBadge 的 emoji 圆形容器做齿轮状描边，像可乐瓶盖。

---

## 附：落地优先级（建议顺序）

1. 装 Tailwind v4 + 写 `@theme`（第 6 节）→ 全站 token 就位
2. `next/font` 四字体接入（第 3 节）
3. MatchCard + 底部 tab bar（移动端骨架先跑起来）
4. OddsCompare 双源对比（核心特色，重点打磨差值徽章）
5. VotePanel + LeaderboardTable
6. 最后加点缀 A/B（气泡 + 翻牌），点到为止

---

## 来源 (Research Sources)

- [Sports Betting App UX & UI in 2026 — Prometteur](https://prometteursolutions.com/blog/user-experience-and-interface-in-sports-betting-apps/)
- [The UX Playbook 2025 — Shape Games](https://www.shapegames.com/news/ux-best-practices-playbook)
- [Best UX/UI Patterns for Prediction Markets in 2026 — Avark](https://avark.agency/learn/prediction-market-design-patterns)
- [Polymarket Mobile App Design — Finextra](https://www.finextra.com/blogposting/31216/polymarket-mobile-app-design-uiux-features-that-drive-engagement-amp-trust)
- [2026 FIFA World Cup identity / new design system — Design Week](https://www.designweek.co.uk/issues/22-may-26-may-2023/2026-fifa-world-cup-identity/)
- [Coca-Cola Brand Colors — US Brand Colors](https://usbrandcolors.com/coca-cola-colors/)
- [29 Best Free Scoreboard Fonts — FontAdvice](https://fontadvice.com/font-collections/scoreboard-fonts/)
- [35 Sports Fonts That Score Big in 2026 — Design Work Life](https://designworklife.com/35-sports-fonts-that-score-big-in-year/)
- [Tailwind CSS v4 — Theme variables docs](https://tailwindcss.com/docs/theme)
