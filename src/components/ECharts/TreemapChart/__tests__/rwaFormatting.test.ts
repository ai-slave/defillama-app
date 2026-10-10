import { describe, expect, test } from 'vitest'
import { formatRwaTreemapTooltip } from '../rwaFormatting'

describe('rwa treemap formatting', () => {
	test('a top-level node shows its share of the total', () => {
		const tooltip = formatRwaTreemapTooltip({
			info: {
				name: 'Tesla',
				value: [3, 6.12, 6.12],
				treePathInfo: [{ name: 'Base Asset' }, { name: 'Tesla' }]
			},
			valueLabel: 'Markets',
			formatMetricValue: (value) => String(value)
		})

		expect(tooltip).toBe('Tesla<br>Markets: 3<br>Share of total: 6.12%<br>')
	})

	test('a nested node names its parent and shows both shares', () => {
		const tooltip = formatRwaTreemapTooltip({
			info: {
				name: 'xyz:META',
				value: [2, 66.67, 44.44],
				treePathInfo: [{ name: 'Base Asset' }, { name: 'Meta' }, { name: 'xyz:META' }]
			},
			valueLabel: 'Markets',
			formatMetricValue: (value) => String(value)
		})

		expect(tooltip).toBe('xyz:META<br>Markets: 2<br>Share of Meta: 66.67%<br>Share of total: 44.44%<br>')
	})

	test('a node with a 1D change shows it as the last line', () => {
		const tooltip = formatRwaTreemapTooltip({
			info: {
				name: 'Software',
				value: [2, 40, 12.5, -1.25],
				treePathInfo: [{ name: 'Equities' }, { name: 'Technology' }, { name: 'Software' }]
			},
			valueLabel: 'Market Cap',
			formatMetricValue: (value) => String(value)
		})

		expect(tooltip).toBe(
			'Software<br>Market Cap: 2<br>Share of Technology: 40%<br>Share of total: 12.5%<br>1D return: <span class="text-data-down">-1.25%</span><br>'
		)
	})

	test('labels the root node tooltip with the root name and total metric', () => {
		const tooltip = formatRwaTreemapTooltip({
			info: { name: 'Base Asset', value: [9, 100, 100], treePathInfo: [{ name: 'Base Asset' }] },
			valueLabel: 'Markets',
			formatMetricValue: (value) => String(value)
		})

		expect(tooltip).toBe('Base Asset<br>Markets: 9<br>')
	})
})
