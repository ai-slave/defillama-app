import {
	SERVER_URL,
	V2_SERVER_URL,
	BRIDGES_SERVER_URL,
	ETF_SERVER_URL,
	STABLECOINS_SERVER_URL,
	RWA_SERVER_URL,
	TRADFI_API
} from '~/constants'
import type { IHackApiItem } from '~/containers/Hacks/api.types'
import { normalizeHack } from '~/containers/Hacks/model'
import type { RaisesApiItem } from '~/containers/Raises/api.types'
import { normalizeRaisesApiItem } from '~/containers/Raises/model'

export interface DatasetExcludeToggle {
	field: string
	label: string
	defaultExclude?: boolean
}

export interface DatasetDefinition {
	slug: string
	name: string
	description: string
	category: string
	url: string
	fields?: Array<string>
	defaultSortField?: string
	extractItems: (json: unknown) => Array<DatasetItem>
	chainFilterType?: 'overview' | 'protocols'
	excludeToggles?: Array<DatasetExcludeToggle>
}

export type DatasetItem = Record<string, unknown>

function isRecord(value: unknown): value is DatasetItem {
	return typeof value === 'object' && value != null && !Array.isArray(value)
}

function extractRecordArray(value: unknown): Array<DatasetItem> {
	return Array.isArray(value) ? value.filter(isRecord) : []
}

function recordField(value: unknown, field: string): unknown {
	return isRecord(value) ? value[field] : undefined
}

function recordFieldArray(value: unknown, field: string): Array<DatasetItem> {
	return extractRecordArray(recordField(value, field))
}

function recordFieldArrayOrRoot(value: unknown, field: string): Array<DatasetItem> {
	const fieldValue = recordField(value, field)
	return fieldValue === undefined ? extractRecordArray(value) : extractRecordArray(fieldValue)
}

function numericField(record: DatasetItem, field: string): number | null {
	const value = record[field]
	return typeof value === 'number' ? value : null
}

const extractArray = (json: unknown): Array<DatasetItem> => extractRecordArray(json)
const extractDataField = (json: unknown): Array<DatasetItem> => recordFieldArrayOrRoot(json, 'data')
const extractProtocols = (json: unknown): Array<DatasetItem> => recordFieldArray(json, 'protocols')

function pctChange(current: number | null | undefined, prev: number | null | undefined): number | null {
	if (current == null || prev == null || prev === 0) return null
	return ((current - prev) / prev) * 100
}

function sumRecord(rec: unknown): number {
	if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return 0
	let total = 0
	for (const v of Object.values(rec)) {
		if (typeof v === 'number' && Number.isFinite(v)) total += v
	}
	return total
}

function deepSumRecord(rec: unknown): number {
	if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return 0
	let total = 0
	for (const v of Object.values(rec)) {
		if (typeof v === 'number' && Number.isFinite(v)) total += v
		else if (v && typeof v === 'object' && !Array.isArray(v)) total += deepSumRecord(v)
	}
	return total
}

const extractLiteProtocols = (json: unknown): Array<DatasetItem> => {
	const protocols = recordFieldArray(json, 'protocols')
	return protocols.map((protocol) => ({
		name: protocol.name,
		symbol: protocol.symbol,
		category: protocol.category,
		chain: Array.isArray(protocol.chains) ? (protocol.chains[0] ?? null) : null,
		chains: protocol.chains,
		tvl: protocol.tvl,
		tvlPrevDay: protocol.tvlPrevDay,
		tvlPrevWeek: protocol.tvlPrevWeek,
		tvlPrevMonth: protocol.tvlPrevMonth,
		change_1d: pctChange(numericField(protocol, 'tvl'), numericField(protocol, 'tvlPrevDay')),
		change_7d: pctChange(numericField(protocol, 'tvl'), numericField(protocol, 'tvlPrevWeek')),
		change_1m: pctChange(numericField(protocol, 'tvl'), numericField(protocol, 'tvlPrevMonth')),
		mcap: protocol.mcap,
		url: protocol.url,
		chainTvls: protocol.chainTvls
	}))
}

const overviewFields = [
	'name',
	'displayName',
	'category',
	'chains',
	'slug',
	'parentProtocol',
	'total24h',
	'total48hto24h',
	'total7d',
	'total14dto7d',
	'total60dto30d',
	'total30d',
	'total1y',
	'totalAllTime',
	'average1y',
	'monthlyAverage1y',
	'change_1d',
	'change_7d',
	'change_1m',
	'change_7dover7d',
	'change_30dover30d'
]

export const datasets: Array<DatasetDefinition> = [
	{
		slug: 'stablecoins',
		name: 'Stablecoins',
		description: 'All stablecoins with circulating supply, price, and chain distribution',
		category: 'Stablecoins',
		url: `${STABLECOINS_SERVER_URL}/stablecoins?includePrices=true`,
		fields: [
			'name',
			'symbol',
			'pegType',
			'pegMechanism',
			'circulating',
			'circulatingPrevDay',
			'circulatingPrevWeek',
			'circulatingPrevMonth',
			'chains',
			'price'
		],
		extractItems: (json) => recordFieldArrayOrRoot(json, 'peggedAssets')
	},
	{
		slug: 'stablecoins-chains',
		name: 'Stablecoins by Chain',
		description: 'Stablecoin circulating supply breakdown by chain',
		category: 'Stablecoins',
		url: `${STABLECOINS_SERVER_URL}/stablecoins`,
		defaultSortField: 'totalCirculatingUSD',
		fields: ['name', 'tokenSymbol', 'totalCirculatingUSD'],
		extractItems: (json) => {
			const chains = recordFieldArray(json, 'chains')
			return chains.map((chain) => ({
				...chain,
				totalCirculatingUSD: sumRecord(chain.totalCirculatingUSD)
			}))
		}
	},
	{
		slug: 'rwa-assets',
		name: 'RWA Assets',
		description: 'All Real World Assets with on-chain market cap, categories, and chain distribution',
		category: 'RWA',
		url: `${RWA_SERVER_URL}/current?z=0`,
		defaultSortField: 'onChainMcap',
		fields: [
			'ticker',
			'assetName',
			'category',
			'primaryChain',
			'chain',
			'onChainMcap',
			'activeMcap',
			'defiActiveTvl',
			'issuer',
			'rwaClassification',
			'accessModel',
			'type',
			'stablecoin'
		],
		excludeToggles: [{ field: 'stablecoin', label: 'Stablecoins', defaultExclude: true }],
		extractItems: (json) => {
			if (!Array.isArray(json)) return []
			return extractRecordArray(json).map((item) => ({
				...item,
				category: Array.isArray(item.category) ? item.category.join(', ') : item.category,
				chain: Array.isArray(item.chain) ? item.chain.join(', ') : item.chain,
				onChainMcap: item.onChainMcap ? sumRecord(item.onChainMcap) : null,
				activeMcap: item.activeMcap ? sumRecord(item.activeMcap) : null,
				defiActiveTvl: item.defiActiveTvl ? deepSumRecord(item.defiActiveTvl) : null
			}))
		}
	},
	{
		slug: 'rwa-categories',
		name: 'RWA by Category',
		description: 'RWA aggregate on-chain market cap, asset count, and issuers by category',
		category: 'RWA',
		url: `${RWA_SERVER_URL}/stats?z=0`,
		defaultSortField: 'onChainMcap',
		fields: ['category', 'onChainMcap', 'activeMcap', 'defiActiveTvl', 'assetCount', 'assetIssuers'],
		extractItems: (json) => {
			const byCategory = recordField(json, 'byCategory')
			if (!isRecord(byCategory)) return []
			return Object.entries(byCategory).map(([category, stats]) => {
				if (!isRecord(stats))
					return { category, onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0, assetCount: 0, assetIssuers: 0 }
				const buckets = [stats.base, stats.stablecoinsOnly, stats.governanceOnly, stats.stablecoinsAndGovernance]
				let onChainMcap = 0
				let activeMcap = 0
				let defiActiveTvl = 0
				let assetCount = 0
				const issuerSet = new Set<string>()
				for (const b of buckets) {
					if (!isRecord(b)) continue
					onChainMcap += numericField(b, 'onChainMcap') ?? 0
					activeMcap += numericField(b, 'activeMcap') ?? 0
					defiActiveTvl += numericField(b, 'defiActiveTvl') ?? 0
					assetCount += numericField(b, 'assetCount') ?? 0
					if (Array.isArray(b.assetIssuers)) {
						for (const issuer of b.assetIssuers) if (typeof issuer === 'string') issuerSet.add(issuer)
					}
				}
				return {
					category,
					onChainMcap,
					activeMcap,
					defiActiveTvl,
					assetCount,
					assetIssuers: issuerSet.size
				}
			})
		}
	},
	{
		slug: 'rwa-chains',
		name: 'RWA by Chain',
		description: 'RWA aggregate on-chain market cap, asset count, and issuers by chain',
		category: 'RWA',
		url: `${RWA_SERVER_URL}/stats?z=0`,
		defaultSortField: 'onChainMcap',
		fields: ['chain', 'onChainMcap', 'activeMcap', 'defiActiveTvl', 'assetCount'],
		extractItems: (json) => {
			const byChain = recordField(json, 'byChain')
			if (!isRecord(byChain)) return []
			return Object.entries(byChain).map(([chain, value]) => {
				const stats = isRecord(value) && isRecord(value.base) ? value.base : {}
				return {
					chain,
					onChainMcap: numericField(stats, 'onChainMcap') ?? 0,
					activeMcap: numericField(stats, 'activeMcap') ?? 0,
					defiActiveTvl: numericField(stats, 'defiActiveTvl') ?? 0,
					assetCount: numericField(stats, 'assetCount') ?? 0
				}
			})
		}
	},
	{
		slug: 'protocols',
		name: 'Protocols (TVL)',
		description: 'All protocols with current TVL, market cap, and chain breakdown',
		category: 'TVL',
		url: `${SERVER_URL}/lite/protocols2?zz=19`,
		defaultSortField: 'tvl',
		chainFilterType: 'protocols',
		fields: [
			'name',
			'symbol',
			'category',
			'chain',
			'chains',
			'tvl',
			'change_1d',
			'change_7d',
			'change_1m',
			'mcap',
			'url'
		],
		extractItems: extractLiteProtocols
	},
	{
		slug: 'chains',
		name: 'Chains TVL',
		description: 'Current TVL of all chains with token symbols and chain IDs',
		category: 'TVL',
		url: `${V2_SERVER_URL}/chains`,
		defaultSortField: 'tvl',
		fields: ['name', 'tokenSymbol', 'tvl', 'chainId'],
		extractItems: extractArray
	},
	{
		slug: 'yields',
		name: 'Yield Pools',
		description: 'V2 earn pools with supply APY windows, TVL, stability, holders, and pool attributes',
		category: 'Yields',
		url: '',
		defaultSortField: 'tvlUsd',
		fields: [
			'chain',
			'protocol',
			'protocolSlug',
			'category',
			'pool',
			'poolMeta',
			'poolId',
			'tvlUsd',
			'supplyApy',
			'supplyApyBase',
			'supplyApyReward',
			'supplyApyIntrinsic',
			'supplyApy7d',
			'supplyApyBase7d',
			'supplyApyReward7d',
			'supplyApyIntrinsic7d',
			'supplyApy30d',
			'supplyApyBase30d',
			'supplyApyReward30d',
			'supplyApyIntrinsic30d',
			'stability30d',
			'stablecoinOnly',
			'singleAssetExposure',
			'impermanentLossRisk',
			'referenceAsset',
			'underlyingTokens',
			'rewardTokens',
			'volumeUsd1d',
			'holderCount',
			'top10HolderPct',
			'avgPositionUsd',
			'url'
		],
		extractItems: extractDataField
	},
	{
		slug: 'yields-borrow',
		name: 'Borrow Markets',
		description: 'V2 borrow markets with supply APY, borrow cost, market sizing, available liquidity, and LTV',
		category: 'Yields',
		url: '',
		defaultSortField: 'totalBorrowUsd',
		fields: [
			'chain',
			'protocol',
			'protocolSlug',
			'category',
			'market',
			'marketMeta',
			'marketId',
			'collateralToken',
			'borrowToken',
			'supplyApy',
			'supplyApyBase',
			'supplyApyReward',
			'supplyApyIntrinsic',
			'borrowCostApy',
			'borrowCostApyBase',
			'borrowCostApyReward',
			'borrowCostApyIntrinsic',
			'totalSupplyUsd',
			'totalBorrowUsd',
			'availableBorrowUsd',
			'ltv',
			'rewardTokens',
			'url'
		],
		extractItems: extractDataField
	},
	// The API route resolves these paid legacy upstreams so credentials stay out of the browser catalog bundle.
	{
		slug: 'perp-funding',
		name: 'Perp Funding Rates',
		description: 'Perpetual futures funding rates, open interest, and index prices',
		category: 'Yields',
		url: '',
		defaultSortField: 'openInterest',
		fields: [
			'marketplace',
			'market',
			'baseAsset',
			'fundingRate',
			'fundingRatePrevious',
			'openInterest',
			'indexPrice',
			'fundingRate7dAverage',
			'fundingRate7dSum',
			'fundingRate30dAverage',
			'fundingRate30dSum'
		],
		extractItems: extractDataField
	},
	{
		slug: 'lsd-rates',
		name: 'LSD Rates',
		description: 'Liquid staking derivative APY rates and market share data',
		category: 'Yields',
		url: '',
		extractItems: extractDataField
	},
	{
		slug: 'dex-volumes',
		name: 'DEX Volumes',
		description: 'Aggregated DEX trading volumes by protocol with 24h/7d changes',
		category: 'Volume',
		url: `${SERVER_URL}/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
		fields: overviewFields,
		defaultSortField: 'total24h',
		chainFilterType: 'overview',
		extractItems: extractProtocols
	},
	{
		slug: 'perps-volume',
		name: 'Perps Volume',
		description: 'Perpetual derivatives trading volumes by protocol',
		category: 'Volume',
		url: `${SERVER_URL}/overview/derivatives?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
		fields: overviewFields,
		defaultSortField: 'total24h',
		chainFilterType: 'overview',
		extractItems: extractProtocols
	},
	{
		slug: 'options-premium-volume',
		name: 'Options Premium Volume',
		description: 'Options protocol premium volumes by protocol',
		category: 'Volume',
		url: `${SERVER_URL}/overview/options?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyPremiumVolume`,
		fields: overviewFields,
		defaultSortField: 'total24h',
		chainFilterType: 'overview',
		extractItems: extractProtocols
	},
	{
		slug: 'options-notional-volume',
		name: 'Options Notional Volume',
		description: 'Options protocol notional volumes by protocol',
		category: 'Volume',
		url: `${SERVER_URL}/overview/options?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyNotionalVolume`,
		fields: overviewFields,
		defaultSortField: 'total24h',
		chainFilterType: 'overview',
		extractItems: extractProtocols
	},
	{
		slug: 'open-interest',
		name: 'Open Interest',
		description: 'Open interest across perpetual derivatives protocols',
		category: 'Volume',
		url: `${SERVER_URL}/overview/open-interest?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=openInterestAtEnd`,
		fields: overviewFields,
		defaultSortField: 'total24h',
		chainFilterType: 'overview',
		extractItems: extractProtocols
	},
	{
		slug: 'dex-aggregator-volume',
		name: 'DEX Aggregator Volume',
		description: 'DEX aggregator trading volumes by protocol',
		category: 'Volume',
		url: `${SERVER_URL}/overview/aggregators?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
		fields: overviewFields,
		defaultSortField: 'total24h',
		chainFilterType: 'overview',
		extractItems: extractProtocols
	},
	{
		slug: 'perps-aggregator-volume',
		name: 'Perps Aggregator Volume',
		description: 'Perpetual futures aggregator volumes by protocol',
		category: 'Volume',
		url: `${SERVER_URL}/overview/aggregator-derivatives?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
		fields: overviewFields,
		defaultSortField: 'total24h',
		chainFilterType: 'overview',
		extractItems: extractProtocols
	},
	{
		slug: 'bridge-aggregator-volume',
		name: 'Bridge Aggregator Volume',
		description: 'Bridge aggregator volumes by protocol',
		category: 'Volume',
		url: `${SERVER_URL}/overview/bridge-aggregators?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
		fields: overviewFields,
		defaultSortField: 'total24h',
		chainFilterType: 'overview',
		extractItems: extractProtocols
	},
	{
		slug: 'fees',
		name: 'Fees',
		description: 'Protocol fees with 24h totals and daily changes',
		category: 'Fees & Revenue',
		url: `${SERVER_URL}/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
		fields: overviewFields,
		defaultSortField: 'total24h',
		chainFilterType: 'overview',
		extractItems: extractProtocols
	},
	{
		slug: 'revenue',
		name: 'Revenue',
		description: 'Protocol revenue with 24h totals and daily changes',
		category: 'Fees & Revenue',
		url: `${SERVER_URL}/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyRevenue`,
		fields: overviewFields,
		defaultSortField: 'total24h',
		chainFilterType: 'overview',
		extractItems: extractProtocols
	},
	{
		slug: 'user-fees',
		name: 'User Fees',
		description: 'Fees paid by users across protocols',
		category: 'Fees & Revenue',
		url: `${SERVER_URL}/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyUserFees`,
		fields: overviewFields,
		defaultSortField: 'total24h',
		chainFilterType: 'overview',
		extractItems: extractProtocols
	},
	{
		slug: 'holders-revenue',
		name: 'Holders Revenue',
		description: 'Revenue distributed to token holders by protocol',
		category: 'Fees & Revenue',
		url: `${SERVER_URL}/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyHoldersRevenue`,
		fields: overviewFields,
		defaultSortField: 'total24h',
		chainFilterType: 'overview',
		extractItems: extractProtocols
	},
	{
		slug: 'protocol-revenue',
		name: 'Protocol Revenue',
		description: 'Revenue retained by protocol treasuries',
		category: 'Fees & Revenue',
		url: `${SERVER_URL}/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyProtocolRevenue`,
		fields: overviewFields,
		defaultSortField: 'total24h',
		chainFilterType: 'overview',
		extractItems: extractProtocols
	},
	{
		slug: 'supply-side-revenue',
		name: 'Supply Side Revenue',
		description: 'Revenue earned by liquidity providers and supply-side participants',
		category: 'Fees & Revenue',
		url: `${SERVER_URL}/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailySupplySideRevenue`,
		fields: overviewFields,
		defaultSortField: 'total24h',
		chainFilterType: 'overview',
		extractItems: extractProtocols
	},
	{
		slug: 'hacks',
		name: 'Hacks',
		description: 'Historical exploits database with classification, technique, and whole-USD amounts',
		category: 'Security',
		url: `${SERVER_URL}/hacks`,
		defaultSortField: 'amountUsd',
		fields: [
			'date',
			'name',
			'classification',
			'technique',
			'amountUsd',
			'chain',
			'bridgeHack',
			'targetType',
			'source',
			'returnedFundsUsd',
			'language'
		],
		extractItems: (json) =>
			extractArray(json).map((item) => normalizeHack(item as unknown as IHackApiItem) as unknown as DatasetItem)
	},
	{
		slug: 'raises',
		name: 'Raises',
		description: 'Funding rounds database with investors and whole-USD amounts and valuations',
		category: 'Fundraising',
		url: `${SERVER_URL}/raises`,
		defaultSortField: 'date',
		fields: [
			'date',
			'name',
			'round',
			'amountUsd',
			'chains',
			'sector',
			'category',
			'categoryGroup',
			'source',
			'leadInvestors',
			'otherInvestors',
			'valuationUsd'
		],
		extractItems: (json) =>
			recordFieldArrayOrRoot(json, 'raises').map(
				(item) => normalizeRaisesApiItem(item as unknown as RaisesApiItem) as unknown as DatasetItem
			)
	},
	{
		slug: 'emissions',
		name: 'Token Emissions / Unlocks',
		description: 'Token unlock schedules with circulating supply and next unlock events',
		category: 'Token',
		url: `${SERVER_URL}/emissions`,
		defaultSortField: 'mcap',
		fields: [
			'name',
			'protocolSlug',
			'token',
			'circSupply',
			'circSupply30d',
			'totalLocked',
			'maxSupply',
			'mcap',
			'unlocksPerDay'
		],
		extractItems: extractArray
	},
	{
		slug: 'treasuries',
		name: 'Protocol Treasuries',
		description: 'Protocol treasury balances with token breakdowns by category',
		category: 'Treasury',
		url: `${SERVER_URL}/treasuries`,
		defaultSortField: 'tvl',
		fields: ['name', 'slug', 'chain', 'chains', 'tvl', 'change_1h', 'change_1d', 'change_7d', 'tokenBreakdowns'],
		extractItems: extractArray
	},
	{
		slug: 'etf-overview',
		name: 'ETF Overview',
		description: 'Crypto ETF data with AUM, flows, volume, and fee information',
		category: 'ETFs & DATs',
		url: `${ETF_SERVER_URL}/overview`,
		defaultSortField: 'aum',
		fields: ['ticker', 'asset', 'issuer', 'etf_name', 'custodian', 'pct_fee', 'flows', 'aum', 'volume'],
		extractItems: extractArray
	},
	{
		slug: 'etf-history',
		name: 'ETF History',
		description: 'Historical ETF flow and AUM data across all crypto ETFs',
		category: 'ETFs & DATs',
		url: `${ETF_SERVER_URL}/history`,
		defaultSortField: 'day',
		fields: ['gecko_id', 'day', 'total_flow_usd'],
		extractItems: extractArray
	},
	{
		slug: 'bridges',
		name: 'Bridges',
		description: 'All bridges with daily/weekly/monthly volume and chain data',
		category: 'Bridges',
		url: `${BRIDGES_SERVER_URL}/bridges?includeChains=true`,
		defaultSortField: 'monthlyVolume',
		fields: [
			'name',
			'displayName',
			'slug',
			'chains',
			'last24hVolume',
			'lastDailyVolume',
			'dayBeforeLastVolume',
			'weeklyVolume',
			'monthlyVolume',
			'url'
		],
		extractItems: (json) => recordFieldArrayOrRoot(json, 'bridges')
	},
	{
		slug: 'cex-transparency',
		name: 'CEX Transparency',
		description: 'Centralized exchange transparency data with TVL, inflows, spot/derivatives volume, and leverage',
		category: 'CEX',
		url: `${SERVER_URL}/cexs`,
		defaultSortField: 'currentTvl',
		fields: [
			'name',
			'coin',
			'coinSymbol',
			'currentTvl',
			'cleanAssetsTvl',
			'inflows_24h',
			'inflows_1w',
			'inflows_1m',
			'spotVolume',
			'oi',
			'derivVolume',
			'leverage',
			'lastAuditDate',
			'auditor'
		],
		extractItems: (json) => recordFieldArrayOrRoot(json, 'cexs')
	},
	{
		slug: 'dat-institutions',
		name: 'DAT Institutions',
		description: 'Digital Asset Treasury data for public companies holding crypto',
		category: 'ETFs & DATs',
		url: `${TRADFI_API}/institutions`,
		defaultSortField: 'totalUsdValue',
		fields: [
			'ticker',
			'name',
			'type',
			'price',
			'priceChange24h',
			'volume24h',
			'mcapRealized',
			'realized_mNAV',
			'totalUsdValue',
			'totalCost',
			'holdings'
		],
		extractItems: (json) => {
			const metadata = recordField(json, 'institutionMetadata')
			return isRecord(metadata) ? Object.values(metadata).filter(isRecord) : []
		}
	}
]

export const datasetsBySlug = new Map(datasets.map((d) => [d.slug, d]))

export const datasetCategories = [...new Set(datasets.map((d) => d.category))]
