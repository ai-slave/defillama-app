import { SmolLineChart } from '~/containers/ChainOverview/SmolLineChart'
import { SmolStatCard } from '~/ui/SmolStatCard'
import type { RWAOverviewDisplayRow } from '../api.types'
import { formatRwaKpiUsd } from '../kpi/format'
import type { RwaPerpsKpi } from '../kpi/perpsKpi'
import { perpsDefinitions } from '../Perps/definitions'
import { buildRwaSplitCard, foldRwaSeriesTotal, getRwaPerpsMarkets, RWA_CARD_CHANGE_DAYS } from './cardData'
import { RWAChangeCard, RWAValueBars } from './OverviewCard'
import { buildRwaPerpsVolumeCard, rankRwaPerpsOpenInterest, toRwaSplitRows, type RwaPerpsCards } from './perpsCardData'

export type RWAPerpsCardsProps = {
	cards: RwaPerpsCards
	/** The page's rows after its filters; the cards fold their perps markets. */
	markets: Array<RWAOverviewDisplayRow>
	/** The Key Metrics fold over the same markets: the first card's total. */
	kpi: RwaPerpsKpi
	/** A filter is set: Change by Venue then folds the per-market history, as the server split knows no filter but Venue Type. */
	filtered: boolean
	/** That history by venue, loaded by the page while a filter is set; null until it lands. */
	venueHistory: Record<string, Array<[number, number]>> | null
	/** The per-market volume history by venue, loaded the same way, behind the Volume card while a filter is set. */
	volumeHistory: Record<string, Array<[number, number]>> | null
	includeCex: boolean
}

/** The three cards of /rwa/perps under the chart panel, in place of the Assets cards. */
export function RWAPerpsCards({
	cards,
	markets,
	kpi,
	filtered,
	venueHistory,
	volumeHistory,
	includeCex
}: RWAPerpsCardsProps) {
	const perpsMarkets = getRwaPerpsMarkets(markets, includeCex)
	const variant = includeCex ? 'withCex' : 'dexOnly'
	const venueChange = filtered
		? buildRwaSplitCard(venueHistory ? toRwaSplitRows(venueHistory) : [])
		: cards.venueChange[variant]
	const volume = buildRwaPerpsVolumeCard(
		filtered ? (volumeHistory ? foldRwaSeriesTotal(toRwaSplitRows(volumeHistory)) : []) : cards.volume[variant]
	)
	return (
		<div className="grid grid-cols-1 gap-2 md:grid-cols-3">
			<SmolStatCard
				title="Open Interest by Asset Group"
				tooltip={`${perpsDefinitions.totalOpenInterest.description} Split by the asset group of each market's underlying.`}
				value={kpi.openInterest == null ? null : formatRwaKpiUsd(kpi.openInterest)}
			>
				<RWAValueBars bars={rankRwaPerpsOpenInterest(perpsMarkets)} logo={null} />
			</SmolStatCard>
			<RWAChangeCard
				title="Change by Venue"
				tooltip={`Open interest now against ${RWA_CARD_CHANGE_DAYS} days ago, in total and per venue.`}
				card={venueChange}
				logo="token"
			/>
			<SmolStatCard
				title="Volume, 7 day average"
				tooltip="Daily volume across every market, averaged over the last seven days so a weekend does not read as a drop; the line is the last 90 days."
				value={volume.value == null ? null : formatRwaKpiUsd(volume.value)}
				qualifier="a day"
				change={volume.changePct == null ? undefined : { value: volume.changePct, comparison: 'over a week' }}
			>
				<SmolLineChart series={volume.series} color="blue" />
			</SmolStatCard>
		</div>
	)
}
