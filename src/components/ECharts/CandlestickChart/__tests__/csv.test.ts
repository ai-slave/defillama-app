import { expect, test } from 'vitest'
import { buildCsvRowsFromDataset } from '~/components/ChartExport/ChartCsvExportButton'
import { buildCandlestickCsvDataset } from '../csv'

const JAN_1 = Date.UTC(2024, 0, 1)
const JAN_2 = Date.UTC(2024, 0, 2)

test('the candlestick CSV reads open, high, low and close in that order, with volume when the chart draws it', () => {
	// Points store open, close, low, high: the CSV must not copy that order.
	const { dimensions, source } = buildCandlestickCsvDataset([
		[JAN_1, 10, 12, 9, 13, 500],
		[JAN_2, 12, 11, 10, 14, 700]
	])

	expect(buildCsvRowsFromDataset(dimensions, source, 'daily')).toEqual([
		['Timestamp', 'Date', 'Open', 'High', 'Low', 'Close', 'Volume'],
		[JAN_1, '2024-01-01', 10, 13, 9, 12, 500],
		[JAN_2, '2024-01-02', 12, 14, 10, 11, 700]
	])
})

test('a candlestick chart without volume exports no Volume column', () => {
	const { dimensions, source } = buildCandlestickCsvDataset([[JAN_1, 10, 12, 9, 13]])

	expect(buildCsvRowsFromDataset(dimensions, source, 'daily')).toEqual([
		['Timestamp', 'Date', 'Open', 'High', 'Low', 'Close'],
		[JAN_1, '2024-01-01', 10, 13, 9, 12]
	])
})
