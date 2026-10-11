import { TokenLogo } from '~/components/TokenLogo'
import { Tag } from '~/ui/Tag'
import { RWAKpiCard } from '../kpi/KpiCard'
import { getRwaKpiCsvName } from '../kpi/kpiRows'
import { getRwaPerpsKpiHeadline, getRwaVenueKpiRows } from '../kpi/perpsKpiRows'
import type { RwaPerpsVenueType } from './venueData'
import type { RwaVenueKpi } from './venueKpi'

export type RWAVenueKeyMetricsProps = {
	venue: string
	logo: string | null
	venueSlug: string
	kpi: RwaVenueKpi
	/** DEX or CEX: the tag by the name, and which open interest the share reads. */
	venueType: RwaPerpsVenueType | null
	/** The platforms index's perp taker fee; the row hides without it. */
	takerFeeBps: number | null
}

/**
 * The venue's Key Metrics card: the Perps card over one venue. Its name is the page's h1, as on the platform page,
 * with the DEX or CEX tag beside it; the headline metric is an h2.
 */
export function RWAVenueKeyMetrics({ venue, logo, venueSlug, kpi, venueType, takerFeeBps }: RWAVenueKeyMetricsProps) {
	return (
		<RWAKpiCard
			identity={
				<div className="flex flex-wrap items-center gap-2">
					<h1 className="flex items-center gap-2 heading-sm">
						{logo ? <TokenLogo src={logo} size={24} alt={`${venue} logo`} /> : null}
						<span>{venue}</span>
					</h1>
					{venueType ? <Tag>{venueType}</Tag> : null}
				</div>
			}
			headline={getRwaPerpsKpiHeadline(kpi)}
			rows={getRwaVenueKpiRows(kpi, venueType, takerFeeBps)}
			csvName={getRwaKpiCsvName('venue', venueSlug)}
			csvLead={venueType ? [['Venue type', venueType]] : []}
		/>
	)
}
