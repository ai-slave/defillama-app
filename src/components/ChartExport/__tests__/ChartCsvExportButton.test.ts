import type { ECharts } from 'echarts'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	prepareCsv: undefined as
		| (() => {
				filename: string
				rows: Array<Array<string | number | boolean | null | undefined>>
		  })
		| undefined
}))

vi.mock('~/components/CsvDownloadButton', () => ({
	CSVDownloadButton: ({ prepareCsv: prepareCsvProp }: { prepareCsv: NonNullable<typeof mocks.prepareCsv> }) => {
		mocks.prepareCsv = prepareCsvProp
		return null
	}
}))

import { ChartCsvExportButton } from '../ChartCsvExportButton'

function prepareCsv(instance: ECharts) {
	mocks.prepareCsv = undefined
	renderToStaticMarkup(createElement(ChartCsvExportButton, { chartInstance: () => instance, filename: 'app-revenue' }))
	if (!mocks.prepareCsv) throw new Error('CSV preparer was not rendered')
	return mocks.prepareCsv()
}

describe('ChartCsvExportButton', () => {
	it('uses logical display names from private ECharts dimensions', () => {
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

		const result = prepareCsv(instance)

		expect(result.rows).toEqual([
			['Timestamp', 'Date', 'Ethereum'],
			[Date.UTC(2024, 0, 1), '2024-01-01', 100]
		])
		expect(result.filename).toMatch(/^app-revenue-\d{4}-\d{2}-\d{2}$/)
		expect(instance.getOption).toHaveBeenCalledOnce()
	})

	it('keeps string dimensions while omitting unselected private dimensions', () => {
		const sourceRow = [Date.UTC(2024, 0, 1), 50, 100]
		const option = {
			dataset: {
				dimensions: ['timestamp', { name: '__dimension_1' }, { name: '__dimension_2', displayName: 'Ethereum' }],
				source: [sourceRow]
			}
		}
		const instance = {
			getOption: vi.fn(() => option)
		} as unknown as ECharts

		const result = prepareCsv(instance)

		expect(result.rows).toEqual([
			['Timestamp', 'Date', 'Ethereum'],
			[Date.UTC(2024, 0, 1), '2024-01-01', 100]
		])
	})
})
