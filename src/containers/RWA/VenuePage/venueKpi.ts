import type { RWAOverviewDisplayRow } from '../api.types'
import { getRwaRatio } from '../cards/cardData'
import { foldRwaPerpsKpi, type RwaPerpsKpi } from '../kpi/perpsKpi'

export type RwaVenueKpi = RwaPerpsKpi & {
	/** The venue's open interest over all open interest of its type (DEX or CEX), in percent. */
	venueShare: number | null
	/** The 30 day fees run over a year. */
	feesAnnual: number | null
}

/** The venue's Key Metrics: the Perps overview fold over its markets, CEX included (a venue page has no Venue Type),
    plus its share of the open interest of its type and the annual fee run rate. */
export function foldRwaVenueKpi(rows: Array<RWAOverviewDisplayRow>, typeOpenInterest: number | null): RwaVenueKpi {
	const kpi = foldRwaPerpsKpi(rows, true)
	return {
		...kpi,
		venueShare: getRwaRatio(kpi.openInterest, typeOpenInterest),
		feesAnnual: kpi.fees30d == null ? null : (kpi.fees30d * 365) / 30
	}
}
