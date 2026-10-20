# 荒岛书生 · 静态站

- 修改前检查 Git 状态、分支和远程，保留已有改动。提交、推送、部署依用户当次授权。
- 本仓库写文章、新闻短讯、榜单点评、改稿和拟标题时，默认先读取并遵循[荒岛书生写作 Skill](.agents/skills/huangdao-ai-writer/SKILL.md)，无需用户显式调用；用户当次要求优先。普通代码、部署和文档维护不触发。
- React 18.3.1、TypeScript 5.8.3、Vite 6.4.3、React Router DOM 7.18.3。默认复用现有组件、CSS 和亮暗主题，不无故升级主版本。
- `npm ci`、`npm run build` 生成纯静态 `dist/`，构建和访问不连接 MySQL、不启动 Go、不调用旧 API。
- `content/` 只存可公开内容；草稿、下线、回收站、未来记录及凭据只能留在 Git 忽略的 `.private/`，不得复制到 `public/` 或产物。
- `content:export` 是本机只读数据库导出；历史备份只用于盘点，必须记录来源，不替代当前数据库。重导出前保护本地已改稿。
- 本仓库直接改稿后执行 `npm run content:sync`，再运行 `content:check` 和构建。保留历史 ID、slug、真实日期、来源与示例身份。
- 新增图片放入 `public/uploads/`，使用 `/uploads/...`；二维码沿用真实设置，未配置时显示“二维码待配置”。Markdown 禁止执行原始 HTML。
- 按变更范围运行类型检查、单元/浏览器测试和 `output:check`；页面/内容变化需要重新构建静态 HTML。说明实际验证和未完成项。
- 运行、内容维护、迁移对账和 EdgeOne 配置见 `README.md` 与 `docs/`；测试只使用隔离数据，不写原数据库。
