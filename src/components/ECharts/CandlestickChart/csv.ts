import type { ChartCsvDataset } from '~/components/ChartExport/ChartCsvExportButton'
import type { CandlestickPoint } from './types'

/** OHLC rows in reading order (the points store open, close, low, high). The `timestamp` dimension gives the file its
    Timestamp and Date columns; a chart without volume, which draws no volume panel, gets no Volume column. */
export function buildCandlestickCsvDataset(data: ReadonlyArray<CandlestickPoint>): ChartCsvDataset {
	const hasVolume = data[0]?.[5] !== undefined
	const source: Array<Array<number>> = []
	for (const [timestamp, open, close, low, high, volume] of data) {
		source.push(hasVolume ? [timestamp, open, high, low, close, volume] : [timestamp, open, high, low, close])
	}
	return {
		dimensions: hasVolume
			? ['timestamp', 'Open', 'High', 'Low', 'Close', 'Volume']
			: ['timestamp', 'Open', 'High', 'Low', 'Close'],
		source
	}
}
