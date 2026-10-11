import { PanelLoadingStatus } from '~/ui/Status'
import { ApiTrendChart, DualAxisChart } from './ChainBreakdownChart'
import type { Chart, Kpi as KpiT } from './transform'
import { Kpi, KpiGrid, PlaceholderCard, TimeAreaCard, useThorchainData } from './ui'

interface TokenData {
	rune: { kpis: Record<string, KpiT | undefined> }
	runePriceChart: Chart
	priceVolumeChart: Chart
	burn: { burnChart: Chart; cumulativeBurnChart: Chart; kpis: Record<string, KpiT | undefined> }
	tcy: {
		yieldChart: Chart
		priceChart: Chart | null
		aprChart: Chart | null
		protocolOwnedChart?: Chart | null
		kpis: Record<string, KpiT | undefined>
	}
}

const RUNE_KPIS: Array<[string, string]> = [
	['marketCap', 'Market cap'],
	['fdv', 'FDV'],
	['mcapFdv', 'Mcap/FDV'],
	['circulatingSupply', 'Circulating Supply'],
	['totalSupply', 'Total Supply'],
	['reserveRune', 'Reserve']
]

// RUNE-denominated only — USD burn figures dropped per the protocol's review.
const BURN_KPIS: Array<[string, string]> = [
	['burnedLifetime', 'Burned (Lifetime)'],
	['burned30d', 'Burned (30d)'],
	['burnRate', 'Burn Rate']
]

export default function Token() {
	// Both price charts come pre-built from the ir-server with the DefiLlama market
	// price as the line — Midgard's pool-derived price freezes during trading halts
	// (e.g. Jul–Oct 2021 read ~$4.7 vs the real ~$7.7) so it's never used for price.
	// The line shares one date axis with the Midgard swap-volume bars: no mismatch.
	const { data } = useThorchainData<TokenData>('token')
	if (!data) return <PanelLoadingStatus />

	const runePriceChart = data.runePriceChart
	const priceVolumeChart = data.priceVolumeChart
	const tcy = data.tcy.kpis

	return (
		<div className="flex flex-col gap-10">
			<section className="flex flex-col gap-6">
				<h2 className="heading-xs">RUNE</h2>
				<KpiGrid kpis={data.rune.kpis} items={RUNE_KPIS} cols={3} />
				{runePriceChart && (
					<TimeAreaCard
						chart={runePriceChart}
						subtitle="Daily RUNE price (DefiLlama)."
						value={data.rune.kpis.runePrice?.formatted}
						fullRange
					/>
				)}
				{priceVolumeChart?.series?.length ? (
					<DualAxisChart
						chart={priceVolumeChart}
						subtitle="RUNE price (right axis, DefiLlama) against THORChain swap volume (left axis)."
					/>
				) : (
					<PlaceholderCard
						title="RUNE price vs swap volume"
						subtitle="RUNE price against THORChain swap volume."
						note="token.priceVolumeChart"
					/>
				)}
			</section>

			<section className="flex flex-col gap-6">
				<h2 className="heading-xs">TCY</h2>
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
					<Kpi kpi={tcy.tcyMarketCap} label="Market cap" />
					<Kpi kpi={tcy.tcyFdv} label="FDV" />
					<Kpi kpi={tcy.tcyMcapFdv} label="Mcap/FDV" />
					<Kpi kpi={tcy.tcyMcapToRuneMcap} label="TCY Mcap / RUNE Mcap" />
					<Kpi kpi={tcy.tcyCirculating} label="Circulating Supply" />
					<Kpi kpi={tcy.tcySupply} label="Total Supply" />
					<Kpi kpi={tcy.tcyProtocolOwned} label="Protocol Owned" note="thorchain/tcy_protocol_owned" />
					<Kpi kpi={tcy.tcyUnclaimed} label="Unclaimed" />
				</div>
				{data.tcy.priceChart ? (
					<TimeAreaCard chart={data.tcy.priceChart} value={tcy.tcyPrice?.formatted} />
				) : (
					<PlaceholderCard
						title="TCY price"
						subtitle="TCY price feed unavailable."
						note="coins.llama.fi coingecko:tcy"
					/>
				)}
				{data.tcy.aprChart ? (
					<TimeAreaCard
						chart={data.tcy.aprChart}
						subtitle="Trailing-7d annualized staking yield (raynalytics, real historical staked balance)."
						value={tcy.tcyApr?.formatted}
					/>
				) : (
					<PlaceholderCard
						title="TCY staking APR"
						subtitle="Needs both the rewards and TCY price feeds."
						note="token.tcy.aprChart"
					/>
				)}
				{data.tcy.protocolOwnedChart ? (
					<TimeAreaCard
						chart={data.tcy.protocolOwnedChart}
						valueSymbol=""
						subtitle="TCY held by the protocol's POL position, since May 2025."
						value={tcy.tcyProtocolOwned?.formatted}
					/>
				) : (
					<PlaceholderCard
						title="Protocol owned TCY"
						subtitle="Protocol-owned TCY over time. Awaiting feed."
						note="raynalytics treasury-pol-tcy-balance"
					/>
				)}
			</section>

			<section className="flex flex-col gap-6">
				<h2 className="heading-xs">RUNE burn</h2>
				<KpiGrid kpis={data.burn.kpis} items={BURN_KPIS} cols={3} />
				<ApiTrendChart
					chart={data.burn.burnChart}
					subtitle="RUNE permanently burned from system income."
					valueSymbol=""
				/>
			</section>
		</div>
	)
}
