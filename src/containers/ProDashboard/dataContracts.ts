import type { ChartSeries } from '~/utils/breakdowns'
import type { IChainMetadata, IProtocolMetadata } from '~/utils/metadata/types'

export interface ProDashboardAppMetadata {
	protocols: Record<string, IProtocolMetadata>
	chains: Record<string, IChainMetadata>
	pfPs: { pf: string[]; ps: string[] }
}

interface ProDashboardChartRequestBase {
	type: string
	/** Backend chain ID used by the precomputed Bridged TVL chart cache. */
	chainAssetId?: string
	geckoId?: string | null
	dataType?: string
}

/** Fields actually consumed when a chart source is fetched. */
export type ProDashboardChartRequest = ProDashboardChartRequestBase &
	(
		| { subjectType: 'chain'; chain: string; protocol?: never }
		| { subjectType: 'protocol'; protocol: string; chain?: never }
	)

export type ChartBuilderSeriesData = { series: ChartSeries[] }
