import { toDisplayName } from '~/utils/chainNormalizer'
import type { CexDatasetTableConfig, ChainsDatasetTableConfig, DatasetTableConfig, YieldsFilters } from '../types'

export type DatasetTableSelection = DatasetTableConfig extends infer Config
	? Config extends DatasetTableConfig
		? Omit<Config, 'kind'>
		: never
	: never

export type NewDatasetTableSelection = DatasetTableSelection extends infer Config
	? Config extends DatasetTableSelection
		? Omit<Config, 'id' | 'colSpan'>
		: never
	: never

type DatasetTableConfigForSelection<Selection extends DatasetTableSelection> = Selection extends {
	datasetType: 'cex-analytics'
	cexAnalyticsView: 'market-share'
}
	? Extract<CexDatasetTableConfig, { cexAnalyticsView: 'market-share' }>
	: Selection extends { datasetType: infer DatasetType }
		? Extract<DatasetTableConfig, { datasetType: DatasetType }>
		: never

const YIELDS_COLUMN_IDS = new Set([
	'pool',
	'project',
	'chains',
	'tvl',
	'apy',
	'apyBase',
	'apyReward',
	'apyMean30d',
	'stabilityRating',
	'volumeUsd1d',
	'ilRisk',
	'apyBorrow',
	'totalSupplyUsd',
	'totalBorrowUsd',
	'totalAvailableUsd',
	'ltv'
])
const CHAINS_COLUMN_IDS = new Set([
	'name',
	'protocols',
	'users',
	'change_1d',
	'change_7d',
	'change_1m',
	'tvl',
	'bridgedTvl',
	'stablesMcap',
	'totalVolume24h',
	'totalVolume30d',
	'totalFees24h',
	'totalFees30d',
	'totalAppRevenue24h',
	'totalAppRevenue30d',
	'totalRevenue30d',
	'mcaptvl',
	'mcap',
	'nftVolume',
	'tvl_share',
	'stablesMcap_share',
	'totalVolume24h_share',
	'totalFees24h_share',
	'totalAppRevenue24h_share',
	'nftVolume_share'
])

function normalizedList(values: Array<string>): Array<string> {
	const result: Array<string> = []
	const seen = new Set<string>()
	for (const value of values) {
		const normalized = value.trim()
		const identity = normalized.toLowerCase()
		if (!normalized || seen.has(identity)) continue
		seen.add(identity)
		result.push(normalized)
	}
	return result
}

function normalizedChains(chains: Array<string>): Array<string> {
	const result: Array<string> = []
	const seen = new Set<string>()
	for (const value of chains) {
		const trimmed = value.trim()
		if (!trimmed) continue
		if (trimmed.toLowerCase() === 'all') return []

		// Saved Pro configs may contain historical Dimensions/internal aliases. Runtime
		// configs own the one-time migration to the display names accepted by v2 APIs.
		const chain = toDisplayName(trimmed)
		const identity = chain.toLowerCase()
		if (seen.has(identity)) continue
		seen.add(identity)
		result.push(chain)
	}
	return result
}

function yieldsFilters(filters: YieldsFilters | undefined): YieldsFilters | undefined {
	if (!filters) return undefined
	return {
		...(filters.apyMin === undefined ? {} : { apyMin: filters.apyMin }),
		...(filters.apyMax === undefined ? {} : { apyMax: filters.apyMax }),
		...(filters.tvlMin === undefined ? {} : { tvlMin: filters.tvlMin }),
		...(filters.tvlMax === undefined ? {} : { tvlMax: filters.tvlMax }),
		...(filters.baseApyMin === undefined ? {} : { baseApyMin: filters.baseApyMin }),
		...(filters.baseApyMax === undefined ? {} : { baseApyMax: filters.baseApyMax }),
		...(filters.hasRewards === undefined ? {} : { hasRewards: filters.hasRewards }),
		...(filters.stablesOnly === undefined ? {} : { stablesOnly: filters.stablesOnly }),
		...(filters.chains?.length ? { chains: normalizedList(filters.chains) } : {}),
		...(filters.protocols?.length ? { protocols: normalizedList(filters.protocols) } : {}),
		...(filters.tokens?.length ? { tokens: normalizedList(filters.tokens) } : {}),
		...(filters.categories?.length ? { categories: normalizedList(filters.categories) } : {})
	}
}

function columnSettings(
	columnOrder: Array<string> | undefined,
	columnVisibility: Record<string, boolean> | undefined,
	allowed: ReadonlySet<string>
) {
	const order = columnOrder?.filter((id) => allowed.has(id))
	let visibility: Record<string, boolean> | undefined
	if (columnVisibility) {
		visibility = {}
		for (const id in columnVisibility) {
			const value = columnVisibility[id]
			if (value !== undefined && allowed.has(id)) visibility[id] = value
		}
	}
	return {
		...(order?.length ? { columnOrder: order } : {}),
		...(visibility && Object.keys(visibility).length > 0 ? { columnVisibility: visibility } : {})
	}
}

export function createDatasetTableConfig<const Selection extends DatasetTableSelection>(
	input: Selection
): DatasetTableConfigForSelection<Selection>
export function createDatasetTableConfig(input: DatasetTableSelection): DatasetTableConfig
export function createDatasetTableConfig(input: DatasetTableSelection): DatasetTableConfig {
	const common = {
		id: input.id,
		kind: 'dataset-table' as const,
		...(input.colSpan === undefined ? {} : { colSpan: input.colSpan })
	}
	switch (input.datasetType) {
		case 'token-usage':
			return {
				...common,
				datasetType: input.datasetType,
				tokenSymbols: normalizedList(input.tokenSymbols)
					.slice(0, 4)
					.map((symbol) => symbol.toUpperCase()),
				includeCex: input.includeCex
			}
		case 'cex-analytics':
			if (input.cexAnalyticsView === 'market-share') {
				return {
					...common,
					datasetType: input.datasetType,
					cexAnalyticsView: input.cexAnalyticsView,
					cexAnalyticsMetric: input.cexAnalyticsMetric,
					cexAnalyticsTopN: Math.min(12, Math.max(1, Math.trunc(input.cexAnalyticsTopN)))
				}
			}
			return { ...common, datasetType: input.datasetType, cexAnalyticsView: input.cexAnalyticsView }
		case 'stablecoins':
			return { ...common, datasetType: input.datasetType, chain: input.chain }
		case 'yields': {
			const filters = yieldsFilters(input.filters)
			return {
				...common,
				datasetType: input.datasetType,
				chains: normalizedChains(input.chains),
				...(filters ? { filters } : {}),
				...columnSettings(input.columnOrder, input.columnVisibility, YIELDS_COLUMN_IDS)
			}
		}
		case 'chains':
			return {
				...common,
				datasetType: input.datasetType,
				...(input.category === undefined ? {} : { category: input.category }),
				...columnSettings(input.columnOrder, input.columnVisibility, CHAINS_COLUMN_IDS)
			} satisfies ChainsDatasetTableConfig
		case 'rwa':
		case 'rwa-chains':
		case 'equities':
			return { ...common, datasetType: input.datasetType }
		case 'rwa-selected-chain':
			return { ...common, datasetType: input.datasetType, chain: input.chain }
		case 'equities-financials':
		case 'equities-filings':
			return { ...common, datasetType: input.datasetType, ticker: input.ticker }
	}
}
