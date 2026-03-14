'use client';

/**
 * XSync 国内平台通用预览组件
 *
 * 仿微信公众号/知乎文章卡片风格，适用于所有 xsync-* 平台。
 * 超字数内容用红色高亮标注（与国外平台行为一致）。
 */
import { useIntegration } from '@xpoz/frontend/components/launches/helpers/use.integration';
import { useMediaDirectory } from '@xpoz/react/helpers/use.media.directory';
import { textSlicer } from '@xpoz/helpers/utils/count.length';
import { stripHtmlValidation } from '@xpoz/helpers/utils/strip.html.validation';
import { VideoOrImage } from '@xpoz/react/helpers/video.or.image';
import { FC } from 'react';

/** 平台品牌色映射（25 个 XSync 平台全覆盖）*/
const PLATFORM_COLORS: Record<string, string> = {
  'xsync-weixin':       '#07C160', // 微信绿
  'xsync-weibo':        '#E6162D', // 微博红
  'xsync-zhihu':        '#0066FF', // 知乎蓝
  'xsync-toutiao':      '#FE2C55', // 头条橙红
  'xsync-xiaohongshu':  '#FF2442', // 小红书红
  'xsync-bilibili':     '#00A1D6', // B站蓝
  'xsync-baijiahao':    '#2468F2', // 百家号蓝
  'xsync-juejin':       '#1E80FF', // 掘金蓝
  'xsync-csdn':         '#FC5531', // CSDN 橙
  'xsync-jianshu':      '#EA6F5A', // 简书橙
  'xsync-douban':       '#007722', // 豆瓣绿
  'xsync-xueqiu':       '#F5A623', // 雪球橙
  'xsync-yuque':        '#3B7DDD', // 语雀蓝
  'xsync-oschina':      '#ED1C24', // 开源中国红
  'xsync-segmentfault': '#009A63', // SegmentFault 绿
  'xsync-cnblogs':      '#5C833D', // 博客园绿
  'xsync-woshipm':      '#FF6400', // 人人都是产品经理橙
  'xsync-sohu':         '#FF6600', // 搜狐橙
  'xsync-dayu':         '#FF6A00', // 大鱼号橙
  'xsync-51cto':        '#FF6C00', // 51CTO 橙
  'xsync-yidian':       '#E02020', // 一点号红
  'xsync-eastmoney':    '#C8241A', // 东方财富红
  'xsync-imooc':        '#3F86FF', // 慕课网蓝
  'xsync-sohufocus':    '#FF8C00', // 搜狐焦点橙
};

function getPlatformColor(identifier: string): string {
  return PLATFORM_COLORS[identifier] || '#6B7280';
}

export const XSyncPreview: FC<{ maximumCharacters?: number }> = (props) => {
  const { value: topValue, integration } = useIntegration();
  const mediaDir = useMediaDirectory();
  const color = getPlatformColor(integration?.identifier || '');

  const renderContent = topValue.map((p) => {
    // 剥离 HTML 标签获取纯文本用于字数限制显示
    const rawText = p.content
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();

    const { start, end } = textSlicer(
      integration?.identifier || '',
      props.maximumCharacters || 50000,
      rawText
    );

    const visibleText = rawText.slice(start, end);
    const overflowText = rawText.slice(end);

    return { visibleText, overflowText, images: p.image, raw: rawText };
  });

  const firstContent = renderContent[0];
  if (!firstContent) return null;

  return (
    <div
      className="w-full flex flex-col bg-white dark:bg-gray-900 rounded-[12px] overflow-hidden border border-gray-200 dark:border-gray-700"
      style={{ fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif' }}
    >
      {/* 顶部平台标识栏 */}
      <div
        className="flex items-center gap-[8px] px-[16px] py-[10px]"
        style={{ backgroundColor: color + '15', borderBottom: `2px solid ${color}` }}
      >
        <img
          src={integration?.picture || '/no-picture.jpg'}
          alt={integration?.name}
          className="w-[28px] h-[28px] rounded-full"
        />
        <div className="flex flex-col leading-none">
          <span className="text-[13px] font-[600]" style={{ color }}>
            {integration?.name}
          </span>
          <span className="text-[11px] text-gray-400 mt-[1px]">
            {integration?.display || '作者'}
          </span>
        </div>
        <div className="ml-auto">
          <span
            className="text-[10px] font-[500] px-[8px] py-[3px] rounded-full text-white"
            style={{ backgroundColor: color }}
          >
            XSync
          </span>
        </div>
      </div>

      {/* 内容区 */}
      <div className="px-[16px] py-[14px] flex flex-col gap-[12px]">
        <div className="text-[14px] leading-[1.7] text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words">
          <span>{firstContent.visibleText}</span>
          {firstContent.overflowText && (
            <mark
              className="bg-red-500 text-white"
              data-tooltip-id="tooltip"
              data-tooltip-content="该内容超出平台字数限制，将被截断"
            >
              {firstContent.overflowText}
            </mark>
          )}
        </div>

        {/* 字数统计 */}
        <div className="flex justify-end">
          <span
            className={`text-[11px] ${
              firstContent.raw.length > (props.maximumCharacters || 50000)
                ? 'text-red-500 font-[600]'
                : 'text-gray-400'
            }`}
          >
            {firstContent.raw.length} / {props.maximumCharacters || 50000}
          </span>
        </div>

        {/* 图片区 */}
        {!!firstContent.images?.length && (
          <div
            className={`w-full rounded-[8px] overflow-hidden ${
              firstContent.images.length === 1
                ? 'max-h-[300px]'
                : 'grid gap-[4px]'
            }`}
            style={
              firstContent.images.length > 1
                ? { gridTemplateColumns: `repeat(${Math.min(firstContent.images.length, 3)}, 1fr)` }
                : undefined
            }
          >
            {firstContent.images.map((image, index) => (
              <a
                key={`img_${index}`}
                href={mediaDir.set(image.path)}
                target="_blank"
                rel="noreferrer"
                className="flex-1 overflow-hidden"
              >
                <VideoOrImage
                  autoplay={false}
                  src={mediaDir.set(image.path)}
                />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* 底部操作栏（仿平台风格）*/}
      <div
        className="px-[16px] py-[10px] flex items-center gap-[20px] border-t border-gray-100 dark:border-gray-700 text-gray-400"
        style={{ fontSize: '12px' }}
      >
        <div className="flex items-center gap-[4px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          点赞
        </div>
        <div className="flex items-center gap-[4px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          评论
        </div>
        <div className="flex items-center gap-[4px] ml-auto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          分享
        </div>
      </div>
    </div>
  );
};
