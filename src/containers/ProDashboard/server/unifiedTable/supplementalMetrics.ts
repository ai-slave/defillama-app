import type { DimensionDatasetProtocol, DimensionDatasetResult } from '~/containers/AdapterMetrics/datasetTypes'
import {
	createDimensionDatasetRequestScope,
	fetchDimensionDataset,
	getDimensionDatasetSpec,
	type DimensionDatasetRequestScope
} from '~/containers/AdapterMetrics/server/datasets'
import type {
	ParentProtocolMetrics,
	ProtocolTableMetrics,
	ProtocolTableSourceRow
} from '~/containers/ProDashboard/unifiedTable/contracts'
import type { ProtocolSupplementalMetric } from '~/containers/ProDashboard/unifiedTable/protocolCapabilities'
import { slug } from '~/utils'
import { toInternalSlug } from '~/utils/chainNormalizer'

export type ProtocolSupplementalMetricResult = {
	earnings?: DimensionDatasetResult
	bridgeAggregatorVolume?: DimensionDatasetResult
}

export type ProtocolSupplementalScope = { kind: 'protocol' } | { kind: 'chain'; chains: string[] }

export async function fetchProtocolSupplementalMetrics(
	metrics: ProtocolSupplementalMetric[],
	scope: ProtocolSupplementalScope,
	requestScope?: DimensionDatasetRequestScope
): Promise<ProtocolSupplementalMetricResult> {
	if (metrics.length === 0) return {}
	const sharedRequestScope = requestScope ?? createDimensionDatasetRequestScope()
	const requests = metrics.map(async (metric): Promise<[ProtocolSupplementalMetric, DimensionDatasetResult]> => {
		const datasetType = metric === 'earnings' ? 'earnings' : 'bridge-aggregators'
		const spec = getDimensionDatasetSpec(datasetType)
		const dataset = await fetchDimensionDataset(
			{
				...spec.options,
				withChainBreakdown: scope.kind === 'chain',
				...(scope.kind === 'chain' ? { chains: scope.chains } : {})
			},
			sharedRequestScope
		)
		return [metric, dataset]
	})

	const result: ProtocolSupplementalMetricResult = {}
	for (const [metric, dataset] of await Promise.all(requests)) {
		if (metric === 'earnings') result.earnings = dataset
		else result.bridgeAggregatorVolume = dataset
	}
	return result
}

const toDatasetKey = (protocol: DimensionDatasetProtocol): string => slug(protocol.slug ?? protocol.name)

function earningsMetrics(protocol: DimensionDatasetProtocol): ProtocolTableMetrics {
	return {
		earnings24h: protocol.total24h ?? null,
		earnings7d: protocol.total7d ?? null,
		earnings30d: protocol.total30d ?? null,
		earnings1y: protocol.total1y ?? null
	}
}

function bridgeAggregatorMetrics(protocol: DimensionDatasetProtocol, total24h: number): ProtocolTableMetrics {
	const volume24h = protocol.total24h ?? null
	return {
		bridgeAggregatorVolume24h: volume24h,
		bridgeAggregatorVolume7d: protocol.total7d ?? null,
		bridgeAggregatorVolume30d: protocol.total30d ?? null,
		bridgeAggregatorVolumeChange1d: protocol.change_1d ?? null,
		bridgeAggregatorVolume24h7dAgo: protocol.total7DaysAgo ?? null,
		bridgeAggregatorVolume24hChange7dAgo: protocol.change_7d ?? null,
		bridgeAggregatorVolumeDominance24h:
			volume24h != null && volume24h > 0 && total24h > 0 ? (volume24h / total24h) * 100 : null
	}
}

const UNAVAILABLE_EARNINGS_METRICS = {
	earnings24h: null,
	earnings7d: null,
	earnings30d: null,
	earnings1y: null
} satisfies ProtocolTableMetrics

const UNAVAILABLE_BRIDGE_AGGREGATOR_METRICS = {
	bridgeAggregatorVolume24h: null,
	bridgeAggregatorVolume7d: null,
	bridgeAggregatorVolume30d: null,
	bridgeAggregatorVolumeChange1d: null,
	bridgeAggregatorVolume24h7dAgo: null,
	bridgeAggregatorVolume24hChange7dAgo: null,
	bridgeAggregatorVolumeDominance24h: null
} satisfies ProtocolTableMetrics

export function applyProtocolSupplementalMetrics(
	rows: ProtocolTableSourceRow[],
	parentMetrics: Record<string, ParentProtocolMetrics>,
	supplements: ProtocolSupplementalMetricResult,
	relationRows: ProtocolTableSourceRow[] = rows
): { rows: ProtocolTableSourceRow[]; parentMetrics: Record<string, ParentProtocolMetrics> } {
	if (!supplements.earnings && !supplements.bridgeAggregatorVolume) return { rows, parentMetrics }

	const childrenByParent = new Map<string, Set<string>>()
	const childrenByParentChain = new Map<string, Map<string, Set<string>>>()
	for (const row of relationRows) {
		if (!row.parentProtocolId) continue
		const children = childrenByParent.get(row.parentProtocolId) ?? new Set<string>()
		children.add(row.protocolId)
		childrenByParent.set(row.parentProtocolId, children)
		if (row.chain) {
			const chainSlug = toInternalSlug(row.chain)
			const childrenByChain = childrenByParentChain.get(row.parentProtocolId) ?? new Map<string, Set<string>>()
			const chainChildren = childrenByChain.get(chainSlug) ?? new Set<string>()
			chainChildren.add(row.protocolId)
			childrenByChain.set(chainSlug, chainChildren)
			childrenByParentChain.set(row.parentProtocolId, childrenByChain)
		}
	}

	const metricsByProtocol = new Map<string, ProtocolTableMetrics>()
	const metricsByProtocolChain = new Map<string, ProtocolTableMetrics>()
	const nextParentMetrics: Record<string, ParentProtocolMetrics> = { ...parentMetrics }
	const applyDataset = (
		dataset: DimensionDatasetResult | undefined,
		source: 'earnings' | 'bridgeAggregatorVolume'
	): void => {
		if (!dataset) return
		const complete = dataset.status === 'complete'
		let total24h = 0
		const totals24hByChain = new Map<string, number>()
		if (source === 'bridgeAggregatorVolume') {
			for (const protocol of dataset.protocols) {
				total24h += Math.max(protocol.total24h ?? 0, 0)
				const chainBreakdown = protocol.chainBreakdown
				if (!chainBreakdown) continue
				for (const chainSlug in chainBreakdown) {
					const chainProtocol = chainBreakdown[chainSlug]
					if (!chainProtocol) continue
					const canonicalChainSlug = toInternalSlug(chainSlug)
					totals24hByChain.set(
						canonicalChainSlug,
						(totals24hByChain.get(canonicalChainSlug) ?? 0) + Math.max(chainProtocol.total24h ?? 0, 0)
					)
				}
			}
		}
		for (const protocol of dataset.protocols) {
			const protocolId = toDatasetKey(protocol)
			const metrics = source === 'earnings' ? earningsMetrics(protocol) : bridgeAggregatorMetrics(protocol, total24h)
			const metricsByChain: Record<string, ProtocolTableMetrics> = {}
			const chainBreakdown = protocol.chainBreakdown
			if (chainBreakdown) {
				for (const chainName in chainBreakdown) {
					const chainProtocol = chainBreakdown[chainName]
					if (!chainProtocol) continue
					const chainSlug = toInternalSlug(chainName)
					metricsByChain[chainSlug] =
						source === 'earnings'
							? earningsMetrics(chainProtocol)
							: bridgeAggregatorMetrics(chainProtocol, totals24hByChain.get(chainSlug) ?? 0)
				}
			}
			const parent = nextParentMetrics[protocolId]
			const childIds = childrenByParent.get(protocolId)
			if (parent && childIds) {
				const childProtocolIdsByChain: Record<string, string[]> = {}
				for (const [chainSlug, chainChildren] of childrenByParentChain.get(protocolId) ?? []) {
					childProtocolIdsByChain[chainSlug] = Array.from(chainChildren)
				}
				nextParentMetrics[protocolId] = {
					...parent,
					supplements: {
						...parent.supplements,
						[source]: {
							childProtocolIds: Array.from(childIds),
							childProtocolIdsByChain,
							metrics: complete
								? metrics
								: source === 'earnings'
									? UNAVAILABLE_EARNINGS_METRICS
									: UNAVAILABLE_BRIDGE_AGGREGATOR_METRICS,
							metricsByChain
						}
					}
				}
				continue
			}
			if (complete) metricsByProtocol.set(protocolId, { ...metricsByProtocol.get(protocolId), ...metrics })
			for (const chainSlug in metricsByChain) {
				const chainMetrics = metricsByChain[chainSlug]
				if (!chainMetrics) continue
				const key = `${protocolId}:${chainSlug}`
				metricsByProtocolChain.set(key, { ...metricsByProtocolChain.get(key), ...chainMetrics })
			}
		}
	}

	applyDataset(supplements.earnings, 'earnings')
	applyDataset(supplements.bridgeAggregatorVolume, 'bridgeAggregatorVolume')

	return {
		rows: rows.map((row) => {
			const metrics = row.chain
				? metricsByProtocolChain.get(`${row.protocolId}:${toInternalSlug(row.chain)}`)
				: metricsByProtocol.get(row.protocolId)
			if (!metrics) return row
			return { ...row, metrics: { ...row.metrics, ...metrics } }
		}),
		parentMetrics: nextParentMetrics
	}
}
