import { SmolLineChart } from '~/containers/ChainOverview/SmolLineChart'
import { SmolStatCard } from '~/ui/SmolStatCard'
import type { IRWAAssetsOverview } from '../api.types'
import { definitions } from '../definitions'
import { formatRwaKpiUsd } from '../kpi/format'
import { perpsDefinitions } from '../Perps/definitions'
import {
	buildRwaDefiProtocolCard,
	RWA_CARD_CHAIN_EACH,
	RWA_CARD_CHANGE_DAYS,
	rankRwaChainChanges,
	type RwaOverviewCards
} from './cardData'
import { foldRwaChainChangeCard } from './chainChangeCard'
import { RWAChangeCard, RWAValueBars } from './OverviewCard'
import { useRwaChainChangeRows } from './useChainChangeRows'

export type RWAOverviewCardsProps = {
	cards: RwaOverviewCards
	/** The page's assets after its filters; the cards fold these. */
	assets: IRWAAssetsOverview['assets']
	/** A filter is set: Change by Chain then folds the per-chain histories, as the server split knows no filter. */
	filtered: boolean
	includeStablecoins: boolean
	includeGovernance: boolean
	includeBridgeTvl: boolean
	/** The Key Metrics card's RWA Perps OI, so the two totals on the page agree. */
	perpsOpenInterest: number | null
}

/** The three front page cards under the chart panel. */
export function RWAOverviewCards({
	cards,
	assets,
	filtered,
	includeStablecoins,
	includeGovernance,
	includeBridgeTvl,
	perpsOpenInterest
}: RWAOverviewCardsProps) {
	const defi = buildRwaDefiProtocolCard(assets, includeBridgeTvl)
	const chainHistory = useRwaChainChangeRows({
		assets,
		includeStablecoins,
		includeGovernance,
		includeBridgeTvl,
		enabled: filtered
	})
	const chainBars = filtered
		? rankRwaChainChanges(chainHistory.rows ?? [], { days: RWA_CARD_CHANGE_DAYS, each: RWA_CARD_CHAIN_EACH })
		: cards.chainChange.bars
	const chain = foldRwaChainChangeCard(assets, chainBars)
	/* An Assets page reads the perps totals with CEX venues in; the line and its change are the server's daily split. */
	const perps = cards.perpsOpenInterest
	const perpsValue = perpsOpenInterest ?? perps.value
	return (
		<div className="grid grid-cols-1 gap-2 md:grid-cols-3">
			<SmolStatCard
				title="RWA in DeFi by Protocol"
				tooltip={`${definitions.totalDefiActiveTvl.description} The bars leave bridge and interop protocols out.`}
				value={defi.value == null ? null : formatRwaKpiUsd(defi.value)}
				change={
					defi.changeUsd == null
						? undefined
						: { value: defi.changeUsd, unit: 'usd', comparison: `over ${RWA_CARD_CHANGE_DAYS}d` }
				}
			>
				<RWAValueBars bars={defi.bars} />
			</SmolStatCard>
			<RWAChangeCard
				title="Change by Chain"
				tooltip="Active AUM now against 30 days ago, in total and per chain."
				card={chain}
				logo="chain"
			/>
			<SmolStatCard
				title="RWA Perps Open Interest"
				tooltip={perpsDefinitions.totalOpenInterest.description}
				value={perpsValue == null ? null : formatRwaKpiUsd(perpsValue)}
				change={
					perps.changePct == null ? undefined : { value: perps.changePct, comparison: `over ${RWA_CARD_CHANGE_DAYS}d` }
				}
			>
				<SmolLineChart series={perps.series} color={(perps.changePct ?? 0) >= 0 ? 'green' : 'red'} />
			</SmolStatCard>
		</div>
	)
}
