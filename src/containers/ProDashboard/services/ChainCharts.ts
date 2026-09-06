import { fetchCoinGeckoChartByIdWithCacheFallback } from '~/api/coingecko'
import { fetchAdapterChainChartData, fetchAdapterProtocolChartData } from '~/containers/AdapterMetrics/api'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { fetchChainAssetsChart } from '~/containers/BridgedTVL/api'
import { resolveChainAssetId } from '~/containers/BridgedTVL/chainAssetIds'
import { fetchChainChart } from '~/containers/Chains/api'
import { fetchStablecoinChartApi } from '~/containers/Stablecoins/api'
import type { StablecoinChartResponse } from '~/containers/Stablecoins/api.types'
import { buildStablecoinAggregatePairs, type StablecoinAggregatePair } from '~/containers/Stablecoins/utils'
import { toDisplayName } from '~/utils/chainNormalizer'
import { processAdjustedTvl } from '~/utils/tvl'
import { convertToNumberFormat, normalizeHourlyToDaily } from '../utils'

const stablecoinChartRequests = new Map<string, Promise<StablecoinChartResponse>>()

function fetchStablecoinChartOnce(chain: string): Promise<StablecoinChartResponse> {
	const existing = stablecoinChartRequests.get(chain)
	if (existing) return existing

	const request = fetchStablecoinChartApi(chain).finally(() => {
		if (stablecoinChartRequests.get(chain) === request) stablecoinChartRequests.delete(chain)
	})
	stablecoinChartRequests.set(chain, request)
	return request
}

const CHART_METADATA = {
	tvl: { type: 'tvl' },

	volume: { type: 'dimensions', adapterType: ADAPTER_TYPES.DEXS },
	fees: { type: 'dimensions', adapterType: ADAPTER_TYPES.FEES, dataType: ADAPTER_DATA_TYPES.DAILY_APP_FEES },
	revenue: {
		type: 'dimensions',
		adapterType: ADAPTER_TYPES.FEES,
		dataType: ADAPTER_DATA_TYPES.DAILY_APP_REVENUE
	},
	aggregators: { type: 'dimensions', adapterType: ADAPTER_TYPES.AGGREGATORS },
	perps: { type: 'dimensions', adapterType: ADAPTER_TYPES.PERPS },
	openInterest: {
		type: 'dimensions',
		adapterType: ADAPTER_TYPES.OPEN_INTEREST,
		dataType: ADAPTER_DATA_TYPES.OPEN_INTEREST_AT_END
	},
	bridgeAggregators: { type: 'dimensions', adapterType: ADAPTER_TYPES.BRIDGE_AGGREGATORS },
	perpsAggregators: { type: 'dimensions', adapterType: ADAPTER_TYPES.PERPS_AGGREGATOR },
	optionsPremium: {
		type: 'dimensions',
		adapterType: ADAPTER_TYPES.OPTIONS,
		dataType: ADAPTER_DATA_TYPES.DAILY_PREMIUM_VOLUME
	},
	optionsNotional: {
		type: 'dimensions',
		adapterType: ADAPTER_TYPES.OPTIONS,
		dataType: ADAPTER_DATA_TYPES.DAILY_NOTIONAL_VOLUME
	},

	chainFees: { type: 'protocol', adapterType: ADAPTER_TYPES.FEES },
	chainRevenue: {
		type: 'protocol',
		adapterType: ADAPTER_TYPES.FEES,
		dataType: ADAPTER_DATA_TYPES.DAILY_REVENUE
	},

	// Chain activity totals are stored as chain pseudo-protocols, not chain-filtered app aggregates.
	activeUsers: { type: 'activity', adapterType: ADAPTER_TYPES.ACTIVE_USERS },
	newUsers: { type: 'activity', adapterType: ADAPTER_TYPES.NEW_USERS },
	txs: {
		type: 'activity',
		adapterType: ADAPTER_TYPES.ACTIVE_USERS,
		dataType: ADAPTER_DATA_TYPES.DAILY_TRANSACTIONS_COUNT
	},
	gasUsed: {
		type: 'dimensions',
		adapterType: ADAPTER_TYPES.ACTIVE_USERS,
		dataType: ADAPTER_DATA_TYPES.DAILY_GAS_USED_USD
	},

	stablecoins: { type: 'stablecoins' },
	stablecoinInflows: { type: 'stablecoins', dataType: 'inflows' },

	bridgedTvl: { type: 'chainAssets' },

	chainMcap: { type: 'chainToken' },
	chainPrice: { type: 'chainToken' }
} as const

type ChartMetadataKey = keyof typeof CHART_METADATA

function isChartMetadataKey(value: string): value is ChartMetadataKey {
	return Object.hasOwn(CHART_METADATA, value)
}

// TODO(chain-normalizer): this service accepts saved chart-builder chain values
// and calls external APIs that historically accepted mixed chain names. Migrate
// configs and calls to v2 display-name chain values, then remove normalization.
// TODO(chain-normalizer): saved ProDashboard chain chart configs can still
// contain legacy/internal chain values. Remove this once chart configs and
// external chain chart calls use v2 display-name chain values end to end.
function getChainNames(chain: string): Array<string> {
	const displayName = toDisplayName(chain)
	if (displayName !== chain) {
		return [chain, displayName]
	}
	return [chain]
}

async function fetchChainDimensionsData(
	chain: string,
	adapterType: `${ADAPTER_TYPES}`,
	dataType?: `${ADAPTER_DATA_TYPES}`
): Promise<Array<[number, number]>> {
	if (!chain) return []
	const apiChain = toDisplayName(chain)
	const data = await fetchAdapterChainChartData({
		adapterType,
		chain: apiChain,
		...(dataType ? { dataType } : {})
	})
	return data
}

async function fetchChainProtocolData(
	chain: string,
	adapterType: `${ADAPTER_TYPES}`,
	dataType?: `${ADAPTER_DATA_TYPES}`
): Promise<Array<[number, number]>> {
	if (!chain) return []
	const apiChain = toDisplayName(chain)
	const data = await fetchAdapterProtocolChartData({
		adapterType,
		protocol: apiChain,
		...(dataType ? { dataType } : {})
	})
	return data
}

async function fetchChainTvlData(chain: string): Promise<Array<[number, number]>> {
	if (!chain) return []

	const chainNames = getChainNames(chain)

	if (chainNames.length === 1) {
		const data = await fetchChainChart(chain)
		const adjustedTvl = processAdjustedTvl(data)
		return convertToNumberFormat(adjustedTvl)
	}

	const responses = await Promise.allSettled(chainNames.map((chainName) => fetchChainChart(chainName)))
	// The final name is the canonical display name. Older saved names are only a
	// compatibility fallback, not another chain whose values should be merged.
	for (let index = responses.length - 1; index >= 0; index--) {
		const response = responses[index]
		if (response?.status === 'fulfilled') return convertToNumberFormat(processAdjustedTvl(response.value))
	}
	const failure = responses[0]
	if (failure?.status === 'rejected') throw failure.reason
	throw new Error(`Unable to fetch TVL chart for ${chain}`)
}

async function fetchChainStablecoinsData(chain: string, dataType?: string): Promise<Array<[number, number]>> {
	if (!chain) return []
	const apiChain = toDisplayName(chain)
	const encodedChain = apiChain.includes(' ') ? encodeURIComponent(apiChain) : apiChain
	const data = await fetchStablecoinChartOnce(encodedChain)
	const totals = buildStablecoinAggregatePairs(data)

	if (dataType === 'inflows') {
		return calculateStablecoinInflows(totals)
	}

	return totals
}

function calculateStablecoinInflows(aggregatedData: Array<StablecoinAggregatePair>): Array<[number, number]> {
	if (aggregatedData.length < 2) return []

	const inflowsData: Array<[number, number]> = []

	for (let i = 1; i < aggregatedData.length; i++) {
		const currentDay = aggregatedData[i]
		const prevDay = aggregatedData[i - 1]
		if (!currentDay || !prevDay) throw new Error(`Missing stablecoin chart point at index ${i}`)

		inflowsData.push([currentDay[0], currentDay[1] - prevDay[1]])
	}
	return inflowsData
}

async function fetchChainAssetsData(chain: string, chainAssetId?: string): Promise<Array<[number, number]>> {
	if (!chain) return []

	const resolvedChainAssetId = chainAssetId ?? (await resolveChainAssetId(chain))
	if (!resolvedChainAssetId) return []

	const data = await fetchChainAssetsChart(resolvedChainAssetId)
	return data.map((item) => [item.timestamp, item.data.total])
}

async function fetchChainTokenData(geckoId: string) {
	const result = await fetchCoinGeckoChartByIdWithCacheFallback(geckoId, { timeframe: 'MAX' })
	return result?.data ?? null
}

async function fetchChainMcapData(geckoId?: string): Promise<Array<[number, number]>> {
	if (!geckoId) return []
	const data = await fetchChainTokenData(geckoId)
	if (!data) return []
	const converted = convertToNumberFormat(data.mcaps ?? [], true)
	return normalizeHourlyToDaily(converted, 'last')
}

async function fetchChainPriceData(geckoId?: string): Promise<Array<[number, number]>> {
	if (!geckoId) return []
	const data = await fetchChainTokenData(geckoId)
	if (!data) return []
	const converted = convertToNumberFormat(data.prices ?? [], true)
	return normalizeHourlyToDaily(converted, 'last')
}

export async function fetchProChainChartData(
	chartType: string,
	chain: string,
	geckoId?: string,
	chainAssetId?: string
): Promise<Array<[number, number]>> {
	if (!isChartMetadataKey(chartType)) return []
	const metadata = CHART_METADATA[chartType]

	switch (metadata.type) {
		case 'tvl':
			return fetchChainTvlData(chain)
		case 'dimensions':
			return fetchChainDimensionsData(
				chain,
				metadata.adapterType,
				'dataType' in metadata ? metadata.dataType : undefined
			)
		case 'protocol':
		case 'activity':
			return fetchChainProtocolData(chain, metadata.adapterType, 'dataType' in metadata ? metadata.dataType : undefined)
		case 'stablecoins':
			return fetchChainStablecoinsData(chain, 'dataType' in metadata ? metadata.dataType : undefined)
		case 'chainAssets':
			return fetchChainAssetsData(chain, chainAssetId)
		case 'chainToken':
			if (chartType === 'chainMcap') {
				return fetchChainMcapData(geckoId)
			}
			if (chartType === 'chainPrice') {
				return fetchChainPriceData(geckoId)
			}
			return []
		default:
			return []
	}
}
