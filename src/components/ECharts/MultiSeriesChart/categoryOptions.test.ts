import { describe, expect, test } from 'vitest'
import { createCategoryChartOptions } from './categoryOptions'
import { prepareMultiSeriesDataset } from './datasetAdapter'
import { createCategoryTooltipFormatter } from './tooltip'

describe('category chart tooltip', () => {
	test('keeps the category header and reads each series value from the rendered dataset row', () => {
		const prepared = prepareMultiSeriesDataset(
			{ dimensions: ['name', 'Principal', 'Interest'], source: [['Pool A', 300, 1250]] },
			[
				{ type: 'bar', name: 'Principal', encode: { x: 'name', y: 'Principal' } },
				{ type: 'bar', name: 'Interest', encode: { x: 'name', y: 'Interest' } }
			]
		)
		const row = prepared.source[0]!
		// ECharts hover params for a dataset row: the whole row plus the series' encoded dimension.
		const params = prepared.charts.map((chart) => ({
			axisValue: row[0],
			seriesName: chart.name,
			marker: '',
			data: row,
			value: row,
			encode: { x: [chart.encode.x], y: [chart.encode.y] },
			dimensionNames: prepared.dimensions.map((dimension) => dimension.name)
		}))
		const { formatter } = createCategoryChartOptions('$')!.tooltip as { formatter: (params: unknown) => string }

		expect(formatter(params)).toBe(
			'<strong>Pool A</strong><br/>' +
				'<li style="list-style:none">Interest&nbsp;&nbsp;$1,250</li>' +
				'<li style="list-style:none">Principal&nbsp;&nbsp;$300</li>'
		)
	})

	test('preserves negative values and omits legacy zero rows', () => {
		const formatter = createCategoryTooltipFormatter('%')
		const tooltip = formatter([
			{ axisValue: 'Bucket', seriesName: 'Loss', data: { Loss: -2.5 } },
			{ axisValue: 'Bucket', seriesName: 'Flat', data: { Flat: 0 } }
		])

		expect(tooltip).toContain('Loss')
		expect(tooltip).toContain('-2.5 %')
		expect(tooltip).not.toContain('Flat')
	})
})
