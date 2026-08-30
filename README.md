# 真假维斯

`真假维斯` 是一个由 Hugo 生成、通过 GitHub Actions 自动发布到 GitHub
Pages 的个人博客：<https://groklab.github.io/>。

项目没有 `npm`、其他 JS 包管理器或第三方前端依赖。唯一的浏览器脚本是本地、
无依赖的明暗主题开关；文章使用 Markdown，数学公式在构建时转成 MathML，图片在
构建时生成响应式 WebP 版本。中文正文使用自托管的霞鹜文楷 GB，拉丁文字使用
Newsreader，数学使用 STIX Two Math。字体来源与许可见
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## 准备环境

安装 [Hugo Extended 0.165.0](https://github.com/gohugoio/hugo/releases/tag/v0.165.0)、
Python 3 和 Node.js 20 或更高版本，然后确认：

```sh
hugo version
python3 --version
node --version
```

Hugo 输出应包含 `v0.165.0` 和 `extended`。Node 只运行 Worker 的内置测试；项目
没有 `package.json`，也无需运行 `npm install` 或安装任何包。

## 写一篇新文章

文章必须是 page bundle，目录名使用小写英文、数字和连字符：

```sh
hugo new content posts/my-new-note/index.md
```

这个命令会创建：

```text
content/posts/my-new-note/
└── index.md
```

编辑 `index.md` 的标题和正文；发布前把 `draft` 改成 `false`。`date` 必须保留
带 UTC offset 的 ISO 8601 时间，例如：

```yaml
---
title: "一篇新文章"
date: 2026-08-30T09:00:00-05:00
draft: false
slug: "my-new-note"
---
```

`slug` 一旦发布就不要修改，否则文章网址会变化。首页和文章归档按 `date` 从新
到旧排列。

## 图片

把图片和 `index.md` 放在同一目录，并写清楚替代文字：

```text
content/posts/my-new-note/
├── index.md
└── lake.jpg
```

```md
![湖面与远山](lake.jpg "清晨的湖")
```

替代文字不能为空；缺失的本地图片会使检查失败。首版只接受放在文章 bundle 内、
可由 Hugo 处理的位图；常用 PNG、JPEG 和 WebP 均可，外链图片与 SVG 会被拒绝。
Hugo 会生成响应式 WebP，并保留原格式 fallback。图片标题可选，填写后会显示为
图注。

## 数学公式

行内公式：

```md
欧拉恒等式是 \(e^{i\pi}+1=0\)。
```

独立公式：

```md
\[
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
\]
```

公式在构建时转换成 MathML，不会在浏览器里加载数学 JavaScript 或 CDN。

## 本地预览

预览包括草稿在内的内容：

```sh
hugo server --buildDrafts --disableFastRender
```

打开 <http://localhost:1313/>。停止预览时在终端按 `Ctrl-C`。

## 发布前检查

依次运行：

```sh
python3 scripts/check_content.py
python3 scripts/check_visitor_map_integration.py
node --test visitor-map/test/*.test.mjs
python3 visitor-map/tools/check_sqlite.py
hugo --cleanDestinationDir --gc --minify --panicOnWarning
python3 scripts/check_site.py public
```

第一条检查文章元数据、路径和图片，并用临时文章真实构建 MathML 与响应式图片；
第二条用临时配置分别构建“地图关闭”和“地图启用”产物，并验证错误配置会失败；
接下来两条检查匿名聚合地图的隐私契约、接口、SVG、保留期和真实 SQLite SQL
语义；Hugo 命令生成生产站点，也会拒绝实际文章里的非法公式；最后一条检查 HTML、
链接、静态资源、图片属性、RSS 和 sitemap。生成的 `public/` 已被 Git 忽略，不要
提交。

如需查看生产产物：

```sh
python3 -m http.server --directory public 8000
```

然后打开 <http://localhost:8000/>。

## 明暗主题

首次访问会跟随操作系统的明暗偏好；页眉里的 `日` 或 `夜` 表示当前主题。手动切换
后，选择只保存在这个站点自己的浏览器本地存储中，并在后续页面与刷新后继续使用。
它不设置 cookie、不加载第三方资源，也不发送主题选择。

## 匿名访问地图

页脚地图统计页面请求，不统计或识别独立访客。Worker 只把 Cloudflare 临时提供的
位置转换为 15° 网格，并在 D1 中保存 UTC 日期、网格编号和封顶计数；不保存 IP、
稳定标识、精确位置、访问路径、referrer 或 user agent。过去 90 天内少于 5 次请求
的网格不公开，公开数量也只显示区间。

源码中的双开关默认关闭，因此普通本地构建不会联系 Cloudflare，也不会在产物中
出现 Worker 地址。生产流水线只有在仓库变量 `VISITOR_MAP_ENABLED=true` 且
`VISITOR_MAP_ORIGIN` 是经过验证的纯 `https://…workers.dev` origin 时才接入
固定的 pixel、SVG 地图和文字版三条路由；清空这两个变量并重新部署即可恢复零
Worker 请求。404 页面不采集，以免不存在页面和机器人噪声进入统计。

## 自动发布

检查全部通过后，只暂存这篇新文章，再提交并推送：

```sh
git status --short
git add content/posts/my-new-note/
git diff --cached
git commit -m "Add my new note"
git push origin main
```

把示例中的目录和提交说明换成自己的内容。如果 `draft` 仍为 `true` 或发布时间在
未来，流水线会拒绝发布。

推送到 `main` 后，`.github/workflows/pages.yml` 会：

1. 下载并校验固定版本的 Hugo Extended；
2. 检查文章、数学渲染和响应式图片；
3. 同时验证地图关闭/启用两种 Hugo 产物及错误配置；
4. 检查匿名聚合地图源码及 SQLite 语义；
5. 按仓库变量决定生产地图开关，构建并检查完整静态站点；
6. 将通过检查的产物部署到 GitHub Pages。

Pull request 只构建和检查，不部署。推送后打开
[GitHub Actions](https://github.com/groklab/groklab.github.io/actions/workflows/pages.yml)，
确认最新一次 `Build and deploy GitHub Pages` 的 build 和 deploy 都是绿色，再打开
<https://groklab.github.io/> 以及新文章网址核对内容。一次成功的 `git push` 本身
不等于部署已经完成。
