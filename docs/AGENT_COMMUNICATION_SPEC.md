# Agent 通信协议技术白皮书：ACP、A2A 与 MCP 全解析

## 1. ACP (Agent Client Protocol) 详解
**定位**：人机交互界面标准（Client <-> Agent）。
- **底层架构**：基于 JSON-RPC 2.0，通过 stdio 或 WebSocket 传输。
- **关键方法**：
    - `initialize`: 协商版本与能力。
    - `session/new`: 创建对话上下文。
    - `session/prompt`: 发送用户请求。
    - `session/update`: Agent 发送实时反馈（流式响应、思考状态）。
- **设计哲学**：解决 Agent 如何优雅地在 IDE 或浏览器中“生活”，侧重会话持久化与多模态反馈。

## 2. A2A (Agent-to-Agent) 详解
**定位**：Agent 间的社交协议（Agent <-> Agent）。
- **底层架构**：基于 RESTful API / HTTP，支持同步请求与异步回调。
- **核心组件**：
    - **AgentCard**: 声明 Agent 的身份、描述及可用 Skill（技能）。
    - **Skill ID**: 具体的任务标识，如 `analyze_topic`, `distribute_content`。
    - **x-a2a-key**: 双向认证的安全基础。
- **设计哲学**：解决 Agent 如何“外包”任务。它不要求 Agent 共享内存，而是通过清晰定义的输入/输出来协作。

## 3. MCP (Model Context Protocol) 详解
**定位**：数据与工具接入标准（Model <-> Data/Tool）。
- **底层架构**：由 Anthropic 发起，旨在让模型突破上下文限制，安全访问私有数据。
- **核心能力**：
    - **Resources**: 让模型读取文件、数据库记录。
    - **Tools**: 让模型执行本地操作（如搜素、运行代码）。
- **设计哲学**：解决 Agent 的“手”和“眼”如何接入。它通常是无状态的、原子化的调用。

## 4. 三者在 XPoz 项目中的深度协同逻辑
在 XPoz (postiz-app) 系统中，这三者并非替代关系，而是分层协作：

1. **接入层 (ACP)**: 
   用户在 Cursor 或 VS Code 中输入指令。OpenClaw 的 ACP Bridge 将其转化为系统可理解的消息流。
2. **知识层 (MCP)**: 
   OpenClaw 使用 MCP Server 读取用户的项目代码或数据库上下文，为回复提供背景知识。
3. **执行层 (A2A)**: 
   当需要执行“社交分发”这一专业且复杂的任务时，OpenClaw 通过 A2A 协议向 XPoz 后端发起委托。XPoz 内部处理 Temporal 工作流、媒体上传、API 限制等逻辑。

## 5. 技术决策：为什么在 XPoz 中 A2A 比 MCP 更重要？
- **任务解耦**：社交发布涉及长达几天的定时任务（Temporal），MCP 无法处理这类长时异步状态，而 A2A 的任务委托模式天然支持。
- **生态隔离**：XPoz 的 55+ 平台适配逻辑极其复杂。如果用 MCP，主 Agent 需要加载所有适配器的上下文（Token 爆炸）；使用 A2A，主 Agent 只需要知道 XPoz 这个“分销商”能搞定一切。

## 6. 开发者速查表：报文头对比
- **ACP**: `{"jsonrpc": "2.0", "method": "session/prompt", ...}`
- **A2A**: `POST /a2a/tasks HTTP/1.1; x-a2a-key: ...`
- **MCP**: `{"jsonrpc": "2.0", "method": "tools/call", ...}`
