import { formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import type { Chart, Kpi as KpiT } from './transform'
import { chartToTrendSeries, groupTopN, SeriesTrendChart } from './TrendChart'
import { BarListCard, ChartCard, MiniTable, PageLoader, SectionHeader, TimeAreaCard, useUniswapData } from './ui'

const PERCENT_OPTIONS = {
	input: 'percent',
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
	useGrouping: false
} as const

// The ir-server switched the window from 30d to 3 months; the old
// field names are kept as fallbacks so an older payload still renders.
interface MarketshareRow {
	chain: string
	uniswapVolumeFormatted?: string
	chainVolumeFormatted?: string
	uniswapVolume30dFormatted?: string
	chainVolume30dFormatted?: string
	sharePct: number
}

interface OrderFlowRow {
	entity: string
	volumeFormatted: string
	trades: number
	sharePct: number
}

interface OrderFlowVersionRow {
	entity: string
	totalFormatted: string
	v2Formatted: string
	v3Formatted: string
	v4Formatted: string
}

interface TopHookProjectRow {
	project: string
	hooks: number
	volumeFormatted: string
	sharePct: number
}

// All served by the ir-server: order flow comes from Dune tx_to labeling, hooks from the
// v4 PoolManager events, and marketshare from DefiLlama per-chain DEX overviews (an
// ir-server computation across many chains, so it stays server-side). "Router Volume by
// Generation" was removed per Uniswap in the methodology review.
interface IntegrationsData {
	kpis: Record<string, KpiT | undefined>
	marketshareByChain: Chart
	currentMarketshare: { title?: string; rows: Array<MarketshareRow> }
	orderFlowByEntity: Chart
	uniswapVsOther: Chart
	orderFlowTable30d: { title?: string; rows: Array<OrderFlowRow> }
	orderFlowByVersion: { title?: string; rows: Array<OrderFlowVersionRow> }
	hooks: {
		kpis: Record<string, KpiT | undefined>
		adoption: Chart
		creationByCapability: Chart
	}
	hookVolume: Chart
	topHookProjects: { title?: string; rows: Array<TopHookProjectRow> }
	hookCategories: Chart
}

export default function Integrations() {
	const { data } = useUniswapData<IntegrationsData>('integrations')
	if (!data) return <PageLoader />

	// The 30d table lists every labeled integrator; the weekly chart stays readable at top 12.
	const orderFlowSeries = groupTopN(chartToTrendSeries(data.orderFlowByEntity), 12)
	const hookCategoryItems = (data.hookCategories?.dates ?? [])
		.map((name, index) => ({ name, value: data.hookCategories.series[0]?.data[index] ?? 0 }))
		.sort((a, b) => {
			const aOther = a.name.startsWith('Unclassified')
			const bOther = b.name.startsWith('Unclassified')
			if (aOther !== bOther) return aOther ? 1 : -1
			return b.value - a.value
		})

	return (
		<div className="flex flex-col gap-10">
			{/* No KPI stat cards on this tab. */}
			<section className="flex flex-col gap-6">
				<SectionHeader>Market Share</SectionHeader>
				{/* Open on the last ~2 years: the full weekly history back to 2018 is unreadable
				    as a default view (the zoom slider still reaches it). */}
				<TimeAreaCard
					chart={data.marketshareByChain}
					valueSymbol="%"
					zoomLastPoints={104}
					subtitle="Uniswap's weekly share of each chain's spot-DEX volume. Click a legend entry to toggle a chain."
				/>
				<ChartCard
					title={data.currentMarketshare.title ?? 'Uniswap DEX Market Share by Chain (3 Months)'}
					subtitle="Trailing 3-month Uniswap volume against each chain's spot-DEX volume."
				>
					<MiniTable
						grid="minmax(120px,1.2fr) minmax(120px,1fr) minmax(130px,1fr) minmax(90px,0.7fr)"
						headers={[
							['Chain', 'left'],
							['Uniswap', 'right'],
							['Chain DEXs', 'right'],
							['Share', 'right']
						]}
						rows={data.currentMarketshare.rows.map((row) => [
							row.chain,
							row.uniswapVolumeFormatted ?? row.uniswapVolume30dFormatted ?? '-',
							row.chainVolumeFormatted ?? row.chainVolume30dFormatted ?? '-',
							formatPercent(row.sharePct, PERCENT_OPTIONS)
						])}
					/>
				</ChartCard>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>Order Flow</SectionHeader>
				<SeriesTrendChart
					title="Entity-Driven Protocol Order Flow"
					subtitle="Weekly volume by the third-party integrator or aggregator that routed the swap (tx_to labeling); top 12 entities plus Others."
					series={orderFlowSeries}
				/>
				<SeriesTrendChart
					title={data.uniswapVsOther.title ?? 'Uniswap Router vs Aggregator Volume'}
					subtitle="Routed flow only: Uniswap's own routers vs third-party aggregators (direct and MEV/arbitrage flow excluded)."
					series={chartToTrendSeries(data.uniswapVsOther)}
				/>
				<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
					<ChartCard
						title={data.orderFlowTable30d.title ?? 'Aggregator & Router Order Flow (30d)'}
						subtitle="Every labeled entity with volume, trades, and share of routed flow."
					>
						<MiniTable
							grid="minmax(140px,1.5fr) minmax(100px,1fr) minmax(90px,1fr) minmax(70px,0.6fr)"
							headers={[
								['Entity', 'left'],
								['Volume', 'right'],
								['Trades', 'right'],
								['Share', 'right']
							]}
							rows={data.orderFlowTable30d.rows.map((row) => [
								row.entity,
								row.volumeFormatted,
								formatCompactNumber(row.trades) ?? String(row.trades),
								formatPercent(row.sharePct, PERCENT_OPTIONS)
							])}
							maxHeight="480px"
						/>
					</ChartCard>
					<ChartCard
						title={data.orderFlowByVersion.title ?? 'Order Flow by Aggregator and Version (30d)'}
						subtitle="The same order flow split by the AMM version it settled on."
					>
						<MiniTable
							grid="minmax(140px,1.5fr) minmax(90px,1fr) minmax(80px,0.8fr) minmax(80px,0.8fr) minmax(80px,0.8fr)"
							headers={[
								['Entity', 'left'],
								['Total', 'right'],
								['v2', 'right'],
								['v3', 'right'],
								['v4', 'right']
							]}
							rows={data.orderFlowByVersion.rows.map((row) => [
								row.entity,
								row.totalFormatted,
								row.v2Formatted,
								row.v3Formatted,
								row.v4Formatted
							])}
							maxHeight="480px"
						/>
					</ChartCard>
				</div>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>v4 Hooks</SectionHeader>
				<TimeAreaCard
					chart={data.hooks.adoption}
					valueSymbol="%"
					subtitle="Share of all v4 pools created to date that use a hook."
				/>
				<SeriesTrendChart
					title="v4 Hook Creation by Capability"
					subtitle="New v4 hook contracts per week by capability class, read from the permission bits in the hook address."
					series={chartToTrendSeries(data.hooks.creationByCapability)}
					valueSymbol=""
				/>
				<SeriesTrendChart
					title="Hook Volume"
					subtitle="Weekly v4 swap volume through hooked vs non-hooked pools (Ethereum)."
					series={chartToTrendSeries(data.hookVolume)}
				/>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<BarListCard
						title={data.hookCategories?.title ?? 'v4 Hook Volume by Category'}
						subtitle="90-day hooked volume rolled up by project category."
						items={hookCategoryItems}
						valueSymbol="$"
					/>
					<ChartCard
						title={data.topHookProjects.title ?? 'Top Projects Using v4 Hooks'}
						subtitle="Projects by 90-day volume through their hooks (labels from Uniswap's own categorization)."
					>
						<MiniTable
							grid="minmax(130px,1.5fr) minmax(60px,0.5fr) minmax(100px,1fr) minmax(70px,0.6fr)"
							headers={[
								['Project', 'left'],
								['Hooks', 'right'],
								['Volume (90d)', 'right'],
								['Share', 'right']
							]}
							rows={data.topHookProjects.rows.map((row) => [
								row.project,
								row.hooks,
								row.volumeFormatted,
								formatPercent(row.sharePct, PERCENT_OPTIONS)
							])}
							maxHeight="420px"
						/>
					</ChartCard>
				</div>
			</section>
		</div>
	)
}
