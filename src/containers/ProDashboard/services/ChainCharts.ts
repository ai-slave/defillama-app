import { fetchCoinGeckoChartByIdWithCacheFallback } from '~/api/coingecko'
import { fetchAdapterChainChartData, fetchAdapterProtocolChartData } from '~/containers/AdapterMetrics/api'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { fetchChainAssetsChart } from '~/containers/BridgedTVL/api'
import { fetchChainChart } from '~/containers/Chains/api'
import type { ChainChartResponse } from '~/containers/Chains/api.types'
import { fetchStablecoinChartApi } from '~/containers/Stablecoins/api'
import type { StablecoinChartPoint, StablecoinChartResponse } from '~/containers/Stablecoins/api.types'
import { slug } from '~/utils'
import { toDisplayName } from '~/utils/chainNormalizer'
import { recordRuntimeError } from '~/utils/telemetry'
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
	bribes: {
		type: 'dimensions',
		adapterType: ADAPTER_TYPES.FEES,
		dataType: ADAPTER_DATA_TYPES.DAILY_BRIBES_REVENUE
	},
	tokenTax: {
		type: 'dimensions',
		adapterType: ADAPTER_TYPES.FEES,
		dataType: ADAPTER_DATA_TYPES.DAILY_TOKEN_TAXES
	},
	aggregators: { type: 'dimensions', adapterType: ADAPTER_TYPES.AGGREGATORS },
	perps: { type: 'dimensions', adapterType: ADAPTER_TYPES.PERPS },
	bridgeAggregators: { type: 'dimensions', adapterType: ADAPTER_TYPES.BRIDGE_AGGREGATORS },
	perpsAggregators: { type: 'dimensions', adapterType: ADAPTER_TYPES.PERPS_AGGREGATOR },
	// Persisted `options` cards predate the premium/notional split and mean premium volume.
	options: {
		type: 'dimensions',
		adapterType: ADAPTER_TYPES.OPTIONS,
		dataType: ADAPTER_DATA_TYPES.DAILY_PREMIUM_VOLUME
	},
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
	users: { type: 'activity', adapterType: ADAPTER_TYPES.ACTIVE_USERS },
	activeUsers: { type: 'activity', adapterType: ADAPTER_TYPES.ACTIVE_USERS },
	newUsers: { type: 'activity', adapterType: ADAPTER_TYPES.NEW_USERS },
	txs: {
		type: 'activity',
		adapterType: ADAPTER_TYPES.ACTIVE_USERS,
		dataType: ADAPTER_DATA_TYPES.DAILY_TRANSACTIONS_COUNT
	},
	gasUsed: {
		type: 'activity',
		adapterType: ADAPTER_TYPES.ACTIVE_USERS,
		dataType: ADAPTER_DATA_TYPES.DAILY_GAS_USED
	},

	stablecoins: { type: 'stablecoins' },
	stablecoinInflows: { type: 'stablecoins', dataType: 'inflows' },

	bridgedTvl: { type: 'chainAssets' },

	chainMcap: { type: 'chainToken' },
	chainPrice: { type: 'chainToken' }
} as const

// TODO(chain-normalizer): this service accepts saved chart-builder chain values
// and calls external APIs that historically accepted mixed chain names. Migrate
// configs and calls to v2 display-name chain values, then remove normalization.
export default class ChainCharts {
	private static async fetchAndMergeChains<T>(
		chains: string[],
		fetchData: (chainName: string) => Promise<T>,
		extractData: (data: T) => [number, number][]
	): Promise<[number, number][]> {
		if (chains.length === 0) return []

		try {
			const responses = await Promise.all(chains.map((chain) => fetchData(chain).catch(() => null)))

			const mergedMap = new Map<number, number>()

			for (const data of responses) {
				if (data == null) continue
				const extracted = extractData(data)
				for (const [timestamp, value] of extracted) {
					mergedMap.set(timestamp, value)
				}
			}

			if (mergedMap.size > 0) {
				return Array.from(mergedMap.entries()).sort((a, b) => a[0] - b[0])
			}
		} catch (error) {
			recordRuntimeError(error, 'pageBuild')
		}

		return []
	}

	// TODO(chain-normalizer): saved ProDashboard chain chart configs can still
	// contain legacy/internal chain values. Remove this once chart configs and
	// external chain chart calls use v2 display-name chain values end to end.
	private static getChainNames(chain: string): string[] {
		const displayName = toDisplayName(chain)
		if (displayName !== chain) {
			return [chain, displayName]
		}
		return [chain]
	}

	private static async dimensionsData(
		chain: string,
		adapterType: `${ADAPTER_TYPES}`,
		dataType?: `${ADAPTER_DATA_TYPES}`
	): Promise<[number, number][]> {
		if (!chain) return []
		const apiChain = toDisplayName(chain)
		const data = await fetchAdapterChainChartData({ adapterType, chain: apiChain, dataType })
		return convertToNumberFormat(data)
	}

	private static async protocolData(
		chain: string,
		adapterType: `${ADAPTER_TYPES}`,
		dataType?: `${ADAPTER_DATA_TYPES}`
	): Promise<[number, number][]> {
		if (!chain) return []
		const apiChain = toDisplayName(chain)
		const data = await fetchAdapterProtocolChartData({ adapterType, protocol: apiChain, dataType })
		return convertToNumberFormat(data)
	}

	private static async tvlData(chain: string): Promise<[number, number][]> {
		if (!chain) return []

		const chainNames = this.getChainNames(chain)

		if (chainNames.length === 1) {
			const data = await fetchChainChart(chain).catch(() => null)
			if (data == null) return []
			const adjustedTvl = processAdjustedTvl(data)
			return convertToNumberFormat(adjustedTvl)
		}

		return this.fetchAndMergeChains(
			chainNames,
			(chainName) => fetchChainChart<ChainChartResponse>(chainName),
			(data) => {
				const adjustedTvl = processAdjustedTvl(data)
				return convertToNumberFormat(adjustedTvl)
			}
		)
	}

	private static async stablecoinsData(chain: string, dataType?: string): Promise<[number, number][]> {
		if (!chain) return []
		const apiChain = toDisplayName(chain)
		const encodedChain = apiChain.includes(' ') ? encodeURIComponent(apiChain) : apiChain
		const data = await fetchStablecoinChartOnce(encodedChain)

		if (dataType === 'inflows') {
			return this.calculateInflows(data.aggregated)
		}

		const formattedData: [number, number][] = data.aggregated.map((item) => [
			parseInt(item.date, 10),
			item.totalCirculatingUSD?.peggedUSD || 0
		])

		return formattedData
	}

	private static calculateInflows(aggregatedData: StablecoinChartPoint[]): [number, number][] {
		if (aggregatedData.length < 2) return []

		const inflowsData: [number, number][] = []

		for (let i = 1; i < aggregatedData.length; i++) {
			const currentDay = aggregatedData[i]
			const prevDay = aggregatedData[i - 1]

			const currentMcap = currentDay.totalCirculatingUSD?.peggedUSD || 0
			const prevMcap = prevDay.totalCirculatingUSD?.peggedUSD || 0
			const inflow = currentMcap - prevMcap

			inflowsData.push([parseInt(currentDay.date, 10), inflow])
		}
		return inflowsData
	}

	private static async chainAssetsData(chain: string): Promise<[number, number][]> {
		if (!chain) return []

		const chainSlugs = Array.from(new Set(this.getChainNames(chain).map(slug).filter(Boolean)))

		if (chainSlugs.length === 1) {
			const data = await fetchChainAssetsChart(chainSlugs[0]).catch(() => null)
			if (!Array.isArray(data)) return []
			return data.map((item) => [Number(item.timestamp), Number(item.data?.total) || 0])
		}

		try {
			const responses = await Promise.all(
				chainSlugs.map((chainSlug) => fetchChainAssetsChart(chainSlug).catch(() => null))
			)
			const mergedMap = new Map<number, number>()
			for (const data of responses) {
				if (!Array.isArray(data)) continue
				for (const item of data) {
					const timestamp = Number(item.timestamp)
					const value = Number(item.data?.total) || 0
					mergedMap.set(timestamp, value)
				}
			}
			return Array.from(mergedMap.entries()).sort((a, b) => a[0] - b[0])
		} catch (error) {
			recordRuntimeError(error, 'pageBuild')
			return []
		}
	}

	private static async getTokenData(geckoId: string) {
		if (!geckoId) return null
		const result = await fetchCoinGeckoChartByIdWithCacheFallback(geckoId, { fullChart: true })
		return result?.data ?? null
	}

	private static async chainMcapData(_chain: string, geckoId?: string): Promise<[number, number][]> {
		if (!geckoId) return []
		const data = await this.getTokenData(geckoId)
		if (!data) return []
		const converted = convertToNumberFormat(data.mcaps ?? [], true)
		return normalizeHourlyToDaily(converted, 'last')
	}

	private static async chainPriceData(_chain: string, geckoId?: string): Promise<[number, number][]> {
		if (!geckoId) return []
		const data = await this.getTokenData(geckoId)
		if (!data) return []
		const converted = convertToNumberFormat(data.prices ?? [], true)
		return normalizeHourlyToDaily(converted, 'last')
	}

	static async getData(chartType: string, chain: string, geckoId?: string): Promise<[number, number][]> {
		const metadata = CHART_METADATA[chartType]

		if (!metadata) {
			return []
		}

		switch (metadata.type) {
			case 'tvl':
				return this.tvlData(chain)
			case 'dimensions':
				return this.dimensionsData(chain, metadata.adapterType, metadata.dataType)
			case 'protocol':
			case 'activity':
				return this.protocolData(chain, metadata.adapterType, metadata.dataType)
			case 'stablecoins':
				return this.stablecoinsData(chain, metadata.dataType)
			case 'chainAssets':
				return this.chainAssetsData(chain)
			case 'chainToken':
				if (chartType === 'chainMcap') {
					return this.chainMcapData(chain, geckoId)
				} else if (chartType === 'chainPrice') {
					return this.chainPriceData(chain, geckoId)
				}
				return []
			default:
				return []
		}
	}

	// Legacy method wrappers for backward compatibility
	static async tvl(chain: string): Promise<[number, number][]> {
		return this.getData('tvl', chain)
	}
	static async volume(chain: string): Promise<[number, number][]> {
		return this.getData('volume', chain)
	}
	static async fees(chain: string): Promise<[number, number][]> {
		return this.getData('fees', chain)
	}
	static async revenue(chain: string): Promise<[number, number][]> {
		return this.getData('revenue', chain)
	}
	static async bribes(chain: string): Promise<[number, number][]> {
		return this.getData('bribes', chain)
	}
	static async tokenTax(chain: string): Promise<[number, number][]> {
		return this.getData('tokenTax', chain)
	}
	static async aggregators(chain: string): Promise<[number, number][]> {
		return this.getData('aggregators', chain)
	}
	static async perps(chain: string): Promise<[number, number][]> {
		return this.getData('perps', chain)
	}
	static async bridgeAggregators(chain: string): Promise<[number, number][]> {
		return this.getData('bridgeAggregators', chain)
	}
	static async perpsAggregators(chain: string): Promise<[number, number][]> {
		return this.getData('perpsAggregators', chain)
	}
	static async options(chain: string): Promise<[number, number][]> {
		return this.getData('options', chain)
	}
	static async users(chain: string): Promise<[number, number][]> {
		return this.getData('users', chain)
	}
	static async activeUsers(chain: string): Promise<[number, number][]> {
		return this.getData('activeUsers', chain)
	}
	static async newUsers(chain: string): Promise<[number, number][]> {
		return this.getData('newUsers', chain)
	}
	static async txs(chain: string): Promise<[number, number][]> {
		return this.getData('txs', chain)
	}
	static async gasUsed(chain: string): Promise<[number, number][]> {
		return this.getData('gasUsed', chain)
	}
	static async stablecoins(chain: string): Promise<[number, number][]> {
		return this.getData('stablecoins', chain)
	}
	static async stablecoinInflows(chain: string): Promise<[number, number][]> {
		return this.getData('stablecoinInflows', chain)
	}
	static async chainFees(chain: string): Promise<[number, number][]> {
		return this.getData('chainFees', chain)
	}
	static async chainRevenue(chain: string): Promise<[number, number][]> {
		return this.getData('chainRevenue', chain)
	}
	static async bridgedTvl(chain: string): Promise<[number, number][]> {
		return this.getData('bridgedTvl', chain)
	}
	static async chainMcap(chain: string, geckoId?: string): Promise<[number, number][]> {
		return this.getData('chainMcap', chain, geckoId)
	}
	static async chainPrice(chain: string, geckoId?: string): Promise<[number, number][]> {
		return this.getData('chainPrice', chain, geckoId)
	}
}
