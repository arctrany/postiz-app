/**
 * Douban-specific types and Markdown → Draft.js converter
 *
 * Douban's note editor uses Draft.js internally.
 * This module converts Markdown content into the Draft.js JSON format
 * that Douban's API expects.
 */

export interface DoubanImageData {
  id: string
  url: string
  thumb: string
  width: number
  height: number
  file_name: string
  file_size: number
}

interface DraftBlock {
  key: string
  text: string
  type: string
  depth: number
  inlineStyleRanges: any[]
  entityRanges: any[]
  data: Record<string, any>
}

interface DraftEntity {
  type: string
  mutability: string
  data: Record<string, any>
}

interface DraftContent {
  blocks: DraftBlock[]
  entityMap: Record<string, DraftEntity>
}

function generateKey(): string {
  return Math.random().toString(36).substring(2, 7)
}

/**
 * Convert Markdown content to Douban Draft.js JSON format
 *
 * @param markdown - The markdown content (with image URLs already replaced to douban CDN)
 * @param imageDataMap - Map of image URL → DoubanImageData (from upload responses)
 * @returns JSON string in Draft.js format that Douban's API accepts
 */
export function markdownToDraft(
  markdown: string,
  imageDataMap: Map<string, DoubanImageData>
): string {
  const blocks: DraftBlock[] = []
  const entityMap: Record<string, DraftEntity> = {}
  let entityIndex = 0

  const lines = markdown.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Image line: ![alt](url)
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imageMatch) {
      const imageUrl = imageMatch[2]
      const imageData = imageDataMap.get(imageUrl)

      if (imageData) {
        // Douban image block (atomic)
        const entityKey = entityIndex++
        entityMap[entityKey.toString()] = {
          type: 'IMAGE',
          mutability: 'IMMUTABLE',
          data: {
            id: imageData.id,
            src: imageData.url,
            thumb: imageData.thumb,
            width: imageData.width,
            height: imageData.height,
            file_name: imageData.file_name,
            file_size: imageData.file_size,
          },
        }
        blocks.push({
          key: generateKey(),
          text: ' ',
          type: 'atomic',
          depth: 0,
          inlineStyleRanges: [],
          entityRanges: [{ offset: 0, length: 1, key: entityKey }],
          data: {},
        })
      } else {
        // Fallback: treat as text with image link
        blocks.push({
          key: generateKey(),
          text: `[图片: ${imageMatch[1] || imageUrl}]`,
          type: 'unstyled',
          depth: 0,
          inlineStyleRanges: [],
          entityRanges: [],
          data: {},
        })
      }
      continue
    }

    // Heading: # ## ###
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const types: Record<number, string> = { 1: 'header-one', 2: 'header-two', 3: 'header-three' }
      blocks.push({
        key: generateKey(),
        text: headingMatch[2],
        type: types[level] || 'unstyled',
        depth: 0,
        inlineStyleRanges: [],
        entityRanges: [],
        data: {},
      })
      continue
    }

    // Blockquote: > text
    const quoteMatch = line.match(/^>\s+(.+)$/)
    if (quoteMatch) {
      blocks.push({
        key: generateKey(),
        text: quoteMatch[1],
        type: 'blockquote',
        depth: 0,
        inlineStyleRanges: [],
        entityRanges: [],
        data: {},
      })
      continue
    }

    // Unordered list: - text or * text
    const ulMatch = line.match(/^[-*]\s+(.+)$/)
    if (ulMatch) {
      blocks.push({
        key: generateKey(),
        text: ulMatch[1],
        type: 'unordered-list-item',
        depth: 0,
        inlineStyleRanges: [],
        entityRanges: [],
        data: {},
      })
      continue
    }

    // Ordered list: 1. text
    const olMatch = line.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      blocks.push({
        key: generateKey(),
        text: olMatch[1],
        type: 'ordered-list-item',
        depth: 0,
        inlineStyleRanges: [],
        entityRanges: [],
        data: {},
      })
      continue
    }

    // Horizontal rule: --- or ***
    if (/^[-*]{3,}$/.test(line.trim())) {
      blocks.push({
        key: generateKey(),
        text: '',
        type: 'unstyled',
        depth: 0,
        inlineStyleRanges: [],
        entityRanges: [],
        data: {},
      })
      continue
    }

    // Process inline styles
    let text = line
    const inlineStyleRanges: any[] = []
    const entityRanges: any[] = []

    // Bold: **text** or __text__
    const boldRegex = /\*\*(.+?)\*\*|__(.+?)__/g
    let match
    // Strip bold markers and track positions
    let stripped = text
    let offset = 0
    while ((match = boldRegex.exec(text)) !== null) {
      const boldText = match[1] || match[2]
      const startInStripped = match.index - offset
      inlineStyleRanges.push({
        offset: startInStripped,
        length: boldText.length,
        style: 'BOLD',
      })
      offset += 4 // ** ** = 4 chars removed
    }
    stripped = stripped.replace(/\*\*(.+?)\*\*|__(.+?)__/g, '$1$2')

    // Italic: *text* or _text_
    const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g
    while ((match = italicRegex.exec(stripped)) !== null) {
      const italicText = match[1] || match[2]
      inlineStyleRanges.push({
        offset: match.index,
        length: italicText.length,
        style: 'ITALIC',
      })
    }
    stripped = stripped.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '$1$2')

    // Links: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    let linkStripped = stripped
    let linkOffset = 0
    while ((match = linkRegex.exec(stripped)) !== null) {
      const linkText = match[1]
      const linkUrl = match[2]
      const entityKey = entityIndex++
      entityMap[entityKey.toString()] = {
        type: 'LINK',
        mutability: 'MUTABLE',
        data: { url: linkUrl },
      }
      const startPos = match.index - linkOffset
      entityRanges.push({
        offset: startPos,
        length: linkText.length,
        key: entityKey,
      })
      linkOffset += match[0].length - linkText.length
    }
    linkStripped = linkStripped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')

    // Default unstyled block
    blocks.push({
      key: generateKey(),
      text: linkStripped,
      type: 'unstyled',
      depth: 0,
      inlineStyleRanges,
      entityRanges,
      data: {},
    })
  }

  // Ensure at least one block
  if (blocks.length === 0) {
    blocks.push({
      key: generateKey(),
      text: '',
      type: 'unstyled',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {},
    })
  }

  const draftContent: DraftContent = { blocks, entityMap }
  return JSON.stringify(draftContent)
}
