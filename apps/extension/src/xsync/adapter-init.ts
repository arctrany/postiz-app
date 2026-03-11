/**
 * XSync 适配器初始化
 * 注册所有国内平台适配器到全局 Registry
 */
import { adapterRegistry } from './adapters/registry'
import { createChromeRuntime } from './chrome-runtime'
import type { RuntimeInterface } from './runtime/interface'

// 导入所有平台适配器
import { ZhihuAdapter } from './adapters/platforms/zhihu'
import { JuejinAdapter } from './adapters/platforms/juejin'
import { CSDNAdapter } from './adapters/platforms/csdn'
import { ToutiaoAdapter } from './adapters/platforms/toutiao'
import { WeiboAdapter } from './adapters/platforms/weibo'
import { BilibiliAdapter } from './adapters/platforms/bilibili'
import { BaijiahaoAdapter } from './adapters/platforms/baijiahao'
import { WeixinAdapter } from './adapters/platforms/weixin'
import { XiaohongshuAdapter } from './adapters/platforms/xiaohongshu'
import { JianshuAdapter } from './adapters/platforms/jianshu'
import { DoubanAdapter } from './adapters/platforms/douban'
import { XueqiuAdapter } from './adapters/platforms/xueqiu'
import { SohuAdapter } from './adapters/platforms/sohu'
import { DaYuAdapter } from './adapters/platforms/dayu'
import { WoshipmAdapter } from './adapters/platforms/woshipm'
import { YuqueAdapter } from './adapters/platforms/yuque'
import { YidianAdapter } from './adapters/platforms/yidian'
import { Cto51Adapter } from './adapters/platforms/cto51'
import { SohuFocusAdapter } from './adapters/platforms/sohufocus'
import { ImoocAdapter } from './adapters/platforms/imooc'
import { OschinaAdapter } from './adapters/platforms/oschina'
import { SegmentfaultAdapter } from './adapters/platforms/segmentfault'
import { CnblogsAdapter } from './adapters/platforms/cnblogs'
import { EastmoneyAdapter } from './adapters/platforms/eastmoney'

let runtime: RuntimeInterface | null = null

/**
 * 注册所有适配器
 */
function registerAllAdapters(): void {
  const adapters = [
    ZhihuAdapter,
    JuejinAdapter,
    CSDNAdapter,
    ToutiaoAdapter,
    WeiboAdapter,
    BilibiliAdapter,
    BaijiahaoAdapter,
    WeixinAdapter,
    XiaohongshuAdapter,
    JianshuAdapter,
    DoubanAdapter,
    XueqiuAdapter,
    SohuAdapter,
    DaYuAdapter,
    WoshipmAdapter,
    YuqueAdapter,
    YidianAdapter,
    Cto51Adapter,
    SohuFocusAdapter,
    ImoocAdapter,
    OschinaAdapter,
    SegmentfaultAdapter,
    CnblogsAdapter,
    EastmoneyAdapter,
  ]

  for (const AdapterClass of adapters) {
    const instance = new AdapterClass()
    adapterRegistry.register({
      meta: instance.meta,
      factory: (rt) => {
        const adapter = new AdapterClass()
        adapter.init(rt)
        return adapter
      },
      preprocessConfig: (instance as any).preprocessConfig,
    })
  }
}

/**
 * 初始化 XSync
 */
export function initXSync(): void {
  runtime = createChromeRuntime()
  adapterRegistry.setRuntime(runtime)
  registerAllAdapters()
  console.log(`[XPoz] XSync initialized with ${adapterRegistry.getRegisteredIds().length} adapters`)
}

/**
 * 获取适配器 Registry
 */
export { adapterRegistry }

/**
 * 获取当前 Runtime
 */
export function getRuntime(): RuntimeInterface | null {
  return runtime
}
