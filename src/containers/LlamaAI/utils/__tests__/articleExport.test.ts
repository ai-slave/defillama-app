// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/types'
import {
	buildExportBlocks,
	buildMessageExportRequest,
	splitMarkdownTables,
	summarizeSelectionHtml
} from '../articleExport'

const config = (id: string): ChartConfiguration =>
	({
		id,
		type: 'bar',
		title: `Chart ${id}`,
		description: '',
		axes: { x: { field: 'ts' }, yAxes: [{ field: 'value' }] }
	}) as unknown as ChartConfiguration

const charts = {
	c1: { config: config('c1'), data: [{ ts: 1, value: 42 }] },
	c2: { config: config('c2'), data: [{ ts: 2, value: 7 }] }
}

describe('buildExportBlocks — chart export', () => {
	it('produces one chart node and stamps the saved chart id', async () => {
		const saveChart = vi.fn().mockResolvedValue('saved_123')
		const { blocks } = await buildExportBlocks(
			{ kind: 'chart', chartId: 'c1', charts },
			{ text: true, chartIds: ['c1'], imageIds: [] },
			{ saveChart }
		)
		expect(blocks).toHaveLength(1)
		expect(blocks[0].type).toBe('llamaaiChart')
		expect(blocks[0].attrs?.savedChartId).toBe('saved_123')
		expect(saveChart).toHaveBeenCalledWith('c1')
	})

	it('keeps the node with null savedChartId when saving to the library fails', async () => {
		const saveChart = vi.fn().mockRejectedValue(new Error('boom'))
		const { blocks, notes } = await buildExportBlocks(
			{ kind: 'chart', chartId: 'c1', charts },
			{ text: true, chartIds: ['c1'], imageIds: [] },
			{ saveChart }
		)
		expect(blocks[0].attrs?.savedChartId).toBeNull()
		expect(notes).toHaveLength(0)
	})
})

describe('buildExportBlocks — message export', () => {
	const markdown = 'Intro paragraph.\n\n[CHART:c1]\n\n[CHART:c2]\n\n[IMAGE:img1]'

	it('respects include flags: unchecked text and charts are dropped', async () => {
		const { blocks } = await buildExportBlocks(
			{ kind: 'message', markdown, charts, images: { img1: { url: 'https://x/y.png' } } },
			{ text: false, chartIds: ['c2'], imageIds: [] },
			{}
		)
		expect(blocks.map((b) => b.type)).toEqual(['llamaaiChart'])
		expect(blocks[0].attrs?.chartConfig).toMatchObject({ id: 'c2' })
	})

	it('uploads included images and notes the ones that fail', async () => {
		const uploadImage = vi.fn().mockResolvedValueOnce(null)
		const { blocks, notes } = await buildExportBlocks(
			{ kind: 'message', markdown, charts, images: { img1: { url: 'https://x/y.png' } } },
			{ text: true, chartIds: [], imageIds: ['img1'] },
			{ uploadImage }
		)
		expect(uploadImage).toHaveBeenCalledWith('img1', 'https://x/y.png')
		expect(blocks.some((b) => b.type === 'articleImage')).toBe(false)
		expect(notes).toHaveLength(1)
	})

	it('stamps saved ids on every included chart node', async () => {
		const saveChart = vi.fn(async (id: string) => `saved_${id}`)
		const { blocks } = await buildExportBlocks(
			{ kind: 'message', markdown, charts },
			{ text: false, chartIds: ['c1', 'c2'], imageIds: [] },
			{ saveChart }
		)
		expect(blocks.map((b) => b.attrs?.savedChartId)).toEqual(['saved_c1', 'saved_c2'])
	})
})

describe('buildExportBlocks — selection export', () => {
	it('runs the DOM pipeline and splices charts', async () => {
		const { blocks } = await buildExportBlocks(
			{ kind: 'selection', html: '<p>Look:</p><div data-chart-id="c1"></div>', charts },
			{ text: true, chartIds: ['c1'], imageIds: [] },
			{}
		)
		expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'llamaaiChart'])
	})
})

describe('buildMessageExportRequest', () => {
	it('flattens chart groups into an id-keyed map, resolving keyed and flat data', () => {
		const request = buildMessageExportRequest({
			markdown: 'x [CHART:c1]',
			messageId: 'm1',
			sessionId: 's1',
			chartGroups: [
				{ charts: [config('c1')], chartData: { c1: [{ ts: 1, value: 2 }] } },
				{ charts: [config('c2')], chartData: [{ ts: 9, value: 9 }] as never }
			],
			generatedImages: [{ id: 'img1', url: 'https://x/y.png' }]
		})
		expect(request.kind).toBe('message')
		if (request.kind !== 'message') return
		expect(request.charts.c1.data).toEqual([{ ts: 1, value: 2 }])
		expect(request.charts.c2.data).toEqual([{ ts: 9, value: 9 }])
		expect(request.images).toEqual({ img1: { url: 'https://x/y.png' } })
		expect(request.messageId).toBe('m1')
	})
})

describe('splitMarkdownTables', () => {
	it('splits text and tables, counting data rows', () => {
		const md = 'Intro.\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n\nOutro.\n\n| x |\n| --- |\n| 9 |'
		const segments = splitMarkdownTables(md)
		expect(segments.map((s) => s.kind)).toEqual(['text', 'table', 'text', 'table'])
		expect(segments[1].kind === 'table' && segments[1].rows).toBe(2)
		expect(segments[3].kind === 'table' && segments[3].rows).toBe(1)
	})

	it('ignores pipe lines inside code fences', () => {
		const md = 'Text.\n\n```\n| not | a table |\n| --- | --- |\n```'
		const segments = splitMarkdownTables(md)
		expect(segments.every((s) => s.kind === 'text')).toBe(true)
	})
})

describe('buildExportBlocks — table include control', () => {
	const markdown = 'Intro.\n\n| a |\n| --- |\n| 1 |\n\n[CHART:c1]\n\n| b |\n| --- |\n| 2 |\n\nOutro.'

	it('excludes an unticked table while keeping the rest in order', async () => {
		const { blocks } = await buildExportBlocks(
			{ kind: 'message', markdown, charts },
			{ text: true, chartIds: ['c1'], imageIds: [], tableIndices: [1] },
			{}
		)
		expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'llamaaiChart', 'table', 'paragraph'])
		expect(JSON.stringify(blocks)).not.toContain('"text":"a"')
	})

	it('keeps ticked tables and chart placeholders even when text is excluded', async () => {
		const { blocks } = await buildExportBlocks(
			{ kind: 'message', markdown, charts },
			{ text: false, chartIds: ['c1'], imageIds: [], tableIndices: [0, 1] },
			{}
		)
		expect(blocks.map((b) => b.type)).toEqual(['table', 'llamaaiChart', 'table'])
	})

	it('defaults to including all tables when tableIndices is omitted', async () => {
		const { blocks } = await buildExportBlocks(
			{ kind: 'message', markdown, charts },
			{ text: true, chartIds: ['c1'], imageIds: [] },
			{}
		)
		expect(blocks.filter((b) => b.type === 'table')).toHaveLength(2)
	})
})

describe('table titles', () => {
	it('takes the immediately preceding heading as the markdown table title', () => {
		const md = '### Top 5 fee days\n\n| a |\n| --- |\n| 1 |\n\nProse.\n\n| b |\n| --- |\n| 2 |'
		const tables = splitMarkdownTables(md).filter((s) => s.kind === 'table')
		expect(tables[0].kind === 'table' && tables[0].title).toBe('Top 5 fee days')
		expect(tables[1].kind === 'table' && tables[1].title).toBeUndefined()
	})

	it('accepts a bold-only line as a title and strips emphasis from headings', () => {
		const md = '**Fee comparison:**\n\n| a |\n| --- |\n| 1 |\n\n## **Top days**\n\n| b |\n| --- |\n| 2 |'
		const tables = splitMarkdownTables(md).filter((s) => s.kind === 'table')
		expect(tables[0].kind === 'table' && tables[0].title).toBe('Fee comparison')
		expect(tables[1].kind === 'table' && tables[1].title).toBe('Top days')
	})
})

describe('summarizeSelectionHtml', () => {
	it('itemizes text, titled tables, and charts', () => {
		const html =
			'<p>Uniswap leads all fee rankings today.</p><h3>Top 5 fee days</h3><div><table><tbody><tr><td>1</td></tr><tr><td>2</td></tr></tbody></table></div><div data-chart-id="c1"></div>'
		const items = summarizeSelectionHtml(html, charts)
		expect(items.map((i) => i.label)).toEqual([
			'Text · ~9 words',
			'Table · Top 5 fee days (2 rows)',
			'Chart · Chart c1'
		])
	})

	it('falls back to row counts and flags unresolvable charts', () => {
		const html = '<table><tbody><tr><td>1</td></tr></tbody></table><div data-chart-id="nope"></div>'
		const items = summarizeSelectionHtml(html, {})
		expect(items.map((i) => i.label)).toEqual(['Table · 1 row', 'Chart · nope (no data — will be skipped)'])
	})
})
