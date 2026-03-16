'use client';

/**
 * useXSyncPublisher — XSync 国内平台 Chrome Extension 发布轮询 hook
 *
 * 工作流程：
 *   1. 定时轮询 GET /posts/pending-extension
 *   2. 发现 PENDING_EXTENSION 帖子后，通过 chrome.runtime.sendMessage 通知 XPoz Extension
 *   3. Extension 完成发布后，调用 POST /posts/:id/mark-published 回写状态
 *
 * 轮询策略：
 *   - 初始间隔：5 秒（发布后快速感知）
 *   - 无 pending 帖子时逐步退避到 30 秒（自适应间隔）
 *   - 每个帖子最多重试 5 次，超出后标记为 ERROR
 *
 * 使用方式：在 (site)/layout.tsx 或顶层 Provider 中调用一次：
 *   useXSyncPublisher();
 */
import { useEffect, useRef } from 'react';

/** XPoz Extension 的 Chrome Extension ID，与 manifest.json 中 externally_connectable 匹配 */
const XPOZ_EXTENSION_ID =
  process.env.NEXT_PUBLIC_XPOZ_EXTENSION_ID || 'xpozextensionid';

/** 轮询间隔边界（毫秒）*/
const POLL_MIN_MS  =  5_000;  // 5 秒：有 pending 帖子时的最小间隔
const POLL_MAX_MS  = 30_000;  // 30 秒：无 pending 帖子时退避到的最大间隔
const POLL_BACK_MS =  5_000;  // 每次无任务后，间隔增加的步长

/** 单个帖子的最大重试次数（超出后标记 ERROR） */
const MAX_RETRIES = 5;

interface PendingPost {
  id: string;
  content: string;
  publishDate: string;
  settings: string | null;
  image: string | null;
  integration: {
    id: string;
    name: string;
    providerIdentifier: string;
    picture: string | null;
    type: string;
    token: string;
  };
}

async function fetchPendingPosts(): Promise<PendingPost[]> {
  try {
    const res = await fetch('/api/posts/pending-extension', {
      credentials: 'include',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function markPublished(
  postId: string,
  releaseURL?: string,
  error?: string
) {
  try {
    await fetch(`/api/posts/${postId}/mark-published`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ releaseURL, error }),
    });
  } catch (err) {
    console.error('[XSyncPublisher] mark-published failed', err);
  }
}

async function triggerExtension(post: PendingPost): Promise<void> {
  return new Promise((resolve) => {
    // 检查 Chrome Extension API 是否可用
    if (
      typeof window === 'undefined' ||
      !('chrome' in window) ||
      !chrome.runtime?.sendMessage
    ) {
      console.warn(
        '[XSyncPublisher] Chrome Extension API 不可用，跳过',
        post.integration.providerIdentifier
      );
      resolve();
      return;
    }

    // 解析 settings，提取平台特定选项
    const settings: Record<string, unknown> = post.settings
      ? JSON.parse(post.settings)
      : {};
    const images: string[] = post.image ? JSON.parse(post.image) : [];

    /**
     * 消息结构与 Extension types/messages.ts XSyncPublishRequest 严格对齐：
     *   type: 'XSYNC_PUBLISH'
     *   platformId: string           (from providerIdentifier, e.g. 'xsync-zhihu')
     *   article: { title, markdown, cover, tags, category }
     *   options?: { draftOnly }
     */
    const payload = {
      type: 'XSYNC_PUBLISH' as const,
      // Extension 使用 providerIdentifier 直接作为 platformId
      platformId: post.integration.providerIdentifier,
      article: {
        title:    (settings.title as string) || post.content.slice(0, 50),
        markdown: post.content,
        cover:    images[0] || undefined,
        tags:     (settings.tags as string[]) || undefined,
        category: (settings.category as string) || undefined,
        summary:  (settings.summary as string) || undefined,
      },
      options: {
        draftOnly: Boolean(settings.draftOnly),
      },
    };

    chrome.runtime.sendMessage(
      XPOZ_EXTENSION_ID,
      payload,
      (response: { success: boolean; postUrl?: string; error?: string }) => {
        if (chrome.runtime.lastError) {
          console.warn(
            '[XSyncPublisher] Extension 通信失败:',
            chrome.runtime.lastError.message
          );
          // Extension 不在线，不标记错误（下次轮询重试）
          resolve();
          return;
        }

        if (response?.success) {
          markPublished(post.id, response.postUrl).then(resolve);
        } else {
          markPublished(
            post.id,
            undefined,
            response?.error || 'Extension 发布失败'
          ).then(resolve);
        }
      }
    );
  });
}

export function useXSyncPublisher() {
  const processingRef = useRef<Set<string>>(new Set());
  const retryCountRef = useRef<Map<string, number>>(new Map());
  const pollIntervalRef = useRef<number>(POLL_MIN_MS);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const posts = await fetchPendingPosts();
      const unprocessed = posts.filter(
        (p) => !processingRef.current.has(p.id)
      );

      // 自适应轮询间隔：有任务时保持最小间隔，无任务时退避
      if (unprocessed.length > 0) {
        pollIntervalRef.current = POLL_MIN_MS;
      } else {
        pollIntervalRef.current = Math.min(
          pollIntervalRef.current + POLL_BACK_MS,
          POLL_MAX_MS
        );
      }

      for (const post of unprocessed) {
        // 检查重试次数上限
        const retries = retryCountRef.current.get(post.id) || 0;
        if (retries >= MAX_RETRIES) {
          if (!processingRef.current.has(`${post.id}:errored`)) {
            processingRef.current.add(`${post.id}:errored`);
            console.error(
              `[XSyncPublisher] 帖子 ${post.id} 超过最大重试次数 (${MAX_RETRIES})，标记 ERROR`
            );
            markPublished(post.id, undefined, `超过最大重试次数 ${MAX_RETRIES} 次`);
          }
          continue;
        }

        processingRef.current.add(post.id);
        retryCountRef.current.set(post.id, retries + 1);

        triggerExtension(post).finally(() => {
          processingRef.current.delete(post.id);
        });
      }

      // 用 setTimeout 替换 setInterval，动态调整间隔
      timeoutId = setTimeout(poll, pollIntervalRef.current);
    };

    // 立即执行一次，之后按动态间隔轮询
    poll();

    return () => clearTimeout(timeoutId);
  }, []);
}
