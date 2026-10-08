import type { RwaNamedBar, RwaPerpsTotals } from '../cards/cardData'
import type { RWAPageKind } from '../layout/pageLayout'
import type { RWATableMetrics } from '../table/rows'
import { getRwaAssetsKpiHeadline, getRwaOverviewKpiRows, RWA_OVERVIEW_KPI_LABEL } from './assetsKpiRows'
import { RWAKpiCard } from './KpiCard'
import { getRwaKpiCsvName } from './kpiRows'

export type RWAKeyMetricsProps = {
	/** The page totals after its filters, the fold the tiles used. */
	metrics: RWATableMetrics
	/** The server's RWA Perps totals over the page's markets, CEX venues in. */
	perps: RwaPerpsTotals
	largestProtocol: RwaNamedBar | null
	/** The page's h1 (layout/pageCopy.ts). Absent inside another page, where the default label is an h2. */
	headline?: string
	pageKind: RWAPageKind
	/** The page's scope (a chain, a category), for the csv name. */
	scopeName?: string | null
}

/** The Assets Key Metrics card: active AUM heads it, the AUM sections and the perps totals open under it. */
export function RWAKeyMetrics({ metrics, perps, largestProtocol, headline, pageKind, scopeName }: RWAKeyMetricsProps) {
	return (
		<RWAKpiCard
			headline={getRwaAssetsKpiHeadline(metrics, RWA_OVERVIEW_KPI_LABEL, headline)}
			rows={getRwaOverviewKpiRows(metrics, perps, largestProtocol)}
			csvName={getRwaKpiCsvName(pageKind, scopeName)}
		/>
	)
}
