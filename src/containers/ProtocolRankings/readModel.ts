import type { IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import type { IChildProtocol, ProtocolRankingActivityMetric } from './types'

type DimensionFees = Omit<NonNullable<IChildProtocol['fees']>, 'pf'>
type DimensionRevenue = Omit<NonNullable<IChildProtocol['revenue']>, 'ps'>
// Upstream activity SOURCES (includes 'dexs'). Deliberately distinct from
// sortAccessors' ProtocolRankingActivityMetricKey, which lists the activity
// METRIC COLUMNS the table exposes (no 'dexs' - DEX volume has its own path).
export type ProtocolRankingActivitySourceKey =
	| 'dexs'
	| 'perps'
	| 'normalizedVolume'
	| 'activeLiquidity'
	| 'openInterest'
	| 'optionsPremiumVolume'
	| 'optionsNotionalVolume'
	| 'dexAggregators'
	| 'perpsAggregators'
	| 'bridgeAggregators'

export interface IProtocolRankingsDimensionMetrics {
	fees?: DimensionFees
	revenue?: DimensionRevenue
	holdersRevenue?: NonNullable<IChildProtocol['holdersRevenue']>
	dexs?: ProtocolRankingActivityMetric
	perps?: ProtocolRankingActivityMetric
	normalizedVolume?: ProtocolRankingActivityMetric
	activeLiquidity?: ProtocolRankingActivityMetric
	openInterest?: ProtocolRankingActivityMetric
	optionsPremiumVolume?: ProtocolRankingActivityMetric
	optionsNotionalVolume?: ProtocolRankingActivityMetric
	dexAggregators?: ProtocolRankingActivityMetric
	perpsAggregators?: ProtocolRankingActivityMetric
	bridgeAggregators?: ProtocolRankingActivityMetric
}

export type ProtocolRankingActivitySources = Partial<
	Record<ProtocolRankingActivitySourceKey, IAdapterChainMetrics | null>
>

export function getProtocolEarningsValue(
	revenue: number | null | undefined,
	emissions: number | null | undefined
): number | null {
	return revenue != null && emissions != null ? revenue - emissions : null
}

export function buildDimensionProtocolMetrics({
	fees,
	revenue,
	holdersRevenue,
	activity
}: {
	fees: IAdapterChainMetrics | null
	revenue: IAdapterChainMetrics | null
	holdersRevenue: IAdapterChainMetrics | null
	activity: ProtocolRankingActivitySources
}) {
	const dimensionProtocols: Record<string, IProtocolRankingsDimensionMetrics> = {}
	const reportedPerpVolume24hByProtocol = new Map<string, number | null>()
	for (const protocol of activity.perps?.protocols ?? []) {
		reportedPerpVolume24hByProtocol.set(protocol.defillamaId, protocol.total24h ?? null)
	}

	for (const protocol of fees?.protocols ?? []) {
		const row = (dimensionProtocols[protocol.defillamaId] ??= {})
		row.fees = {
			total24h: protocol.total24h ?? 0,
			total7d: protocol.total7d ?? 0,
			total30d: protocol.total30d ?? 0,
			total1y: protocol.total1y ?? 0,
			annualized1y: protocol.annualized1y ?? null,
			monthlyAverage1y: protocol.monthlyAverage1y ?? 0,
			totalAllTime: protocol.totalAllTime ?? 0
		}
	}

	for (const protocol of revenue?.protocols ?? []) {
		const row = (dimensionProtocols[protocol.defillamaId] ??= {})
		row.revenue = {
			total24h: protocol.total24h ?? 0,
			total7d: protocol.total7d ?? 0,
			total30d: protocol.total30d ?? 0,
			total1y: protocol.total1y ?? 0,
			annualized1y: protocol.annualized1y ?? null,
			monthlyAverage1y: protocol.monthlyAverage1y ?? 0,
			totalAllTime: protocol.totalAllTime ?? 0
		}
	}

	for (const protocol of holdersRevenue?.protocols ?? []) {
		const row = (dimensionProtocols[protocol.defillamaId] ??= {})
		row.holdersRevenue = {
			total24h: protocol.total24h ?? 0,
			total7d: protocol.total7d ?? 0,
			total30d: protocol.total30d ?? 0,
			total1y: protocol.total1y ?? 0,
			monthlyAverage1y: protocol.monthlyAverage1y ?? 0,
			totalAllTime: protocol.totalAllTime ?? 0
		}
	}

	for (const metricKey of Object.keys(activity) as Array<ProtocolRankingActivitySourceKey>) {
		for (const protocol of activity[metricKey]?.protocols ?? []) {
			const row = (dimensionProtocols[protocol.defillamaId] ??= {})
			const preserveLegacyDexZeros = metricKey === 'dexs'
			const reportedPerpVolume24h = reportedPerpVolume24hByProtocol.get(protocol.defillamaId)
			const total24h =
				metricKey === 'normalizedVolume'
					? protocol.total24h != null && reportedPerpVolume24h != null
						? Math.min(protocol.total24h, reportedPerpVolume24h)
						: null
					: preserveLegacyDexZeros
						? (protocol.total24h ?? 0)
						: (protocol.total24h ?? null)
			row[metricKey] = {
				total24h,
				total7d: preserveLegacyDexZeros ? (protocol.total7d ?? 0) : (protocol.total7d ?? null),
				total30d: preserveLegacyDexZeros ? (protocol.total30d ?? 0) : (protocol.total30d ?? null),
				change_7dover7d: protocol.change_7dover7d ?? null,
				totalAllTime: preserveLegacyDexZeros ? (protocol.totalAllTime ?? 0) : (protocol.totalAllTime ?? null)
			}
		}
	}

	return dimensionProtocols
}
