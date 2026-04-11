# XPoz 全媒体融合端到端测试计划 (E2E Test Plan)

## 1. 概述 (Overview)
本计划旨在验证 XPoz 系统的核心能力：**中外媒体平台的无缝融合**。系统通过“国际 API 模式”与“国内 Extension 桥接模式”双轨并行，确保 55+ 社交媒体平台在统一的工作流下运行。

## 2. 测试环境要求 (Test Environment)
- **后端 (Backend)**: NestJS 服务运行中，Temporal Orchestrator 已启动。
- **前端 (Frontend)**: Next.js 服务运行中，需配置插件 ID `NEXT_PUBLIC_XPOZ_EXTENSION_ID`。
- **插件 (Extension)**: 已安装 XPoz Chrome Extension（开发者模式加载）。
- **数据库 (Database)**: PostgreSQL 已初始化，包含测试用的 Organization 和 User 数据。

## 3. 测试套件设计 (Test Suites)

### Suite 1: 国际平台生命周期 (API 模式)
验证基于 OAuth/API 的标准国际社交媒体流程。
- **Case 1.1: 授权连接**: 验证 X (Twitter) 或 GitHub 能够通过标准 OAuth 流程获取并存储 Token。
- **Case 1.2: 实时发布**: 提交 Markdown 文章，验证 Workflow 直接调用平台 API 并将状态更新为 `PUBLISHED`。
- **Case 1.3: 定时发布**: 设置未来时间发布，验证 Temporal 定时器准确触发并完成发布。

### Suite 2: 国内平台生命周期 (XSync 桥接模式)
验证通过 Chrome Extension 桥接的国内社交媒体流程。
- **Case 2.1: 登录探测 (Auth Check)**: 验证前端自动通过 Extension 探测知乎、掘金等平台的 Cookie 登录状态。
- **Case 2.2: 异步发布闭环**:
  1. 用户点击“发布到知乎”。
  2. 后端拦截并返回 `PENDING_EXTENSION` 状态。
  3. 前端 `useXSyncPublisher` 轮询检测到任务。
  4. 验证 Extension 接收 `XSYNC_PUBLISH` 消息并执行模拟发布。
  5. 验证 Extension 回调 `/mark-published` 接口，后端将帖子状态闭环为 `PUBLISHED`。
- **Case 2.3: 媒体附件同步**: 验证图片 URL 被 Extension 适配器正确下载、处理并上传至国内平台。

### Suite 3: MCP (Model Context Protocol) 融合测试
验证 AI 客户端通过 MCP 协议调用系统的能力。
- **Case 3.1: 工具发现 (Manifest)**: 验证 `GET /mcp/manifest` 返回包含 `sync_article` 等工具的 JSON 定义。
- **Case 3.2: 混合分发**: 通过 MCP 一次性发布文章到 X (API) 和 掘金 (Extension)，验证跨模式并发执行。

### Suite 4: 健壮性与边缘 Case (Robustness)
- **Case 4.1: Extension 离线处理**: 在插件关闭时发起发布，验证系统能保持 `PENDING` 状态，并在插件重新上线后自动完成任务。
- **Case 4.2: 自适应退避轮询**: 验证前端在无任务时自动降低轮询频率 (5s -> 30s)，有任务时立即恢复。
- **Case 4.3: 最大重试保护**: 验证单次发布失败超过 5 次后，系统自动标记为 `ERROR` 状态，防止无限循环。

## 4. 自动化工具栈 (Tooling)
- **API 层**: 使用 `scripts/e2e-full.mjs` (Node.js) 进行自动化接口回归。
- **UI/插件层**: 建议使用 Playwright 驱动 Chrome 浏览器，结合 `--load-extension` 参数进行集成测试。
- **状态监控**: 使用 Temporal Web UI 监控 Workflow 执行状态。

## 5. 验收标准 (Acceptance Criteria)
1. **状态一致性**: 所有平台的发布状态（Draft -> Scheduled -> Publishing -> Published）在 UI 上表现必须完全一致。
2. **交互透明性**: 国内平台发布时，用户需看到明确的“等待插件处理”提示及进度更新。
3. **关键平台覆盖**: 知乎、掘金、微信、X、GitHub 这 5 个核心平台必须通过全流程测试。
4. **性能指标**: 从 Extension 收到消息到完成发布的响应时间（不含网络上传）应小于 5 秒。
