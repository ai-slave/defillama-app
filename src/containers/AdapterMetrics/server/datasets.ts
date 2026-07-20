import { fetchAdapterChainMetrics } from '~/containers/AdapterMetrics/api'
import type { IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { mergeMetricPeriods, type MetricPeriodFields } from '~/containers/AdapterMetrics/metricPeriods'
import { getAdapterByChainPageData, getAdapterChainOverview } from '~/containers/AdapterMetrics/queries'
import type { IAdapterByChainPageData } from '~/containers/AdapterMetrics/types'
import { slug } from '~/utils'
import type { IChainMetadata } from '~/utils/metadata/types'

type DimensionDatasetSourceProtocol =
	| IAdapterChainMetrics['protocols'][number]
	| IAdapterByChainPageData['protocols'][number]

export interface DimensionDatasetProtocol extends MetricPeriodFields {
	name: string
	displayName?: string
	defillamaId?: string
	category?: string | null
	logo?: string
	slug?: string
	chains: string[]
	chainBreakdown?: Record<string, DimensionDatasetProtocol & { chain: string }>
}

function toDimensionDatasetProtocol(protocol: DimensionDatasetSourceProtocol): DimensionDatasetProtocol {
	return {
		...protocol,
		name: protocol.name,
		displayName: 'displayName' in protocol ? protocol.displayName : protocol.name,
		defillamaId: 'defillamaId' in protocol ? protocol.defillamaId : undefined,
		chains: protocol.chains ?? []
	}
}

interface DimensionDatasetOptions {
	adapterType: `${ADAPTER_TYPES}`
	route: string
	metricName: string
	chains?: string[]
	dataType?: `${ADAPTER_DATA_TYPES}` | 'dailyEarnings'
	allCaseFetcher?: 'chainMetrics' | 'chainOverview'
	chainGuard?: keyof IChainMetadata
	hasOpenInterestByChain?: boolean
	withChainBreakdown?: boolean
}

export async function fetchDimensionDataset({
	adapterType,
	route,
	metricName,
	chains,
	dataType,
	allCaseFetcher = 'chainMetrics',
	chainGuard,
	hasOpenInterestByChain,
	withChainBreakdown
}: DimensionDatasetOptions): Promise<DimensionDatasetProtocol[]> {
	const chainList = chains ?? []
	const allChains = chainList.length === 0 || chainList.includes('All')

	if (allChains) {
		const data =
			allCaseFetcher === 'chainOverview'
				? await getAdapterChainOverview({ adapterType, chain: 'All', excludeTotalDataChart: true, dataType })
				: await fetchAdapterChainMetrics({ adapterType, dataType, chain: 'All' })
		return (data.protocols ?? [])
			.map(toDimensionDatasetProtocol)
			.filter((protocol) => (protocol.total24h ?? 0) > 0)
			.sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
	}

	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	const allProtocolsMap = new Map<string, DimensionDatasetProtocol>()

	for (const chainName of chainList) {
		const chainSlug = slug(chainName)
		const chainData = metadataCache.chainMetadata[chainSlug]
		if (!chainData) continue
		if (chainGuard && !chainData[chainGuard]) continue

		const data = await getAdapterByChainPageData({
			adapterType,
			dataType,
			chain: chainData.name,
			route,
			metricName,
			...(hasOpenInterestByChain ? { hasOpenInterest: chainData.openInterest } : {})
		}).catch((e) => {
			console.info(`Chain page data not found ${adapterType} : chain:${chainName}`, e)
			return null
		})

		if (!data?.protocols) continue

		for (const sourceProtocol of data.protocols) {
			const protocol = toDimensionDatasetProtocol(sourceProtocol)
			const key = protocol.defillamaId ?? protocol.slug ?? protocol.name
			const existing = allProtocolsMap.get(key)
			if (existing) {
				mergeMetricPeriods(existing, protocol)
				existing.chains = Array.from(new Set([...existing.chains, chainName]))
				if (withChainBreakdown) {
					const normalizedChainKey = chainName.trim().toLowerCase()
					existing.chainBreakdown ??= {}
					existing.chainBreakdown[normalizedChainKey] = {
						...protocol,
						change_7d: protocol.change_7d ?? protocol.change_7dover7d,
						chain: chainName
					}
				}
			} else {
				const entry: DimensionDatasetProtocol = {
					...protocol,
					chains: [chainName]
				}
				if (withChainBreakdown) {
					const normalizedChainKey = chainName.trim().toLowerCase()
					entry.chainBreakdown = {
						[normalizedChainKey]: {
							...protocol,
							change_7d: protocol.change_7d ?? protocol.change_7dover7d,
							chain: chainName
						}
					}
				}
				allProtocolsMap.set(key, entry)
			}
		}
	}

	return Array.from(allProtocolsMap.values())
		.filter((protocol) => (protocol.total24h ?? 0) > 0)
		.sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
}

export interface DimensionDatasetSpec {
	datasetType: string
	options: Omit<DimensionDatasetOptions, 'chains'>
}

export const DIMENSION_DATASET_SPECS = [
	{
		datasetType: 'dexs',
		options: { adapterType: ADAPTER_TYPES.DEXS, route: 'dexs', metricName: 'DEX Volume' }
	},
	{
		datasetType: 'perps',
		options: {
			adapterType: ADAPTER_TYPES.PERPS,
			route: 'perps',
			metricName: 'Perp Volume',
			hasOpenInterestByChain: true
		}
	},
	{
		datasetType: 'aggregators',
		options: {
			adapterType: ADAPTER_TYPES.AGGREGATORS,
			route: 'dex-aggregators',
			metricName: 'DEX Aggregator Volume',
			withChainBreakdown: true
		}
	},
	{
		datasetType: 'fees',
		options: { adapterType: ADAPTER_TYPES.FEES, route: 'fees', metricName: 'Fees' }
	},
	{
		datasetType: 'revenue',
		options: {
			adapterType: ADAPTER_TYPES.FEES,
			route: 'revenue',
			metricName: 'Revenue',
			dataType: ADAPTER_DATA_TYPES.DAILY_REVENUE
		}
	},
	{
		datasetType: 'earnings',
		options: {
			adapterType: ADAPTER_TYPES.FEES,
			route: 'earnings',
			metricName: 'Earnings',
			dataType: ADAPTER_DATA_TYPES.DAILY_EARNINGS,
			allCaseFetcher: 'chainOverview',
			chainGuard: 'fees',
			withChainBreakdown: true
		}
	},
	{
		datasetType: 'holders-revenue',
		options: {
			adapterType: ADAPTER_TYPES.FEES,
			route: 'holders-revenue',
			metricName: 'Holders Revenue',
			dataType: ADAPTER_DATA_TYPES.DAILY_HOLDERS_REVENUE,
			chainGuard: 'fees'
		}
	},
	{
		datasetType: 'options',
		options: {
			adapterType: ADAPTER_TYPES.OPTIONS,
			route: 'options',
			metricName: 'Options Volume',
			withChainBreakdown: true
		}
	},
	{
		datasetType: 'bridge-aggregators',
		options: {
			adapterType: ADAPTER_TYPES.BRIDGE_AGGREGATORS,
			route: 'bridge-aggregators',
			metricName: 'Bridge Aggregator Volume',
			withChainBreakdown: true
		}
	}
] as const satisfies readonly DimensionDatasetSpec[]

export const DIMENSION_DATASET_SPEC_BY_TYPE: Record<string, DimensionDatasetSpec> = Object.fromEntries(
	DIMENSION_DATASET_SPECS.map((spec) => [spec.datasetType, spec])
)
