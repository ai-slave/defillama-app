import type { MultiSeriesTimeSeriesDataset } from '~/components/ECharts/MultiSeriesChart/types'

export const RWA_OPEN_INTEREST_SERIES_LABEL = 'RWA Perps OI'

export type RWAChartSeriesValue = number | null | undefined
export type RWAChartRow = { timestamp: number } & Record<string, RWAChartSeriesValue>
export type RWAChartDataset = { source: Array<RWAChartRow>; dimensions: Array<string> }
export type RWAPositionalChartDataset = MultiSeriesTimeSeriesDataset
export type RwaNamedValue = { name: string; value: number }

export const RWA_MAX_HORIZONTAL_BARS = 9

export function emptyChartDataset(): RWAChartDataset {
	return { source: [], dimensions: ['timestamp'] }
}

/** Materialize the named public RWA API contract once before a Cartesian renderer consumes it. */
export function toRwaMultiSeriesChartDataset(dataset: RWAChartDataset): MultiSeriesTimeSeriesDataset {
	const seriesDimensions = dataset.dimensions.slice(1)
	const dimensions: MultiSeriesTimeSeriesDataset['dimensions'] = ['timestamp', ...seriesDimensions]
	const source: MultiSeriesTimeSeriesDataset['source'] = []
	for (const input of dataset.source) {
		const row: MultiSeriesTimeSeriesDataset['source'][number] = [input.timestamp]
		for (const dimension of seriesDimensions) {
			row.push(input[dimension] ?? null)
		}
		source.push(row)
	}
	return { source, dimensions }
}

export function buildRwaChartDatasetTotal({
	dataset,
	totalLabel = 'Total',
	onlyTotal = false,
	isSeriesDimension
}: {
	dataset: RWAChartDataset
	totalLabel?: string
	onlyTotal?: boolean
	isSeriesDimension?: (dimension: string) => boolean
}): RWAChartDataset {
	if (dataset.source.length === 0) return emptyChartDataset()

	const seriesDimensions: Array<string> = []
	for (const dimension of dataset.dimensions) {
		const includeSeries = isSeriesDimension
			? isSeriesDimension(dimension)
			: dimension !== 'timestamp' && dimension !== totalLabel
		if (includeSeries) {
			seriesDimensions.push(dimension)
		}
	}
	if (seriesDimensions.length === 0) return onlyTotal ? emptyChartDataset() : dataset

	const source: RWAChartDataset['source'] = []
	for (const row of dataset.source) {
		const nextRow: RWAChartRow = { timestamp: row.timestamp }
		if (!onlyTotal) {
			for (const key in row) {
				nextRow[key] = row[key]
			}
		}

		let total = 0
		for (const dimension of seriesDimensions) {
			total += row[dimension] ?? 0
		}
		nextRow[totalLabel] = total
		source.push(nextRow)
	}

	if (onlyTotal) {
		return {
			source,
			dimensions: ['timestamp', totalLabel]
		}
	}

	return {
		source,
		dimensions: ['timestamp', totalLabel, ...seriesDimensions]
	}
}

export function appendRwaChartDatasetTotal(dataset: RWAChartDataset): RWAChartDataset {
	return buildRwaChartDatasetTotal({ dataset })
}

export function limitRwaHorizontalBarData(
	items: ReadonlyArray<RwaNamedValue>,
	{ sort = false }: { sort?: boolean } = {}
): Array<RwaNamedValue> {
	let othersValue = 0
	const withoutOthers: Array<RwaNamedValue> = []
	for (const item of items) {
		const value = item.value
		if (value <= 0) continue
		if (item.name === 'Others') {
			othersValue += value
			continue
		}
		withoutOthers.push({ name: item.name, value })
	}

	if (sort) {
		withoutOthers.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
	}

	if (withoutOthers.length <= RWA_MAX_HORIZONTAL_BARS - (othersValue > 0 ? 1 : 0)) {
		return othersValue > 0 ? [...withoutOthers, { name: 'Others', value: othersValue }] : withoutOthers
	}

	const limited = withoutOthers.slice(0, RWA_MAX_HORIZONTAL_BARS - 1)
	let overflowValue = othersValue
	for (const item of withoutOthers.slice(RWA_MAX_HORIZONTAL_BARS - 1)) {
		overflowValue += item.value
	}
	return overflowValue > 0 ? [...limited, { name: 'Others', value: overflowValue }] : limited
}

export function isRwaTotalSeriesLabel(label: string): boolean {
	return label.startsWith('Total ')
}

export function sortRwaChartSeriesLabels(labels: Array<string>): Array<string> {
	const totalSeries = labels.filter(isRwaTotalSeriesLabel)
	const hasOpenInterestSeries = labels.includes(RWA_OPEN_INTEREST_SERIES_LABEL)
	const otherSeries = labels.filter(
		(label) => !isRwaTotalSeriesLabel(label) && label !== RWA_OPEN_INTEREST_SERIES_LABEL
	)

	return [...totalSeries, ...(hasOpenInterestSeries ? [RWA_OPEN_INTEREST_SERIES_LABEL] : []), ...otherSeries]
}

export function getRwaReservedSeriesColorSlot(label: string): number | null {
	if (isRwaTotalSeriesLabel(label)) return 0
	if (label === RWA_OPEN_INTEREST_SERIES_LABEL) return 1
	return null
}

export function getRwaChartSeriesColorSlots(labels: Array<string>): Record<string, number> {
	const colorSlots: Record<string, number> = {}
	let nextNonReservedColorSlot = 2

	for (const label of sortRwaChartSeriesLabels(labels)) {
		colorSlots[label] = getRwaReservedSeriesColorSlot(label) ?? nextNonReservedColorSlot++
	}

	return colorSlots
}

export function mergeRwaChartDatasets(primary: RWAChartDataset, overlay: RWAChartDataset): RWAChartDataset {
	if (overlay.dimensions.length <= 1 || overlay.source.length === 0) return primary
	if (primary.dimensions.length <= 1 || primary.source.length === 0) return overlay

	const mergedRows = new Map<number, RWAChartRow>()
	const cloneRow = (row: RWAChartRow) => {
		const clone: RWAChartRow = { timestamp: row.timestamp }
		for (const key in row) clone[key] = row[key]
		return clone
	}

	for (const row of primary.source) {
		mergedRows.set(row.timestamp, cloneRow(row))
	}

	for (const row of overlay.source) {
		const existingRow = mergedRows.get(row.timestamp)
		if (existingRow) {
			Object.assign(existingRow, row)
			continue
		}

		mergedRows.set(row.timestamp, cloneRow(row))
	}

	return {
		source: Array.from(mergedRows.values()).toSorted((a, b) => a.timestamp - b.timestamp),
		dimensions: [
			'timestamp',
			...primary.dimensions.filter((dimension) => dimension !== 'timestamp'),
			...overlay.dimensions.filter((dimension) => dimension !== 'timestamp' && !primary.dimensions.includes(dimension))
		]
	}
}
