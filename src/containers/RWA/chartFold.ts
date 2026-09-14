import { isRwaTotalSeriesLabel, type RWAPositionalChartDataset } from './chartDataset'

export const RWA_OTHERS_SERIES_LABEL = 'Others'
/** Time series and Share show this many groups; the rest fold into Others. */
export const RWA_MAX_CHART_SERIES = 10

type SeriesColumn = { name: string; index: number }

/** The columns the fold ranks: not the timestamp and not a Total line. */
function getRankedColumns(dataset: RWAPositionalChartDataset): {
	ranked: Array<SeriesColumn>
	reserved: Array<SeriesColumn>
	others: SeriesColumn | null
} {
	const ranked: Array<SeriesColumn> = []
	const reserved: Array<SeriesColumn> = []
	let others: SeriesColumn | null = null
	for (const [index, name] of dataset.dimensions.entries()) {
		if (index === 0) continue
		if (isRwaTotalSeriesLabel(name)) reserved.push({ name, index })
		else if (name === RWA_OTHERS_SERIES_LABEL) others = { name, index }
		else ranked.push({ name, index })
	}
	return { ranked, reserved, others }
}

function latestValue(dataset: RWAPositionalChartDataset, index: number): number {
	const lastRow = dataset.source[dataset.source.length - 1]
	const value = lastRow?.[index]
	return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Keeps the `max` largest series by their latest value, ordered largest first, and folds the rest into one
 * Others series; an Others series already in the dataset joins that fold and stays last. Total lines keep
 * their place and stay out of the ranking. An Others cell stays null when every folded cell of that row is null.
 */
export function foldRwaTopSeries(
	dataset: RWAPositionalChartDataset,
	{ max = RWA_MAX_CHART_SERIES, othersLabel = RWA_OTHERS_SERIES_LABEL }: { max?: number; othersLabel?: string }
): RWAPositionalChartDataset {
	if (dataset.source.length === 0) return dataset
	const { ranked, reserved, others } = getRankedColumns(dataset)
	if (ranked.length === 0) return dataset
	const ordered = [...ranked].sort(
		(a, b) => latestValue(dataset, b.index) - latestValue(dataset, a.index) || a.name.localeCompare(b.name)
	)
	const kept = ordered.slice(0, max)
	const folded = [...ordered.slice(max), ...(others ? [others] : [])]
	const columns = [...reserved, ...kept]
	const dimensions: RWAPositionalChartDataset['dimensions'] = [
		'timestamp',
		...columns.map((column) => column.name),
		...(folded.length > 0 ? [othersLabel] : [])
	]
	const source = dataset.source.map((row) => {
		const next: RWAPositionalChartDataset['source'][number] = [row[0], ...columns.map((column) => row[column.index])]
		if (folded.length > 0) {
			let sum = 0
			let hasValue = false
			for (const column of folded) {
				const value = row[column.index]
				if (value == null) continue
				sum += value
				hasValue = true
			}
			next.push(hasValue ? sum : null)
		}
		return next
	})
	return { ...dataset, dimensions, source }
}

/**
 * Draws every row as percent of that row's total across the ranked series and Others. The Total line leaves
 * the dataset. A row whose total is zero or missing stays null.
 */
export function toRwaShareDataset(dataset: RWAPositionalChartDataset): RWAPositionalChartDataset {
	const { ranked, others } = getRankedColumns(dataset)
	const columns = others ? [...ranked, others] : ranked
	const dimensions: RWAPositionalChartDataset['dimensions'] = ['timestamp', ...columns.map((column) => column.name)]
	const source = dataset.source.map((row) => {
		let total = 0
		for (const column of columns) {
			const value = row[column.index]
			if (value != null) total += value
		}
		const next: RWAPositionalChartDataset['source'][number] = [row[0]]
		for (const column of columns) {
			const value = row[column.index]
			next.push(value == null || total === 0 ? null : (value / total) * 100)
		}
		return next
	})
	return { dimensions, source }
}

/** Adds a Total line over the series and Others, first after the timestamp, when the dataset has none. A row with no values stays null. */
export function ensureRwaTotalSeries(
	dataset: RWAPositionalChartDataset,
	totalLabel: string
): RWAPositionalChartDataset {
	if (dataset.dimensions.some(isRwaTotalSeriesLabel)) return dataset
	const { ranked, others } = getRankedColumns(dataset)
	const columns = others ? [...ranked, others] : ranked
	const dimensions: RWAPositionalChartDataset['dimensions'] = ['timestamp', totalLabel, ...dataset.dimensions.slice(1)]
	const source = dataset.source.map((row) => {
		let total = 0
		let hasValue = false
		for (const column of columns) {
			const value = row[column.index]
			if (value == null) continue
			total += value
			hasValue = true
		}
		return [row[0], hasValue ? total : null, ...row.slice(1)] as RWAPositionalChartDataset['source'][number]
	})
	return { ...dataset, dimensions, source }
}
