import { BarChart } from 'echarts/charts'
import { DatasetComponent, GridComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { describe, expect, test } from 'vitest'
import { serializeCsv } from '~/utils/csv'
import { buildCsvRowsFromChartOption } from '../ChartCsvExportButton'

type ChartOption = Parameters<typeof buildCsvRowsFromChartOption>[0]
const JAN_1 = Date.UTC(2024, 0, 1)

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
			['Timestamp', 'Date', 'Volume'],
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
