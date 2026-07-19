import type { MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import { getTimePeriodBounds } from '~/containers/ProDashboard/queries'
import type { CustomTimePeriod, TimePeriod } from '../../ProDashboardAPIContext'

/** Slice an ascending canonical chart dataset without rebuilding its rows. */
export function filterChartDatasetByTimePeriod<TDataset extends MultiSeriesChart2Dataset>(
	dataset: TDataset,
	timePeriod: TimePeriod,
	customTimePeriod?: CustomTimePeriod | null
): TDataset {
	const source = dataset.source
	if (source.length === 0) return dataset
	const bounds = getTimePeriodBounds(timePeriod, customTimePeriod)
	if (!bounds) return dataset

	const startTimestamp = bounds.start * 1e3
	const endTimestamp = bounds.end * 1e3
	let low = 0
	let high = source.length
	while (low < high) {
		const middle = (low + high) >>> 1
		if ((source[middle].timestamp as number) < startTimestamp) low = middle + 1
		else high = middle
	}
	const startIndex = low

	high = source.length
	while (low < high) {
		const middle = (low + high) >>> 1
		if ((source[middle].timestamp as number) <= endTimestamp) low = middle + 1
		else high = middle
	}

	if (startIndex === 0 && low === source.length) return dataset
	return { ...dataset, source: source.slice(startIndex, low) }
}
