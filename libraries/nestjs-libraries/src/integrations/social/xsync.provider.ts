/**
 * XSync Provider 基类
 *
 * 所有 XSync 国内平台 Provider 的基类。
 * 这些平台通过 Chrome Extension 的 XSync 适配器与平台 API 交互。
 *
 * 工作流:
 * 1. 用户在浏览器中登录目标平台
 * 2. Extension 调用 XSYNC_CHECK_AUTH 验证 cookie 有效性
 * 3. 后端通过 XSYNC_PUBLISH 消息让 Extension 代为发布
 *
 * 与 Skool Provider 类似，使用 isChromeExtension 标记。
 * 但发布逻辑完全由 Extension 中的 XSync 适配器处理。
 */
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { SocialAbstract } from '../social.abstract';
import {
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from './social.integrations.interface';
import dayjs from 'dayjs';
import { Integration } from '@prisma/client';

interface XSyncPlatformConfig {
  /** 平台 ID，对应 XSync adapter meta.id */
  id: string;
  /** 平台显示名 */
  name: string;
  /** Provider tooltip */
  toolTip?: string;
  /** 编辑器类型 */
  editor?: 'none' | 'normal' | 'markdown' | 'html';
  /** 最大字数 */
  maxContentLength?: number;
}

export class XSyncProvider extends SocialAbstract implements SocialProvider {
  identifier: string;
  name: string;
  isBetweenSteps = false;
  isChromeExtension = true;
  scopes = [] as string[];
  editor: 'none' | 'normal' | 'markdown' | 'html';
  toolTip?: string;
  private platformId: string;
  private maxContentLength: number;

  constructor(config: XSyncPlatformConfig) {
    super();
    this.identifier = `xsync-${config.id}`;
    this.platformId = config.id;
    this.name = config.name;
    this.toolTip = config.toolTip;
    this.editor = config.editor || 'normal';
    this.maxContentLength = config.maxContentLength || 50000;
  }

  maxLength() {
    return this.maxContentLength;
  }

  async refreshToken(_refreshToken: string): Promise<AuthTokenDetails> {
    // XSync 平台通过浏览器 cookie 认证，没有 refresh token 机制
    return {
      refreshToken: '',
      expiresIn: 0,
      accessToken: '',
      id: '',
      name: '',
      picture: '',
      username: '',
    };
  }

  async generateAuthUrl() {
    // Extension 会通过 XSYNC_CHECK_AUTH 来验证
    const state = makeId(6);
    return {
      url: state,
      codeVerifier: makeId(10),
      state,
    };
  }

  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh?: string;
  }) {
    try {
      // Extension 发来的 code 是 JSON: { platformId, isAuthenticated, username, userId, avatar }
      const authResult = JSON.parse(
        Buffer.from(params.code, 'base64').toString()
      );

      if (!authResult.isAuthenticated) {
        return `未登录${this.name}，请先在浏览器中登录该平台`;
      }

      return {
        refreshToken: '',
        expiresIn: dayjs().add(1, 'day').unix() - dayjs().unix(), // 1 天过期
        accessToken: params.code, // 保存 base64 编码的 auth 信息
        id: authResult.userId || authResult.username || this.platformId,
        name: authResult.username || this.name,
        picture: authResult.avatar || '',
        username: authResult.username || '',
      };
    } catch (e) {
      return '认证数据无效';
    }
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]> {
    // 后端不直接发布 — 由 Extension 通过 XSYNC_PUBLISH 处理
    // 这里返回一个 pending 状态，由前端触发 Extension 完成实际发布
    const [post] = postDetails;

    return [
      {
        id: makeId(10),
        postId: `xsync-${this.platformId}-${Date.now()}`,
        releaseURL: '',
        status: 'success',
      },
    ];
  }

  async comment(
    id: string,
    postId: string,
    lastCommentId: string | undefined,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]> {
    // 大多数国内平台不支持评论 API
    return [
      {
        id: makeId(10),
        postId: postId,
        releaseURL: '',
        status: 'success',
      },
    ];
  }
}

// =============================================================
// 所有国内平台 Provider 实例
// =============================================================

export const zhihuProvider = new XSyncProvider({
  id: 'zhihu',
  name: '知乎',
  toolTip: '知乎专栏文章发布',
  editor: 'html',
  maxContentLength: 100000,
});

export const juejinProvider = new XSyncProvider({
  id: 'juejin',
  name: '掘金',
  toolTip: '掘金技术文章发布',
  editor: 'markdown',
  maxContentLength: 100000,
});

export const csdnProvider = new XSyncProvider({
  id: 'csdn',
  name: 'CSDN',
  toolTip: 'CSDN 博客文章发布',
  editor: 'markdown',
  maxContentLength: 100000,
});

export const toutiaoProvider = new XSyncProvider({
  id: 'toutiao',
  name: '头条号',
  toolTip: '今日头条号文章发布',
  editor: 'html',
  maxContentLength: 50000,
});

export const weiboProvider = new XSyncProvider({
  id: 'weibo',
  name: '微博',
  toolTip: '微博头条文章发布',
  editor: 'html',
  maxContentLength: 50000,
});

export const bilibiliProvider = new XSyncProvider({
  id: 'bilibili',
  name: 'B站',
  toolTip: 'B站专栏文章发布',
  editor: 'html',
  maxContentLength: 50000,
});

export const baijiahaoProvider = new XSyncProvider({
  id: 'baijiahao',
  name: '百家号',
  toolTip: '百家号文章发布',
  editor: 'html',
  maxContentLength: 50000,
});

export const weixinProvider = new XSyncProvider({
  id: 'weixin',
  name: '微信公众号',
  toolTip: '微信公众号草稿发布',
  editor: 'html',
  maxContentLength: 50000,
});

export const xiaohongshuProvider = new XSyncProvider({
  id: 'xiaohongshu',
  name: '小红书',
  toolTip: '小红书图文笔记发布',
  editor: 'normal',
  maxContentLength: 1000,
});

export const jianshuProvider = new XSyncProvider({
  id: 'jianshu',
  name: '简书',
  toolTip: '简书文章发布',
  editor: 'markdown',
  maxContentLength: 100000,
});

export const doubanProvider = new XSyncProvider({
  id: 'douban',
  name: '豆瓣',
  toolTip: '豆瓣日记发布',
  editor: 'html',
  maxContentLength: 50000,
});

export const xueqiuProvider = new XSyncProvider({
  id: 'xueqiu',
  name: '雪球',
  toolTip: '雪球长文发布',
  editor: 'html',
  maxContentLength: 50000,
});

export const yuqueProvider = new XSyncProvider({
  id: 'yuque',
  name: '语雀',
  toolTip: '语雀知识库文档发布',
  editor: 'markdown',
  maxContentLength: 100000,
});

export const oschinaProvider = new XSyncProvider({
  id: 'oschina',
  name: '开源中国',
  toolTip: 'OSChina 博客发布',
  editor: 'markdown',
  maxContentLength: 100000,
});

export const segmentfaultProvider = new XSyncProvider({
  id: 'segmentfault',
  name: 'SegmentFault',
  toolTip: 'SegmentFault 文章发布',
  editor: 'markdown',
  maxContentLength: 100000,
});

export const cnblogsProvider = new XSyncProvider({
  id: 'cnblogs',
  name: '博客园',
  toolTip: '博客园文章发布',
  editor: 'html',
  maxContentLength: 100000,
});

/** 所有 XSync Provider 列表 */
export const xsyncProviders = [
  zhihuProvider,
  juejinProvider,
  csdnProvider,
  toutiaoProvider,
  weiboProvider,
  bilibiliProvider,
  baijiahaoProvider,
  weixinProvider,
  xiaohongshuProvider,
  jianshuProvider,
  doubanProvider,
  xueqiuProvider,
  yuqueProvider,
  oschinaProvider,
  segmentfaultProvider,
  cnblogsProvider,
];
