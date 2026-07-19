import { lazy, useMemo } from 'react'
import { createSingleSeriesChartOptions } from '~/components/ECharts/timeSeriesChartOptions'
import type {
	IHBarChartProps,
	IMultiSeriesChart2Props,
	IMultiSeriesChartProps,
	IPieChartProps,
	MultiSeriesChart2Dataset
} from '~/components/ECharts/types'
import { formattedNum } from '~/utils'
import {
	useEcosystemData,
	chartToTimeSeries,
	type BreakdownChart,
	type ChannelBreakdown,
	type ChartData
} from './ecosystemApi'
import { NearIcon } from './NearHeader'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>
const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>

const UNITLESS_SINGLE_SERIES_CHART_OPTIONS = createSingleSeriesChartOptions('')
const NEAR_SINGLE_SERIES_CHART_OPTIONS = createSingleSeriesChartOptions(' NEAR')
const DOLLAR_SINGLE_SERIES_CHART_OPTIONS = createSingleSeriesChartOptions('$')
const BAR_MAX_WIDTH_40_CHART_OPTIONS = { series: { barMaxWidth: 40 } }
const BAR_MAX_WIDTH_30_CHART_OPTIONS = { series: { barMaxWidth: 30 } }

const BREAKDOWN_PALETTE = [
	'#00C1DE',
	'#4cae4f',
	'#f59e0b',
	'#ef4444',
	'#8b5cf6',
	'#ec4899',
	'#14b8a6',
	'#f97316',
	'#3b82f6',
	'#a855f7',
	'#10b981',
	'#eab308',
	'#06b6d4',
	'#dc2626',
	'#22c55e',
	'#0ea5e9',
	'#d946ef',
	'#84cc16',
	'#f43f5e',
	'#6366f1'
]

const DAILY_TRANSACTIONS_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'Daily Transactions',
		type: 'line',
		encode: { x: 'timestamp', y: 'Daily Transactions' }
	}
]
const ACTIVE_ACCOUNTS_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'Daily Active Accounts',
		type: 'line',
		encode: { x: 'timestamp', y: 'Daily Active Accounts' }
	}
]
const NEW_ACCOUNTS_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'New Accounts Created',
		type: 'line',
		encode: { x: 'timestamp', y: 'New Accounts Created' }
	}
]
const GAS_FEES_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'Daily Gas Fees',
		type: 'line',
		encode: { x: 'timestamp', y: 'Daily Gas Fees' }
	}
]
const NEAR_PRICE_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'NEAR Price',
		type: 'line',
		encode: { x: 'timestamp', y: 'NEAR Price' },
		color: '#00C1DE'
	}
]

function singleSeriesDataset(chart: ChartData, dimension: string): MultiSeriesChart2Dataset | undefined {
	const values = chart.series[0]?.data
	if (!values) return undefined
	return {
		dimensions: ['timestamp', dimension],
		source: chart.dates.map((date, index) => ({
			timestamp: Date.parse(`${date}T00:00:00Z`),
			[dimension]: values[index]
		}))
	}
}

function aggregateBreakdown(chart: BreakdownChart, topN: number): { name: string; value: number }[] {
	const totals = chart.series.map((s) => ({
		name: s.name,
		value: s.data.reduce((a, b) => a + (b ?? 0), 0)
	}))
	totals.sort((a, b) => b.value - a.value)
	if (totals.length <= topN) return totals
	const top = totals.slice(0, topN)
	const othersValue = totals.slice(topN).reduce((acc, t) => acc + t.value, 0)
	if (othersValue > 0) top.push({ name: 'Others', value: othersValue })
	return top
}

function channelsToBars(breakdown: ChannelBreakdown): {
	categories: string[]
	values: number[]
} {
	const sorted = breakdown.channels.toSorted((a, b) => b.fees - a.fees)
	return {
		categories: sorted.map((c) => c.referral || 'unknown'),
		values: sorted.map((c) => c.fees)
	}
}

function lastSeriesValue(chart: ChartData | undefined, seriesName: string): number | undefined {
	if (!chart) return undefined
	const series = chart.series.find((s) => s.name === seriesName)
	if (!series || series.data.length === 0) return undefined
	for (let i = series.data.length - 1; i >= 0; i--) {
		const v = series.data[i]
		if (v != null && !Number.isNaN(v)) return v
	}
	return undefined
}

const PROTOCOL_STATS = [
	{
		label: 'TPS Capacity',
		value: '1M+',
		description: 'Transactions per second'
	},
	{ label: 'Shards', value: '9', description: 'Live shards on mainnet' },
	{
		label: 'Block Time',
		value: '600ms',
		description: 'Average block production time'
	},
	{
		label: 'Finality',
		value: '1.2s',
		description: 'Time to transaction finality'
	},
	{
		label: 'AI Agents',
		value: '1,300+',
		description: 'Active agents on NEAR AI'
	}
]

function StatCard({ label, value, description }: { label: string; value: string; description: string }) {
	return (
		<div className="flex flex-col gap-2 rounded-xl border border-pro-cards-border bg-pro-cards-bg p-5 transition-all hover:border-sl-accent/20 hover:shadow-md">
			<span className="text-xs font-medium tracking-wide text-pro-text-label">{label}</span>
			<span className="text-3xl font-bold tracking-tight text-pro-text-primary">{value}</span>
			<span className="text-xs text-pro-text-secondary">{description}</span>
		</div>
	)
}

function KpiCard({ label, value }: { label: string; value?: string }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<span className="text-xs font-medium tracking-wide text-pro-text-label">{label}</span>
			{value ? (
				<span className="text-2xl font-semibold text-pro-text-primary">{value}</span>
			) : (
				<div className="h-8 w-24 animate-pulse rounded-sm bg-tertiary opacity-20" />
			)}
		</div>
	)
}

function HeadlinePill({ label, value }: { label: string; value?: string }) {
	return (
		<div className="flex items-center gap-2 rounded-full border border-pro-cards-border bg-pro-cards-bg px-3 py-1">
			<span className="text-xs font-medium text-pro-text-label">{label}</span>
			{value ? (
				<span className="text-sm font-semibold text-pro-text-primary">{value}</span>
			) : (
				<span className="inline-block h-4 w-12 animate-pulse rounded-sm bg-tertiary opacity-20" />
			)}
		</div>
	)
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">{title}</h3>
			{children}
		</div>
	)
}

function ChartSkeleton({ title }: { title: string }) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">{title}</h3>
			<div className="flex h-[350px] items-center justify-center">
				<div className="size-5 animate-spin rounded-full border-2 border-tertiary border-t-transparent" />
			</div>
		</div>
	)
}

function SectionTitle({ children }: { children: React.ReactNode }) {
	return <h2 className="heading-xs tracking-tight text-pro-text-primary">{children}</h2>
}

export default function Ecosystem() {
	const { data, isLoading } = useEcosystemData()

	const intents = data?.intents
	const eco = data?.ecosystem
	const token = data?.tokenEconomics

	const buildDailyCumulativeSeries = (
		chart: typeof intents.volumeChart | undefined,
		dailyName: string,
		cumulativeName: string
	) => {
		if (!chart) return undefined
		const ts = chartToTimeSeries(chart)
		const daily = ts.find((s) => s.name === dailyName)
		const cumulative = ts.find((s) => s.name === cumulativeName)
		return [
			cumulative && {
				name: cumulativeName,
				type: 'line' as const,
				color: '#00C1DE',
				data: cumulative.data,
				yAxisIndex: 0
			},
			daily && {
				name: dailyName,
				type: 'bar' as const,
				color: '#4cae4f',
				data: daily.data,
				yAxisIndex: 1
			}
		].filter(Boolean)
	}

	const volumeSeries = buildDailyCumulativeSeries(intents?.volumeChart, 'Daily Volume', 'Cumulative Volume')
	const feesSeries = buildDailyCumulativeSeries(intents?.feesChart, 'Daily Fees', 'Cumulative Fees')
	const activitySeries = buildDailyCumulativeSeries(intents?.activityChart, 'Daily Swaps', 'Cumulative Swaps')

	const tokenPie = intents ? aggregateBreakdown(intents.tokenBreakdown, 15) : undefined
	const blockchainPie = intents ? aggregateBreakdown(intents.blockchainBreakdown, 15) : undefined
	const channelBars = intents ? channelsToBars(intents.channelBreakdown) : undefined

	const dailyVolumeRaw = lastSeriesValue(intents?.volumeChart, 'Daily Volume')
	const dailyVolumeFormatted = dailyVolumeRaw != null ? formattedNum(dailyVolumeRaw, true) : undefined

	const areaDatasets = useMemo(
		() => ({
			transactions: eco ? singleSeriesDataset(eco.txnsChart, 'Daily Transactions') : undefined,
			activeAccounts: eco ? singleSeriesDataset(eco.activeAccountsChart, 'Daily Active Accounts') : undefined,
			newAccounts: eco ? singleSeriesDataset(eco.newAccountsChart, 'New Accounts Created') : undefined,
			gasFees: eco ? singleSeriesDataset(eco.gasChart, 'Daily Gas Fees') : undefined,
			nearPrice: token ? singleSeriesDataset(token.priceChart, 'NEAR Price') : undefined
		}),
		[eco, token]
	)

	const supplySeries = token
		? (() => {
				const ts = chartToTimeSeries(token.supplyChart)
				return ts.map((s, i) => ({
					name: s.name,
					type: 'line' as const,
					color: i === 0 ? '#00C1DE' : '#4cae4f',
					data: s.data,
					yAxisIndex: 0
				}))
			})()
		: undefined

	return (
		<div className="flex flex-col gap-8">
			<div className="flex flex-col gap-2 rounded-xl border border-pro-cards-border bg-pro-cards-bg p-6">
				<div className="flex items-center gap-3">
					<NearIcon />
					<h1 className="heading-sm text-pro-text-primary">Ecosystem</h1>
				</div>
				<p className="max-w-2xl text-sm leading-relaxed text-pro-text-secondary">
					Live metrics across NEAR Intents, base-chain activity, and token supply.
				</p>
			</div>

			{/* NEAR Intents */}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<SectionTitle>NEAR Intents</SectionTitle>
				<HeadlinePill label="Total Intent Fees" value={intents?.kpis.totalIntentFees.formatted} />
			</div>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<KpiCard label="All-Time Volume" value={intents?.kpis.allTimeVolume.formatted} />
				<KpiCard label="30-Day Volume" value={intents?.kpis.volume30d.formatted} />
				<KpiCard label="7-Day Volume" value={intents?.kpis.volume7d.formatted} />
				<KpiCard label="Daily Volume" value={dailyVolumeFormatted} />

				<KpiCard label="All-Time Swaps" value={intents?.kpis.totalSwaps.formatted} />
				<KpiCard label="30-Day Swaps" value={intents?.kpis.swaps30d.formatted} />
				<KpiCard label="7-Day Swaps" value={intents?.kpis.swaps7d.formatted} />
				<KpiCard label="Daily Swaps" value={intents?.kpis.dailySwaps.formatted} />

				<KpiCard label="Avg Trade Size" value={intents?.kpis.avgTradeSize.formatted} />
				<KpiCard label="30-Day Unique Users" value={intents?.kpis.uniqueUsers30d.formatted} />
				<KpiCard label="7-Day Unique Users" value={intents?.kpis.uniqueUsers7d.formatted} />
				<KpiCard label="1-Day Unique Users" value={intents?.kpis.uniqueUsers1d.formatted} />
			</div>

			{isLoading || !volumeSeries ? (
				<ChartSkeleton title="NEAR Intents Daily Volume" />
			) : (
				<ChartCard title="NEAR Intents Daily Volume">
					<MultiSeriesChart
						series={volumeSeries}
						valueSymbol="$"
						yAxisSymbols={['$', '$']}
						height="400px"
						showAggregateInTooltip
						chartOptions={BAR_MAX_WIDTH_40_CHART_OPTIONS}
					/>
				</ChartCard>
			)}

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{isLoading || !feesSeries ? (
					<ChartSkeleton title="NEAR Intents Fees" />
				) : (
					<ChartCard title="NEAR Intents Fees">
						<MultiSeriesChart
							series={feesSeries}
							valueSymbol="$"
							yAxisSymbols={['$', '$']}
							height="350px"
							showAggregateInTooltip
							chartOptions={BAR_MAX_WIDTH_30_CHART_OPTIONS}
						/>
					</ChartCard>
				)}
				{isLoading || !activitySeries ? (
					<ChartSkeleton title="NEAR Intents Swap Activity" />
				) : (
					<ChartCard title="NEAR Intents Swap Activity">
						<MultiSeriesChart
							series={activitySeries}
							valueSymbol=""
							yAxisSymbols={['', '']}
							height="350px"
							showAggregateInTooltip
							chartOptions={BAR_MAX_WIDTH_30_CHART_OPTIONS}
						/>
					</ChartCard>
				)}
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{isLoading || !tokenPie ? (
					<ChartSkeleton title="Volume by Token (All-Time, Top 15)" />
				) : (
					<ChartCard title="Volume by Token (All-Time, Top 15)">
						<PieChart
							chartData={tokenPie}
							valueSymbol="$"
							height="380px"
							showLegend
							legendPosition={{
								orient: 'vertical',
								left: 'right',
								top: 'middle'
							}}
						/>
					</ChartCard>
				)}
				{isLoading || !blockchainPie ? (
					<ChartSkeleton title="Volume by Blockchain (All-Time)" />
				) : (
					<ChartCard title="Volume by Blockchain (All-Time)">
						<PieChart
							chartData={blockchainPie}
							valueSymbol="$"
							height="380px"
							showLegend
							legendPosition={{
								orient: 'vertical',
								left: 'right',
								top: 'middle'
							}}
						/>
					</ChartCard>
				)}
			</div>

			{isLoading || !channelBars ? (
				<ChartSkeleton title="Fees by Referral Channel" />
			) : (
				<ChartCard title="Fees by Referral Channel">
					<HBarChart
						categories={channelBars.categories}
						values={channelBars.values}
						valueSymbol="$"
						height="400px"
						colors={channelBars.categories.map((_, i) => BREAKDOWN_PALETTE[i % BREAKDOWN_PALETTE.length])}
					/>
				</ChartCard>
			)}

			{/* Base-Chain Activity */}
			<SectionTitle>Base-Chain Activity</SectionTitle>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
				<KpiCard label="Daily Transactions" value={eco?.kpis.dailyTxns.formatted} />
				<KpiCard label="Avg Daily Txns (7d)" value={eco?.kpis.avgDailyTxns7d.formatted} />
				<KpiCard label="Avg Daily Txns (30d)" value={eco?.kpis.avgDailyTxns30d.formatted} />
			</div>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<KpiCard label="Daily Active Accounts" value={eco?.kpis.dailyActiveAccounts.formatted} />
				<KpiCard label="Monthly Active Accounts" value={eco?.kpis.monthlyActiveAccounts.formatted} />
				<KpiCard label="New Accounts (30d)" value={eco?.kpis.newAccounts30d.formatted} />
				<KpiCard label="Daily Gas Fee" value={eco?.kpis.dailyGasFeeNear.formatted} />
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{isLoading || !areaDatasets.transactions ? (
					<ChartSkeleton title="Daily Transactions" />
				) : (
					<ChartCard title="Daily Transactions">
						<MultiSeriesChart2
							dataset={areaDatasets.transactions}
							charts={DAILY_TRANSACTIONS_CHART}
							valueSymbol=""
							chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
							height="300px"
						/>
					</ChartCard>
				)}
				{isLoading || !areaDatasets.activeAccounts ? (
					<ChartSkeleton title="Daily Active Accounts" />
				) : (
					<ChartCard title="Daily Active Accounts">
						<MultiSeriesChart2
							dataset={areaDatasets.activeAccounts}
							charts={ACTIVE_ACCOUNTS_CHART}
							valueSymbol=""
							chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
							height="300px"
						/>
					</ChartCard>
				)}
				{isLoading || !areaDatasets.newAccounts ? (
					<ChartSkeleton title="New Accounts Created" />
				) : (
					<ChartCard title="New Accounts Created">
						<MultiSeriesChart2
							dataset={areaDatasets.newAccounts}
							charts={NEW_ACCOUNTS_CHART}
							valueSymbol=""
							chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
							height="300px"
						/>
					</ChartCard>
				)}
				{isLoading || !areaDatasets.gasFees ? (
					<ChartSkeleton title="Daily Gas Fees (NEAR)" />
				) : (
					<ChartCard title="Daily Gas Fees (NEAR)">
						<MultiSeriesChart2
							dataset={areaDatasets.gasFees}
							charts={GAS_FEES_CHART}
							valueSymbol=" NEAR"
							chartOptions={NEAR_SINGLE_SERIES_CHART_OPTIONS}
							height="300px"
						/>
					</ChartCard>
				)}
			</div>

			{/* Token Overview */}
			<SectionTitle>Token Overview</SectionTitle>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
				<KpiCard label="NEAR Price" value={token?.kpis.nearPrice.formatted} />
				<KpiCard label="Market Cap" value={token?.kpis.marketCap.formatted} />
				<KpiCard label="Circulating Supply" value={token?.kpis.circulatingSupply.formatted} />
				<KpiCard label="Total Supply" value={token?.kpis.totalSupply.formatted} />
				<KpiCard label="Locked Supply" value={token?.kpis.lockedSupply.formatted} />
			</div>

			{isLoading || !areaDatasets.nearPrice ? (
				<ChartSkeleton title="NEAR Price (USD)" />
			) : (
				<ChartCard title="NEAR Price (USD)">
					<MultiSeriesChart2
						dataset={areaDatasets.nearPrice}
						charts={NEAR_PRICE_CHART}
						valueSymbol="$"
						chartOptions={DOLLAR_SINGLE_SERIES_CHART_OPTIONS}
						height="350px"
					/>
				</ChartCard>
			)}

			{isLoading || !supplySeries ? (
				<ChartSkeleton title="Token Supply" />
			) : (
				<ChartCard title="Token Supply">
					<MultiSeriesChart series={supplySeries} valueSymbol=" NEAR" height="350px" />
				</ChartCard>
			)}

			{/* Protocol */}
			<SectionTitle>Protocol</SectionTitle>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
				{PROTOCOL_STATS.map((stat) => (
					<StatCard key={stat.label} {...stat} />
				))}
			</div>
		</div>
	)
}
