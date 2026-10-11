import { useMemo } from 'react'
import { fetchAdapterProtocolChartData } from '~/containers/AdapterMetrics/api'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { Card } from '~/ui/Card'
import { PanelLoadingStatus } from '~/ui/Status'
import { ApiTrendChart, FeeRevenueChart } from './ChainBreakdownChart'
import type { ApiTableData, Chart, Distribution, Kpi as KpiT } from './transform'
import {
	ApiTable,
	CategoryBarCard,
	defWithNetworkFee,
	DEX,
	DonutCard,
	Kpi,
	KpiGrid,
	PlaceholderCard,
	TimeAreaCard,
	useAdapterSeries,
	useThorchainData,
	useThorchainDefs,
	withNetworkFee
} from './ui'

interface OverviewData {
	kpis: {
		thorchain?: Record<string, KpiT | undefined>
		thorchainDex?: Record<string, KpiT | undefined>
	}
	tvlChart: Chart
}

const GRID = 'grid grid-cols-2 gap-3 lg:grid-cols-4'

// THORChain is one integrated DEX — no separate "Chain" vs "DEX" accounting (per the
// protocol's review). Headline KPIs are the lifetime income-statement figures from
// the DefiLlama thorchain-dex adapter; TVL and its chart live in the Liquidity section.
export default function Overview() {
	const { data } = useThorchainData<OverviewData>('overview')
	// Liquidity composition currently lives on the network endpoint.
	const { data: net } = useThorchainData<{ liquidity?: LiquidityData }>('network')
	const defs = useThorchainDefs()
	const fees = useAdapterSeries('total-fees', withNetworkFee(ADAPTER_DATA_TYPES.DAILY_FEES))
	const revenue = useAdapterSeries('total-revenue', withNetworkFee(ADAPTER_DATA_TYPES.DAILY_REVENUE))
	const holdersRevenue = useAdapterSeries('dex-holders-revenue', () =>
		fetchAdapterProtocolChartData({
			adapterType: ADAPTER_TYPES.FEES,
			protocol: DEX,
			dataType: ADAPTER_DATA_TYPES.DAILY_HOLDERS_REVENUE
		})
	)
	const supplySideRevenue = useAdapterSeries('dex-supply-side-revenue', () =>
		fetchAdapterProtocolChartData({
			adapterType: ADAPTER_TYPES.FEES,
			protocol: DEX,
			dataType: ADAPTER_DATA_TYPES.DAILY_SUPPLY_SIDE_REVENUE
		})
	)
	// Volume from the ir-server volume payload (Midgard daily history, same series as the
	// Volume tab — same query key, so the tab loads instantly). The DefiLlama dex-volume
	// series reads ~0.5% lower and would disagree with the Volume tab's lifetime KPI.
	const { data: vol } = useThorchainData<{ kpis: Record<string, KpiT | undefined>; volumeChart: Chart }>('volume')
	// Overview shows the TOTAL only — the by-type split stays on the Volume tab.
	const totalVolumeChart: Chart | null = useMemo(() => {
		const c = vol?.volumeChart
		if (!c) return null
		const total: Array<number> = []
		for (const [index, date] of c.dates.entries()) {
			let value = 0
			for (const series of c.series) {
				const seriesValue = series.data[index]
				if (seriesValue === undefined) {
					throw new Error(`Expected ${series.name} data for ${date}`)
				}
				value += seriesValue
			}
			total.push(value)
		}
		return { ...c, title: 'Swap volume', series: [{ name: 'Volume', type: 'bar', data: total }] }
	}, [vol])
	if (!data) return <PanelLoadingStatus />

	return (
		<div className="flex flex-col gap-10">
			{/* No section header — the page header above already carries the THORChain identity. */}
			<section className="flex flex-col gap-6">
				<div className={GRID}>
					<Kpi kpi={fees.data?.lifetime} label="Fees (Lifetime)" def={defWithNetworkFee(defs.fees)} />
					<Kpi
						kpi={supplySideRevenue.data?.lifetime}
						label="Supply-Side Revenue (Lifetime)"
						def={defs.supplySideRevenue}
					/>
					<Kpi kpi={revenue.data?.lifetime} label="Revenue (Lifetime)" def={defWithNetworkFee(defs.revenue)} />
					<Kpi kpi={holdersRevenue.data?.lifetime} label="Holders Revenue (Lifetime)" def={defs.holdersRevenue} />
				</div>

				<FeeRevenueChart
					title="Fees & Revenue"
					subtitle="Swap fees plus the native network fee, and protocol revenue."
				/>

				<div className={GRID}>
					<Kpi kpi={vol?.kpis.volumeLifetime} label="Volume (Lifetime)" />
				</div>
				<ApiTrendChart chart={totalVolumeChart} subtitle="Cumulative swap volume." defaultView="cumulative" />
			</section>

			{net?.liquidity ? (
				<LiquiditySection liquidity={net.liquidity} tvlChart={data.tvlChart} tvl={data.kpis.thorchain?.tvl} />
			) : (
				<section className="flex flex-col gap-6">
					<h2 className="heading-xs">Liquidity</h2>
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
function LiquiditySection({
	liquidity,
	tvlChart,
	tvl
}: {
	liquidity: LiquidityData
	tvlChart: Chart
	tvl?: KpiT | undefined
}) {
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
			<h2 className="heading-xs">Liquidity</h2>
			{/* 6 KPIs at 3-per-row on desktop: [TVL, Pools, Blockchains] / [Majors, Stables, Top Pool]. */}
			<KpiGrid kpis={kpis} items={LIQUIDITY_KPIS} cols={3} />

			<TimeAreaCard chart={tvlChart} subtitle="Total value locked, as measured by DefiLlama." value={tvl?.formatted} />

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<DonutCard dist={liquidity.chainDistribution} subtitle="Liquidity by connected blockchain." />
				<DonutCard dist={liquidity.distribution} subtitle="Liquidity by asset class." />
			</div>

			{/* One pool/token view: every THORChain pool IS a single token, so the old
			    "Token Breakdown" donut and "Token Values" table duplicated these two. */}
			<div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
				<CategoryBarCard chart={liquidity.poolDepthChart} />
				<Card padding="md">
					<h3 className="mb-3 title-md text-primary">{liquidity.pools.title ?? 'Pools by Depth'}</h3>
					<ApiTable table={liquidity.pools} maxHeight="420px" />
				</Card>
			</div>
		</section>
	)
}
