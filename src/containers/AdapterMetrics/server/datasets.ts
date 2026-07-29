import { fetchAdapterChainMetrics } from '~/containers/AdapterMetrics/api'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { mergeMetricPeriods, type MetricPeriodFields } from '~/containers/AdapterMetrics/metricPeriods'
import { getAdapterByChainPageData, getAdapterChainOverview } from '~/containers/AdapterMetrics/queries'
import type { IAdapterByChainPageData, IAdapterChainOverview } from '~/containers/AdapterMetrics/types'
import { slug } from '~/utils'
import type { IChainMetadata } from '~/utils/metadata/types'

type DimensionDatasetSourceProtocol =
	| IAdapterChainOverview['protocols'][number]
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

export type DimensionDatasetResult<T = DimensionDatasetProtocol> =
	| { status: 'complete'; protocols: T[] }
	| { status: 'partial'; protocols: T[]; unavailableChains: string[] }

type DimensionDatasetChainProtocol = DimensionDatasetProtocol & { chain: string }

function toDimensionDatasetProtocol(protocol: DimensionDatasetSourceProtocol): DimensionDatasetProtocol {
	const displayName = 'displayName' in protocol ? protocol.displayName : protocol.name
	const defillamaId = 'defillamaId' in protocol ? protocol.defillamaId : undefined
	return {
		...protocol,
		name: protocol.name,
		displayName,
		...(defillamaId !== undefined ? { defillamaId } : {}),
		chains: protocol.chains ?? []
	}
}

function toChainBreakdownProtocol(protocol: DimensionDatasetProtocol, chain: string): DimensionDatasetChainProtocol {
	const change7d = protocol.change_7d ?? protocol.change_7dover7d
	return {
		...protocol,
		...(change7d !== undefined ? { change_7d: change7d } : {}),
		chain
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
}: DimensionDatasetOptions): Promise<DimensionDatasetResult> {
	const chainList = chains ?? []
	const allChains = chainList.length === 0 || chainList.includes('All')

	if (allChains) {
		const data =
			allCaseFetcher === 'chainOverview'
				? await getAdapterChainOverview({
						adapterType,
						chain: 'All',
						excludeTotalDataChart: true,
						...(dataType !== undefined ? { dataType } : {})
					})
				: await fetchAdapterChainMetrics({
						adapterType,
						chain: 'All',
						...(dataType !== undefined ? { dataType } : {})
					})
		const protocols: DimensionDatasetProtocol[] = []
		for (const protocol of data.protocols) protocols.push(toDimensionDatasetProtocol(protocol))
		return {
			status: 'complete',
			protocols: protocols
				.filter((protocol) => (protocol.total24h ?? 0) > 0)
				.sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
		}
	}

	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	const allProtocolsMap = new Map<string, DimensionDatasetProtocol>()
	const unavailableChains: string[] = []

	for (const chainName of chainList) {
		const chainSlug = slug(chainName)
		const chainData = metadataCache.chainMetadata[chainSlug]
		if (!chainData) continue
		if (chainGuard && !chainData[chainGuard]) continue

		let data: IAdapterByChainPageData | null
		try {
			data = await getAdapterByChainPageData({
				adapterType,
				chain: chainData.name,
				route,
				metricName,
				...(dataType !== undefined ? { dataType } : {}),
				...(hasOpenInterestByChain && chainData.openInterest !== undefined
					? { hasOpenInterest: chainData.openInterest }
					: {})
			})
		} catch (error) {
			console.info(`Chain page data not found ${adapterType} : chain:${chainName}`, error)
			unavailableChains.push(chainData.name)
			continue
		}

		if (!data) {
			unavailableChains.push(chainData.name)
			continue
		}

		for (const sourceProtocol of data.protocols) {
			const protocol = toDimensionDatasetProtocol(sourceProtocol)
			const key = protocol.defillamaId ?? protocol.slug ?? protocol.name
			const existing = allProtocolsMap.get(key)
			let aggregate: DimensionDatasetProtocol
			if (existing) {
				mergeMetricPeriods(existing, protocol)
				if (!existing.chains.includes(chainName)) existing.chains.push(chainName)
				aggregate = existing
			} else {
				aggregate = {
					...protocol,
					chains: [chainName]
				}
				allProtocolsMap.set(key, aggregate)
			}

			if (withChainBreakdown) {
				const chainBreakdown = aggregate.chainBreakdown ?? (aggregate.chainBreakdown = {})
				chainBreakdown[chainName.trim().toLowerCase()] = toChainBreakdownProtocol(protocol, chainName)
			}
		}
	}

	const protocols: DimensionDatasetProtocol[] = []
	for (const protocol of allProtocolsMap.values()) protocols.push(protocol)

	const sortedProtocols = protocols
		.filter((protocol) => (protocol.total24h ?? 0) > 0)
		.sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))

	return unavailableChains.length > 0
		? { status: 'partial', protocols: sortedProtocols, unavailableChains }
		: { status: 'complete', protocols: sortedProtocols }
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
