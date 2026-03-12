'use client';

/**
 * useXSyncPublisher — XSync 国内平台 Chrome Extension 发布轮询 hook
 *
 * 工作流程：
 *   1. 定时轮询 GET /posts/pending-extension
 *   2. 发现 PENDING_EXTENSION 帖子后，通过 chrome.runtime.sendMessage 通知 XPoz Extension
 *   3. Extension 完成发布后，调用 POST /posts/:id/mark-published 回写状态
 *
 * 使用方式：在 (site)/layout.tsx 或顶层 Provider 中调用一次：
 *   useXSyncPublisher();
 */
import { useEffect, useRef } from 'react';

/** XPoz Extension 的 Chrome Extension ID，与 manifest.json 中 externally_connectable 匹配 */
const XPOZ_EXTENSION_ID =
  process.env.NEXT_PUBLIC_XPOZ_EXTENSION_ID || 'xpozextensionid';

/** 轮询间隔（毫秒），默认 30 秒 */
const POLL_INTERVAL_MS = 30_000;

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

    const payload = {
      type: 'XSYNC_PUBLISH',
      postId: post.id,
      provider: post.integration.providerIdentifier,
      content: post.content,
      settings: post.settings ? JSON.parse(post.settings) : {},
      images: post.image ? JSON.parse(post.image) : [],
      token: post.integration.token, // JWT 格式，包含 userId/cookies 信息
    };

    chrome.runtime.sendMessage(
      XPOZ_EXTENSION_ID,
      payload,
      (response: { success: boolean; releaseURL?: string; error?: string }) => {
        if (chrome.runtime.lastError) {
          console.error(
            '[XSyncPublisher] Extension 通信失败:',
            chrome.runtime.lastError.message
          );
          // Extension 不在线，不标记错误（下次轮询重试）
          resolve();
          return;
        }

        if (response?.success) {
          markPublished(post.id, response.releaseURL).then(resolve);
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

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const poll = async () => {
      const posts = await fetchPendingPosts();
      const unprocessed = posts.filter(
        (p) => !processingRef.current.has(p.id)
      );

      for (const post of unprocessed) {
        processingRef.current.add(post.id);
        triggerExtension(post).finally(() => {
          processingRef.current.delete(post.id);
        });
      }
    };

    // 立即执行一次，再按间隔轮询
    poll();
    timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);
}
