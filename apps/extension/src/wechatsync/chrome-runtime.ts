/**
 * Chrome Extension Runtime
 * 实现 RuntimeInterface，让 Wechatsync 适配器在 Chrome Extension Service Worker 中运行
 */
import type { RuntimeInterface, RuntimeConfig } from './runtime/interface'
import type { Cookie, HeaderRule } from './types'

let ruleCounter = 1000 // 从 1000 开始避免与其他规则冲突

export function createChromeRuntime(_config?: RuntimeConfig): RuntimeInterface {
  return {
    type: 'extension',

    // HTTP 请求 — Service Worker 中 fetch 自动携带 cookies
    async fetch(url: string, options?: RequestInit): Promise<Response> {
      return globalThis.fetch(url, {
        ...options,
        credentials: options?.credentials ?? 'include',
      })
    },

    // Cookie 管理
    cookies: {
      async get(domain: string): Promise<Cookie[]> {
        const cookies = await chrome.cookies.getAll({ domain })
        return cookies.map(c => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          secure: c.secure,
          httpOnly: c.httpOnly,
          expirationDate: c.expirationDate,
        }))
      },

      async set(cookie: Cookie): Promise<void> {
        await chrome.cookies.set({
          url: `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path || '/'}`,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          expirationDate: cookie.expirationDate,
        })
      },

      async remove(name: string, domain: string): Promise<void> {
        await chrome.cookies.remove({
          url: `https://${domain}`,
          name,
        })
      },
    },

    // 便捷方法: 获取单个 Cookie
    async getCookie(domain: string, name: string): Promise<string | null> {
      const cookie = await chrome.cookies.get({
        url: `https://${domain}`,
        name,
      })
      return cookie?.value ?? null
    },

    // 持久化存储
    storage: {
      async get<T>(key: string): Promise<T | null> {
        const result = await chrome.storage.local.get(key)
        return result[key] ?? null
      },

      async set<T>(key: string, value: T): Promise<void> {
        await chrome.storage.local.set({ [key]: value })
      },

      async remove(key: string): Promise<void> {
        await chrome.storage.local.remove(key)
      },
    },

    // 会话存储
    session: {
      async get<T>(key: string): Promise<T | null> {
        if (chrome.storage.session) {
          const result = await chrome.storage.session.get(key)
          return result[key] ?? null
        }
        return null
      },

      async set<T>(key: string, value: T): Promise<void> {
        if (chrome.storage.session) {
          await chrome.storage.session.set({ [key]: value })
        }
      },
    },

    // Header 规则管理 (declarativeNetRequest)
    headerRules: {
      async add(rule: HeaderRule): Promise<string> {
        const ruleId = ruleCounter++
        const id = String(ruleId)

        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: [{
            id: ruleId,
            priority: 1,
            action: {
              type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
              requestHeaders: Object.entries(rule.headers).map(([header, value]) => ({
                header,
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value,
              })),
            },
            condition: {
              urlFilter: rule.urlFilter,
              resourceTypes: (rule.resourceTypes || ['xmlhttprequest']) as chrome.declarativeNetRequest.ResourceType[],
            },
          }],
          removeRuleIds: [],
        })

        return id
      },

      async remove(ruleId: string): Promise<void> {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [Number(ruleId)],
          addRules: [],
        })
      },

      async clear(): Promise<void> {
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
        const ruleIds = existingRules.map(r => r.id)
        if (ruleIds.length > 0) {
          await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ruleIds,
            addRules: [],
          })
        }
      },
    },

    // Tab 管理
    tabs: {
      async query(urlPattern: string): Promise<Array<{ id: number; url?: string }>> {
        const tabs = await chrome.tabs.query({ url: urlPattern })
        return tabs.filter(t => t.id !== undefined).map(t => ({ id: t.id!, url: t.url }))
      },

      async create(url: string, active?: boolean): Promise<{ id: number }> {
        const tab = await chrome.tabs.create({ url, active: active ?? false })
        return { id: tab.id! }
      },

      async waitForLoad(tabId: number, timeout = 30000): Promise<void> {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener)
            reject(new Error(`Tab load timeout after ${timeout}ms`))
          }, timeout)

          const listener = (id: number, changeInfo: chrome.tabs.TabChangeInfo) => {
            if (id === tabId && changeInfo.status === 'complete') {
              clearTimeout(timer)
              chrome.tabs.onUpdated.removeListener(listener)
              resolve()
            }
          }

          chrome.tabs.onUpdated.addListener(listener)
        })
      },

      async executeScript<T>(
        tabId: number,
        func: (...args: any[]) => T | Promise<T>,
        args: any[]
      ): Promise<T> {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func,
          args: args as any[],
        })
        return results[0]?.result as T
      },
    },

    // DOM 操作 — 在 Service Worker 中不可用
    // 需要通过 Offscreen Document 或 Content Script 代理
    dom: {
      async parseHTML(_html: string): Promise<Document> {
        // Service Worker 没有 DOM，返回空文档占位
        throw new Error('DOM parsing not available in Service Worker. Use preprocessed content.')
      },
      querySelector(_doc: Document, _selector: string): Element | null {
        return null
      },
      querySelectorAll(_doc: Document, _selector: string): Element[] {
        return []
      },
      getTextContent(_element: Element): string {
        return ''
      },
      getInnerHTML(_element: Element): string {
        return ''
      },
    },
  }
}
