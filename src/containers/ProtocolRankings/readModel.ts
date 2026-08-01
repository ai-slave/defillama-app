import type { IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import type { IAdapterChainOverview } from '~/containers/AdapterMetrics/types'
import type { IChildProtocol } from './types'

type DimensionFees = Omit<NonNullable<IChildProtocol['fees']>, 'pf'>
type DimensionRevenue = Omit<NonNullable<IChildProtocol['revenue']>, 'ps'>

export interface IProtocolRankingsDimensionMetrics {
	fees?: DimensionFees
	revenue?: DimensionRevenue
	holdersRevenue?: NonNullable<IChildProtocol['holdersRevenue']>
	dexs?: NonNullable<IChildProtocol['dexs']>
}

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
	dexs
}: {
	fees: IAdapterChainMetrics | null
	revenue: IAdapterChainMetrics | null
	holdersRevenue: IAdapterChainMetrics | null
	dexs: IAdapterChainOverview | null
}) {
	const dimensionProtocols: Record<string, IProtocolRankingsDimensionMetrics> = {}

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

	for (const protocol of dexs?.protocols ?? []) {
		const row = (dimensionProtocols[protocol.defillamaId] ??= {})
		row.dexs = {
			total24h: protocol.total24h ?? 0,
			total7d: protocol.total7d ?? 0,
			change_7dover7d: protocol.change_7dover7d ?? null,
			totalAllTime: protocol.totalAllTime ?? 0
		}
	}

	return dimensionProtocols
}
