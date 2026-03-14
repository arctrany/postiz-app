/**
 * HTML to Markdown converter using Turndown
 * Used by zip-download adapter for content export
 */
import TurndownService from 'turndown'

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
})

/**
 * Convert HTML content to Markdown
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return ''
  return turndownService.turndown(html)
}
