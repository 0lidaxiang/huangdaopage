# 荒岛有信号 · 静态站

React 18.3.1、React DOM 18.3.1、TypeScript 5.8.3、Vite 6.4.3、React Router DOM 7.18.3。复用原站的组件、样式、灯塔意象和亮暗主题；所有公开页面在构建时生成 HTML。文章和演化节点的正文、来源、日期与 SEO 已进入 HTML，无需 JavaScript 也可阅读。

运行网站和平台构建只需要本仓库，**不启动 Go，不连接 MySQL，不调用旧 API**。

## 本地运行

使用 Node.js 22（EdgeOne 配置为预装的 22.11.0；本机兼容 22.22.3），从仓库根目录执行：

```sh
npm ci
npm run dev
```

开发地址为 `http://127.0.0.1:5180`。直接检查生产产物：

```sh
npm run build
npm run preview
```

预览地址为 `http://127.0.0.1:4180`，实际输出目录为 `dist/`。预览服务器仅提供静态文件，对不存在的路径返回 HTTP 404。

## 内容与维护

- `content/site.json`：公开元数据、话题、路线、阶段、推荐顺序和站点设置。
- `content/articles/{signal,depth,node}/*.json`：每篇公开文章的完整记录，正文为 Markdown。
- `content/provenance.json`：导出来源、时间、公开 ID/slug 清单、正文哈希、总数与排除统计。
- `public/uploads/`：公开内容引用的原站本地媒体；未引用的媒体不会导出。
- `public/brand/`：从设计稿灯塔区域提取的三个小型 WebP 和品牌图标，未携带设计稿中的文字或示例二维码。

数据库导出只在本机维护时使用，不属于 `npm run build`：

```sh
npm run content:audit
npm run content:export
npm run content:check
npm run build
```

首次连接、安全配置、完整盘点、冲突处理及后续脱离数据库的编辑流程，见[内容维护](docs/内容维护.md)与[迁移说明](docs/迁移说明.md)。

## 验证

```sh
npm run typecheck
npm test
npm run content:check
npm run build
npm run test:e2e
npm run output:check
git diff --check
```

浏览器测试使用本机 Google Chrome，可通过 `CHROME_PATH` 改为其他 Chromium 可执行文件；测试不写入原数据库。截图、网络检查和测试报告均在 Git 忽略目录。

## EdgeOne Pages

根目录 `./`，安装 `npm ci`，构建 `npm run build`，输出 `dist`，Node.js `22.11.0`，框架选择静态/Vite。仓库根目录已提供 `edgeone.json`。

正式部署时设置 `SITE_URL=https://你的正式域名`，构建将生成绝对 canonical、Open Graph URL 和完整 `sitemap.xml`。未提供正式域名时保留独立页面标题和描述，不猜测域名；站点地图暂为空。详细路径、404、子路径及缓存配置见[部署说明](docs/部署说明.md)。

代码通过本仓库的 `main` 分支维护。正式部署按[部署说明](docs/部署说明.md)执行；本地验收不会自动触发部署。
