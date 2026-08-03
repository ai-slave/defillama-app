import { generateJSON } from '@tiptap/core'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChartConfiguration, ChartDataByKey, ChartDataSeries } from '~/containers/LlamaAI/chartTypes'
import {
	normalizeCitationMarkerWhitespace,
	parseArtifactPlaceholders,
	processUnifiedCitations
} from '~/containers/LlamaAI/utils/markdownHelpers'
import { createArticleEditorExtensions } from '../editor/extensions'
import { createLlamaAIChartAttrs } from '../llamaaiChart'
import type { TiptapJson } from '../types'

export type LlamaAIImportChart = { config: ChartConfiguration; data: ChartDataSeries | ChartDataByKey }
export type LlamaAIImportImage = { imageId: string; src: string; width?: number; height?: number }

export type LlamaAIImportOptions = {
	charts: Record<string, LlamaAIImportChart>
	images?: Record<string, LlamaAIImportImage>
}

let extensionsCache: ReturnType<typeof createArticleEditorExtensions> | null = null
function articleExtensions() {
	if (!extensionsCache) extensionsCache = createArticleEditorExtensions()
	return extensionsCache
}

// Same remark pipeline the chat renderer uses, so exported text matches what
// the researcher saw on screen.
function markdownToHtml(markdown: string): string {
	return renderToStaticMarkup(
		createElement(ReactMarkdown, { remarkPlugins: [[remarkGfm, { singleTilde: false }]] }, markdown)
	)
}

// The article schema only allows h2–h6 (StarterKit heading levels), so h1 must
// be demoted in the HTML before generateJSON — afterwards it is already a paragraph.
function demoteH1Html(html: string): string {
	return html.replace(/<(\/?)h1([\s>])/gi, '<$1h2$2')
}

function htmlToBlocks(html: string): TiptapJson[] {
	const doc = generateJSON(demoteH1Html(html), articleExtensions()) as TiptapJson
	return (doc.content as TiptapJson[]) ?? []
}

export function buildLlamaAIChartNode(config: unknown, data: unknown): TiptapJson | null {
	const attrs = createLlamaAIChartAttrs(config, data)
	if (!attrs) return null
	return {
		type: 'llamaaiChart',
		attrs
	}
}

function articleImageNode(image: LlamaAIImportImage): TiptapJson {
	return {
		type: 'articleImage',
		attrs: {
			imageId: image.imageId,
			src: image.src,
			alt: '',
			caption: '',
			credit: '',
			copyright: '',
			headline: '',
			href: '',
			width: image.width ?? null,
			height: image.height ?? null
		}
	}
}

export function llamaaiMarkdownToTiptap(markdown: string, opts: LlamaAIImportOptions): TiptapJson[] {
	const withoutCitations = processUnifiedCitations(markdown)
	const { parts } = parseArtifactPlaceholders(withoutCitations)
	const blocks: TiptapJson[] = []
	for (const part of parts) {
		if (part.type === 'text') {
			if (!part.content.trim()) continue
			blocks.push(...htmlToBlocks(markdownToHtml(part.content)))
		} else if (part.type === 'chart') {
			const entry = opts.charts[part.chartId]
			const node = entry ? buildLlamaAIChartNode(entry.config, entry.data) : null
			if (node) blocks.push(node)
		} else if (part.type === 'image') {
			const image = opts.images?.[part.imageId]
			if (image) blocks.push(articleImageNode(image))
		}
		// csv / md / alert / dashboard / action artifacts intentionally do not export
	}
	return blocks
}

// Whitelist, not blocklist: unknown chat widgets degrade to their text (unwrap)
// or vanish (drop) instead of leaking markup into articles.
const KEEP_TAGS = new Set([
	'P',
	'H1',
	'H2',
	'H3',
	'H4',
	'H5',
	'H6',
	'UL',
	'OL',
	'LI',
	'TABLE',
	'THEAD',
	'TBODY',
	'TR',
	'TH',
	'TD',
	'STRONG',
	'B',
	'EM',
	'I',
	'A',
	'CODE',
	'PRE',
	'BLOCKQUOTE',
	'BR',
	'HR'
])
const DROP_TAGS = new Set([
	'BUTTON',
	'SVG',
	'CANVAS',
	'INPUT',
	'SELECT',
	'TEXTAREA',
	'STYLE',
	'SCRIPT',
	'IFRAME',
	'IMG',
	'VIDEO',
	'AUDIO'
])

function scrub(root: ParentNode): void {
	for (const el of Array.from(root.children)) {
		scrub(el)
		if (el.hasAttribute('data-llamaai-chart')) continue
		const tag = el.tagName.toUpperCase()
		if (DROP_TAGS.has(tag)) {
			el.remove()
		} else if (!KEEP_TAGS.has(tag)) {
			el.replaceWith(...Array.from(el.childNodes))
		}
	}
}

// Dropping citation pills leaves their surrounding spaces behind ("lol [1]." ->
// "lol ."). Merge adjacent text nodes and apply the same whitespace rules the
// markdown path uses, skipping code blocks where spacing is meaningful.
function cleanOrphanWhitespace(container: HTMLElement): void {
	container.normalize()
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const text = node as Text
		if ((text.parentElement as Element | null)?.closest('pre, code')) continue
		const cleaned = normalizeCitationMarkerWhitespace(text.data)
		if (cleaned !== text.data) text.data = cleaned
	}
}

function hydrateChartNodes(nodes: TiptapJson[], charts: Record<string, LlamaAIImportChart>): TiptapJson[] {
	const out: TiptapJson[] = []
	for (const node of nodes) {
		if (node.type === 'llamaaiChart') {
			if (node.attrs?.chartConfig) {
				const { chartRef: _chartRef, ...attrs } = node.attrs
				out.push({ ...node, attrs })
				continue
			}
			const ref = typeof node.attrs?.chartRef === 'string' ? node.attrs.chartRef : null
			const entry = ref ? charts[ref] : null
			const built = entry ? buildLlamaAIChartNode(entry.config, entry.data) : null
			if (built) out.push(built)
			continue
		}
		if (Array.isArray(node.content)) {
			out.push({ ...node, content: hydrateChartNodes(node.content as TiptapJson[], charts) })
		} else {
			out.push(node)
		}
	}
	return out
}

export function llamaaiSelectionToTiptap(html: string, charts: Record<string, LlamaAIImportChart>): TiptapJson[] {
	const template = document.createElement('template')
	template.innerHTML = html

	for (const el of Array.from(template.content.querySelectorAll('[data-chart-id]'))) {
		const id = el.getAttribute('data-chart-id')
		const marker = document.createElement('div')
		if (id) marker.setAttribute('data-llamaai-chart', id)
		el.replaceWith(marker)
	}

	scrub(template.content)

	const container = document.createElement('div')
	container.appendChild(template.content)
	cleanOrphanWhitespace(container)
	return hydrateChartNodes(htmlToBlocks(container.innerHTML), charts)
}
