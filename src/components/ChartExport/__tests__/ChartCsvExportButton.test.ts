import type { ECharts } from 'echarts'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { PrepareCsv } from '~/components/CsvDownloadButton'
import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'

const mocks = vi.hoisted(() => ({
	prepareCsv: undefined as PrepareCsv | undefined
}))

vi.mock('~/components/CsvDownloadButton', () => ({
	CSVDownloadButton: ({ prepareCsv: prepareCsvProp }: { prepareCsv: NonNullable<typeof mocks.prepareCsv> }) => {
		mocks.prepareCsv = prepareCsvProp
		return null
	}
}))

import { ChartCsvExportButton } from '../ChartCsvExportButton'

async function prepareCsv(instance: ECharts) {
	mocks.prepareCsv = undefined
	renderToStaticMarkup(
		createElement(ChartCsvExportButton, {
			chartInstance: () => instance,
			filename: 'app-revenue',
			source: 'rendered-chart'
		})
	)
	if (!mocks.prepareCsv) throw new Error('CSV preparer was not rendered')
	return await mocks.prepareCsv()
}

async function prepareCsvFromDataset(instance: ECharts, groupBy?: ChartTimeGroupingWithCumulative) {
	mocks.prepareCsv = undefined
	const prepareDataset = vi.fn(() => ({
		dimensions: ['timestamp', 'Solana', 'Ethereum'],
		source: [[Date.UTC(2024, 0, 1), 50, 100]],
		...(groupBy ? { groupBy } : {})
	}))
	renderToStaticMarkup(
		createElement(ChartCsvExportButton, {
			chartInstance: () => instance,
			filename: 'app-revenue',
			source: {
				type: 'dataset',
				prepare: prepareDataset
			}
		})
	)
	if (!mocks.prepareCsv) throw new Error('CSV preparer was not rendered')
	expect(prepareDataset).not.toHaveBeenCalled()
	const result = await mocks.prepareCsv()
	expect(prepareDataset).toHaveBeenCalledOnce()
	return result
}

describe('ChartCsvExportButton', () => {
	test('names both ends of the period each row of a grouped dataset covers', async () => {
		const instance = { getOption: vi.fn(() => ({})) } as unknown as ECharts

		expect((await prepareCsvFromDataset(instance, 'monthly')).rows).toEqual([
			['Timestamp', 'Month start', 'Month end', 'Solana', 'Ethereum'],
			[Date.UTC(2024, 0, 1), '2024-01-01', '2024-01-31', 50, 100]
		])
		expect((await prepareCsvFromDataset(instance)).rows).toEqual([
			['Timestamp', 'Date', 'Solana', 'Ethereum'],
			[Date.UTC(2024, 0, 1), '2024-01-01', 50, 100]
		])
	})

	test('uses logical display names from private ECharts dimensions', async () => {
		const instance = {
			getOption: vi.fn(() => ({
				dataset: {
					dimensions: [
						{ name: '__dimension_0', displayName: 'timestamp' },
						{ name: '__dimension_1', displayName: 'Ethereum' }
					],
					source: [[Date.UTC(2024, 0, 1), 100]]
				}
			}))
		} as unknown as ECharts

		const result = await prepareCsv(instance)

		expect(result.rows).toEqual([
			['Timestamp', 'Date', 'Ethereum'],
			[Date.UTC(2024, 0, 1), '2024-01-01', 100]
		])
		expect(result.filename).toMatch(/^app-revenue-\d{4}-\d{2}-\d{2}$/)
		expect(instance.getOption).toHaveBeenCalledOnce()
	})

	test('exports every logical dimension even when a chart legend is hidden', async () => {
		const sourceRow = [Date.UTC(2024, 0, 1), 50, 100]
		const option = {
			dataset: {
				dimensions: [
					'timestamp',
					{ name: '__dimension_1', displayName: 'Solana' },
					{ name: '__dimension_2', displayName: 'Ethereum' }
				],
				source: [sourceRow]
			}
		}
		const instance = {
			getOption: vi.fn(() => option)
		} as unknown as ECharts

		const result = await prepareCsv(instance)

		expect(result.rows).toEqual([
			['Timestamp', 'Date', 'Solana', 'Ethereum'],
			[Date.UTC(2024, 0, 1), '2024-01-01', 50, 100]
		])
	})

	test('prefers an explicit canonical dataset over the rendered chart presentation', async () => {
		const instance = {
			getOption: vi.fn(() => ({
				dataset: {
					dimensions: ['timestamp', 'Top Protocol', 'Others'],
					source: [[Date.UTC(2024, 0, 1), 100, 50]]
				}
			}))
		} as unknown as ECharts

		const result = await prepareCsvFromDataset(instance)

		expect(result.rows).toEqual([
			['Timestamp', 'Date', 'Solana', 'Ethereum'],
			[Date.UTC(2024, 0, 1), '2024-01-01', 50, 100]
		])
		expect(instance.getOption).not.toHaveBeenCalled()
	})

	test('awaits an asynchronous dataset before reporting the export', async () => {
		mocks.prepareCsv = undefined
		const onExport = vi.fn()
		renderToStaticMarkup(
			createElement(ChartCsvExportButton, {
				chartInstance: () => null,
				filename: 'complete-data',
				source: {
					type: 'dataset',
					prepare: async () => ({ dimensions: ['Value'], source: [[1]] })
				},
				onExport
			})
		)
		if (!mocks.prepareCsv) throw new Error('CSV preparer was not rendered')

		const result = await mocks.prepareCsv()
		expect(result.rows).toEqual([['Value'], [1]])
		expect(result.filename).toMatch(/^complete-data-\d{4}-\d{2}-\d{2}$/)
		expect(onExport).toHaveBeenCalledWith({ filename: result.filename })
	})
})

test('exports a real ECharts dataset with dates and chain labels intact', async () => {
	const { init, use } = await import('echarts/core')
	const { BarChart } = await import('echarts/charts')
	const { DatasetComponent, GridComponent } = await import('echarts/components')
	const { SVGRenderer } = await import('echarts/renderers')
	const { serializeCsv } = await import('~/utils/csv')
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
		const result = await prepareCsv(instance)
		expect(serializeCsv(result.rows)).toBe(
			'Timestamp,Date,ethereum,solana\n1704067200000,2024-01-01,123.25,0\n1704153600000,2024-01-02,,7.5'
		)
	} finally {
		instance.dispose()
	}
})

test('downloads all protocol columns from the real capped presentation, including unselected history', async () => {
	const { buildAdapterByChainBreakdownPresentation } = await import('~/containers/AdapterMetrics/utils')
	const { serializeCsv } = await import('~/utils/csv')
	const names = Array.from({ length: 32 }, (_, index) => `Protocol ${index + 1}`)
	const presentation = buildAdapterByChainBreakdownPresentation({
		chartData: {
			dimensions: ['timestamp', ...names, 'Historical protocol'],
			source: [[1_704_067_200_000, ...Array.from({ length: 32 }, (_, index) => index + 1), 500]]
		},
		selectedProtocols: names,
		state: { chartKind: 'bar', valueMode: 'absolute', barLayout: 'stacked', groupBy: 'daily' }
	})
	expect(presentation.dataset.dimensions.at(-1)).toBe('Others')
	mocks.prepareCsv = undefined
	renderToStaticMarkup(
		createElement(ChartCsvExportButton, { chartInstance: () => null, source: presentation.csvSource })
	)
	if (!mocks.prepareCsv) throw new Error('CSV preparer was not rendered')
	const result = await mocks.prepareCsv()
	expect(serializeCsv(result.rows)).toBe(
		'Timestamp,Date,Protocol 1,Protocol 2,Protocol 3,Protocol 4,Protocol 5,Protocol 6,Protocol 7,Protocol 8,Protocol 9,Protocol 10,Protocol 11,Protocol 12,Protocol 13,Protocol 14,Protocol 15,Protocol 16,Protocol 17,Protocol 18,Protocol 19,Protocol 20,Protocol 21,Protocol 22,Protocol 23,Protocol 24,Protocol 25,Protocol 26,Protocol 27,Protocol 28,Protocol 29,Protocol 30,Protocol 31,Protocol 32,Historical protocol\n1704067200000,2024-01-01,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,500'
	)
})

test('keeps numeric-looking pie labels distinct without inventing a date column', async () => {
	const result = await prepareCsv({
		getOption: () => ({
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
		})
	} as unknown as ECharts)
	expect(result.rows).toEqual([
		['x', 'Value'],
		['001', 12],
		['1', 5]
	])
})

test('adds dates to time axes but not numeric value axes', async () => {
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
	const time = await prepareCsv({ getOption: () => ({ xAxis: [{ type: 'time' }], series }) } as unknown as ECharts)
	expect(time.rows).toEqual([
		['x', 'Date', 'Volume'],
		[1_704_067_200_000, '2024-01-01', 0],
		[1_704_153_600_000, '2024-01-02', 12]
	])
	const value = await prepareCsv({
		getOption: () => ({ xAxis: [{ type: 'value' }], series: [{ name: 'Count', type: 'bar', data: [[5, 20]] }] })
	} as unknown as ECharts)
	expect(value.rows).toEqual([
		['x', 'Count'],
		[5, 20]
	])
})
