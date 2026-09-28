import type {
	MultiSeriesTimeSeriesDataset,
	MultiSeriesTimeSeriesRow
} from '~/components/ECharts/MultiSeriesChart/types'
import { V2_SERVER_URL } from '~/constants'
import { getDimensionAdapterChainEarningsOverview } from '~/containers/Incentives/queries'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import type { TokenRightsBadgeSources } from '~/containers/TokenRights/badge'
import type { ChainNativeFeeRevenueRankingDataType } from '~/metrics/definitions'
import { feeRevenueMetrics, getChainNativeFeeRevenueRankingMetric } from '~/metrics/feesRevenue'
import { slug } from '~/utils'
import { fetchJson } from '~/utils/async'
import { chainIconUrl } from '~/utils/icons'
import { getDeprecatedChainNames, isDeprecatedChain } from '~/utils/metadata/deprecatedChains'
import type { IChainMetadata } from '~/utils/metadata/types'
import { recordRuntimeError } from '~/utils/telemetry'
import { buildAdapterByChainReadModel } from './adapterByChainReadModel'
import {
	fetchAdapterChainChartData,
	fetchAdapterChainMetrics,
	fetchAdapterProtocolChartData,
	fetchAdapterProtocolMetrics
} from './api'
import type { IAdapterChainMetrics } from './api.types'
import type { ADAPTER_TYPES } from './constants'
import { ADAPTER_DATA_TYPE_KEYS, ADAPTER_DATA_TYPES, getChainMetadataKey, REV_PROTOCOLS } from './constants'
import type {
	IAdapterByChainPageData,
	IAdapterChainOverview,
	IAdapterProtocolOverview,
	IChainsByAdapterPageData,
	IChainsByREVPageData
} from './types'
import { buildAdapterByChainChartDataset } from './utils'

const FEES_CHART_ROUTES = new Set(['fees', 'revenue', 'holders-revenue'])
const CANTON_INCENTIVES_WARNING =
	'Canton is currently distributing massive incentives, so its fees and revenue should be interpreted with that context.'
type ChainPeriodMetrics = { '24h'?: number | null; '7d'?: number | null; '30d'?: number | null }
type ChainPeriodMetricsByName = Record<string, ChainPeriodMetrics>

function buildChainsChartData({
	rawChartData,
	allChains
}: {
	rawChartData: Array<[number, Record<string, number>]>
	allChains: Array<string>
}): MultiSeriesTimeSeriesDataset {
	const chartDimensions: MultiSeriesTimeSeriesDataset['dimensions'] = ['timestamp', ...allChains]
	const chainIndexes = new Map<string, number>()
	for (let index = 0; index < allChains.length; index++) {
		const chain = allChains[index]
		if (chain !== undefined) chainIndexes.set(chain, index + 1)
	}
	const source: MultiSeriesTimeSeriesDataset['source'] = []
	for (const [timestamp, chainValues] of rawChartData) {
		const normalizedTimestamp = timestamp < 1e12 ? timestamp * 1e3 : timestamp
		const row: MultiSeriesTimeSeriesRow = [normalizedTimestamp]
		row.length = allChains.length + 1
		row.fill(null, 1)

		for (const chainKey in chainValues) {
			const value = chainValues[chainKey]
			const index = chainIndexes.get(chainKey)
			if (value !== undefined && index !== undefined) row[index] = value
		}

		source.push(row)
	}
	return {
		dimensions: chartDimensions,
		source
	}
}

export function getChainsByAdapterAllChains({
	adapterType,
	dataType,
	chainMetadata
}: {
	adapterType: `${ADAPTER_TYPES}`
	dataType: `${ADAPTER_DATA_TYPES}`
	chainMetadata: Record<string, IChainMetadata>
}): Array<string> {
	const allChains: Array<string> = []
	const sType = getChainMetadataKey(adapterType, dataType)
	if (!sType) return allChains

	for (const chainId in chainMetadata) {
		const currentChainMetadata = chainMetadata[chainId]
		if (currentChainMetadata === undefined) continue
		if (!currentChainMetadata[sType]) continue
		allChains.push(currentChainMetadata.name)
	}

	return allChains
}

export async function getChainsByAdapterChartData({
	adapterType,
	dataType,
	allChains,
	allowEmptyOnError = false
}: {
	adapterType: `${ADAPTER_TYPES}`
	dataType: `${ADAPTER_DATA_TYPES}`
	allChains: Array<string>
	allowEmptyOnError?: boolean
}): Promise<MultiSeriesTimeSeriesDataset> {
	let rawChartData: Array<[number, Record<string, number>]>
	try {
		rawChartData = await fetchJson<Array<[number, Record<string, number>]>>(
			`${V2_SERVER_URL}/chart/${adapterType}/chain-breakdown${dataType ? `?dataType=${dataType}` : ''}`
		)
	} catch (error) {
		if (!allowEmptyOnError) throw error
		rawChartData = []
	}

	return buildChainsChartData({ rawChartData, allChains })
}

export async function getAdapterChainOverview({
	adapterType,
	chain,
	excludeTotalDataChart,
	dataType
}: {
	adapterType: `${ADAPTER_TYPES}`
	chain: string
	excludeTotalDataChart: boolean
	dataType?: `${ADAPTER_DATA_TYPES}` | 'dailyEarnings'
}): Promise<IAdapterChainOverview> {
	if (dataType !== 'dailyEarnings') {
		const [overviewData, totalDataChart] = await Promise.all([
			fetchAdapterChainMetrics({ adapterType, chain, ...(dataType !== undefined ? { dataType } : {}) }),
			excludeTotalDataChart
				? Promise.resolve<IAdapterChainOverview['totalDataChart']>([])
				: fetchAdapterChainChartData({ adapterType, chain, ...(dataType !== undefined ? { dataType } : {}) })
		])

		const overview: IAdapterChainOverview = { ...overviewData, totalDataChart }
		return overview
	}

	const [overviewData, totalDataChart] = await Promise.all([
		fetchAdapterChainMetrics({ adapterType, chain: 'All', dataType: 'dailyRevenue' }),
		excludeTotalDataChart
			? Promise.resolve<IAdapterChainOverview['totalDataChart']>([])
			: fetchAdapterChainChartData({ adapterType, chain, dataType: 'dailyRevenue' })
	])

	const earnings = await getDimensionAdapterChainEarningsOverview({
		chain,
		overviewData,
		totalDataChart
	})
	if (earnings.status === 'unavailable')
		throw new Error('Earnings are unavailable because emissions data could not be loaded')
	return earnings.overview
}

export async function getAdapterProtocolOverview({
	adapterType,
	protocol,
	excludeTotalDataChart,
	dataType
}: {
	adapterType: `${ADAPTER_TYPES}`
	protocol: string
	excludeTotalDataChart: boolean
	dataType?: `${ADAPTER_DATA_TYPES}`
}): Promise<IAdapterProtocolOverview> {
	if (protocol.toLowerCase() === 'all') throw new Error('Protocol cannot be All')

	const [overviewData, totalDataChart] = await Promise.all([
		fetchAdapterProtocolMetrics({ adapterType, protocol, ...(dataType !== undefined ? { dataType } : {}) }),
		excludeTotalDataChart
			? Promise.resolve<IAdapterProtocolOverview['totalDataChart']>([])
			: fetchAdapterProtocolChartData({ adapterType, protocol, ...(dataType !== undefined ? { dataType } : {}) })
	])

	return { ...overviewData, totalDataChart }
}

export const getAdapterByChainPageData = async ({
	adapterType,
	chain,
	dataType,
	route,
	hasOpenInterest,
	metricName,
	tokenSources
}: {
	adapterType: `${ADAPTER_TYPES}`
	chain: string
	dataType?: `${ADAPTER_DATA_TYPES}` | 'dailyEarnings'
	route: string
	hasOpenInterest?: boolean
	metricName: string
	/** Started by the page's getStaticProps and awaited after the adapter requests, so the two overlap. */
	tokenSources?: Promise<TokenRightsBadgeSources>
}): Promise<IAdapterByChainPageData | null> => {
	const showFeesChart = FEES_CHART_ROUTES.has(route)
	const rankBy = route === 'pf' || route === 'ps' ? 'pfOrPs' : 'total24h'
	const cantonIncentivesWarning = metricName === 'Fees' || metricName === 'Revenue' ? CANTON_INCENTIVES_WARNING : null

	const [data, protocolsData, openInterestData, activeLiquidityData, normalizedVolumeData]: [
		IAdapterChainOverview,
		{
			protocols: Array<{ name: string; mcap: number | null }>
			parentProtocols: Array<{ name: string; mcap?: number | null }>
		},
		IAdapterChainOverview | null,
		IAdapterChainOverview | null,
		IAdapterChainMetrics | null
	] = await Promise.all([
		getAdapterChainOverview({
			adapterType,
			chain,
			...(dataType !== undefined ? { dataType } : {}),
			excludeTotalDataChart: adapterType === 'fees' && !showFeesChart
		}),
		fetchProtocols().catch(() => ({ protocols: [], parentProtocols: [] })),
		hasOpenInterest
			? getAdapterChainOverview({
					adapterType: 'open-interest',
					chain,
					dataType: 'openInterestAtEnd',
					excludeTotalDataChart: false
				}).catch(() => null)
			: Promise.resolve(null),
		adapterType === 'normalized-volume'
			? getAdapterChainOverview({
					adapterType: 'normalized-volume',
					chain,
					dataType: 'dailyActiveLiquidity',
					excludeTotalDataChart: false
				}).catch(() => null)
			: Promise.resolve(null),
		adapterType === 'derivatives'
			? fetchAdapterChainMetrics({
					adapterType: 'normalized-volume',
					chain
				}).catch(() => null)
			: Promise.resolve(null)
	])

	const readModel = buildAdapterByChainReadModel({
		data,
		protocolsData,
		openInterestData,
		activeLiquidityData,
		normalizedVolumeData,
		adapterType,
		dataType,
		rankBy,
		cantonIncentivesWarning,
		tokenSources: await tokenSources
	})

	const chartData = buildAdapterByChainChartDataset({
		adapterType,
		metricName,
		primaryChartData: data.totalDataChart ?? [],
		openInterestChartData: openInterestData?.totalDataChart ?? [],
		activeLiquidityChartData: activeLiquidityData?.totalDataChart ?? []
	})
	const metadataCache = chain === 'All' ? null : await import('~/utils/metadata').then((m) => m.default)

	return {
		chain,
		...(chain !== 'All' && metadataCache && isDeprecatedChain(metadataCache.chainMetadata, chain)
			? { deprecated: true }
			: {}),
		chains: [
			{ label: 'All', to: `/${route}` },
			...data.allChains.map((chainName) => ({ label: chainName, to: `/${route}/chain/${slug(chainName)}` }))
		],
		protocols: readModel.protocols,
		categories: readModel.categories,
		adapterType,
		chartData,
		dataType: dataType ?? null,
		total24h: data.total24h ?? null,
		total7d: data.total7d ?? null,
		total30d: data.total30d ?? null,
		change_1d: data.change_1d ?? null,
		change_7d: data.change_7d ?? null,
		change_1m: data.change_1m ?? null,
		change_7dover7d: data.change_7dover7d ?? null,
		openInterest: readModel.openInterest,
		activeLiquidity: readModel.activeLiquidity
	}
}

// only returns fees paid by users when using the chain (gas ?), not the fees paid by users when using the protocols on chain
export const getChainsByChainNativeFeeRevenuePageData = async ({
	adapterType,
	dataType,
	chainMetadata
}: {
	adapterType: `${ADAPTER_TYPES}`
	dataType: ChainNativeFeeRevenueRankingDataType
	chainMetadata: Record<string, IChainMetadata>
}): Promise<IChainsByAdapterPageData> => {
	try {
		const allChainsSet = new Set<string>()
		const deprecatedChains = getDeprecatedChainNames(chainMetadata)
		const metric = getChainNativeFeeRevenueRankingMetric(dataType)

		for (const chainId in chainMetadata) {
			const currentChainMetadata = chainMetadata[chainId]
			if (currentChainMetadata === undefined) continue
			if (!currentChainMetadata[metric.metadataFlag]) continue
			allChainsSet.add(currentChainMetadata.name)
		}

		const chainsData = await fetchAdapterChainMetrics({
			adapterType,
			dataType,
			chain: 'All'
		}).then((res) => res.protocols.filter((p) => p.protocolType === 'chain' && allChainsSet.has(p.name)))

		const chains = chainsData
			.map((c) => {
				const warning =
					c.name === 'Canton' &&
					(dataType === ADAPTER_DATA_TYPES.DAILY_FEES || dataType === ADAPTER_DATA_TYPES.DAILY_REVENUE)
						? CANTON_INCENTIVES_WARNING
						: null
				return {
					name: c.name,
					logo: chainIconUrl(c.name),
					total24h: c.total24h ?? null,
					total7d: c.total7d ?? null,
					total30d: c.total30d ?? null,
					...(deprecatedChains[c.name] ? { deprecated: true } : {}),
					...(warning ? { warning } : {})
				}
			})
			.sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
		const allChains = chains.map((c) => c.name)

		return {
			adapterType,
			dataType: dataType ?? null,
			chartData: { dimensions: ['timestamp'], source: [] },
			chains,
			allChains
		}
	} catch (error) {
		recordRuntimeError(error, 'pageBuild', { event: 'chainsByFeesAdapter', adapterType, dataType })
		throw error
	}
}

// returns combined metrics of all protocols by chain
export const getChainsByAdapterPageData = async ({
	adapterType,
	dataType,
	chainMetadata,
	includeChartData = true
}: {
	adapterType: `${ADAPTER_TYPES}`
	dataType: `${ADAPTER_DATA_TYPES}`
	chainMetadata: Record<string, IChainMetadata>
	includeChartData?: boolean
}): Promise<IChainsByAdapterPageData> => {
	try {
		const allChains = getChainsByAdapterAllChains({ adapterType, dataType, chainMetadata })
		const deprecatedChains = getDeprecatedChainNames(chainMetadata)

		const getOptionalOverview = async ({
			enabled,
			adapterType: overviewAdapterType,
			dataType: overviewDataType
		}: {
			enabled: boolean
			adapterType: `${ADAPTER_TYPES}`
			dataType: `${ADAPTER_DATA_TYPES}`
		}): Promise<ChainPeriodMetricsByName | null> => {
			if (!enabled) return null
			try {
				return getDimensionAdapterOverviewOfAllChains({
					adapterType: overviewAdapterType,
					dataType: overviewDataType,
					chainMetadata
				})
			} catch {
				return null
			}
		}

		const [chainsData, chartData, openInterestData, activeLiquidityData] = await Promise.all([
			getDimensionAdapterOverviewOfAllChains({
				adapterType,
				dataType,
				chainMetadata
			}),
			includeChartData
				? getChainsByAdapterChartData({ adapterType, dataType, allChains, allowEmptyOnError: true })
				: Promise.resolve<MultiSeriesTimeSeriesDataset>({ dimensions: ['timestamp'], source: [] }),
			getOptionalOverview({
				enabled: adapterType === 'derivatives',
				adapterType: 'open-interest',
				dataType: 'openInterestAtEnd'
			}),
			getOptionalOverview({
				enabled: adapterType === 'normalized-volume',
				adapterType: 'normalized-volume',
				dataType: 'dailyActiveLiquidity'
			})
		])

		const chains: IChainsByAdapterPageData['chains'] = []
		for (const chain of allChains) {
			const warning =
				chain === 'Canton' &&
				(dataType === ADAPTER_DATA_TYPES.DAILY_FEES || dataType === ADAPTER_DATA_TYPES.DAILY_REVENUE)
					? CANTON_INCENTIVES_WARNING
					: null
			const chainMetrics = chainsData?.[chain]
			const openInterest = openInterestData?.[chain]?.['24h'] ?? null
			const activeLiquidity = activeLiquidityData?.[chain]?.['24h'] ?? null

			chains.push({
				name: chain,
				logo: chainIconUrl(chain),
				total24h: chainMetrics?.['24h'] ?? null,
				total7d: chainMetrics?.['7d'] ?? null,
				total30d: chainMetrics?.['30d'] ?? null,
				...(deprecatedChains[chain] ? { deprecated: true } : {}),
				...(warning ? { warning } : {}),
				...(openInterest != null ? { openInterest } : {}),
				...(activeLiquidity != null ? { activeLiquidity } : {})
			})
		}

		chains.sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
		const sortedAllChains: Array<string> = []
		for (const chain of chains) {
			sortedAllChains.push(chain.name)
		}

		return {
			adapterType,
			dataType: dataType ?? null,
			chartData,
			chains,
			allChains: sortedAllChains
		}
	} catch (error) {
		recordRuntimeError(error, 'pageBuild', { event: 'chainsByAdapter', adapterType, dataType })
		throw error
	}
}

export const getChainsByREVPageData = async ({
	chainMetadata
}: {
	chainMetadata: Record<string, IChainMetadata>
}): Promise<IChainsByREVPageData> => {
	try {
		const allChains: Array<string> = []

		for (const chain in chainMetadata) {
			const currentChainMetadata = chainMetadata[chain]
			if (currentChainMetadata === undefined) continue
			if (currentChainMetadata[feeRevenueMetrics.rev.metadataFlag]) {
				allChains.push(chain)
			}
		}

		const protocolsByChain = await Promise.all(
			allChains.map(async (chain) => ({
				chain,
				protocols: await fetchAdapterChainMetrics({ adapterType: 'fees', chain }).catch(() => null)
			}))
		)

		const chainFeesData = await fetchAdapterChainMetrics({
			adapterType: 'fees',
			chain: 'All'
		})

		const chains: IChainsByREVPageData['chains'] = []
		for (const { chain, protocols } of protocolsByChain) {
			const currentChainMetadata = chainMetadata[chain]
			if (currentChainMetadata === undefined) continue
			const chainFees = chainFeesData.protocols.find((p) => p.slug === chain)
			const chainRevProtocols = new Set(REV_PROTOCOLS[chain] ?? [])
			let revProtocols24h = 0
			let revProtocols30d = 0
			for (const curr of protocols?.protocols ?? []) {
				if (!chainRevProtocols.has(curr.slug)) continue
				revProtocols24h += curr.total24h ?? 0
				revProtocols30d += curr.total30d ?? 0
			}

			chains.push({
				name: currentChainMetadata.name,
				slug: chain,
				logo: chainIconUrl(chain),
				total24h: (chainFees?.total24h ?? 0) + revProtocols24h,
				total30d: (chainFees?.total30d ?? 0) + revProtocols30d,
				...(currentChainMetadata.deprecated ? { deprecated: true } : {})
			})
		}

		return { chains: chains.sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0)) }
	} catch (error) {
		recordRuntimeError(error, 'pageBuild', { event: 'chainsByREV' })
		throw error
	}
}

export function getDimensionAdapterOverviewOfAllChains({
	adapterType,
	dataType,
	chainMetadata
}: {
	adapterType: `${ADAPTER_TYPES}`
	dataType: `${ADAPTER_DATA_TYPES}`
	chainMetadata: Record<string, IChainMetadata>
}): ChainPeriodMetricsByName {
	try {
		const chains: ChainPeriodMetricsByName = {}
		const metadataKey = getChainMetadataKey(adapterType, dataType)
		const dataKey = ADAPTER_DATA_TYPE_KEYS[dataType]
		if (!metadataKey || !dataKey) return chains
		for (const chainId in chainMetadata) {
			const currentChainMetadata = chainMetadata[chainId]
			if (currentChainMetadata === undefined) continue
			if (!currentChainMetadata[metadataKey]) continue
			const value = currentChainMetadata.dimAgg?.[adapterType]?.[dataKey]
			if (!value) continue
			chains[currentChainMetadata.name] = value
		}

		return chains
	} catch (error) {
		recordRuntimeError(error, 'pageBuild', { event: 'dimensionAdapterOverviewOfAllChains', adapterType, dataType })
		throw error
	}
}
