import type { IEquitiesListCompanyRow } from './types'

export const EQUITIES_TREEMAP_SIZE_METRICS = [
	'marketCap',
	'revenueTTM',
	'earningsTTM',
	'ebitdaTTM',
	'enterpriseValue',
	'cashAndCashEquivalents',
	'totalDebt',
	'totalAssets',
	'totalShareholdersEquity',
	'employeeCount'
] as const

export type EquitiesTreemapSizeMetric = (typeof EQUITIES_TREEMAP_SIZE_METRICS)[number]

export const EQUITIES_TREEMAP_COLOR_METRICS = [
	'priceChangePercentage1d',
	'priceChangePercentage7d',
	'priceChangePercentage1m'
] as const

export type EquitiesTreemapColorMetric = (typeof EQUITIES_TREEMAP_COLOR_METRICS)[number]

export type EquitiesTreemapGroupBy = 'none' | 'sector'

export const EQUITIES_TREEMAP_DEFAULT_LIMIT = 500

const FALLBACK_SECTOR = 'Other'

export interface IEquitiesTreemapLeaf {
	name: string
	value: [number, number | null]
	companyName: string
	country: string
	sector: string
	industry: string
	marketCap: number | null
}

export interface IEquitiesTreemapGroup {
	name: string
	value: [number, null]
	children: IEquitiesTreemapLeaf[]
}

export type EquitiesTreemapNode = IEquitiesTreemapLeaf | IEquitiesTreemapGroup

export interface IEquitiesTreemapOptions {
	groupBy: EquitiesTreemapGroupBy
	sizeMetric: EquitiesTreemapSizeMetric
	colorMetric: EquitiesTreemapColorMetric
	limit?: number
}

export interface IEquitiesTreemapResult {
	treeData: EquitiesTreemapNode[]
	excludedCount: number
	truncatedCount: number
}

export function buildEquitiesTreemap(
	rows: IEquitiesListCompanyRow[],
	{ groupBy, sizeMetric, colorMetric, limit = EQUITIES_TREEMAP_DEFAULT_LIMIT }: IEquitiesTreemapOptions
): IEquitiesTreemapResult {
	const sized: Array<{ row: IEquitiesListCompanyRow; size: number }> = []
	let excludedCount = 0

	for (const row of rows ?? []) {
		const size = row?.[sizeMetric]
		if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
			sized.push({ row, size })
		} else {
			excludedCount++
		}
	}

	sized.sort((a, b) => b.size - a.size)

	const limited = limit != null && limit > 0 ? sized.slice(0, limit) : sized
	const truncatedCount = sized.length - limited.length

	const leaves: IEquitiesTreemapLeaf[] = limited.map(({ row, size }) => {
		const colorValue = row[colorMetric]
		const colorPct = typeof colorValue === 'number' && Number.isFinite(colorValue) ? colorValue : null
		return {
			name: row.ticker,
			value: [size, colorPct],
			companyName: row.name,
			country: row.country,
			sector: row.sector || FALLBACK_SECTOR,
			industry: row.industry || '',
			marketCap: row.marketCap
		}
	})

	if (groupBy === 'none') {
		return { treeData: leaves, excludedCount, truncatedCount }
	}

	const groups = new Map<string, IEquitiesTreemapGroup>()
	for (const leaf of leaves) {
		let group = groups.get(leaf.sector)
		if (!group) {
			group = { name: leaf.sector, value: [0, null], children: [] }
			groups.set(leaf.sector, group)
		}
		group.value[0] += leaf.value[0]
		group.children.push(leaf)
	}

	return { treeData: Array.from(groups.values()), excludedCount, truncatedCount }
}
