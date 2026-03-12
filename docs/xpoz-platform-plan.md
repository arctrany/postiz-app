# XPoz 全媒体平台 — 完整改造规划

> 基于 XPoz + Wechatsync 融合，品牌升级为 XPoz
>
> **目标**：覆盖全球 + 国内 55+ 平台，AI Agent 互联互通

---

## 总体架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户浏览器                             │
│   Next.js 前端 (XPoz UI)                                 │
│   └── Copilot 侧边栏 (Mastra + CopilotKit)               │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────────┐
│                  NestJS 后端                              │
│   ├── 社交平台集成 (IntegrationManager)                   │
│   ├── 定时调度 (Temporal)                                 │
│   ├── AI Copilot (/copilot/*) ← Mastra Agent             │
│   ├── MCP Server (/mcp) ← 全渠道 AI 工具接入              │
│   └── A2A 端点 (/a2a/*) ← Openclaw 等 Agent 互通          │
└──────┬───────────────┬───────────────────────────────────┘
       │               │
       │ OAuth2        │ chrome.runtime.sendMessageExternal
       ▼               ▼
  国际平台          XPoz Extension (Chrome)
  (30+ 个)         ├── 模式A：Cookie 中继（小红书等）
                   ├── 模式B：国内直发（Wechatsync 25个适配器）
                   └── MCP WebSocket Bridge（AI 工具接入）
```

---

## 一、Chrome 扩展融合

### 背景

- **XPoz Extension**：当前已有，功能为抓取 Cookie 中继给后端（仅支持 Skool 一个平台）
- **Wechatsync Extension**：已有，支持25个国内平台直接在浏览器内发布
- **目标**：合并为单一 `XPoz Extension`，统一品牌、统一能力

### 平台接入方式决策树

```
这个平台有官方 OAuth2/Open API？
  ├── YES → 后端直接 OAuth2 授权，无需扩展
  │         (X, LinkedIn, YouTube, TikTok, Instagram, Discord, Reddit...)
  │
  └── NO → 需要 Cookie 认证
        ├── 后端能模拟请求（无 CORS/JS 验证限制）？
        │     → 模式A：Cookie 中继
        │       扩展提取 Cookie → 传给后端 → 后端发 API 请求
        │       适用：小红书（部分接口）、Skool
        │
        └── 平台有 CORS 限制 / 需要在浏览器上下文执行？
              → 模式B：扩展直发（Wechatsync 模式）
                后端发送指令 → 扩展在浏览器内 fetch（携带真实 Cookie）
                适用：知乎、掘金、头条、微博、CSDN、B站... (共25个)
```

### 扩展消息协议扩展

```typescript
// 在原有 GET_COOKIES / PING / GET_PROVIDERS 基础上新增：
type ExtensionMessage =
  | { type: 'GET_COOKIES'; provider: string }                          // 原有
  | { type: 'SYNC_ARTICLE'; platforms: string[]; article: Article }    // 新增
  | { type: 'CHECK_AUTH'; platform: string }                           // 新增
  | { type: 'PING' }
  | { type: 'GET_PROVIDERS' }
```

### Manifest 升级（关键权限变更）

```json
{
  "name": "XPoz",
  "description": "XPoz — 全媒体内容发布与同步助手",
  "permissions": [
    "cookies", "alarms", "storage", "unlimitedStorage",
    "declarativeNetRequest", "declarativeNetRequestWithHostAccess",
    "scripting", "tabs", "contextMenus", "downloads"
  ],
  "host_permissions": ["http://*/*", "https://*/*"],
  "externally_connectable": {
    "matches": [
      "http://localhost/*",
      "https://localhost/*",
      "https://*.xpoz.com/*"
    ]
  }
}
```

### 后端新增：国内平台 Provider 基类

```typescript
// libraries/nestjs-libraries/src/integrations/social/base-wechatsync.provider.ts
export abstract class BaseWechatsyncProvider extends SocialAbstract implements SocialProvider {
  isChromeExtension = true;

  // 国内平台认证：检查扩展的浏览器登录状态，而非 OAuth 回调
  async authenticate(params: any) {
    const authResult = await this.callExtension('CHECK_AUTH', {
      platform: this.identifier
    });
    if (!authResult.isAuthenticated) {
      throw new Error(`请先在浏览器中登录 ${this.name}`);
    }
    return {
      id: authResult.userId,
      name: authResult.username,
      accessToken: 'extension-mode', // 标记位，真正的认证在扩展侧
      refreshToken: '',
      expiresIn: 999999999,
      picture: authResult.avatar,
      username: authResult.username,
    };
  }

  // 发布：通过扩展直发到国内平台
  async post(id: string, accessToken: string, postDetails: PostDetails[], integration: Integration) {
    const result = await this.callExtension('SYNC_ARTICLE', {
      platforms: [this.identifier],
      article: {
        title: postDetails[0].settings?.title ||
               postDetails[0].message.substring(0, 50),
        markdown: postDetails[0].message,
        cover: postDetails[0].media?.[0]?.url,
      }
    });
    return [{
      id: postDetails[0].id,
      postId: result.results?.[0]?.postId,
      releaseURL: result.results?.[0]?.postUrl,
      status: 'posted' as const,
    }];
  }

  private async callExtension(type: string, params: any) {
    const extensionId = process.env.EXTENSION_ID;
    if (!extensionId) throw new Error('EXTENSION_ID not configured');
    // 通过 chrome.runtime.sendMessage 调用扩展
    return ExtensionBridgeService.sendMessage(extensionId, { type, ...params });
  }
}

// 各平台实现（每个只需几行）：
export class ZhihuProvider extends BaseWechatsyncProvider {
  identifier = 'zhihu'; name = '知乎';
  supportedScopes = [ScopeVariables.PostCreate];
}
export class JuejinProvider extends BaseWechatsyncProvider {
  identifier = 'juejin'; name = '掘金';
  supportedScopes = [ScopeVariables.PostCreate];
}
// ... 共 25 个
```

---

## 二、MCP — 全渠道 Universal AI Bridge

### 定位与目标

MCP Server 是所有外部 AI 工具的**统一接入口**，覆盖国内 + 国际全渠道。

```
支持接入的 AI 客户端（任何实现 MCP 协议的工具）：
  ├── Claude Desktop / Claude Code (Anthropic)
  ├── Gemini (Google)
  ├── Codex / ChatGPT (OpenAI)
  ├── Antigravity
  ├── Cursor / Windsurf 等编程 IDE
  └── 任何 MCP 兼容客户端

暴露的 MCP 工具：
  ├── sync_article      → 发布文章（自动路由：国内走扩展，国际走 OAuth2）
  ├── schedule_post     → 定时发布（Temporal 工作流）
  ├── list_platforms    → 列出可用平台及登录状态
  ├── check_auth        → 检查指定平台认证状态
  ├── upload_image      → 上传图片到平台图床
  └── extract_article   → 从当前浏览器页面提取文章
```

### 当前 vs 升级后对比

| 维度 | 当前 (Wechatsync MCP) | 升级后 (XPoz MCP) |
|------|-----------------------|-------------------|
| 执行层 | 只转发 Chrome 扩展 | 扩展直发 + 后端 OAuth2 双路并行 |
| 平台覆盖 | 国内 25 个 | 国内 + 国际 55+ |
| AI 客户端 | 主要面向 Claude | 全部 MCP 兼容客户端 |
| 调度能力 | 无 | 支持 Temporal 定时任务 |

---

## 三、A2A 协议 — XPoz ↔ Openclaw 对等互通

### 设计原则

- **对等关系**：XPoz 和 Openclaw 是**平等的两个 Agent 系统**，互相调用
- **无嵌入**：不在 XPoz 的 Copilot 里嵌入 Openclaw，也不反过来
- **各自独立**：XPoz 保留自己的 Mastra Copilot，Openclaw 保留自己的
- **协作通道**：需要协作时，通过 A2A 任务接口互相请求

### 协作场景

```
场景1：Openclaw → XPoz（让 XPoz 发布内容）
  Openclaw Agent 完成内容策略/文章生成
      ↓  POST /a2a/tasks { skill_id: 'publish', input: { content, platforms } }
  XPoz 接收任务，通过 55+ 渠道发布，返回结果

场景2：XPoz → Openclaw（借助 Openclaw 分析能力）
  用户在 XPoz Copilot 请求"帮我分析近期内容热点"
      ↓  XPoz Copilot 内置 openclaw_analysis 工具
      ↓  POST openclaw/a2a/tasks { skill_id: 'topic_analysis' }
  Openclaw 返回分析结果，XPoz Copilot 展示给用户
```

### XPoz A2A 实现

```
新增文件：
  apps/backend/src/api/routes/a2a.controller.ts

端点：
  GET  /a2a/agent-card    → 能力声明（AgentCard），供 Openclaw 发现
  POST /a2a/tasks         → 接收来自 Openclaw 的任务请求

认证（MVP 阶段）：
  双向 API Key，Header：x-a2a-key
  Openclaw 发给 XPoz 时携带 OPENCLAW_A2A_KEY
  XPoz 发给 Openclaw 时携带 XPOZ_A2A_KEY
```

```typescript
// AgentCard 示例
{
  "name": "XPoz",
  "version": "1.0",
  "description": "全媒体内容发布 Agent，支持 55+ 国内外平台及定时调度",
  "url": "https://api.xpoz.com/a2a",
  "skills": [
    { "id": "publish",       "description": "立即发布内容到指定平台列表" },
    { "id": "schedule",      "description": "定时发布内容" },
    { "id": "list_channels", "description": "列出用户已连接的渠道" }
  ]
}
```

### 安全模型（递进式）

| 阶段 | 方案 | 成熟度 |
|------|------|--------|
| MVP | 双向 API Key（`x-a2a-key` Header）| 现在先用 |
| V2  | JWT（XPoz 签发，含 org_id + 权限白名单）| 上线后补 |
| V3  | mTLS + JWT | 生产加固 |

---

## 四、XPoz Copilot Agent

### 当前技术栈

```
Mastra Framework    → Agent 注册与运行时管理
CopilotKit          → 前端 Chat UI + 后端 Runtime Protocol
@ai-sdk/openai      → 模型调用（当前仅 gpt-5.2）
PostgreSQL Memory   → 对话上下文记忆
```

### 多模型支持改造

Agent 的底层模型通过环境变量切换，不改动业务逻辑：

```typescript
// 改造 load.tools.service.ts
private createLLM() {
  switch (process.env.AI_PROVIDER || 'openai') {
    case 'openai':
      return openai(process.env.OPENAI_MODEL || 'gpt-4.1');
    case 'google':
      return google(process.env.GEMINI_MODEL || 'gemini-2.5-pro');
    case 'anthropic':
      return anthropic(process.env.ANTHROPIC_MODEL || 'claude-opus-4-5');
    case 'openrouter':
      // 通过 OpenRouter 路由到任意模型
      return openai.createClient({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        model: process.env.OPENROUTER_MODEL,
      });
  }
}
```

### Copilot 内置 A2A 工具（可选）

```typescript
// XPoz Copilot 工具集中新增，使 Copilot 可以主动调用 Openclaw
const openclawAnalysisTool = createTool({
  id: 'openclaw_analysis',
  description: '调用 Openclaw 进行内容趋势分析、选题建议',
  inputSchema: z.object({
    query: z.string(),
    platform: z.string().optional(),
  }),
  execute: async ({ query, platform }) => {
    if (!process.env.OPENCLAW_A2A_URL) return '(Openclaw 未配置)';
    return a2aService.callOpenclaw('analyze', { query, platform });
  }
});
```

---

## 五、品牌改造

### 必须立即处理（数据安全风险）

| 文件 | 问题 | 操作 |
|------|------|------|
| `apps/frontend/src/app/(app)/layout.tsx:48` | Plausible 统计 → 数据上报给 xpoz.com | **删除或改域名** |
| `apps/frontend/src/app/(app)/layout.tsx:99` | PostHog 统计 → 数据上报给 xpoz.com | **删除或改域名** |
| `apps/frontend/src/components/layout/dubAnalytics.tsx:13` | Dub 链接追踪 | 删除或修改 |
| `libraries/nestjs-libraries/src/database/prisma/agencies/agencies.service.ts:88` | 硬编码原作者邮箱 `nevo@xpoz.com` | **改为自己邮箱** |

### 外链替换清单（grep 精确定位）

| 文件 | 当前值 | 改为 |
|------|--------|------|
| `agencies.service.ts:53,196,199` | `xpoz.com/agencies/...` | `xpoz.com/agencies/...` |
| `organization.repository.ts:42` | `@xpoz.com` 临时邮箱后缀 | `@xpoz.com` |
| `top.menu.tsx:251` | `affiliate.xpoz.com` | 删除 |
| `chrome.extension.component.tsx:9` | Chrome Store 旧扩展 ID | 发布新扩展后更新 |
| `add.provider.component.tsx:271` | 同上 | 同上 |
| `developer.component.tsx` | `docs.xpoz.com/public-api` | 暂时注释或改为 README 链接 |
| `public.component.tsx:67,77` | `docs.xpoz.com` / `n8n-nodes-postiz` | 暂时注释 |
| `register.tsx:222,231` | `xpoz.com/terms` / `xpoz.com/privacy` | 改为自建页面或删除 |
| `apps/sdk/src/index.ts:18` | `https://api.xpoz.com` 默认值 | `https://api.xpoz.com` |
| `apps/cli/src/api.ts:14` | `https://api.xpoz.com` 默认值 | `https://api.xpoz.com` |
| `billing/faq.component.tsx:38` | `gitroomhq/xpoz-app` GitHub 链接 | 改为新 repo |
| `agents/agent.chat.tsx:49` | `agent="postiz"` | `agent="xpoz"` |
| `app/(preview)/p/[id]/page.tsx:61` | `/postiz.svg` | `/xpoz.svg` |
| `apps/extension/manifest.json:26` | `xpoz.com` 白名单 | `xpoz.com` |
| `apps/extension/src/background.ts:11` | `xpoz.com` 正则 | `xpoz.com` |

### Logo 文件位置

```
apps/frontend/public/postiz.svg                                ← 替换为 XPoz SVG
apps/frontend/src/components/new-layout/logo.tsx               ← 主 Logo 组件
apps/frontend/src/components/ui/logo-text.component.tsx        ← 文字 Logo
apps/extension/public/icon-32.png                              ← 扩展小图标
apps/extension/public/icon-128.png                             ← 扩展大图标
```

---

## 六、已确认的国际平台 OAuth2 支持

> 以下平台已通过代码审计确认完整实现：

| 平台 | 协议 | 状态 | 备注 |
|------|------|------|------|
| X (Twitter) | OAuth 1.0a | ⚠️ **需升级至 OAuth 2.0** | 见 6.1 节升级方案 |
| LinkedIn | OAuth 2.0 | ✅ 已完成 | 支持图文、视频、PDF |
| YouTube | OAuth 2.0 | ✅ 已完成 | 共用 Google provider |
| TikTok | OAuth 2.0 | ✅ 已完成 | 国际版 |
| Facebook / Instagram | OAuth 2.0 | ✅ 已完成 | Meta Graph API |
| Pinterest | OAuth 2.0 | ✅ 已完成 | 已实现 |
| Discord | OAuth 2.0 | ✅ 已完成 | 已实现 |
| Reddit | OAuth 2.0 | ✅ 已完成 | 已实现 |
| Mastodon | OAuth 2.0 | ✅ 已完成 | 支持自定义实例 |
| Slack | OAuth 2.0 | ✅ 已完成 | 已实现 |
| Threads | Meta OAuth | ✅ 已完成 | Graph API |
| Bluesky | XRPC | ✅ 已完成 | AT Protocol |
| Dribbble | OAuth 2.0 | ✅ 已完成 | 已实现 |
| Beehiiv / Listmonk | API Key | ✅ 已完成 | 无需 OAuth |

### 6.1 X (Twitter) OAuth 2.0 升级方案

#### 升级原因

- **X 官方推荐**：X API v2 推荐使用 OAuth 2.0 + PKCE，OAuth 1.0a 属于遗留方式
- **更细权限控制**：OAuth 2.0 支持 scopes 粒度控制（`tweet.read`, `tweet.write`, `users.read`, `offline.access`）
- **Token 安全性**：OAuth 2.0 access_token 2 小时有效期 + refresh_token 自动续期，比 OAuth 1.0a 永久 token 更安全
- **未来兼容**：X 可能逐步弃用 OAuth 1.0a

#### 当前实现分析

```
文件：libraries/nestjs-libraries/src/integrations/social/x.provider.ts
库：  twitter-api-v2@^1.29.0（已支持 OAuth 2.0 PKCE，无需换库）

当前问题：
├── generateAuthUrl()  → 使用 client.generateAuthLink()（OAuth 1.0a）
├── authenticate()     → 使用 startingClient.login()（OAuth 1.0a token 交换）
├── refreshToken()     → 返回空对象（OAuth 1.0a 不需要刷新）
├── getClient()        → 需要 appKey + appSecret + accessToken + accessSecret
└── Token 存储         → accessToken:accessSecret 拼接，expiresIn=999999999
```

#### 改造方案

```typescript
// === 1. generateAuthUrl() — OAuth 2.0 PKCE 授权链接 ===
async generateAuthUrl() {
  const client = new TwitterApi({
    clientId: process.env.X_CLIENT_ID!,
    clientSecret: process.env.X_CLIENT_SECRET,
  });
  const callbackUrl =
    (process.env.X_URL || process.env.FRONTEND_URL) + '/integrations/social/x';
  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
    callbackUrl,
    { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] }
  );
  return { url, codeVerifier, state };
}

// === 2. authenticate() — PKCE code 交换 ===
async authenticate(params: { code: string; codeVerifier: string }) {
  const client = new TwitterApi({
    clientId: process.env.X_CLIENT_ID!,
    clientSecret: process.env.X_CLIENT_SECRET,
  });
  const callbackUrl =
    (process.env.X_URL || process.env.FRONTEND_URL) + '/integrations/social/x';
  const { accessToken, refreshToken, client: loggedClient } =
    await client.loginWithOAuth2({
      code: params.code,
      codeVerifier: params.codeVerifier,
      redirectUri: callbackUrl,
    });
  const { data } = await loggedClient.v2.me({ ... });
  return {
    id: data.id,
    accessToken,           // 独立存储，不再拼接 accessSecret
    refreshToken,          // OAuth 2.0 refresh token
    expiresIn: 7200,       // 2 小时有效期
    ...
  };
}

// === 3. refreshToken() — 真正的 token 刷新 ===
async refreshToken(refreshToken: string) {
  const client = new TwitterApi({
    clientId: process.env.X_CLIENT_ID!,
    clientSecret: process.env.X_CLIENT_SECRET,
  });
  const { accessToken, refreshToken: newRefresh } =
    await client.refreshOAuth2Token(refreshToken);
  return { accessToken, refreshToken: newRefresh, expiresIn: 7200, ... };
}

// === 4. getClient() — Bearer Token 模式 ===
private async getClient(accessToken: string) {
  // 向后兼容：旧 OAuth 1.0a token 含 ":"，新 OAuth 2.0 token 不含
  if (accessToken.includes(':')) {
    const [token, secret] = accessToken.split(':');
    return new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: token, accessSecret: secret,
    });
  }
  return new TwitterApi(accessToken);  // OAuth 2.0 bearer
}
```

#### 向后兼容策略

| 场景 | 处理方式 |
|------|----------|
| 已连接的用户（OAuth 1.0a token） | `getClient()` 自动识别 `:` 分隔的旧格式，走 OAuth 1.0a |
| 新连接的用户 | 走 OAuth 2.0 PKCE，存储独立 token |
| 旧用户重新连接 | 自动升级为 OAuth 2.0 |
| `X_CLIENT_ID` 未配置 | 降级回 OAuth 1.0a（`X_API_KEY` + `X_API_SECRET`）|

#### X Developer Portal 配置要求

```
1. 进入 https://developer.twitter.com/en/portal/projects
2. 选择 App → User authentication settings → Edit
3. 启用 "OAuth 2.0"
4. App Type: 选择 "Web App" (Confidential Client)
5. Callback URI: https://app.xpoz.com/integrations/social/x
6. Website URL: https://xpoz.com
7. 保存后获取 Client ID 和 Client Secret
```

---

## 七、国内平台覆盖（Wechatsync 已实现）

> 通过融合 Wechatsync 扩展适配器获得，用户登录各平台网站即可使用：

| 平台 | ID | 类型 |
|------|-----|------|
| 知乎 | zhihu | 主流 |
| 掘金 | juejin | 技术 |
| 头条号 | toutiao | 主流 |
| 微博 | weibo | 主流 |
| B站专栏 | bilibili | 主流 |
| CSDN | csdn | 技术 |
| 简书 | jianshu | 通用 |
| 百家号 | baijiahao | 通用 |
| 微信公众号 | weixin | 主流（草稿） |
| 小红书 | xiaohongshu | 主流 |
| 语雀 | yuque | 技术 |
| 豆瓣 | douban | 通用 |
| 搜狐号 | sohu | 通用 |
| 雪球 | xueqiu | 财经 |
| 人人都是产品经理 | woshipm | 产品 |
| 大鱼号 | dayu | 通用 |
| 一点号 | yidian | 通用 |
| 51CTO | 51cto | 技术 |
| 慕课网 | imooc | 技术 |
| 开源中国 | oschina | 技术 |
| SegmentFault | segmentfault | 技术 |
| 搜狐焦点 | sohufocus | 房产 |
| 东方财富 | eastmoney | 财经 |
| WordPress | wordpress | 自建站 |
| Typecho | typecho | 自建站 |

---

## 八、实施路径

### 阶段 0 — 品牌清理（优先，1-2天）

- [ ] 生成 XPoz Logo（AI 生成 SVG + PNG）
- [ ] 替换前端 Logo 组件和 SVG 文件
- [ ] **移除 Plausible / PostHog 数据回传**（防止用户数据外泄）
- [ ] 替换硬编码 `nevo@xpoz.com` 邮箱
- [ ] 更新 Extension manifest（名称 + 域名白名单）
- [ ] 批量替换其余 xpoz.com 外链（见上清单）

### 阶段 0.5 — X (Twitter) OAuth 2.0 升级（1-2天）

- [ ] X Developer Portal 启用 OAuth 2.0，配置 Callback URI
- [ ] 改造 `x.provider.ts`：`generateAuthUrl()` → `generateOAuth2AuthLink()`
- [ ] 改造 `x.provider.ts`：`authenticate()` → `loginWithOAuth2()`
- [ ] 实现 `refreshToken()` 真正的 token 刷新逻辑
- [ ] `getClient()` 兼容旧 OAuth 1.0a 和新 OAuth 2.0 token 格式
- [ ] 新增 `X_CLIENT_ID` / `X_CLIENT_SECRET` 环境变量
- [ ] 端到端测试：新用户连接 → 发帖 → token 过期 → 自动刷新
- [ ] 验证已有用户的 OAuth 1.0a token 仍可正常工作

### 阶段 1 — 扩展融合（3-5天）

- [ ] 将 Wechatsync 25个平台适配器复制进 `apps/extension/src/wechatsync/`
- [ ] `background.ts` 新增 `SYNC_ARTICLE` / `CHECK_AUTH` 消息处理
- [ ] 更新 manifest 权限（tabs, scripting, host_permissions 全量）
- [ ] 后端新建 `BaseWechatsyncProvider` 基类
- [ ] 为 25 个国内平台各创建 Provider 文件
- [ ] 前端集成页新增国内平台卡片，提示"请先登录该平台网站"

### 阶段 2 — MCP 全渠道升级（2-3天）

- [ ] 现有 MCP 工具 `sync_article` 支持国际 OAuth2 渠道（当前只支持扩展）
- [ ] 新增 `schedule_post` MCP 工具（调 Temporal）
- [ ] 验证 Claude / Gemini / Antigravity 全部可正常接入

### 阶段 3 — A2A 协议（3-4天）

- [ ] 新建 `apps/backend/src/api/routes/a2a.controller.ts`
- [ ] 实现 `GET /a2a/agent-card` 和 `POST /a2a/tasks`
- [ ] API Key 双向认证
- [ ] Copilot 工具集新增 `openclaw_analysis` 工具（可选）
- [ ] 与 Openclaw 团队联调

### 阶段 4 — Agent 多模型支持（2-3天）

- [ ] 抽象 `createLLM()` 工厂函数
- [ ] 支持 Google Gemini / Anthropic / OpenRouter
- [ ] 环境变量切换，无需改代码

---

## 九、新增环境变量汇总

```env
# ── 品牌与访问 ──
FRONTEND_URL="https://app.xpoz.com"
BACKEND_URL="https://api.xpoz.com"

# ── Chrome Extension ──
EXTENSION_ID=""                   # XPoz Extension 的 Chrome Extension ID

# ── X (Twitter) OAuth 2.0 升级 ──
X_CLIENT_ID=""                    # X Developer Portal → OAuth 2.0 Client ID
X_CLIENT_SECRET=""                # X Developer Portal → OAuth 2.0 Client Secret
# 保留原有 OAuth 1.0a 变量（向后兼容已连接用户）：
# X_API_KEY=""                    # Consumer Key（原有）
# X_API_SECRET=""                 # Consumer Secret（原有）

# ── AI Agent 模型配置 ──
AI_PROVIDER="openai"              # openai | google | anthropic | openrouter
OPENAI_MODEL="gpt-4.1"
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.5-pro"
ANTHROPIC_API_KEY=""
ANTHROPIC_MODEL="claude-opus-4-5"
OPENROUTER_API_KEY=""
OPENROUTER_MODEL=""

# ── A2A 协议（Openclaw 互通）──
OPENCLAW_A2A_URL=""               # Openclaw A2A 端点（空则不主动调用）
OPENCLAW_A2A_KEY=""               # Openclaw 发请求给 XPoz 时的验证 Key
XPOZ_A2A_KEY=""                   # XPoz 发请求给 Openclaw 时携带的 Key
```

---

## 十、平台全景（目标态）

| 类别 | 平台数 | 接入方式 |
|------|--------|---------|
| 国际 OAuth2/API | 30+ | 后端直接，无需扩展 |
| 国内扩展直发 | 25 | XPoz Extension（Wechatsync 适配器） |
| **合计** | **55+** | |

> **用户价值**：一个平台，管理国内外全部社交媒体渠道，AI 辅助内容创作，定时批量发布。
