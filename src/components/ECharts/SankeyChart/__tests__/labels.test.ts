import { describe, expect, test } from 'vitest'
import { buildSankeyNodeMetadata, createMobileLabelLayout, formatSankeyNodeLabel } from '../labels'

const nodes = [
	{ name: 'Source', depth: 0, displayValue: 'source value' },
	{
		name: 'Middle',
		depth: 1,
		displayValue: 1500,
		description: 'Protocol revenue kept after paying every supply-side party'
	},
	{ name: 'A very long terminal node', depth: 2, displayValue: 'terminal value', percentageLabel: '70%' }
]
const metadata = buildSankeyNodeMetadata(nodes)
const formatValue = (value: number) => `$${value}`

describe('sankey node labels', () => {
	test('shows the full name with its display value and percentage', () => {
		expect(formatSankeyNodeLabel('A very long terminal node', 70, metadata, formatValue, false)).toBe(
			'A very long terminal node: terminal value (70%)'
		)
		expect(formatSankeyNodeLabel('Unlisted', 12, metadata, formatValue, true)).toBe('Unlisted: $12')
	})

	test('adds a truncated description line on desktop only', () => {
		expect(formatSankeyNodeLabel('Middle', 10, metadata, formatValue, true)).toBe(
			'{name|Middle: $1500}\n{desc|Protocol revenue kept after paying every supply...}'
		)
		expect(formatSankeyNodeLabel('Middle', 10, metadata, formatValue, false)).toBe('Middle: $1500')
	})
})

describe('mobile sankey label layout', () => {
	test('keeps every label visible and moves colliding labels to another level', () => {
		const layout = createMobileLabelLayout(nodes, () => ({ width: 320, height: 450 }))
		const labelRect = { x: 100, y: 100, width: 142, height: 32 }

		expect(layout({ dataIndex: 0, dataType: 'node', labelRect })).toEqual({
			x: 100,
			y: 80,
			align: 'left',
			verticalAlign: 'middle',
			hideOverlap: false
		})
		expect(layout({ dataIndex: 1, dataType: 'node', labelRect })).toMatchObject({ x: 100, y: 116, hideOverlap: false })
		expect(layout({ dataIndex: 2, dataType: 'node', labelRect })).toMatchObject({ y: 152, hideOverlap: false })
	})

	test('moves a colliding odd-depth label up before trying below', () => {
		const layout = createMobileLabelLayout(
			[
				{ name: 'First', depth: 1 },
				{ name: 'Second', depth: 1 }
			],
			() => ({ width: 320, height: 450 })
		)
		const labelRect = { x: 100, y: 100, width: 142, height: 32 }

		expect(layout({ dataIndex: 0, dataType: 'node', labelRect })).toMatchObject({ y: 116 })
		expect(layout({ dataIndex: 1, dataType: 'node', labelRect })).toMatchObject({ y: 80 })
	})

	test('clamps a label inside the chart and starts over on the next layout pass', () => {
		const layout = createMobileLabelLayout(nodes, () => ({ width: 320, height: 450 }))
		const offRight = { x: 300, y: 100, width: 142, height: 32 }

		expect(layout({ dataIndex: 0, dataType: 'node', labelRect: offRight })).toMatchObject({ x: 172, y: 80 })
		expect(layout({ dataIndex: 0, dataType: 'node', labelRect: offRight })).toMatchObject({ x: 172, y: 80 })
	})

	test('leaves edge labels to ECharts', () => {
		const layout = createMobileLabelLayout(nodes, () => ({ width: 320, height: 450 }))
		expect(layout({ dataIndex: 0, dataType: 'edge', labelRect: { x: 0, y: 0, width: 1, height: 1 } })).toEqual({
			hideOverlap: false
		})
	})
})
