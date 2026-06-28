import ProtocolCharts from '~/containers/ProDashboard/services/ProtocolCharts'
import { FeeRevenueChart, MetricTrendChart, SeriesAreaChart } from './ChainBreakdownChart'
import type { ApiTableData, Chart, Distribution, Kpi as KpiT } from './transform'
import {
	ApiTable,
	CategoryBarCard,
	DonutCard,
	Kpi,
	KpiGrid,
	PageLoader,
	SectionHeader,
	TimeAreaCard,
	useAdapterSeries,
	useThorchainData
} from './ui'

interface OverviewData {
	kpis: {
		thorchain?: Record<string, KpiT | undefined>
		thorchainDex?: Record<string, KpiT | undefined>
	}
	tvlChart: Chart
}

const DEX = 'thorchain-dex'

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'

export default function Overview() {
	const { data } = useThorchainData<OverviewData>('overview')
	// DEX liquidity composition currently lives on the network endpoint.
	const { data: net } = useThorchainData<{ liquidity?: LiquidityData }>('network')
	// Chain & DEX fee/revenue/volume KPIs come from DefiLlama adapters (chain → native `thorchain`,
	// DEX → `thorchain-dex`), shared with the Financials tab via the same cache keys.
	const chainFees = useAdapterSeries('chain-fees', () => ProtocolCharts.fees('thorchain'))
	const chainRevenue = useAdapterSeries('chain-revenue', () => ProtocolCharts.revenue('thorchain'))
	const dexFees = useAdapterSeries('dex-fees', () => ProtocolCharts.fees(DEX))
	const dexRevenue = useAdapterSeries('dex-revenue', () => ProtocolCharts.revenue(DEX))
	const dexHoldersRevenue = useAdapterSeries('dex-holders-revenue', () => ProtocolCharts.holdersRevenue(DEX))
	const dexSupplySideRevenue = useAdapterSeries('dex-supply-side-revenue', () =>
		ProtocolCharts.summary(DEX, 'fees', 'dailySupplySideRevenue')
	)
	const dexVolume = useAdapterSeries('dex-volume', () => ProtocolCharts.volume(DEX))
	if (!data) return <PageLoader />

	const chain = data.kpis.thorchain ?? {}
	const dex = data.kpis.thorchainDex ?? {}

	return (
		<div className="flex flex-col gap-10">
			{/* DEX data first. */}
			<section className="flex flex-col gap-6">
				<SectionHeader>THORChain DEX</SectionHeader>
				<div className={GRID}>
					<Kpi kpi={dex.tvl} label="DEX TVL" />
					<Kpi kpi={dexVolume.data?.d30} label="DEX Volume (30d)" />
					<Kpi kpi={dexFees.data?.d30} label="Fees (30d)" />
					<Kpi kpi={dexRevenue.data?.d30} label="Revenue (30d)" />
					<Kpi kpi={dexHoldersRevenue.data?.d30} label="Holders Revenue (30d)" />
					<Kpi kpi={dexSupplySideRevenue.data?.d30} label="Supply-side Revenue (30d)" />
				</div>

				<SeriesAreaChart
					title="DEX TVL"
					subtitle="Pooled liquidity in the THORChain DEX."
					name="TVL"
					value={dex.tvl?.formatted}
					zoomDays={60}
					queryKey={['thorchain-dex-tvl']}
					queryFn={() => ProtocolCharts.tvl(DEX)}
				/>
				<FeeRevenueChart
					source="dex"
					title="DEX Fees & Revenue"
					subtitle="Swap fees and protocol revenue from the THORChain DEX adapter."
				/>
				<MetricTrendChart
					title="DEX Volume"
					subtitle="Cumulative swap volume."
					name="Volume"
					queryKey={['thorchain-dex-volume']}
					queryFn={() => ProtocolCharts.volume(DEX)}
					defaultView="cumulative"
				/>
			</section>

			{net?.liquidity && <LiquiditySection liquidity={net.liquidity} />}

			{/* Chain data at the bottom. */}
			<section className="flex flex-col gap-6">
				<SectionHeader>THORChain (Chain)</SectionHeader>
				<div className={GRID}>
					<Kpi kpi={chain.tvl} label="TVL" />
					<Kpi kpi={chainFees.data?.d30} label="Chain Fees (30d)" />
					<Kpi kpi={chainRevenue.data?.d30} label="Chain Revenue (30d)" />
				</div>

				<TimeAreaCard
					chart={data.tvlChart}
					subtitle="Total value locked across the THORChain chain."
					value={chain.tvl?.formatted}
				/>
				<FeeRevenueChart source="chain" title="Chain Fees & Revenue" subtitle="Chain-level app fees and revenue." />
			</section>
		</div>
	)
}

export interface LiquidityData {
	tvlChart: Chart
	tvlByChainChart: Chart
	distribution: Distribution
	chainDistribution: Distribution
	tokenBreakdown: Distribution
	tokenValues: ApiTableData
	poolDepthChart: Chart
	pools: ApiTableData
	kpis: Record<string, KpiT | undefined>
}

const LIQUIDITY_KPIS: [string, string][] = [
	['tvl', 'TVL'],
	['pooledLiquidity', 'Pooled Liquidity'],
	['poolCount', 'Pools'],
	['majorsShare', 'Majors Share'],
	['stablecoinsShare', 'Stablecoins Share'],
	['topPoolByDepth', 'Top Pool by Depth']
]

// DEX liquidity: pooled-liquidity composition (by token / asset class / chain), pool depth
// and pools. The TVL it composes is the DEX/pooled-liquidity TVL, shown separately above.
// Data comes from the network endpoint's `liquidity` object.
function LiquiditySection({ liquidity }: { liquidity: LiquidityData }) {
	return (
		<section className="flex flex-col gap-6">
			<SectionHeader>DEX Liquidity</SectionHeader>
			<KpiGrid kpis={liquidity.kpis} items={LIQUIDITY_KPIS} />

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<DonutCard dist={liquidity.tokenBreakdown} subtitle="Pooled liquidity by token." />
				<div className="rounded-lg border border-(--cards-border) bg-(--cards-bg) p-4">
					<h3 className="mb-3 text-sm font-semibold text-(--text-primary)">
						{liquidity.tokenValues.title ?? 'Token Values'}
					</h3>
					<ApiTable table={liquidity.tokenValues} maxHeight="420px" />
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<DonutCard dist={liquidity.distribution} subtitle="Pooled liquidity by asset class." />
				<DonutCard dist={liquidity.chainDistribution} subtitle="Pooled liquidity by connected chain." />
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<CategoryBarCard chart={liquidity.poolDepthChart} />
				<div className="rounded-lg border border-(--cards-border) bg-(--cards-bg) p-4">
					<h3 className="mb-3 text-sm font-semibold text-(--text-primary)">
						{liquidity.pools.title ?? 'Pools by Depth'}
					</h3>
					<ApiTable table={liquidity.pools} maxHeight="420px" />
				</div>
			</div>
		</section>
	)
}
