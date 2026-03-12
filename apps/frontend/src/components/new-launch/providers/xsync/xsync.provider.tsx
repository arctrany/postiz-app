'use client';

/**
 * XSync 国内平台通用 Provider
 *
 * 所有 25 个 xsync-* 平台共用此 Provider。
 * 通过 withProvider HoC 提供 Editor + Preview + 字数限制，
 * 与国外平台架构完全一致。
 */
import {
  PostComment,
  withProvider,
} from '@xpoz/frontend/components/new-launch/providers/high.order.provider';
import { FC } from 'react';
import { useSettings } from '@xpoz/frontend/components/launches/helpers/use.values';
import { Input } from '@xpoz/react/form/input';
import { useIntegration } from '@xpoz/frontend/components/launches/helpers/use.integration';
import { XSyncPreview } from './xsync.preview';

/**
 * 微信公众号专用设置：摘要 + 作者
 */
const WeixinSettings: FC = () => {
  const form = useSettings();
  return (
    <div className="flex flex-col gap-[8px]">
      <Input
        label="文章摘要（选填）"
        placeholder="简短描述文章内容，显示在消息列表中"
        {...form.register('digest')}
      />
      <Input
        label="作者（选填）"
        placeholder="文章作者名称"
        {...form.register('author')}
      />
    </div>
  );
};

/**
 * 知乎专用设置：话题标签
 */
const ZhihuSettings: FC = () => {
  const form = useSettings();
  return (
    <Input
      label="话题标签（选填）"
      placeholder="如：科技 互联网（空格分隔）"
      {...form.register('topics')}
    />
  );
};

/**
 * 微博专用设置：#话题#
 */
const WeiboSettings: FC = () => {
  const form = useSettings();
  return (
    <Input
      label="#话题#（选填）"
      placeholder="如：科技新闻（不含#符号）"
      {...form.register('topic')}
    />
  );
};

/**
 * 头条号专用设置：分类
 */
const ToutiaoSettings: FC = () => {
  const form = useSettings();
  return (
    <Input
      label="文章标题（选填）"
      placeholder="头条文章标题"
      {...form.register('title')}
    />
  );
};

/**
 * 通用设置组件：标题（适用于博客类平台）
 */
const ArticleSettings: FC = () => {
  const form = useSettings();
  return (
    <Input
      label="文章标题（选填）"
      placeholder="文章标题"
      {...form.register('title')}
    />
  );
};

// ============================================================
// withProvider 包裹 — 各平台最大字数与 xsync.provider.ts 保持一致
// ============================================================

/** 通用 XSync Provider（适用短内容平台：微博、小红书等）*/
const XSyncGeneralProvider = withProvider({
  minimumCharacters: [],
  SettingsComponent: undefined,
  CustomPreviewComponent: XSyncPreview,
  dto: undefined,
  maximumCharacters: 50000,
  postComment: PostComment.NONE,
});

export const XSyncWeixinProvider = withProvider({
  minimumCharacters: [],
  SettingsComponent: WeixinSettings,
  CustomPreviewComponent: XSyncPreview,
  dto: undefined,
  maximumCharacters: 50000,
  postComment: PostComment.NONE,
});

export const XSyncZhihuProvider = withProvider({
  minimumCharacters: [],
  SettingsComponent: ZhihuSettings,
  CustomPreviewComponent: XSyncPreview,
  dto: undefined,
  maximumCharacters: 100000,
  postComment: PostComment.NONE,
});

export const XSyncWeiboProvider = withProvider({
  minimumCharacters: [],
  SettingsComponent: WeiboSettings,
  CustomPreviewComponent: XSyncPreview,
  dto: undefined,
  maximumCharacters: 50000,
  postComment: PostComment.NONE,
});

export const XSyncToutiaoProvider = withProvider({
  minimumCharacters: [],
  SettingsComponent: ToutiaoSettings,
  CustomPreviewComponent: XSyncPreview,
  dto: undefined,
  maximumCharacters: 50000,
  postComment: PostComment.NONE,
});

/** 博客类平台（掘金、CSDN、简书、语雀等）— 带标题设置 */
export const XSyncArticleProvider = withProvider({
  minimumCharacters: [],
  SettingsComponent: ArticleSettings,
  CustomPreviewComponent: XSyncPreview,
  dto: undefined,
  maximumCharacters: 100000,
  postComment: PostComment.NONE,
});

/** 小红书：字数 1000 */
export const XSyncXiaohongshuProvider = withProvider({
  minimumCharacters: [],
  SettingsComponent: undefined,
  CustomPreviewComponent: XSyncPreview,
  dto: undefined,
  maximumCharacters: 1000,
  postComment: PostComment.NONE,
});

export default XSyncGeneralProvider;
