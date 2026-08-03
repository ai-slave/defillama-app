// @vitest-environment happy-dom
// One fixture with every content shape, through both pipelines. If any handling
// regresses (drops, ordering, stripping, hydration), the inventory here breaks.
import { describe, expect, it } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import { llamaaiMarkdownToTiptap, llamaaiSelectionToTiptap } from '../import/llamaaiToTiptap'

const config = (id: string): ChartConfiguration => ({
	id,
	type: 'bar',
	title: `Chart ${id}`,
	description: '',
	axes: {
		x: { field: 'ts', label: 'Date', type: 'time' },
		yAxes: [{ id: 'value', fields: ['value'], label: 'Value', position: 'left' }]
	},
	series: [
		{
			name: 'Value',
			type: 'bar',
			yAxisId: 'value',
			metricClass: 'stock',
			dataMapping: { xField: 'ts', yField: 'value' },
			styling: {}
		}
	],
	dataTransformation: { timeField: 'ts', metrics: ['value'] }
})

const charts = {
	c1: { config: config('c1'), data: [{ ts: 1, value: 42 }] },
	c2: { config: config('c2'), data: Array.from({ length: 6000 }, (_, i) => ({ ts: i, value: i })) }
}

const KITCHEN_SINK_MARKDOWN = `preamble the model wrote before the report
[REPORT_START]
# TVL Report

Uniswap **leads** [1] with [$4M](https://defillama.com/protocol/uniswap) in fees 【2†src】.

| chain | fees |
| --- | --- |
| eth | 1 |
| base | 2 |

[CHART:c1]

- first point
- second point

\`\`\`sql
SELECT 1;
\`\`\`

[CHART:c2]

[CHART:missing]
[CSV:csv9]
[MD:md9]
[ALERT:al9]
[DASHBOARD:db9]
[ACTION:More|tell me more]
[IMAGE:img1]
[IMAGE:img-skipped]

Closing thoughts [3-5].`

describe('kitchen sink — markdown pipeline', () => {
	const blocks = llamaaiMarkdownToTiptap(KITCHEN_SINK_MARKDOWN, {
		charts,
		images: { img1: { imageId: 'up_1', src: 'https://cdn.llama.fi/x.png', width: 800, height: 400 } }
	})
	const json = JSON.stringify(blocks)
	const types = blocks.map((b) => b.type)

	it('produces the exact block inventory in source order', () => {
		expect(types).toEqual([
			'heading',
			'paragraph',
			'table',
			'llamaaiChart',
			'bulletList',
			'codeBlock',
			'llamaaiChart',
			'articleImage',
			'paragraph'
		])
	})

	it('strips the pre-report preamble and every citation marker', () => {
		expect(json).not.toContain('preamble')
		expect(json).not.toContain('[1]')
		expect(json).not.toContain('【')
		expect(json).toContain('Closing thoughts.')
	})

	it('demotes h1 and keeps formatting, links, table cells, and code', () => {
		expect(blocks.filter((block) => block.type === 'heading').map((block) => block.attrs?.level)).toEqual([2])
		expect(json).toContain('bold')
		expect(json).toContain('https://defillama.com/protocol/uniswap')
		expect(json).toContain('base')
		expect(json).toContain('SELECT 1;')
	})

	it('hydrates known charts, downsamples large ones, drops unknown artifacts silently', () => {
		const chartBlocks = blocks.filter((b) => b.type === 'llamaaiChart')
		expect(chartBlocks.map((block) => block.attrs?.chartConfig)).toEqual([
			expect.objectContaining({ id: 'c1' }),
			expect.objectContaining({ id: 'c2' })
		])
		expect(
			chartBlocks.map((block) => {
				const chartData = block.attrs?.chartData
				return Array.isArray(chartData) ? chartData.length : null
			})
		).toEqual([1, 2000])
		expect(json).not.toContain('csv9')
		expect(json).not.toContain('md9')
		expect(json).not.toContain('al9')
		expect(json).not.toContain('db9')
		expect(json).not.toContain('tell me more')
		expect(json).not.toContain('img-skipped')
	})

	it('inserts uploaded images with their CMS src', () => {
		expect(json).toContain('https://cdn.llama.fi/x.png')
	})
})

const KITCHEN_SINK_DOM = `
<h1>Section</h1>
<p>Uniswap <strong>leads</strong> <button data-pill>1</button> with <a href="https://defillama.com/protocol/uniswap">$4M</a> <span class="entity">today</span> .</p>
<div class="table-wrap"><img src="/watermark.png" /><button>.csv</button><table><tbody><tr><td>eth</td><td>1</td></tr><tr><td>base</td><td>2</td></tr></tbody></table></div>
<div data-chart-id="c1"><canvas></canvas><svg></svg><button>gear</button></div>
<pre><code>SELECT  1;</code></pre>
<div data-chart-id="nope"></div>
<p>End.</p>`

describe('kitchen sink — selection pipeline', () => {
	const blocks = llamaaiSelectionToTiptap(KITCHEN_SINK_DOM, charts)
	const json = JSON.stringify(blocks)

	it('produces the exact block inventory: junk gone, blocks in order', () => {
		expect(blocks.map((b) => b.type)).toEqual([
			'heading',
			'paragraph',
			'table',
			'llamaaiChart',
			'codeBlock',
			'paragraph'
		])
	})

	it('demotes h1, unwraps wrappers, drops widgets, cleans orphan whitespace', () => {
		expect(blocks.filter((block) => block.type === 'heading').map((block) => block.attrs?.level)).toEqual([2])
		expect(json).toContain('today.')
		expect(json).not.toContain('today .')
		expect(json).not.toContain('.csv')
		expect(json).not.toContain('gear')
		expect(json).not.toContain('watermark')
	})

	it('keeps table content and code spacing byte-identical', () => {
		expect(json).toContain('base')
		expect(json).toContain('SELECT  1;')
	})

	it('hydrates the known chart and drops the unknown one', () => {
		const chartBlocks = blocks.filter((b) => b.type === 'llamaaiChart')
		expect(chartBlocks.map((block) => block.attrs?.chartConfig)).toEqual([expect.objectContaining({ id: 'c1' })])
	})
})
