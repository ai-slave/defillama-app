import { CHART_SERIES_LIMIT } from '~/constants/colors'
import { isRwaTotalSeriesLabel, type RWAPositionalChartDataset } from './chartDataset'

export const RWA_OTHERS_SERIES_LABEL = 'Others'
/** Time series and Share show this many groups; the rest fold into Others. */
export const RWA_MAX_CHART_SERIES = CHART_SERIES_LIMIT

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
	return dataset.source[dataset.source.length - 1]?.[index] ?? 0
}

function rankByLatest(dataset: RWAPositionalChartDataset, columns: Array<SeriesColumn>): Array<SeriesColumn> {
	return [...columns].sort(
		(a, b) => latestValue(dataset, b.index) - latestValue(dataset, a.index) || a.name.localeCompare(b.name)
	)
}

/** The members of a split, largest first by their latest value, ties by name: the order the fold ranks them in. */
export function getRwaRankedSeriesNames(dataset: RWAPositionalChartDataset): Array<string> {
	return rankByLatest(dataset, getRankedColumns(dataset).ranked).map((column) => column.name)
}

/**
 * What a split's absolute chart draws (docs/charts.md): the `picked` members, or every member without a pick,
 * largest first by their latest value. The first `max` picks draw their own series and the other picks fold into one
 * Others; an unpicked member leaves the chart. An Others already in the dataset joins the fold only while every member
 * is picked, so a pick never draws a remainder it left out. Total lines keep their place and stay out of the ranking,
 * and nothing picked draws nothing, the Total included. An Others cell stays null when every folded cell of that row
 * is null.
 */
export function foldRwaTopSeries(
	dataset: RWAPositionalChartDataset,
	{ max = RWA_MAX_CHART_SERIES, picked }: { max?: number; picked?: ReadonlyArray<string> }
): RWAPositionalChartDataset {
	if (dataset.source.length === 0) return dataset
	const { ranked, reserved, others } = getRankedColumns(dataset)
	if (ranked.length === 0) return dataset
	const pickedSet = picked ? new Set(picked) : null
	const ordered = rankByLatest(dataset, pickedSet ? ranked.filter((column) => pickedSet.has(column.name)) : ranked)
	if (ordered.length === 0) return { dimensions: ['timestamp'], source: [] }
	const folded = ordered.slice(max)
	if (others && ordered.length === ranked.length) folded.push(others)
	const columns = [...reserved, ...ordered.slice(0, max)]
	const dimensions: RWAPositionalChartDataset['dimensions'] = [
		'timestamp',
		...columns.map((column) => column.name),
		...(folded.length > 0 ? [RWA_OTHERS_SERIES_LABEL] : [])
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

/**
 * Drops the Total line when the dataset has exactly one member and that member equals the Total on every row:
 * a one-asset platform draws one line named after the asset, not two lines on one value.
 */
export function dropRwaRedundantTotal(dataset: RWAPositionalChartDataset): RWAPositionalChartDataset {
	const { ranked, reserved, others } = getRankedColumns(dataset)
	if (reserved.length !== 1 || ranked.length !== 1 || others) return dataset
	const [total] = reserved
	const [member] = ranked
	if (!total || !member) return dataset
	for (const row of dataset.source) {
		const totalValue = row[total.index]
		const memberValue = row[member.index]
		/* The canonical builder writes a 0 total against a member with no value yet; that row is still one series. */
		if (memberValue == null ? totalValue != null && totalValue !== 0 : totalValue !== memberValue) return dataset
	}
	const dimensions: RWAPositionalChartDataset['dimensions'] = [
		'timestamp',
		...dataset.dimensions.slice(1).filter((_, index) => index + 1 !== total.index)
	]
	const source = dataset.source.map(
		(row) => row.filter((_, index) => index !== total.index) as RWAPositionalChartDataset['source'][number]
	)
	return { ...dataset, dimensions, source }
}
