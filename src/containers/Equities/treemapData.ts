import { getEquitiesTreemapColor } from '~/components/ECharts/TreemapChart/Market/colors'
import type { MarketTreemapGroup, MarketTreemapLeaf } from '~/components/ECharts/TreemapChart/Market/types'
import { equityIconUrl } from '~/utils/icons'
import type { EquitiesTreemapRow } from './types'

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
	country: string
	sector: string
	industry: string
}

export interface IEquitiesTreemapGroup extends Omit<MarketTreemapGroup, 'children'> {
	children: Array<IEquitiesTreemapLeaf>
}

export type EquitiesTreemapNode = IEquitiesTreemapLeaf | IEquitiesTreemapGroup

export interface IEquitiesTreemapRanking {
	rows: Array<EquitiesTreemapRow>
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
	leaves: ReadonlyArray<IEquitiesTreemapLeaf>
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

export function prepareCompleteEquitiesTreemapCsv({
	ranking,
	colorMetric,
	sizeLabel,
	colorLabel,
	filename
}: {
	ranking: IEquitiesTreemapRanking
	colorMetric: EquitiesTreemapColorMetric
	sizeLabel: string
	colorLabel: string
	filename: string
}) {
	return prepareEquitiesTreemapCsv({
		leaves: buildEquitiesTreemapLeaves(ranking, colorMetric),
		sizeLabel,
		colorLabel,
		filename
	})
}

export function rankEquitiesTreemapRows(
	rows: Array<EquitiesTreemapRow>,
	sizeMetric: EquitiesTreemapSizeMetric,
	limit = EQUITIES_TREEMAP_DEFAULT_LIMIT
): IEquitiesTreemapRanking {
	const rankedRows: Array<EquitiesTreemapRow> = []
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
): Array<IEquitiesTreemapLeaf> {
	const leaves: Array<IEquitiesTreemapLeaf> = []
	const { rows, sizeMetric } = ranking

	let index = 0
	for (const row of rows) {
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
		index++
	}

	return leaves
}

export function groupEquitiesTreemapLeaves(
	leaves: Array<IEquitiesTreemapLeaf>,
	groupBy: EquitiesTreemapGroupBy
): Array<EquitiesTreemapNode> {
	if (groupBy === 'none') return leaves

	const treeData: Array<IEquitiesTreemapGroup> = []
	const groups = new Map<string, IEquitiesTreemapGroup>()
	for (const leaf of leaves) {
		const sector = leaf.sector
		let group = groups.get(sector)
		if (!group) {
			group = { name: sector, value: [0, null], children: [] }
			groups.set(sector, group)
			treeData.push(group)
		}
		group.value[0] += leaf.value[0]
		group.children.push(leaf)
	}

	return treeData
}
