import { SmolLineChart } from '~/containers/ChainOverview/SmolLineChart'
import { SmolStatCard } from '~/ui/SmolStatCard'
import { formatPercentChange } from '~/utils/numberFormat'
import { definitions } from '../definitions'
import { formatRwaKpiUsd } from '../kpi/format'
import { perpsDefinitions } from '../Perps/definitions'
import type { RwaOverviewCards } from './cardData'
import { RWA_CARD_CHANGE_DAYS } from './cardData'
import { formatRwaSignedUsd, getRwaChangeTone, RWA_CARD_FILTER_NOTE, RWAChangeBars, RWAValueBars } from './OverviewCard'

export type RWAOverviewCardsProps = {
	cards: RwaOverviewCards
	includeBridgeTvl: boolean
	includeCex: boolean
}

/** The three front page cards under the chart panel. */
export function RWAOverviewCards({ cards, includeBridgeTvl, includeCex }: RWAOverviewCardsProps) {
	const defi = includeBridgeTvl ? cards.defiByProtocol.withBridges : cards.defiByProtocol.withoutBridges
	const chain = cards.chainChange
	const perps = includeCex ? cards.perpsOpenInterest.withCex : cards.perpsOpenInterest.dexOnly
	return (
		<div className="grid grid-cols-1 gap-2 md:grid-cols-3">
			<SmolStatCard
				title="RWA in DeFi by Protocol"
				tooltip={`${definitions.totalDefiActiveTvl.description} The bars leave bridge and interop protocols out. ${RWA_CARD_FILTER_NOTE}`}
				value={defi.value == null ? null : formatRwaKpiUsd(defi.value)}
				change={{
					text: defi.changeUsd == null ? 'N/A' : formatRwaSignedUsd(defi.changeUsd),
					tone: getRwaChangeTone(defi.changeUsd),
					comparison: `over ${RWA_CARD_CHANGE_DAYS}d`
				}}
			>
				<RWAValueBars bars={defi.bars} />
			</SmolStatCard>
			<SmolStatCard
				title="Change by Chain"
				tooltip={`Active AUM now against 30 days ago, in total and per chain. ${RWA_CARD_FILTER_NOTE}`}
				value={chain.changeUsd == null ? null : formatRwaSignedUsd(chain.changeUsd)}
				change={{
					text: chain.changePct == null ? 'N/A' : formatPercentChange(chain.changePct),
					tone: getRwaChangeTone(chain.changeUsd),
					comparison: `over ${RWA_CARD_CHANGE_DAYS}d`
				}}
			>
				<RWAChangeBars bars={chain.bars} />
			</SmolStatCard>
			<SmolStatCard
				title="RWA Perps Open Interest"
				tooltip={`${perpsDefinitions.totalOpenInterest.description} ${RWA_CARD_FILTER_NOTE}`}
				value={perps.value == null ? null : formatRwaKpiUsd(perps.value)}
				change={{
					text: perps.changePct == null ? 'N/A' : formatPercentChange(perps.changePct),
					tone: getRwaChangeTone(perps.changePct),
					comparison: `over ${RWA_CARD_CHANGE_DAYS}d`
				}}
			>
				<SmolLineChart series={perps.series} color={(perps.changePct ?? 0) >= 0 ? 'green' : 'red'} />
			</SmolStatCard>
		</div>
	)
}
