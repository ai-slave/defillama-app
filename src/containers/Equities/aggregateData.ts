export interface SectorAggregateRow {
	sector: string
	sectorSlug: string
	marketCap: number | null
	weight: number | null
	dollarVolume24h: number | null
	dollarVolumeShare24h: number | null
	revenueTTM: number | null
	companyCount: number
	priceChangePercentage1d: number | null
	priceChangePercentage7d: number | null
	priceChangePercentage1m: number | null
	priceChangePercentage3m: number | null
	priceChangePercentage6m: number | null
	priceChangePercentageYtd: number | null
	priceChangePercentage1y: number | null
	trailingPE: number | null
}

export interface IndustryAggregateRow {
	industry: string
	industrySlug: string
	sector: string
	sectorSlug: string
	marketCap: number | null
	weight: number | null
	sectorWeight: number | null
	companyCount: number
	dollarVolume24h: number | null
	priceChangePercentage1d: number | null
	priceChangePercentage7d: number | null
	priceChangePercentage1m: number | null
	priceChangePercentage3m: number | null
	priceChangePercentage6m: number | null
	priceChangePercentageYtd: number | null
	priceChangePercentage1y: number | null
	trailingPE: number | null
	dividendYield: number | null
}

export interface IndustriesPageData {
	overview: {
		marketCap: number | null
		companyCount: number
		sectorCount: number
	}
	industries: Array<IndustryAggregateRow & { updatedAt: string }>
}

/** Strip API-only aggregate fields before serializing the industries page. */
export function buildIndustriesPageData<
	TOverview extends IndustriesPageData['overview'],
	TIndustry extends IndustriesPageData['industries'][number]
>(source: { overview: TOverview; industries: ReadonlyArray<TIndustry> }): IndustriesPageData {
	return {
		overview: {
			marketCap: source.overview.marketCap,
			companyCount: source.overview.companyCount,
			sectorCount: source.overview.sectorCount
		},
		industries: source.industries.map((row) => ({
			industry: row.industry,
			industrySlug: row.industrySlug,
			sector: row.sector,
			sectorSlug: row.sectorSlug,
			marketCap: row.marketCap,
			weight: row.weight,
			sectorWeight: row.sectorWeight,
			companyCount: row.companyCount,
			dollarVolume24h: row.dollarVolume24h,
			priceChangePercentage1d: row.priceChangePercentage1d,
			priceChangePercentage7d: row.priceChangePercentage7d,
			priceChangePercentage1m: row.priceChangePercentage1m,
			priceChangePercentage3m: row.priceChangePercentage3m,
			priceChangePercentage6m: row.priceChangePercentage6m,
			priceChangePercentageYtd: row.priceChangePercentageYtd,
			priceChangePercentage1y: row.priceChangePercentage1y,
			trailingPE: row.trailingPE,
			dividendYield: row.dividendYield,
			updatedAt: row.updatedAt
		}))
	}
}

export type SortDirection = 'asc' | 'desc'
export type SectorTreemapMetric = 'marketCap' | 'volume' | 'revenue'
export const RETURN_PERIODS = [
	{ key: '1d', label: '1D', field: 'priceChangePercentage1d' },
	{ key: '7d', label: '7D', field: 'priceChangePercentage7d' },
	{ key: '1m', label: '1M', field: 'priceChangePercentage1m' },
	{ key: '3m', label: '3M', field: 'priceChangePercentage3m' },
	{ key: '6m', label: '6M', field: 'priceChangePercentage6m' },
	{ key: 'ytd', label: 'YTD', field: 'priceChangePercentageYtd' },
	{ key: '1y', label: '1Y', field: 'priceChangePercentage1y' }
] as const satisfies ReadonlyArray<{
	key: string
	label: string
	field: keyof IndustryAggregateRow & keyof SectorAggregateRow
}>
export type ReturnPeriod = (typeof RETURN_PERIODS)[number]['key']

export interface AggregateReturnMatrixRow {
	industry: string
	industrySlug: string
	sectorSlug: string
	values: Record<ReturnPeriod, number | null>
}

export function filterKnownAggregates<T extends { sectorSlug?: string; industrySlug?: string }>(
	rows: ReadonlyArray<T>
): Array<T> {
	return rows.filter(
		(row) => row.sectorSlug?.toLowerCase() !== 'unknown' && row.industrySlug?.toLowerCase() !== 'unknown'
	)
}

export function toEquitiesTaxonomySlug(value: string): string {
	return (
		value
			.toLowerCase()
			.replaceAll('&', 'and')
			.replaceAll(/[^a-z0-9]+/g, '-')
			.replaceAll(/(^-|-$)/g, '') || 'unknown'
	)
}

/** Nulls stay last in either direction; equal values retain their input order. */
export function sortNullableRows<T, K extends keyof T>(
	rows: ReadonlyArray<T>,
	key: K,
	direction: SortDirection
): Array<T> {
	return sortRowsByValue(rows, (row) => row[key] as string | number | null | undefined, direction)
}

export function sortRowsByValue<T>(
	rows: ReadonlyArray<T>,
	getValue: (row: T) => string | number | null | undefined,
	direction: SortDirection
): Array<T> {
	const multiplier = direction === 'asc' ? 1 : -1
	return rows
		.map((row, index) => ({ row, index, value: getValue(row) }))
		.sort((a, b) => {
			const aNull =
				a.value === null || a.value === undefined || (typeof a.value === 'number' && !Number.isFinite(a.value))
			const bNull =
				b.value === null || b.value === undefined || (typeof b.value === 'number' && !Number.isFinite(b.value))
			if (aNull || bNull) return aNull === bNull ? a.index - b.index : aNull ? 1 : -1
			if (a.value === b.value) return a.index - b.index
			const comparison =
				typeof a.value === 'string' && typeof b.value === 'string'
					? a.value.localeCompare(b.value)
					: (a.value as number) < (b.value as number)
						? -1
						: 1
			return comparison * multiplier
		})
		.map(({ row }) => row)
}

/**
 * The chip a URL selection lights up in a chip row with an "all" chip: every option is the "all" chip, one
 * option is its own chip, and any other selection (several options, or none) matches no chip.
 */
export function getSelectionChip(selection: ReadonlyArray<string>, optionKeys: ReadonlyArray<string>): string {
	if (selection.length === optionKeys.length) return 'all'
	return selection.length === 1 ? selection[0]! : ''
}

export function buildIndustrySectorOptions(rows: ReadonlyArray<IndustryAggregateRow>) {
	const sectors = new Map<string, { name: string; count: number }>()
	for (const row of rows) {
		const current = sectors.get(row.sectorSlug) ?? { name: row.sector, count: 0 }
		current.count++
		sectors.set(row.sectorSlug, current)
	}
	return [
		{ value: 'all', label: `All sectors ${rows.length}` },
		...[...sectors]
			.sort((a, b) => a[1].name.localeCompare(b[1].name))
			.map(([value, sector]) => ({ value, label: `${sector.name} ${sector.count}` }))
	]
}

interface SectorTreemapValue {
	sector: string
	sectorSlug: string
	priceChangePercentage1d: number | null
	value: number | null
	share: number | null
}

interface SectorTreemapData {
	total: number | null
	rows: Array<SectorTreemapValue>
}

/** One metric selection drives block area, printed share, and caption total. */
export function buildSectorTreemapData(
	rows: ReadonlyArray<SectorAggregateRow>,
	metric: SectorTreemapMetric,
	overview: { marketCap: number | null; dollarVolume24h: number | null; revenueTTM: number | null }
): SectorTreemapData {
	const total =
		metric === 'marketCap' ? overview.marketCap : metric === 'volume' ? overview.dollarVolume24h : overview.revenueTTM
	const mapped = rows.map((row): SectorTreemapValue => {
		const value = metric === 'marketCap' ? row.marketCap : metric === 'volume' ? row.dollarVolume24h : row.revenueTTM
		const share =
			metric === 'marketCap'
				? row.weight
				: metric === 'volume'
					? row.dollarVolumeShare24h
					: value === null || total === null || total === 0
						? null
						: (value / total) * 100
		return {
			sector: row.sector,
			sectorSlug: row.sectorSlug,
			priceChangePercentage1d: row.priceChangePercentage1d,
			value,
			share
		}
	})
	return {
		total,
		rows: mapped
	}
}

interface IndustrySummary {
	industryCount: number
	underTenCompaniesCount: number
	top10MarketShare: number
	top20MarketShare: number
	largestIndustry: IndustryAggregateRow | null
	bestIndustry1m: IndustryAggregateRow | null
	worstIndustry1m: IndustryAggregateRow | null
	underPointOnePercentCount: number
	underPointOnePercentMarketCapThreshold: number | null
}

export function buildIndustrySummary(
	rows: ReadonlyArray<IndustryAggregateRow>,
	marketCap: number | null
): IndustrySummary {
	let bestIndustry1m: IndustryAggregateRow | null = null
	let worstIndustry1m: IndustryAggregateRow | null = null
	for (const row of rows) {
		if (row.priceChangePercentage1m === null) continue
		if (bestIndustry1m === null || row.priceChangePercentage1m! > bestIndustry1m.priceChangePercentage1m!)
			bestIndustry1m = row
		if (worstIndustry1m === null || row.priceChangePercentage1m! < worstIndustry1m.priceChangePercentage1m!)
			worstIndustry1m = row
	}
	return {
		industryCount: rows.length,
		underTenCompaniesCount: rows.filter((row) => row.companyCount < 10).length,
		top10MarketShare: rows.slice(0, 10).reduce((sum, row) => sum + (row.weight ?? 0), 0),
		top20MarketShare: rows.slice(0, 20).reduce((sum, row) => sum + (row.weight ?? 0), 0),
		largestIndustry: rows[0] ?? null,
		bestIndustry1m,
		worstIndustry1m,
		underPointOnePercentCount: rows.filter((row) => row.weight !== null && row.weight < 0.1).length,
		underPointOnePercentMarketCapThreshold: marketCap === null ? null : marketCap * 0.001
	}
}

interface IndustryTailResult<T extends IndustryAggregateRow = IndustryAggregateRow> {
	visibleRows: Array<T>
	hiddenRows: Array<T>
}

/** A row is in the hidden tail when it is under $10B OR has fewer than three constituents. */
export function filterIndustryTail<T extends IndustryAggregateRow>(
	rows: ReadonlyArray<T>,
	options: { hideTail: boolean } = { hideTail: true }
): IndustryTailResult<T> {
	if (!options.hideTail) return { visibleRows: [...rows], hiddenRows: [] }

	const visibleRows: Array<T> = []
	const hiddenRows: Array<T> = []
	for (const row of rows) {
		if ((row.marketCap !== null && row.marketCap < 10_000_000_000) || row.companyCount < 3) {
			hiddenRows.push(row)
		} else {
			visibleRows.push(row)
		}
	}
	return { visibleRows, hiddenRows }
}

interface IndustryTreemapOther {
	count: number
	marketCap: number
	weight: number
	underPointOnePercentCount: number
}

export function getIndustryTreemapOther(
	rows: ReadonlyArray<IndustryAggregateRow>,
	topCount = 20
): IndustryTreemapOther {
	const otherRows = rows.slice(topCount)
	return {
		count: otherRows.length,
		marketCap: otherRows.reduce((sum, row) => sum + (row.marketCap ?? 0), 0),
		weight: otherRows.reduce((sum, row) => sum + (row.weight ?? 0), 0),
		underPointOnePercentCount: otherRows.filter((row) => row.weight !== null && row.weight < 0.1).length
	}
}

export function selectIndustryReturnMatrix(
	rows: ReadonlyArray<IndustryAggregateRow>,
	limit = 12
): Array<AggregateReturnMatrixRow> {
	return rows.slice(0, limit).map((row) => ({
		industry: row.industry,
		industrySlug: row.industrySlug,
		sectorSlug: row.sectorSlug,
		values: Object.fromEntries(RETURN_PERIODS.map(({ key, field }) => [key, row[field]])) as Record<
			ReturnPeriod,
			number | null
		>
	}))
}

export function calculateNetMargin(earningsTTM: number | null, revenueTTM: number | null): number | null {
	return earningsTTM === null || revenueTTM === null || revenueTTM === 0 ? null : (earningsTTM / revenueTTM) * 100
}

export function calculateConstituentSectorWeight(
	marketCap: number | null,
	sectorMarketCap: number | null
): number | null {
	return marketCap === null || sectorMarketCap === null || sectorMarketCap === 0
		? null
		: (marketCap / sectorMarketCap) * 100
}

export function calculateCompanyDollarVolume(volume: number | null, currentPrice: number | null): number | null {
	return volume === null || currentPrice === null ? null : volume * currentPrice
}
