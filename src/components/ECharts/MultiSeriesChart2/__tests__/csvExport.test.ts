import { describe, expect, it } from 'vitest'
import { buildCsvRowsFromDataset } from '~/components/ChartExport/ChartCsvExportButton'
import type { MultiSeriesChart2SeriesConfig } from '../../types'
import { getDisplayedDatasetDimensions } from '../csvExport'

describe('MultiSeriesChart2 selected-series CSV export', () => {
	it('exports only dimensions encoded by the displayed series', () => {
		const dimensions = ['timestamp', 'TVL', 'APY']
		const charts: MultiSeriesChart2SeriesConfig[] = [
			{ type: 'line', name: 'APY', encode: { x: 'timestamp', y: 'APY' } }
		]
		const displayedDimensions = getDisplayedDatasetDimensions(dimensions, charts)

		expect(displayedDimensions).toEqual(['timestamp', 'APY'])
		expect(buildCsvRowsFromDataset(displayedDimensions, [{ timestamp: 1_767_225_600_000, TVL: 100, APY: 5 }])).toEqual([
			['Timestamp', 'Date', 'APY'],
			[1_767_225_600_000, '2026-01-01', 5]
		])
	})

	it('resolves numeric encodes without changing canonical dimension order', () => {
		const dimensions = ['timestamp', 'TVL', 'APY']
		const charts: MultiSeriesChart2SeriesConfig[] = [{ type: 'line', name: 'APY', encode: { x: 0, y: 2 } }]

		expect(getDisplayedDatasetDimensions(dimensions, charts)).toEqual(['timestamp', 'APY'])
	})
})
