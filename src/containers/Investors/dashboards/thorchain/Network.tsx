import { useState } from 'react'
import type { Chart, Kpi } from './transform'
import { KpiGrid, PageLoader, PlaceholderCard, SectionHeader, SegToggle, TimeAreaCard, useThorchainData } from './ui'

type PolView = 'rune' | 'usd'

interface NetworkData {
	kpis: Record<string, Kpi | undefined>
	bond: { bondChart: Chart; kpis: { bondedRuneNow?: Kpi } } | null
	polCharts?: Partial<Record<PolView, Chart | null>>
}

// Layout per the protocol's review: nodes & operators first, then the bonded stack
// (USD / RUNE / vs circulating supply / vs TVL), then protocol-owned liquidity.
const NODES_KPIS: Array<[string, string]> = [
	['activeNodes', 'Active Nodes'],
	['nodeOperators', 'Node Operators'],
	['bondingApy', 'Bonding APR']
]

const BONDED_KPIS: Array<[string, string]> = [
	['totalBonded', 'Bonded (USD)'],
	['bondedRune', 'Bonded (RUNE)'],
	['bondedToCirculating', 'Bonded / Circulating Supply'],
	['bondedToTvl', 'Bonded / TVL']
]

const POL_KPIS: Array<[string, string]> = [
	['polValue', 'Protocol-Owned Liquidity (USD)'],
	['polRune', 'Protocol-Owned Liquidity (RUNE)'],
	['polShareOfTvl', 'Protocol-Owned Liquidity / TVL']
]

export default function Network() {
	// `liquidity` lives on this payload too but renders on Overview, not here.
	const { data } = useThorchainData<NetworkData>('network')
	const [polView, setPolView] = useState<PolView>('rune')
	if (!data) return <PageLoader />

	const { kpis, bond } = data
	const polChart = data.polCharts?.[polView]
	const POL_VIEWS: Array<{ value: PolView; label: string }> = [
		{ value: 'rune', label: 'RUNE' },
		{ value: 'usd', label: 'USD' }
	]
	const polToggle = (
		<SegToggle<PolView>
			options={POL_VIEWS.filter((o) => data.polCharts?.[o.value])}
			value={polView}
			onChange={setPolView}
		/>
	)

	return (
		<div className="flex flex-col gap-6">
			<SectionHeader>Nodes & Bonding</SectionHeader>
			<KpiGrid kpis={kpis} items={NODES_KPIS} cols={3} />
			<KpiGrid kpis={kpis} items={BONDED_KPIS} />

			{bond ? (
				<TimeAreaCard
					chart={bond.bondChart}
					subtitle="Daily RUNE bonded by nodes since mainnet launch (April 2021)."
					valueSymbol=""
					fullRange
				/>
			) : (
				<PlaceholderCard
					title="RUNE Bonded Over Time"
					subtitle="Bond history feed unavailable."
					note="raynalytics daily-tvl"
				/>
			)}

			<SectionHeader>Protocol-Owned Liquidity</SectionHeader>
			<KpiGrid kpis={kpis} items={POL_KPIS} cols={3} />
			{/* Mark-to-market POL value since POL genesis (May 2023), RUNE by default with a
			    USD toggle — official raynalytics feed, cross-checked against THORNode state. */}
			{polChart ? (
				<TimeAreaCard
					chart={polChart}
					subtitle="Market value of the protocol-owned liquidity position since May 2023 (raynalytics)."
					value={(polView === 'rune' ? kpis.polRune : kpis.polValue)?.formatted}
					control={polToggle}
					fullRange
				/>
			) : (
				<PlaceholderCard
					title="Protocol-Owned Liquidity Over Time"
					subtitle="POL market value over time. Awaiting feed."
					note="raynalytics pol-value"
				/>
			)}
		</div>
	)
}
