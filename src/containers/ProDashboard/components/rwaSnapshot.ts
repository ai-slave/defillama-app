import type { RWAPositionalChartDataset } from '~/containers/RWA/chartDataset'
import { buildRwaTreemapTreeData } from '~/containers/RWA/treemap'
import type { CustomTimePeriod, TimePeriod } from '../dashboardTypes'
import { getTimePeriodBounds } from '../queries'
import type { RWAOverviewChartView } from '../types'

type RwaSnapshotView = Exclude<RWAOverviewChartView, 'timeSeries'>
type RwaSnapshotItem = { name: string; value: number }

export type RwaSnapshotPresentation =
	| { view: 'pie'; data: Array<RwaSnapshotItem> }
	| { view: 'hbar'; categories: Array<string>; values: Array<number> }
	| { view: 'treemap'; data: ReturnType<typeof buildRwaTreemapTreeData> }

export function hasRwaOverviewChartExportData(
	view: RWAOverviewChartView,
	timeSeriesDataset: RWAPositionalChartDataset | null,
	snapshot: RwaSnapshotPresentation | null
): boolean {
	if (view === 'timeSeries') return (timeSeriesDataset?.source.length ?? 0) > 0
	if (!snapshot || snapshot.view !== view) return false
	return snapshot.view === 'hbar' ? snapshot.categories.length > 0 : snapshot.data.length > 0
}

export function findLatestRwaSnapshotRow(
	dataset: RWAPositionalChartDataset,
	timePeriod: TimePeriod | null | undefined,
	customTimePeriod?: CustomTimePeriod | null
) {
	const bounds = timePeriod ? getTimePeriodBounds(timePeriod, customTimePeriod) : null
	const startTimestamp = bounds ? bounds.start * 1e3 : Number.NEGATIVE_INFINITY
	const endTimestamp = bounds ? bounds.end * 1e3 : Number.POSITIVE_INFINITY

	for (let rowIndex = dataset.source.length - 1; rowIndex >= 0; rowIndex--) {
		const row = dataset.source[rowIndex]
		const timestamp = row[0] as number
		if (timestamp > endTimestamp) continue
		return timestamp >= startTimestamp ? row : null
	}
	return null
}

export function buildRwaSnapshotPresentation({
	dataset,
	view,
	timePeriod,
	customTimePeriod,
	breakdownLabel
}: {
	dataset: RWAPositionalChartDataset
	view: RwaSnapshotView
	timePeriod: TimePeriod | null | undefined
	customTimePeriod?: CustomTimePeriod | null
	breakdownLabel: string
}): RwaSnapshotPresentation {
	const row = findLatestRwaSnapshotRow(dataset, timePeriod, customTimePeriod)
	const items: Array<RwaSnapshotItem> = []
	if (row) {
		for (let dimensionIndex = 1; dimensionIndex < dataset.dimensions.length; dimensionIndex++) {
			const value = row[dimensionIndex] as number | null | undefined
			if (value != null && value > 0) items.push({ name: dataset.dimensions[dimensionIndex], value })
		}
	}

	if (view === 'treemap') {
		return { view, data: buildRwaTreemapTreeData(items, breakdownLabel) }
	}

	items.sort((a, b) => b.value - a.value)
	if (view === 'pie') return { view, data: items }
	if (items.length > 20) items.length = 20
	return { view, categories: items.map((item) => item.name), values: items.map((item) => item.value) }
}

export function buildRwaSnapshotCsvRows(
	snapshot: RwaSnapshotPresentation | null,
	breakdownLabel: string,
	metricLabel: string
): Array<Array<string | number>> {
	const rows: Array<Array<string | number>> = [[breakdownLabel, metricLabel]]
	if (!snapshot) return rows
	if (snapshot.view === 'hbar')
		return [...rows, ...snapshot.categories.map((name, index) => [name, snapshot.values[index]])]
	return [...rows, ...snapshot.data.map((item) => [item.name, Array.isArray(item.value) ? item.value[0] : item.value])]
}
