import { lazy, useMemo } from 'react'
import type { IHBarChartProps } from '~/components/ECharts/HBarChart/types'
import { buildAlignedCartesianChartModel, type CartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { createSingleSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { formattedNum } from '~/utils'
import { aggregateBreakdown, channelsToBars, lastSeriesValue, singleSeriesDataset } from './chartData'
import { useEcosystemData, type ChartData } from './ecosystemApi'
import { NearIcon } from './NearIcon'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>

const UNITLESS_SINGLE_SERIES_CHART_OPTIONS = createSingleSeriesChartOptions('')
const NEAR_SINGLE_SERIES_CHART_OPTIONS = createSingleSeriesChartOptions(' NEAR')
const DOLLAR_SINGLE_SERIES_CHART_OPTIONS = createSingleSeriesChartOptions('$')

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

const DAILY_TRANSACTIONS_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Daily Transactions',
		type: 'line',
		encode: { x: 'timestamp', y: 'Daily Transactions' }
	}
]
const ACTIVE_ACCOUNTS_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Daily Active Accounts',
		type: 'line',
		encode: { x: 'timestamp', y: 'Daily Active Accounts' }
	}
]
const NEW_ACCOUNTS_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'New Accounts Created',
		type: 'line',
		encode: { x: 'timestamp', y: 'New Accounts Created' }
	}
]
const GAS_FEES_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Daily Gas Fees',
		type: 'line',
		encode: { x: 'timestamp', y: 'Daily Gas Fees' }
	}
]
const NEAR_PRICE_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'NEAR Price',
		type: 'line',
		encode: { x: 'timestamp', y: 'NEAR Price' },
		color: '#00C1DE'
	}
]

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

function parseChartDates(chart: ChartData): number[] {
	const timestamps = new Array<number>(chart.dates.length)
	for (let i = 0; i < chart.dates.length; i++) timestamps[i] = Date.parse(`${chart.dates[i]}T00:00:00Z`)
	return timestamps
}

function buildDailyCumulativeModel(
	chart: ChartData | undefined,
	dailyName: string,
	cumulativeName: string,
	barMaxWidth: number
): CartesianChartModel | undefined {
	if (!chart) return undefined
	const daily = chart.series.find((series) => series.name === dailyName)
	const cumulative = chart.series.find((series) => series.name === cumulativeName)
	if (!daily || !cumulative) return undefined

	return buildAlignedCartesianChartModel(
		parseChartDates(chart),
		[
			{
				name: cumulativeName,
				type: 'line',
				color: '#00C1DE',
				values: cumulative.data,
				yAxisIndex: 0
			},
			{
				name: dailyName,
				type: 'bar',
				color: '#4cae4f',
				values: daily.data,
				yAxisIndex: 1,
				barMaxWidth
			}
		],
		{ timestampMultiplier: 1 }
	)
}

function buildSupplyModel(chart: ChartData | undefined): CartesianChartModel | undefined {
	if (!chart) return undefined
	return buildAlignedCartesianChartModel(
		parseChartDates(chart),
		chart.series.map((series, index) => ({
			name: series.name,
			type: 'line' as const,
			color: index === 0 ? '#00C1DE' : '#4cae4f',
			values: series.data
		})),
		{ timestampMultiplier: 1 }
	)
}

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

	const intentModels = useMemo(
		() => ({
			volume: buildDailyCumulativeModel(intents?.volumeChart, 'Daily Volume', 'Cumulative Volume', 40),
			fees: buildDailyCumulativeModel(intents?.feesChart, 'Daily Fees', 'Cumulative Fees', 30),
			activity: buildDailyCumulativeModel(intents?.activityChart, 'Daily Swaps', 'Cumulative Swaps', 30)
		}),
		[intents]
	)

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

	const supplyModel = useMemo(() => buildSupplyModel(token?.supplyChart), [token])

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

			{isLoading || !intentModels.volume ? (
				<ChartSkeleton title="NEAR Intents Daily Volume" />
			) : (
				<ChartCard title="NEAR Intents Daily Volume">
					<MultiSeriesChart
						dataset={intentModels.volume.dataset}
						charts={intentModels.volume.charts}
						valueSymbol="$"
						height="400px"
						showTotalInTooltip
						hideDefaultLegend={false}
						exportButtons="hidden"
					/>
				</ChartCard>
			)}

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{isLoading || !intentModels.fees ? (
					<ChartSkeleton title="NEAR Intents Fees" />
				) : (
					<ChartCard title="NEAR Intents Fees">
						<MultiSeriesChart
							dataset={intentModels.fees.dataset}
							charts={intentModels.fees.charts}
							valueSymbol="$"
							height="350px"
							showTotalInTooltip
							hideDefaultLegend={false}
							exportButtons="hidden"
						/>
					</ChartCard>
				)}
				{isLoading || !intentModels.activity ? (
					<ChartSkeleton title="NEAR Intents Swap Activity" />
				) : (
					<ChartCard title="NEAR Intents Swap Activity">
						<MultiSeriesChart
							dataset={intentModels.activity.dataset}
							charts={intentModels.activity.charts}
							valueSymbol=""
							height="350px"
							showTotalInTooltip
							hideDefaultLegend={false}
							exportButtons="hidden"
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
						<MultiSeriesChart
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
						<MultiSeriesChart
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
						<MultiSeriesChart
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
						<MultiSeriesChart
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
					<MultiSeriesChart
						dataset={areaDatasets.nearPrice}
						charts={NEAR_PRICE_CHART}
						valueSymbol="$"
						chartOptions={DOLLAR_SINGLE_SERIES_CHART_OPTIONS}
						height="350px"
					/>
				</ChartCard>
			)}

			{isLoading || !supplyModel ? (
				<ChartSkeleton title="Token Supply" />
			) : (
				<ChartCard title="Token Supply">
					<MultiSeriesChart
						dataset={supplyModel.dataset}
						charts={supplyModel.charts}
						valueSymbol=" NEAR"
						height="350px"
						hideDefaultLegend={false}
						exportButtons="hidden"
					/>
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
