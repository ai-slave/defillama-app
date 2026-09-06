import {
	buildLlamaAIChartNode,
	llamaaiMarkdownToTiptap,
	llamaaiSelectionToTiptap,
	type LlamaAIImportChart,
	type LlamaAIImportImage
} from '~/containers/Articles/import/llamaaiToTiptap'
import type { TiptapJson } from '~/containers/Articles/types'

export type ArticleExportChartMap = Record<string, LlamaAIImportChart>

export type ArticleExportRequest =
	| { kind: 'chart'; chartId: string; charts: ArticleExportChartMap; sessionId?: string | null; messageId?: string }
	| { kind: 'selection'; html: string; charts: ArticleExportChartMap }
	| {
			kind: 'message'
			markdown: string
			charts: ArticleExportChartMap
			images?: Record<string, { url: string }>
			sessionId?: string | null
			messageId?: string
	  }

export type ArticleExportInclude = {
	text: boolean
	chartIds: Array<string>
	imageIds: Array<string>
	/** Indices into the message's tables (source order). Omitted = include all. */
	tableIndices?: Array<number>
}

export type MarkdownSegment =
	| { kind: 'text'; content: string }
	| { kind: 'table'; content: string; rows: number; title?: string }

function titleFromPrecedingLine(line: string | undefined): string | undefined {
	if (!line) return undefined
	const heading = line.match(/^#{1,6}\s+(.+)$/)
	const boldOnly = line.match(/^\*\*(.+?)\*\*:?\s*$/)
	const raw = heading?.[1] ?? boldOnly?.[1]
	if (!raw) return undefined
	const cleaned = raw.replace(/\*\*/g, '').replace(/:$/, '').trim()
	return cleaned || undefined
}

/** Split markdown into text and GFM-table segments (tables in source order).
 * Pipe lines inside code fences are not tables. */
export function splitMarkdownTables(markdown: string): Array<MarkdownSegment> {
	const lines = markdown.split('\n')
	const segments: Array<MarkdownSegment> = []
	let buffer: Array<string> = []
	let inFence = false

	const flushText = () => {
		if (buffer.length > 0) {
			segments.push({ kind: 'text', content: buffer.join('\n') })
			buffer = []
		}
	}

	let i = 0
	while (i < lines.length) {
		const line = lines[i]
		if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
		const isTableStart =
			!inFence &&
			/^\s*\|/.test(line) &&
			i + 1 < lines.length &&
			/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) &&
			lines[i + 1].includes('-')
		if (!isTableStart) {
			buffer.push(line)
			i++
			continue
		}
		const precedingLine = buffer.filter((l) => l.trim().length > 0).pop()
		flushText()
		const tableLines = [lines[i], lines[i + 1]]
		i += 2
		while (i < lines.length && /^\s*\|/.test(lines[i])) {
			tableLines.push(lines[i])
			i++
		}
		segments.push({
			kind: 'table',
			content: tableLines.join('\n'),
			rows: tableLines.length - 2,
			title: titleFromPrecedingLine(precedingLine)
		})
	}
	flushText()
	return segments
}

export type ArticleExportDeps = {
	/** Persist a chart to the saved-charts library (frozen). Returns the saved id. */
	saveChart?: (chartId: string) => Promise<string | null>
	/** Upload an image artifact into the CMS. Null result = skip (e.g. CORS-blocked fetch). */
	uploadImage?: (imageId: string, url: string) => Promise<LlamaAIImportImage | null>
}

export type ArticleExportResult = { blocks: Array<TiptapJson>; notes: Array<string> }

type ChartGroup = {
	charts: Array<{ id: string; datasetName?: string }>
	chartData: Record<string, Array<unknown>> | Array<unknown>
}

export function chartsMapFromGroups(groups: Array<ChartGroup> | undefined): ArticleExportChartMap {
	const map: ArticleExportChartMap = {}
	for (const group of groups ?? []) {
		for (const config of group.charts) {
			const data = Array.isArray(group.chartData)
				? group.chartData
				: (group.chartData?.[config.datasetName || config.id] ?? [])
			map[config.id] = { config: config as ArticleExportChartMap[string]['config'], data }
		}
	}
	return map
}

export function buildMessageExportRequest(params: {
	markdown: string
	messageId: string
	sessionId?: string | null
	chartGroups?: Array<ChartGroup>
	generatedImages?: Array<{ id?: string; url: string }>
}): ArticleExportRequest {
	const images: Record<string, { url: string }> = {}
	for (const image of params.generatedImages ?? []) {
		images[image.id ?? image.url] = { url: image.url }
	}
	return {
		kind: 'message',
		markdown: params.markdown,
		charts: chartsMapFromGroups(params.chartGroups),
		images,
		sessionId: params.sessionId,
		messageId: params.messageId
	}
}

async function saveChartsToLibrary(
	blocks: Array<TiptapJson>,
	saveChart: ArticleExportDeps['saveChart']
): Promise<Array<TiptapJson>> {
	if (!saveChart) return blocks
	return Promise.all(
		blocks.map(async (block) => {
			if (block.type !== 'llamaaiChart') return block
			const chartId = (block.attrs?.chartConfig as { id?: string } | undefined)?.id
			if (!chartId) return block
			const savedChartId = await saveChart(chartId).catch(() => null)
			return savedChartId ? { ...block, attrs: { ...block.attrs, savedChartId } } : block
		})
	)
}

export async function buildExportBlocks(
	request: ArticleExportRequest,
	include: ArticleExportInclude,
	deps: ArticleExportDeps
): Promise<ArticleExportResult> {
	const notes: Array<string> = []

	if (request.kind === 'chart') {
		const entry = request.charts[request.chartId]
		const node = entry ? buildLlamaAIChartNode(entry.config, entry.data) : null
		if (!node) return { blocks: [], notes: ['Chart could not be exported'] }
		return { blocks: await saveChartsToLibrary([node], deps.saveChart), notes }
	}

	if (request.kind === 'selection') {
		return { blocks: llamaaiSelectionToTiptap(request.html, request.charts), notes }
	}

	const includedCharts: ArticleExportChartMap = {}
	for (const id of include.chartIds) {
		if (request.charts[id]) includedCharts[id] = request.charts[id]
	}

	const images: Record<string, LlamaAIImportImage> = {}
	for (const imageId of include.imageIds) {
		const source = request.images?.[imageId]
		if (!source || !deps.uploadImage) continue
		const uploaded = await deps.uploadImage(imageId, source.url).catch(() => null)
		if (uploaded) {
			images[imageId] = uploaded
		} else {
			notes.push('One image could not be imported')
		}
	}

	// Reassemble the markdown honoring the text toggle and per-table selection;
	// artifact placeholders always survive so charts/images keep their positions.
	let tableIndex = -1
	const markdown = splitMarkdownTables(request.markdown)
		.map((segment) => {
			if (segment.kind === 'table') {
				tableIndex += 1
				return !include.tableIndices || include.tableIndices.includes(tableIndex) ? segment.content : ''
			}
			if (include.text) return segment.content
			return (segment.content.match(/\[(?:CHART|IMAGE):[^\]]+\]/g) ?? []).join('\n\n')
		})
		.filter(Boolean)
		.join('\n\n')

	const blocks = llamaaiMarkdownToTiptap(markdown, { charts: includedCharts, images })
	return { blocks: await saveChartsToLibrary(blocks, deps.saveChart), notes }
}

export type SelectionSummaryItem = { icon: 'bar-chart-2' | 'file-text' | 'layout-grid'; label: string }

/** Itemize a selection export for the confirm dialog: prose word count, tables
 * (titled by the nearest preceding heading), and charts by id. */
export function summarizeSelectionHtml(html: string, charts: ArticleExportChartMap): Array<SelectionSummaryItem> {
	const items: Array<SelectionSummaryItem> = []
	const template = document.createElement('template')
	template.innerHTML = html

	const chartIds = Array.from(
		new Set(
			Array.from(template.content.querySelectorAll('[data-chart-id]')).map((el) => el.getAttribute('data-chart-id'))
		)
	).filter((id): id is string => !!id)

	const ordered = Array.from(template.content.querySelectorAll('h1, h2, h3, h4, h5, h6, table'))
	const tables: Array<{ rows: number; title?: string }> = []
	let lastHeading: string | undefined
	for (const el of ordered) {
		if (el.tagName === 'TABLE') {
			tables.push({ rows: el.querySelectorAll('tr').length, title: lastHeading })
			lastHeading = undefined
		} else {
			lastHeading = el.textContent?.trim() || undefined
		}
	}

	for (const el of Array.from(template.content.querySelectorAll('table, [data-chart-id]'))) el.remove()
	const words = (template.content.textContent ?? '').trim().split(/\s+/).filter(Boolean).length
	if (words > 0) items.push({ icon: 'file-text', label: `Text · ~${words} words` })

	for (const table of tables) {
		const rowLabel = `${table.rows} row${table.rows === 1 ? '' : 's'}`
		items.push({
			icon: 'layout-grid',
			label: table.title ? `Table · ${table.title} (${rowLabel})` : `Table · ${rowLabel}`
		})
	}
	for (const id of chartIds) {
		const entry = charts[id]
		items.push({
			icon: 'bar-chart-2',
			label: entry ? `Chart · ${entry.config?.title || id}` : `Chart · ${id} (no data — will be skipped)`
		})
	}
	return items
}
