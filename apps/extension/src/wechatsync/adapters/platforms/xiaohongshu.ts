/**
 * 小红书适配器
 *
 * 通过 XHS Creator API 发布文章。
 * 图片处理：已在 XHS CDN 的图片直接跳过。
 * 内容格式：将 markdown 转为 HTML，通过 executeScript 注入编辑器发布。
 */
import { CodeAdapter, type ImageUploadResult } from '../code-adapter'
import type { Article, AuthResult, SyncResult, PlatformMeta } from '../../types'
import type { PublishOptions } from '../types'
import { createLogger } from '../../lib/logger'

const logger = createLogger('Xiaohongshu')

const XHS_CREATOR_URL = 'https://creator.xiaohongshu.com/publish/publish?from=menu&target=article'
const XHS_API_BASE = 'https://creator.xiaohongshu.com'

// 小红书 CDN 域名 — 这些图片已在 XHS 服务器上，无需重新上传
const XHS_CDN_PATTERNS = [
    'xhscdn.com',
    'xiaohongshu.com',
    'xhsimg.com',
]

export class XiaohongshuAdapter extends CodeAdapter {
    readonly meta: PlatformMeta = {
        id: 'xiaohongshu',
        name: '小红书',
        icon: 'https://www.xiaohongshu.com/favicon.ico',
        homepage: XHS_CREATOR_URL,
        capabilities: ['article', 'draft', 'image_upload'],
    }

    private userId: string | null = null

    private readonly HEADER_RULES = [
        {
            urlFilter: '*://creator.xiaohongshu.com/*',
            headers: {
                'Origin': 'https://creator.xiaohongshu.com',
                'Referer': XHS_CREATOR_URL,
            },
            resourceTypes: ['xmlhttprequest' as const],
        },
        {
            urlFilter: '*://ros-upload.xiaohongshu.com/*',
            headers: {
                'Origin': 'https://creator.xiaohongshu.com',
                'Referer': 'https://creator.xiaohongshu.com/',
            },
            resourceTypes: ['xmlhttprequest' as const],
        },
    ]

    async checkAuth(): Promise<AuthResult> {
        try {
            await this.addHeaderRules(this.HEADER_RULES)
            const res = await this.get<{
                success: boolean
                data?: { userId: string; userName: string; userAvatar: string }
            }>(`${XHS_API_BASE}/api/galaxy/user/info`)
            await this.clearHeaderRules()

            if (res.success && res.data) {
                this.userId = res.data.userId
                return {
                    isAuthenticated: true,
                    userId: this.userId,
                    username: res.data.userName,
                    avatar: res.data.userAvatar,
                }
            }
            return { isAuthenticated: false, error: '未登录小红书创作者平台' }
        } catch (error) {
            await this.clearHeaderRules()
            return { isAuthenticated: false, error: (error as Error).message }
        }
    }

    async publish(article: Article, options?: PublishOptions): Promise<SyncResult> {
        await this.addHeaderRules(this.HEADER_RULES)
        try {
            logger.info('Starting publish to Xiaohongshu...')

            if (!this.runtime.tabs) {
                throw new Error('小红书发布需要浏览器 tabs API 支持')
            }

            // 确保已登录
            if (!this.userId && !(await this.checkAuth()).isAuthenticated) {
                throw new Error('请先登录小红书创作者平台')
            }

            // 确保有小红书创作者 tab
            const tabId = await this.ensureXHSTab()

            // 将 markdown 转为 HTML
            let htmlContent = this.markdownToHtml(article.markdown || article.html || article.content || '')

            // 处理图片 — 已在 XHS CDN 的图片直接跳过
            htmlContent = await this.processImages(
                htmlContent,
                async (src) => this.uploadImageByUrl(src),
                {
                    skipPatterns: XHS_CDN_PATTERNS,
                    onProgress: options?.onImageProgress,
                }
            )

            logger.info('Content prepared, injecting into editor...')

            // 通过 executeScript 注入到编辑器并发布
            const result = await this.runtime.tabs.executeScript<
                { success: boolean; error?: string; postUrl?: string },
                [string, string, boolean]
            >(
                tabId,
                async (title, html, shouldPublish) => {
                    try {
                        // 等一下让页面完全加载
                        await new Promise(r => setTimeout(r, 2000))

                        // 找到标题输入框并设置标题
                        const titleInput = document.querySelector<HTMLInputElement>(
                            'input[placeholder*="标题"], input[placeholder*="title"], .title-input input, .ql-title input'
                        )
                        if (titleInput) {
                            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                                HTMLInputElement.prototype, 'value'
                            )?.set
                            nativeInputValueSetter?.call(titleInput, title)
                            titleInput.dispatchEvent(new Event('input', { bubbles: true }))
                            titleInput.dispatchEvent(new Event('change', { bubbles: true }))
                        }

                        // 找到编辑器区域（ProseMirror / contenteditable）
                        const editor = document.querySelector<HTMLElement>(
                            '.ProseMirror, .ql-editor, [contenteditable="true"], .editor-container [contenteditable]'
                        )
                        if (!editor) {
                            return { success: false, error: '找不到编辑器区域，请确保在文章编辑页面' }
                        }

                        // 设置编辑器内容: ProseMirror 不支持 innerHTML，必须用 InputEvent 原生输入
                        editor.focus()
                        const sel = window.getSelection()
                        if (sel && sel.rangeCount > 0) {
                            const range = document.createRange()
                            range.selectNodeContents(editor)
                            sel.removeAllRanges()
                            sel.addRange(range)
                            sel.collapseToStart()
                        }

                        // 将 HTML 转为纯文本行
                        const plain = html
                            .replace(/<br\s*\/?>/gi, '\n')
                            .replace(/<\/p>/gi, '\n')
                            .replace(/<p>/gi, '')
                            .replace(/<img[^>]*>/gi, '')
                            .replace(/<[^>]+>/g, '')
                            .trim()

                        const lines = plain.split('\n')
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i]
                            if (i > 0) {
                                editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertParagraph' }))
                                editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertParagraph' }))
                            }
                            if (line) {
                                const be = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: line })
                                const handled = !editor.dispatchEvent(be)
                                if (!handled) {
                                    const tn = document.createTextNode(line)
                                    if (sel && sel.rangeCount > 0) {
                                        sel.getRangeAt(0).insertNode(tn)
                                        sel.collapseToEnd()
                                    }
                                }
                                editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: line }))
                            }
                        }

                        // 等待内容被编辑器接受
                        await new Promise(r => setTimeout(r, 1000))

                        if (shouldPublish) {
                            // 找到发布按钮并点击
                            const publishBtn = document.querySelector<HTMLElement>(
                                'button.publishBtn, button.publish-btn, button[class*="publish"], .btn-publish, button.red'
                            )

                            // 也尝试通过文字找
                            if (!publishBtn) {
                                const allButtons = document.querySelectorAll('button')
                                for (const btn of allButtons) {
                                    const text = btn.textContent?.trim()
                                    if (text === '发布' || text === '发布笔记' || text === '立即发布') {
                                        btn.click()
                                        await new Promise(r => setTimeout(r, 2000))
                                        return { success: true, postUrl: window.location.href }
                                    }
                                }
                                return { success: false, error: '找不到发布按钮' }
                            }

                            publishBtn.click()
                            await new Promise(r => setTimeout(r, 2000))
                            return { success: true, postUrl: window.location.href }
                        }

                        return { success: true, postUrl: window.location.href }
                    } catch (err: unknown) {
                        return { success: false, error: (err as Error).message }
                    }
                },
                [article.title, htmlContent, !(options?.draftOnly ?? false)]
            )

            await this.clearHeaderRules()

            if (!result?.success) {
                throw new Error(result?.error || '发布失败')
            }

            return this.createResult(true, {
                postId: '',
                postUrl: result.postUrl || XHS_CREATOR_URL,
                draftOnly: options?.draftOnly ?? false,
            })
        } catch (error) {
            await this.clearHeaderRules()
            logger.error('Publish failed:', error)
            return this.createResult(false, { error: (error as Error).message })
        }
    }

    /**
     * 确保有小红书创作者 tab
     */
    private async ensureXHSTab(): Promise<number> {
        if (!this.runtime.tabs) throw new Error('需要浏览器 tabs API')

        const tabs = await this.runtime.tabs.query('https://creator.xiaohongshu.com/*')
        if (tabs.length > 0 && tabs[0].id) return tabs[0].id

        logger.info('Creating new XHS creator tab...')
        const tab = await this.runtime.tabs.create(XHS_CREATOR_URL, false)
        await this.runtime.tabs.waitForLoad(tab.id, 30000)
        return tab.id
    }

    /**
     * 上传图片到小红书
     * 已在 XHS CDN 的图片直接返回
     */
    protected async uploadImageByUrl(src: string): Promise<ImageUploadResult> {
        // 已在 XHS CDN 的图片直接返回
        if (!src.startsWith('data:') && XHS_CDN_PATTERNS.some(p => src.includes(p))) {
            logger.debug('Skipping XHS CDN image:', src)
            return { url: src }
        }

        if (!this.runtime.tabs) throw new Error('需要浏览器 tabs API')

        const tabId = await this.ensureXHSTab()
        let base64: string
        let mimeType: string

        if (src.startsWith('data:')) {
            const match = src.match(/^data:([^;]+);base64,(.+)$/)
            if (!match) throw new Error('Invalid data URI')
            mimeType = match[1]
            base64 = match[2]
        } else {
            const blob = await (await fetch(src)).blob()
            mimeType = blob.type || 'image/jpeg'
            const arrayBuffer = await blob.arrayBuffer()
            const bytes = new Uint8Array(arrayBuffer)
            let binary = ''
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
            base64 = btoa(binary)
        }

        const result = await this.runtime.tabs.executeScript<
            { success: boolean; url?: string; fileId?: string; error?: string },
            [string, string]
        >(
            tabId,
            async (base64Data, mime) => {
                try {
                    const permitUrl = '/api/media/v1/upload/creator/permit?biz_name=spectrum&scene=image&file_count=1&version=1&source=web'
                    const win = window as Window & typeof globalThis & { _webmsxyw?: (url: string) => Record<string, string> }
                    let headers: Record<string, string> = { Accept: 'application/json, text/plain, */*' }

                    if (typeof win._webmsxyw === 'function') {
                        const sig = win._webmsxyw(permitUrl)
                        if (sig) Object.assign(headers, sig)
                    }

                    const permitRes = await (await fetch('https://creator.xiaohongshu.com' + permitUrl, {
                        method: 'GET',
                        credentials: 'include',
                        headers,
                    })).json() as {
                        success: boolean
                        data?: { uploadTempPermits?: Array<{ uploadAddr: string; token: string; fileIds: string[] }> }
                    }

                    if (!permitRes.success || !permitRes.data?.uploadTempPermits?.[0]) {
                        return { success: false, error: '获取上传凭证失败' }
                    }

                    const permit = permitRes.data.uploadTempPermits.find(p => p.uploadAddr === 'ros-upload.xiaohongshu.com')
                        || permitRes.data.uploadTempPermits[0]
                    const fileId = permit.fileIds?.[0]
                    if (!fileId) return { success: false, error: '获取 fileId 失败' }

                    const binaryStr = atob(base64Data)
                    const bytes = new Uint8Array(binaryStr.length)
                    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
                    const blob = new Blob([bytes], { type: mime })

                    const uploadUrl = `https://${permit.uploadAddr}/${fileId}`
                    const uploadRes = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: { Authorization: permit.token, 'Content-Type': mime },
                        body: blob,
                    })

                    if (!uploadRes.ok) return { success: false, error: `上传失败: ${uploadRes.status}` }

                    // 返回 CDN URL
                    const cdnUrl = `https://sns-webpic-qc.xhscdn.com/${fileId}`
                    return { success: true, url: cdnUrl, fileId }
                } catch (err: unknown) {
                    return { success: false, error: (err as Error).message }
                }
            },
            [base64, mimeType]
        )

        if (!result?.success || !result.url) {
            throw new Error(result?.error || '图片上传失败')
        }

        return { url: result.url }
    }

    /**
     * 将 Markdown 转为简单 HTML（不依赖外部库）
     */
    private markdownToHtml(md: string): string {
        let html = md

        // 标题
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

        // 粗体和斜体
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

        // 图片 (markdown → html img)
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;" />')

        // 链接
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

        // 无序列表
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
        html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
        // 合并连续的 ul
        html = html.replace(/<\/ul>\s*<ul>/g, '')

        // 水平线
        html = html.replace(/^━+$/gm, '<hr />')
        html = html.replace(/^---+$/gm, '<hr />')

        // 段落：将连续的非标签行包裹在 <p> 中
        const lines = html.split('\n')
        const result: string[] = []
        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) {
                result.push('')
                continue
            }
            // 已经是 HTML 标签的行不包裹
            if (/^<(h[1-6]|ul|ol|li|hr|img|div|p|blockquote|pre|table)/i.test(trimmed)) {
                result.push(trimmed)
            } else if (trimmed.startsWith('<')) {
                result.push(trimmed)
            } else {
                result.push(`<p>${trimmed}</p>`)
            }
        }

        return result.filter(l => l.trim()).join('\n')
    }
}
