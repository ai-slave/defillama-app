import { SmolLineChart } from '~/containers/ChainOverview/SmolLineChart'
import { SmolStatCard } from '~/ui/SmolStatCard'
import type { RWAOverviewDisplayRow } from '../api.types'
import { formatRwaKpiUsd } from '../kpi/format'
import type { RwaPerpsKpi } from '../kpi/perpsKpi'
import { perpsDefinitions } from '../Perps/definitions'
import { toRwaPerpsHistorySeries, useRwaPerpsHistoryDataset } from '../perpsHistoryFold'
import { buildRwaSplitCard, foldRwaSeriesTotal, getRwaPerpsMarkets, RWA_CARD_CHANGE_DAYS } from './cardData'
import { RWAChangeCard, RWAValueBars } from './OverviewCard'
import { buildRwaPerpsVolumeCard, rankRwaPerpsOpenInterest, toRwaSplitRows, type RwaPerpsCards } from './perpsCardData'

export type RWAPerpsCardsProps = {
	cards: RwaPerpsCards
	/** The page's rows after its filters; the cards fold their perps markets. */
	markets: Array<RWAOverviewDisplayRow>
	/** The Key Metrics fold over the same markets: the first card's total. */
	kpi: RwaPerpsKpi
	/** A filter is set: Change by Venue and the Volume card then fold the per-market open interest and volume history by
	    venue, as the server split knows no filter but Venue Type. */
	filtered: boolean
	includeCex: boolean
}

/** The three cards of /rwa/perps under the chart panel, in place of the Assets cards. */
export function RWAPerpsCards({ cards, markets, kpi, filtered, includeCex }: RWAPerpsCardsProps) {
	const perpsMarkets = getRwaPerpsMarkets(markets, includeCex)
	const marketIds = perpsMarkets.map((market) => market.id)
	/* Each market's history folded by venue: one series per venue. */
	const venueHistory = useRwaPerpsHistoryDataset({
		scope: { kind: 'all' },
		metric: 'openInterest',
		groupBy: 'platform',
		marketIds,
		rows: markets,
		includeCex,
		enabled: filtered
	})
	const volumeHistory = useRwaPerpsHistoryDataset({
		scope: { kind: 'all' },
		metric: 'volume',
		groupBy: 'platform',
		marketIds,
		rows: markets,
		includeCex,
		enabled: filtered
	})
	const variant = includeCex ? 'withCex' : 'dexOnly'
	const venueChange = !filtered
		? cards.venueChange[variant]
		: buildRwaSplitCard(venueHistory.dataset ? toRwaSplitRows(toRwaPerpsHistorySeries(venueHistory.dataset)) : [])
	const volume = buildRwaPerpsVolumeCard(
		!filtered
			? cards.volume[variant]
			: volumeHistory.dataset
				? foldRwaSeriesTotal(toRwaSplitRows(toRwaPerpsHistorySeries(volumeHistory.dataset)))
				: []
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
				isLoading={venueHistory.isLoading}
				failedRead={venueHistory.failedRead}
			/>
			<SmolStatCard
				title="Volume, 7 day average"
				tooltip="Daily volume across every market, averaged over the last seven days so a weekend does not read as a drop; the line is the last 90 days."
				value={volume.value == null ? null : formatRwaKpiUsd(volume.value)}
				qualifier="a day"
				isLoading={volumeHistory.isLoading}
				failedRead={volumeHistory.failedRead}
				change={volume.changePct == null ? undefined : { value: volume.changePct, comparison: 'over a week' }}
			>
				<SmolLineChart series={volume.series} color="blue" />
			</SmolStatCard>
		</div>
	)
}
