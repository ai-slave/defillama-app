import { useMemo } from 'react'
import ProtocolCharts from '~/containers/ProDashboard/services/ProtocolCharts'
import { ApiTrendChart, FeeRevenueChart } from './ChainBreakdownChart'
import type { ApiTableData, Chart, Distribution, Kpi as KpiT } from './transform'
import {
	ApiTable,
	CategoryBarCard,
	DonutCard,
	Kpi,
	KpiGrid,
	PageLoader,
	PlaceholderCard,
	SectionHeader,
	TimeAreaCard,
	useAdapterSeries,
	useThorchainData,
	useThorchainDefs
} from './ui'

interface OverviewData {
	kpis: {
		thorchain?: Record<string, KpiT | undefined>
		thorchainDex?: Record<string, KpiT | undefined>
	}
	tvlChart: Chart
}

const DEX = 'thorchain-dex'

const GRID = 'grid grid-cols-2 gap-3 lg:grid-cols-4'

// THORChain is one integrated DEX — no separate "Chain" vs "DEX" accounting (per the
// protocol's review). Headline KPIs are the lifetime income-statement figures from
// the DefiLlama thorchain-dex adapter; TVL and its chart live in the Liquidity section.
export default function Overview() {
	const { data } = useThorchainData<OverviewData>('overview')
	// Liquidity composition currently lives on the network endpoint.
	const { data: net } = useThorchainData<{ liquidity?: LiquidityData }>('network')
	const defs = useThorchainDefs()
	const fees = useAdapterSeries('dex-fees', () => ProtocolCharts.fees(DEX))
	const revenue = useAdapterSeries('dex-revenue', () => ProtocolCharts.revenue(DEX))
	const holdersRevenue = useAdapterSeries('dex-holders-revenue', () => ProtocolCharts.holdersRevenue(DEX))
	const supplySideRevenue = useAdapterSeries('dex-supply-side-revenue', () =>
		ProtocolCharts.summary(DEX, 'fees', 'dailySupplySideRevenue')
	)
	// Volume from the ir-server volume payload (Midgard daily history, same series as the
	// Volume tab — same query key, so the tab loads instantly). The DefiLlama dex-volume
	// series reads ~0.5% lower and would disagree with the Volume tab's lifetime KPI.
	const { data: vol } = useThorchainData<{ kpis: Record<string, KpiT | undefined>; volumeChart: Chart }>('volume')
	// Overview shows the TOTAL only — the by-type split stays on the Volume tab.
	const totalVolumeChart: Chart | null = useMemo(() => {
		const c = vol?.volumeChart
		if (!c) return null
		const total = c.dates.map((_, i) => c.series.reduce((sum, s) => sum + (s.data[i] ?? 0), 0))
		return { ...c, title: 'Swap Volume', series: [{ name: 'Volume', type: 'bar', data: total }] }
	}, [vol])
	if (!data) return <PageLoader />

	return (
		<div className="flex flex-col gap-10">
			{/* No section header — the page header above already carries the THORChain identity. */}
			<section className="flex flex-col gap-6">
				<div className={GRID}>
					<Kpi kpi={fees.data?.lifetime} label="Fees (Lifetime)" def={defs.fees} />
					<Kpi
						kpi={supplySideRevenue.data?.lifetime}
						label="Supply-Side Revenue (Lifetime)"
						def={defs.supplySideRevenue}
					/>
					<Kpi kpi={revenue.data?.lifetime} label="Revenue (Lifetime)" def={defs.revenue} />
					<Kpi kpi={holdersRevenue.data?.lifetime} label="Holders Revenue (Lifetime)" def={defs.holdersRevenue} />
				</div>

				<FeeRevenueChart source="dex" title="Fees & Revenue" subtitle="Swap fees and protocol revenue." />

				<div className={GRID}>
					<Kpi kpi={vol?.kpis.volumeLifetime} label="Volume (Lifetime)" />
				</div>
				<ApiTrendChart chart={totalVolumeChart} subtitle="Cumulative swap volume." defaultView="cumulative" />
			</section>

			{net?.liquidity ? (
				<LiquiditySection liquidity={net.liquidity} tvlChart={data.tvlChart} tvl={data.kpis.thorchain?.tvl} />
			) : (
				<section className="flex flex-col gap-6">
					<SectionHeader>Liquidity</SectionHeader>
					<PlaceholderCard
						title="Liquidity"
						subtitle="Pool-level liquidity data unavailable."
						note="network.liquidity"
					/>
				</section>
			)}
		</div>
	)
}

interface LiquidityData {
	distribution: Distribution
	chainDistribution: Distribution
	poolDepthChart: Chart
	pools: ApiTableData
	kpis: Record<string, KpiT | undefined>
}

// Liquidity: TVL + pooled-liquidity composition, with the by-blockchain split leading
// (per the protocol's review). Data comes from the network endpoint's `liquidity` object.
function LiquiditySection({ liquidity, tvlChart, tvl }: { liquidity: LiquidityData; tvlChart: Chart; tvl?: KpiT }) {
	const defs = useThorchainDefs()
	const LIQUIDITY_KPIS: Array<[string, string, string | undefined]> = [
		['tvl', 'TVL', defs.tvl],
		['poolCount', 'Pools', undefined],
		['blockchains', 'Blockchains', undefined],
		['majorsShare', 'Majors Share', undefined],
		['stablecoinsShare', 'Stablecoins Share', undefined],
		['topPoolByDepth', 'Top Pool by Depth', undefined]
	]
	// Connected-blockchain count derived from the by-chain distribution, so the KPI
	// always agrees with the donut below.
	const blockchainCount = liquidity.chainDistribution?.data?.length ?? 0
	const kpis = {
		...liquidity.kpis,
		blockchains: blockchainCount > 0 ? { value: blockchainCount, formatted: String(blockchainCount) } : undefined
	}
	return (
		<section className="flex flex-col gap-6">
			<SectionHeader>Liquidity</SectionHeader>
			{/* 6 KPIs at 3-per-row on desktop: [TVL, Pools, Blockchains] / [Majors, Stables, Top Pool]. */}
			<KpiGrid kpis={kpis} items={LIQUIDITY_KPIS} cols={3} />

			<TimeAreaCard chart={tvlChart} subtitle="Total value locked, as measured by DefiLlama." value={tvl?.formatted} />

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<DonutCard dist={liquidity.chainDistribution} subtitle="Liquidity by connected blockchain." />
				<DonutCard dist={liquidity.distribution} subtitle="Liquidity by asset class." />
			</div>

			{/* One pool/token view: every THORChain pool IS a single token, so the old
			    "Token Breakdown" donut and "Token Values" table duplicated these two. */}
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<CategoryBarCard chart={liquidity.poolDepthChart} />
				<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
					<h3 className="mb-3 text-sm font-semibold text-pro-text-primary">
						{liquidity.pools.title ?? 'Pools by Depth'}
					</h3>
					<ApiTable table={liquidity.pools} maxHeight="420px" />
				</div>
			</div>
		</section>
	)
}
