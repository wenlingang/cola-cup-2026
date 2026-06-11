# 把静态资源放到 Cloudflare Pages（CDN offload）

把 `next build` 产出的 `_next/static/*`（带哈希、不可变的 JS/CSS/字体）部署到 **Cloudflare Pages**，
浏览器通过 Pages 的全球 CDN 加载，减轻家里机器负载、加速访问。app 本体（SSR + SQLite）仍跑在本机。

> 为什么用 Pages 而不是 R2：Pages 专为托管网页静态资源设计，自带 CDN、免费、不限流量；
> R2 是对象存储（适合大文件/媒体），当 CDN 用还要额外挂域名+缓存规则。
>
> JS/CSS 压缩由 `next build` 自动完成（SWC minify + CSS 压缩），CDN 再叠加 brotli/gzip，无需额外配置。

## 一、装 wrangler 并登录（一次性）

```bash
npm i -g wrangler        # 或后面都用 npx wrangler
wrangler login           # 浏览器 OAuth 授权你的 Cloudflare 账号
```

> 无头/CI 环境改用 API Token：在 Cloudflare → My Profile → API Tokens 建一个含
> "Cloudflare Pages: Edit" 权限的 token，然后 `export CLOUDFLARE_API_TOKEN=...`。

## 二、确定项目名 → 得到 URL

Pages 项目名决定访问域名，规则固定：项目 `cup-assets` → `https://cup-assets.pages.dev`。
所以**先定项目名就知道 URL**，不存在先有鸡还是先有蛋。Makefile 顶部已默认：

```make
ASSET_PROJECT = cup-assets
ASSET_PREFIX  = https://cup-assets.pages.dev
```

（想用别的名字就两处一起改。首次 `wrangler pages deploy` 会自动创建该项目。）

## 三、一键构建 + 部署

```bash
make deploy      # = next build(注入 ASSET_PREFIX) + 暂存 _next/static + wrangler pages deploy
make start       # 启动生产服务(默认 8026)
```

`make deploy` 做了三件事：
1. `ASSET_PREFIX=… next build` —— Next 把所有 `/_next/static/...` 的 URL 改写成 `https://cup-assets.pages.dev/_next/static/...`
2. 把 `.next/static` 暂存到 `.cf-assets/_next/static`，并写一个 `_headers` 文件设置
   **CORS（字体跨域必需）** + 一年强缓存
3. `wrangler pages deploy .cf-assets` 推到 Pages CDN

> **每次改代码都要 `make deploy`**：重建会生成新哈希文件名，要重新部署到 Pages（Pages 自动保留历史版本）。

## 四、docker 部署时

在 `.env` 里设 `ASSET_PREFIX=https://cup-assets.pages.dev`，镜像构建会注入；
资源同步在宿主机跑 `make deploy` 即可（容器只跑 app，静态资源走 Pages CDN）。

## 验证

打开页面 → DevTools → Network → JS/CSS/字体应从 `cup-assets.pages.dev` 加载（200，响应头有 `cf-cache-status`）。
字体若报 CORS 错 → 检查 `.cf-assets/_headers` 是否随部署上传（`make stage-assets` 会生成它）。
