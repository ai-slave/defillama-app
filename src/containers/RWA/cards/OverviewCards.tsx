import { SmolLineChart } from '~/containers/ChainOverview/SmolLineChart'
import { formatPercentChange } from '~/utils/numberFormat'
import { definitions } from '../definitions'
import { formatRwaKpiUsd } from '../kpi/format'
import { perpsDefinitions } from '../Perps/definitions'
import type { RwaOverviewCards } from './cardData'
import { formatRwaSignedUsd, getRwaChangeTone, RWAChangeBars, RWAOverviewCard, RWAValueBars } from './OverviewCard'

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
			<RWAOverviewCard
				title="RWA in DeFi by Protocol"
				tooltip={`${definitions.totalDefiActiveTvl.description} The bars leave bridge and interop protocols out.`}
				value={defi.value == null ? null : formatRwaKpiUsd(defi.value)}
				change={defi.changeUsd == null ? null : formatRwaSignedUsd(defi.changeUsd)}
				changeTone={getRwaChangeTone(defi.changeUsd)}
			>
				<RWAValueBars bars={defi.bars} />
			</RWAOverviewCard>
			<RWAOverviewCard
				title="Change by Chain, 30d"
				tooltip="Active mcap now against 30 days ago, in total and per chain."
				value={chain.changeUsd == null ? null : formatRwaSignedUsd(chain.changeUsd)}
				change={chain.changePct == null ? null : formatPercentChange(chain.changePct)}
				changeTone={getRwaChangeTone(chain.changeUsd)}
			>
				<RWAChangeBars bars={chain.bars} />
			</RWAOverviewCard>
			<RWAOverviewCard
				title="RWA Perps Open Interest"
				tooltip={perpsDefinitions.totalOpenInterest.description}
				value={perps.value == null ? null : formatRwaKpiUsd(perps.value)}
				change={perps.changePct == null ? null : formatPercentChange(perps.changePct)}
				changeTone={getRwaChangeTone(perps.changePct)}
			>
				<SmolLineChart series={perps.series} color={(perps.changePct ?? 0) >= 0 ? 'green' : 'red'} />
			</RWAOverviewCard>
		</div>
	)
}
