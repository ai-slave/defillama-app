import type { RWAPageKind } from '../layout/pageLayout'
import { RWAKpiCard } from './KpiCard'
import { getRwaKpiCsvName } from './kpiRows'
import type { RwaPerpsKpi } from './perpsKpi'
import { getRwaPerpsKpiHeadline, getRwaPerpsKpiRows } from './perpsKpiRows'

/** The Perps Key Metrics card: open interest heads it; the 30 day sections open into their shorter and longer windows. */
export function RWAPerpsKeyMetrics({
	kpi,
	headline,
	pageKind,
	scopeName
}: {
	kpi: RwaPerpsKpi
	/** The page's h1. */
	headline?: string
	pageKind: RWAPageKind
	scopeName?: string | null
}) {
	return (
		<RWAKpiCard
			headline={getRwaPerpsKpiHeadline(kpi, headline)}
			rows={getRwaPerpsKpiRows(kpi)}
			csvName={getRwaKpiCsvName(pageKind, scopeName)}
		/>
	)
}
