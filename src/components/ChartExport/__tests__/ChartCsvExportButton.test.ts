import type { ECharts } from 'echarts'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { PrepareCsv } from '~/components/CsvDownloadButton'

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

async function prepareCsvFromDataset(instance: ECharts) {
	mocks.prepareCsv = undefined
	renderToStaticMarkup(
		createElement(ChartCsvExportButton, {
			chartInstance: () => instance,
			filename: 'app-revenue',
			source: {
				type: 'dataset',
				dataset: {
					dimensions: ['timestamp', 'Solana', 'Ethereum'],
					source: [[Date.UTC(2024, 0, 1), 50, 100]]
				}
			}
		})
	)
	if (!mocks.prepareCsv) throw new Error('CSV preparer was not rendered')
	return await mocks.prepareCsv()
}

describe('ChartCsvExportButton', () => {
	it('uses logical display names from private ECharts dimensions', async () => {
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

	it('exports every logical dimension even when a chart legend is hidden', async () => {
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

	it('prefers an explicit canonical dataset over the rendered chart presentation', async () => {
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

	it('awaits an asynchronous dataset before reporting the export', async () => {
		mocks.prepareCsv = undefined
		const onExport = vi.fn()
		renderToStaticMarkup(
			createElement(ChartCsvExportButton, {
				chartInstance: () => null,
				filename: 'complete-data',
				source: {
					type: 'prepare-dataset',
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
