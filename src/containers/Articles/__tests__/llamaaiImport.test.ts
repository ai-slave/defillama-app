// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import { buildLlamaAIChartNode, llamaaiMarkdownToTiptap, llamaaiSelectionToTiptap } from '../import/llamaaiToTiptap'

const chartConfig = (id: string): ChartConfiguration => ({
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
	c1: { config: chartConfig('c1'), data: [{ ts: 1, value: 42 }] }
}

describe('llamaaiMarkdownToTiptap', () => {
	it('converts GFM markdown to article blocks, demoting h1 to h2', () => {
		const blocks = llamaaiMarkdownToTiptap(
			'# Fees Overview\n\nUniswap leads.\n\n| chain | fees |\n| --- | --- |\n| eth | 1 |',
			{
				charts: {}
			}
		)
		const types = blocks.map((b) => b.type)
		expect(blocks.filter((block) => block.type === 'heading').map((block) => block.attrs?.level)).toEqual([2])
		expect(types).toContain('paragraph')
		expect(types).toContain('table')
	})

	it('strips citation markers from the text', () => {
		const blocks = llamaaiMarkdownToTiptap('TVL rose 40% [1] overall [2-4] since 【5†src】.', { charts: {} })
		const text = JSON.stringify(blocks)
		expect(text).toContain('TVL rose 40% overall since.')
		expect(text).not.toContain('[1]')
		expect(text).not.toContain('【')
	})

	it('splices chart placeholders as llamaaiChart nodes in source order', () => {
		const blocks = llamaaiMarkdownToTiptap('Before chart.\n\n[CHART:c1]\n\nAfter chart.', { charts })
		const types = blocks.map((b) => b.type)
		expect(types).toEqual(['paragraph', 'llamaaiChart', 'paragraph'])
		expect(blocks.filter((block) => block.type === 'llamaaiChart').map((block) => block.attrs)).toEqual([
			expect.objectContaining({
				chartConfig: expect.objectContaining({ id: 'c1' }),
				chartData: [{ ts: 1, value: 42 }]
			})
		])
	})

	it('drops chart placeholders with no matching chart, and drops CSV/MD/ALERT/DASHBOARD/ACTION/IMAGE artifacts', () => {
		const blocks = llamaaiMarkdownToTiptap(
			'Intro.\n\n[CHART:missing]\n\n[CSV:x]\n\n[MD:y]\n\n[ALERT:z]\n\n[DASHBOARD:d]\n\n[IMAGE:img9]\n\n[ACTION:More|tell me more]\n\nOutro.',
			{ charts: {} }
		)
		expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'paragraph'])
	})

	it('inserts uploaded images as articleImage nodes when an upload result is provided', () => {
		const blocks = llamaaiMarkdownToTiptap('Look:\n\n[IMAGE:img1]', {
			charts: {},
			images: { img1: { imageId: 'up_1', src: 'https://cdn.llama.fi/x.png', width: 800, height: 400 } }
		})
		expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'articleImage'])
		expect(blocks.filter((block) => block.type === 'articleImage').map((block) => block.attrs?.src)).toEqual([
			'https://cdn.llama.fi/x.png'
		])
	})

	it('strips content before [REPORT_START]', () => {
		const blocks = llamaaiMarkdownToTiptap('preamble chatter\n[REPORT_START]\nActual report.', { charts: {} })
		expect(JSON.stringify(blocks)).toContain('Actual report.')
		expect(JSON.stringify(blocks)).not.toContain('preamble chatter')
	})
})

describe('llamaaiSelectionToTiptap', () => {
	it('converts a rendered-DOM selection keeping formatting, links, and tables', () => {
		const html =
			'<p>Uniswap <strong>leads</strong> with <a href="https://defillama.com/protocol/uniswap">$4M</a>.</p><table><tbody><tr><td>eth</td><td>1</td></tr></tbody></table>'
		const blocks = llamaaiSelectionToTiptap(html, {})
		const json = JSON.stringify(blocks)
		expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'table'])
		expect(json).toContain('bold')
		expect(json).toContain('https://defillama.com/protocol/uniswap')
	})

	it('splices charts crossed by the selection at their exact position', () => {
		const html = `<p>Before.</p><div data-chart-id="c1"><canvas></canvas><button>gear</button></div><p>After.</p>`
		const blocks = llamaaiSelectionToTiptap(html, charts)
		expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'llamaaiChart', 'paragraph'])
		const chartAttrs = blocks.filter((block) => block.type === 'llamaaiChart').map((block) => block.attrs)
		expect(chartAttrs).toEqual([expect.objectContaining({ chartConfig: expect.objectContaining({ id: 'c1' }) })])
		expect(chartAttrs.map((attrs) => attrs?.chartRef ?? null)).toEqual([null])
	})

	it('scrubs interactive junk and unwraps stylistic wrappers while keeping text', () => {
		const html =
			'<h1>Title</h1><p><span class="entity-wrap">Aave</span> rose<button data-citation-pill>1</button><svg></svg> 40%.</p><canvas></canvas>'
		const blocks = llamaaiSelectionToTiptap(html, {})
		const json = JSON.stringify(blocks)
		expect(blocks.filter((block) => block.type === 'heading').map((block) => block.attrs?.level)).toEqual([2])
		expect(json).toContain('Aave rose 40%.')
		expect(json).not.toContain('gear')
		expect(json).not.toContain('citation')
	})

	it('removes orphan whitespace left by stripped citation pills', () => {
		const html =
			'<p>lol <button>1</button>.</p><p>TVL rose <button>2</button> and <button>3</button> then fell.</p><pre><code>a  .b</code></pre>'
		const blocks = llamaaiSelectionToTiptap(html, {})
		const json = JSON.stringify(blocks)
		expect(json).toContain('lol.')
		expect(json).not.toContain('lol .')
		expect(json).toContain('TVL rose and then fell.')
		expect(json).toContain('a  .b')
	})

	it('drops unknown chart refs instead of emitting empty nodes', () => {
		const html = '<p>Text.</p><div data-chart-id="nope"></div>'
		const blocks = llamaaiSelectionToTiptap(html, {})
		expect(blocks.map((b) => b.type)).toEqual(['paragraph'])
	})
})

describe('buildLlamaAIChartNode', () => {
	it('rejects empty data instead of producing a blank chart node', () => {
		expect(buildLlamaAIChartNode(chartConfig('c1'), [])).toBeNull()
		expect(buildLlamaAIChartNode(chartConfig('c1'), {})).toBeNull()
		expect(buildLlamaAIChartNode(chartConfig('c1'), { a: [] })).toBeNull()
		expect(buildLlamaAIChartNode(chartConfig('c1'), [{ ts: 1, value: 2 }])).not.toBeNull()
	})
})
