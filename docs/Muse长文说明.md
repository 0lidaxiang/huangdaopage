# Muse 个人 Agent 深度长文

文章为《Muse 与个人 Agent 浪潮：当 AI 开始替你持续办事》，路径 `/depth/muse-personal-agent-wave`，ID 为 `editorial-depth-muse-personal-agent-wave`。全文在 `content/articles/depth/muse-personal-agent-wave.json`，正文约 3,600 个汉字，标注 10 分钟阅读；当前为本地待审稿，已加入首页精选。未提交、推送或部署。

文章以 Meta Muse 为切入口，结合 OpenAI dots、Muse Wonder 和 Poppy 草案，分析持续记忆、任务状态、后台执行、服务连接、授权、注意力成本及服务入口的变化。用“每周整理 AI 新闻”这一假设任务解释产品评价方式，未虚构亲测、用户经历、付费体验或实测成绩。

核验使用 8 份一手资料，正文就近链接并附完整来源：Meta Muse 首发（09-08）、Muse Wonder（10-12）、OpenAI dots（09-29）、Muse for Small Business（09-29）、Muse 官方设计说明、Meta 安全技术说明，以及 Sierra 协议公告（10-06）与 Poppy 草案（10-09）。核验日期为 2026-10-20。

保留的事实边界包括：Muse 产品与底层模型名称分开；Muse Wonder 的接口、编程工具和个人产品推进状态分开；Poppy 是草案；当前 Secure VM 与计划中的 Confidential VM 分开。入口竞争、切换成本和使用评价是文章的编辑分析，没有当作厂商公开的结果。

本次新增 1 篇深度，保留上一轮全部 119 条公开记录与 14 条短讯、5 个节点的批次。当前公开 120 条的构成为“最初迁移 100 + 新闻与节点 19 + 长文 1”；原数据库盘点的 120 条是独立历史口径，其中 20 条非公开记录继续排除。`content/provenance.json` 的 `maintenance` 可核对累计 20 条新增与零删除。

维护时编辑完整文章 JSON，运行 `npm run content:sync`、`npm run content:check` 与 `npm run build`。推荐由 `content/site.json` 的站点设置控制；同日新增 3D 评测长文后，Muse 转入首页精选（`settings.featuredIds`），全部历史深度文章继续保留。

本轮类型检查、内容对账与生产构建通过，生成 141 个公开页面和 404。7 组 Chrome 浏览器测试通过，覆盖 120 条正文与全部公开路径；桌面和手机的亮暗主题截图已改为检查当前主推长文。另在预览面板实际检查目录展开与章节跳转。产物继续排除原 20 条非公开记录，没有旧 API 或私密凭据。截图与最新静态包位于 Git 忽略的 `artifacts/`。
