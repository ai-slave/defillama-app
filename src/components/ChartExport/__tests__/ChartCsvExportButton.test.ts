import { BarChart } from 'echarts/charts'
import { DatasetComponent, GridComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { describe, expect, test } from 'vitest'
import { buildAdapterByChainBreakdownPresentation } from '~/containers/AdapterMetrics/utils'
import { serializeCsv } from '~/utils/csv'
import { buildCsvRowsFromChartOption, buildCsvRowsFromDataset } from '../ChartCsvExportButton'

type ChartOption = Parameters<typeof buildCsvRowsFromChartOption>[0]
const JAN_1 = Date.UTC(2024, 0, 1)

describe('buildCsvRowsFromDataset', () => {
	test('names both ends of the period each row of a grouped dataset covers', () => {
		const source = [[JAN_1, 50, 100]]
		const dimensions = ['timestamp', 'Solana', 'Ethereum']

		expect(buildCsvRowsFromDataset(dimensions, source, 'monthly')).toEqual([
			['Timestamp', 'Month start', 'Month end', 'Solana', 'Ethereum'],
			[JAN_1, '2024-01-01', '2024-01-31', 50, 100]
		])
		expect(buildCsvRowsFromDataset(dimensions, source, 'daily')).toEqual([
			['Timestamp', 'Date', 'Solana', 'Ethereum'],
			[JAN_1, '2024-01-01', 50, 100]
		])
	})

	test('downloads every selected protocol column of a presentation the chart caps with Others', async () => {
		const names = Array.from({ length: 32 }, (_, index) => `Protocol ${index + 1}`)
		const presentation = buildAdapterByChainBreakdownPresentation({
			chartData: {
				dimensions: ['timestamp', ...names, 'Historical protocol'],
				source: [[JAN_1, ...Array.from({ length: 32 }, (_, index) => index + 1), 500]]
			},
			selectedProtocols: [...names, 'Historical protocol'],
			state: { chartKind: 'bar', valueMode: 'absolute', barLayout: 'stacked', groupBy: 'daily' }
		})
		expect(presentation.dataset.dimensions.at(-1)).toBe('Others')
		if (presentation.csvSource === 'rendered-chart' || presentation.csvSource.type !== 'dataset') {
			throw new Error('expected a dataset CSV source')
		}
		const dataset = await presentation.csvSource.prepare()

		const [header, row] = buildCsvRowsFromDataset(dataset.dimensions, dataset.source, dataset.groupBy ?? 'daily')
		expect(header).toEqual(['Timestamp', 'Date', ...names, 'Historical protocol'])
		expect(row.at(-1)).toBe(500)
	})
})

describe('buildCsvRowsFromChartOption', () => {
	test('uses logical display names from private ECharts dimensions, alongside plain ones', () => {
		const option = {
			dataset: {
				dimensions: [
					'timestamp',
					{ name: '__dimension_1', displayName: 'Solana' },
					{ name: '__dimension_2', displayName: 'Ethereum' }
				],
				source: [[JAN_1, 50, 100]]
			}
		} as ChartOption

		expect(buildCsvRowsFromChartOption(option)).toEqual([
			['Timestamp', 'Date', 'Solana', 'Ethereum'],
			[JAN_1, '2024-01-01', 50, 100]
		])
	})

	test('exports a real ECharts dataset with dates and chain labels intact', () => {
		use([BarChart, DatasetComponent, GridComponent, SVGRenderer])
		const instance = init(null, undefined, { renderer: 'svg', ssr: true, width: 640, height: 320 })
		try {
			instance.setOption({
				dataset: {
					dimensions: [
						{ name: '__dimension_0', displayName: 'timestamp' },
						{ name: '__dimension_1', displayName: 'ethereum' },
						{ name: '__dimension_2', displayName: 'solana' }
					],
					source: [
						[1_704_067_200_000, 123.25, 0],
						[1_704_153_600_000, null, 7.5]
					]
				},
				xAxis: { type: 'time' },
				yAxis: {},
				series: [
					{ type: 'bar', encode: { x: 0, y: 1 } },
					{ type: 'bar', encode: { x: 0, y: 2 } }
				]
			})

			expect(serializeCsv(buildCsvRowsFromChartOption(instance.getOption()))).toBe(
				'Timestamp,Date,ethereum,solana\n1704067200000,2024-01-01,123.25,0\n1704153600000,2024-01-02,,7.5'
			)
		} finally {
			instance.dispose()
		}
	})

	test('keeps numeric-looking pie labels distinct without inventing a date column', () => {
		const option = {
			series: [
				{
					type: 'pie',
					name: 'Value',
					data: [
						{ name: '001', value: 12 },
						{ name: '1', value: 5 }
					]
				}
			]
		} as ChartOption

		expect(buildCsvRowsFromChartOption(option)).toEqual([
			['x', 'Value'],
			['001', 12],
			['1', 5]
		])
	})

	test('adds dates to time axes but not numeric value axes', () => {
		const series = [
			{
				name: 'Volume',
				type: 'line',
				data: [
					[1_704_067_200_000, 0],
					[1_704_153_600_000, 12]
				]
			}
		]

		expect(buildCsvRowsFromChartOption({ xAxis: [{ type: 'time' }], series } as ChartOption)).toEqual([
			['x', 'Date', 'Volume'],
			[1_704_067_200_000, '2024-01-01', 0],
			[1_704_153_600_000, '2024-01-02', 12]
		])
		expect(
			buildCsvRowsFromChartOption({
				xAxis: [{ type: 'value' }],
				series: [{ name: 'Count', type: 'bar', data: [[5, 20]] }]
			} as ChartOption)
		).toEqual([
			['x', 'Count'],
			[5, 20]
		])
	})
})
