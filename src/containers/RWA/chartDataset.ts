import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'

export const RWA_OPEN_INTEREST_SERIES_LABEL = 'RWA Perps OI'

export type RWAChartSeriesValue = number | null | undefined
export type RWAChartRow = { timestamp: number } & Record<string, RWAChartSeriesValue>
export type RWAChartDataset = { source: RWAChartRow[]; dimensions: string[] }
export type RWAIndependentChartSeries = { name: string; data: Array<[number, number | null]> }
export type RWAPositionalChartDataset = MultiSeriesChartDataset & {
	/** RWA Perps overlays have an independent calendar and are mirrored into renderer chart configs. */
	independentSeries?: RWAIndependentChartSeries[]
}
export type RwaNamedValue = { name: string; value: number }

export const RWA_MAX_HORIZONTAL_BARS = 9

export function emptyChartDataset(): RWAChartDataset {
	return { source: [], dimensions: ['timestamp'] }
}

/** Materialize the RWA-only composite representation only when exporting a CSV. */
export function materializeRwaIndependentChartDataset(dataset: RWAPositionalChartDataset): MultiSeriesChartDataset {
	if (!dataset.independentSeries?.length) return dataset
	const dimensions = [...dataset.dimensions]
	const dimensionIndexes = new Map<string, number>()
	for (let index = 0; index < dimensions.length; index++) dimensionIndexes.set(dimensions[index], index)
	const rows = new Map<number, MultiSeriesChartDataset['source'][number]>()
	for (const input of dataset.source) {
		const row = new Array<number | null>(dimensions.length).fill(null)
		for (let index = 0; index < input.length; index++) row[index] = input[index] as number | null
		rows.set(input[0] as number, row)
	}
	for (const series of dataset.independentSeries) {
		const valueIndex = dimensionIndexes.get(series.name)!
		for (const [timestamp, value] of series.data) {
			let row = rows.get(timestamp)
			if (!row) {
				row = new Array<number | null>(dimensions.length).fill(null)
				row[0] = timestamp
				rows.set(timestamp, row)
			}
			row[valueIndex] = value
		}
	}
	return { dimensions, source: Array.from(rows.values()).sort((a, b) => (a[0] as number) - (b[0] as number)) }
}

/** Materialize the named public RWA API contract once before a Cartesian renderer consumes it. */
export function toRwaMultiSeriesChartDataset(
	dataset: RWAChartDataset,
	dimensions: string[] = dataset.dimensions
): MultiSeriesChartDataset {
	const source = new Array<MultiSeriesChartDataset['source'][number]>(dataset.source.length)
	for (let rowIndex = 0; rowIndex < dataset.source.length; rowIndex++) {
		const input = dataset.source[rowIndex]
		const row = new Array<RWAChartSeriesValue>(dimensions.length)
		for (let dimensionIndex = 0; dimensionIndex < dimensions.length; dimensionIndex++) {
			row[dimensionIndex] = input[dimensions[dimensionIndex]]
		}
		source[rowIndex] = row
	}
	return { source, dimensions }
}

export function mergeRwaPositionalChartDatasets(
	primary: RWAPositionalChartDataset,
	overlay: RWAPositionalChartDataset
): RWAPositionalChartDataset {
	if (overlay.dimensions.length <= 1 || overlay.source.length === 0) return primary
	if (primary.dimensions.length <= 1 || primary.source.length === 0) return overlay
	const overlaySeriesNames = overlay.dimensions.slice(1)
	const hasOverlappingSeries = overlaySeriesNames.some((name) => primary.dimensions.includes(name))
	if (!hasOverlappingSeries) {
		const independentSeries = [...(primary.independentSeries ?? [])]
		for (let seriesIndex = 0; seriesIndex < overlaySeriesNames.length; seriesIndex++) {
			const data: Array<[number, number | null]> = []
			for (const row of overlay.source) {
				const value = row[seriesIndex + 1]
				if (value !== undefined) data.push([row[0] as number, value as number | null])
			}
			independentSeries.push({ name: overlaySeriesNames[seriesIndex], data })
		}
		independentSeries.push(...(overlay.independentSeries ?? []))
		return {
			dimensions: [...primary.dimensions, ...overlaySeriesNames],
			source: primary.source,
			independentSeries
		}
	}

	const dimensions = [...primary.dimensions]
	const dimensionIndexes = new Map<string, number>()
	for (let index = 0; index < dimensions.length; index++) dimensionIndexes.set(dimensions[index], index)
	for (let index = 1; index < overlay.dimensions.length; index++) {
		const dimension = overlay.dimensions[index]
		if (!dimensionIndexes.has(dimension)) {
			dimensionIndexes.set(dimension, dimensions.length)
			dimensions.push(dimension)
		}
	}

	const rowsByTimestamp = new Map<number, RWAPositionalChartDataset['source'][number]>()
	for (const input of primary.source) {
		const row = new Array<number | null | undefined>(dimensions.length)
		for (let index = 0; index < primary.dimensions.length; index++)
			row[index] = input[index] as number | null | undefined
		rowsByTimestamp.set(input[0] as number, row)
	}
	for (const input of overlay.source) {
		const timestamp = input[0] as number
		let row = rowsByTimestamp.get(timestamp)
		if (!row) {
			row = new Array<number | null | undefined>(dimensions.length)
			row[0] = timestamp
			rowsByTimestamp.set(timestamp, row)
		}
		for (let index = 1; index < overlay.dimensions.length; index++) {
			row[dimensionIndexes.get(overlay.dimensions[index])!] = input[index] as number | null | undefined
		}
	}

	return { source: [...rowsByTimestamp.values()].sort((a, b) => (a[0] as number) - (b[0] as number)), dimensions }
}

export function toFiniteRwaChartValue(value: unknown): number {
	const numeric = typeof value === 'number' ? value : Number(value)
	return Number.isFinite(numeric) ? numeric : 0
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

	const seriesDimensions: string[] = []
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
		const nextRow = { timestamp: row.timestamp } as { timestamp: number } & Record<string, RWAChartSeriesValue>
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
	items: readonly RwaNamedValue[],
	{ maxBars = RWA_MAX_HORIZONTAL_BARS, sort = false }: { maxBars?: number; sort?: boolean } = {}
): RwaNamedValue[] {
	const normalizedMaxBars = Number.isFinite(maxBars) ? Math.floor(maxBars) : RWA_MAX_HORIZONTAL_BARS
	const effectiveMaxBars = Math.max(1, normalizedMaxBars)
	let othersValue = 0
	const withoutOthers: RwaNamedValue[] = []
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

	if (withoutOthers.length <= effectiveMaxBars - (othersValue > 0 ? 1 : 0)) {
		return othersValue > 0 ? [...withoutOthers, { name: 'Others', value: othersValue }] : withoutOthers
	}

	const limited = withoutOthers.slice(0, effectiveMaxBars - 1)
	let overflowValue = othersValue
	for (let index = effectiveMaxBars - 1; index < withoutOthers.length; index++) {
		overflowValue += withoutOthers[index].value
	}
	return overflowValue > 0 ? [...limited, { name: 'Others', value: overflowValue }] : limited
}

export function isRwaTotalSeriesLabel(label: string): boolean {
	return label.startsWith('Total ')
}

export function sortRwaChartSeriesLabels(labels: string[]): string[] {
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

export function getRwaChartSeriesColorSlots(labels: string[]): Record<string, number> {
	const colorSlots = {}
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
		const clone = { timestamp: row.timestamp } as { timestamp: number } & Record<string, RWAChartSeriesValue>
		for (const key of Object.keys(row)) clone[key] = row[key]
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
