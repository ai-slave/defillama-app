import type { CsvPayload } from '~/components/CsvDownloadButton'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { formatIsoDate } from '~/utils/dateFormat'

/** Preserve the Pro chart CSV shape while exporting every dimension in the canonical dataset. */
export function prepareProChartCsv(dataset: MultiSeriesChartDataset, filename: string): CsvPayload {
	const timestampIndex = dataset.dimensions.indexOf('timestamp')
	if (timestampIndex < 0) return { filename, rows: [dataset.dimensions, ...dataset.source] }

	const dimensions = dataset.dimensions.filter((_, index) => index !== timestampIndex)
	const rows: CsvPayload['rows'] = [['Date', ...dimensions]]
	for (const [rowIndex, sourceRow] of dataset.source.entries()) {
		const timestamp = sourceRow[timestampIndex]
		if (typeof timestamp !== 'number') throw new Error(`Invalid chart timestamp at index ${rowIndex}`)
		const row: CsvPayload['rows'][number] = [formatIsoDate(timestamp, { input: 'milliseconds' }) ?? '']
		for (let index = 0; index < dataset.dimensions.length; index++) {
			if (index !== timestampIndex) row.push(sourceRow[index] ?? '')
		}
		rows.push(row)
	}
	return { filename, rows }
}
