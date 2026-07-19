import { getEquitiesTreemapColor } from '~/components/ECharts/EquitiesTreemapChart/colors'
import type { MarketTreemapGroup, MarketTreemapLeaf } from '~/components/ECharts/marketTreemapTypes'
import { equityIconUrl } from '~/utils/icons'
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

export interface IEquitiesTreemapLeaf extends MarketTreemapLeaf {
	country?: string
	sector?: string
	industry?: string
}

export interface IEquitiesTreemapGroup extends Omit<MarketTreemapGroup, 'children'> {
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
	leaves: IEquitiesTreemapLeaf[]
	excludedCount: number
	truncatedCount: number
}

export interface IEquitiesTreemapRanking {
	rows: IEquitiesListCompanyRow[]
	sizeMetric: EquitiesTreemapSizeMetric
	excludedCount: number
	truncatedCount: number
}

export function prepareEquitiesTreemapCsv({
	leaves,
	sizeLabel,
	colorLabel,
	filename
}: {
	leaves: readonly IEquitiesTreemapLeaf[]
	sizeLabel: string
	colorLabel: string
	filename: string
}) {
	const rows: Array<Array<string | number>> = [
		[
			'Ticker',
			'Company',
			'Country',
			'Sector',
			'Industry',
			'Size Metric',
			'Size',
			'Color Metric',
			'Change %',
			'Market Cap'
		]
	]
	for (const leaf of leaves) {
		rows.push([
			leaf.name,
			leaf.companyName,
			leaf.country,
			leaf.sector,
			leaf.industry,
			sizeLabel,
			leaf.value[0],
			colorLabel,
			leaf.value[1] ?? '',
			leaf.marketCap ?? ''
		])
	}

	return { filename, rows }
}

export function rankEquitiesTreemapRows(
	rows: IEquitiesListCompanyRow[],
	sizeMetric: EquitiesTreemapSizeMetric,
	limit = EQUITIES_TREEMAP_DEFAULT_LIMIT
): IEquitiesTreemapRanking {
	const rankedRows: IEquitiesListCompanyRow[] = []
	let excludedCount = 0

	for (const row of rows) {
		const size = row[sizeMetric]
		if (size !== null && size > 0) {
			rankedRows.push(row)
		} else {
			excludedCount++
		}
	}

	rankedRows.sort((a, b) => b[sizeMetric]! - a[sizeMetric]!)

	const truncatedCount = limit > 0 && rankedRows.length > limit ? rankedRows.length - limit : 0
	if (truncatedCount > 0) rankedRows.length = limit

	return { rows: rankedRows, sizeMetric, excludedCount, truncatedCount }
}

export function buildEquitiesTreemapLeaves(
	ranking: IEquitiesTreemapRanking,
	colorMetric: EquitiesTreemapColorMetric
): IEquitiesTreemapLeaf[] {
	const leaves: IEquitiesTreemapLeaf[] = []
	const { rows, sizeMetric } = ranking

	for (let index = 0; index < rows.length; index++) {
		const row = rows[index]
		const changePct = row[colorMetric]
		leaves.push({
			name: row.ticker,
			value: [row[sizeMetric]!, changePct],
			iconKey: index,
			iconUrl: equityIconUrl(row.ticker, row.country),
			itemStyle: { color: getEquitiesTreemapColor(changePct) },
			companyName: row.name,
			country: row.country,
			sector: row.sector || FALLBACK_SECTOR,
			industry: row.industry || '',
			marketCap: row.marketCap
		})
	}

	return leaves
}

export function groupEquitiesTreemapLeaves(
	leaves: IEquitiesTreemapLeaf[],
	groupBy: EquitiesTreemapGroupBy
): EquitiesTreemapNode[] {
	if (groupBy === 'none') return leaves

	const treeData: IEquitiesTreemapGroup[] = []
	const groups = new Map<string, IEquitiesTreemapGroup>()
	for (const leaf of leaves) {
		let group = groups.get(leaf.sector)
		if (!group) {
			group = { name: leaf.sector, value: [0, null], children: [] }
			groups.set(leaf.sector, group)
			treeData.push(group)
		}
		group.value[0] += leaf.value[0]
		group.children.push(leaf)
	}

	return treeData
}

export function buildEquitiesTreemap(
	rows: IEquitiesListCompanyRow[],
	{ groupBy, sizeMetric, colorMetric, limit = EQUITIES_TREEMAP_DEFAULT_LIMIT }: IEquitiesTreemapOptions
): IEquitiesTreemapResult {
	const ranking = rankEquitiesTreemapRows(rows, sizeMetric, limit)
	const leaves = buildEquitiesTreemapLeaves(ranking, colorMetric)
	return {
		treeData: groupEquitiesTreemapLeaves(leaves, groupBy),
		leaves,
		excludedCount: ranking.excludedCount,
		truncatedCount: ranking.truncatedCount
	}
}
