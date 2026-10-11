import { lazy, Suspense, useMemo } from 'react'
import type { IHBarChartProps } from '~/components/ECharts/HBarChart/types'
import { buildAlignedCartesianChartModel, type CartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { createSingleSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { CHART_SERIES_LIMIT } from '~/constants/colors'
import { Card } from '~/ui/Card'
import {
	CHART_FILL,
	ChartPanel,
	ChartPanelBodyLoading,
	ChartPanelExportShellLoading,
	ChartPanelTitle,
	ChartPanelToolbar
} from '~/ui/ChartPanel'
import { Skeleton } from '~/ui/Skeleton'
import { StatTile } from '~/ui/SummaryStats'
import { formatUsd } from '~/utils/numberFormat'
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

function parseChartDates(chart: ChartData): Array<number> {
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

function HeadlinePill({ label, value }: { label: string; value?: string }) {
	return (
		<div className="flex items-center gap-2 rounded-full border border-medium bg-surface px-3 py-1">
			<span className="label-sm text-secondary">{label}</span>
			{value ? <span className="title-md text-primary">{value}</span> : <Skeleton className="h-4 w-12" />}
		</div>
	)
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

	const tokenPie = intents ? aggregateBreakdown(intents.tokenBreakdown, CHART_SERIES_LIMIT) : undefined
	const blockchainPie = intents ? aggregateBreakdown(intents.blockchainBreakdown, CHART_SERIES_LIMIT) : undefined
	const channelBars = intents ? channelsToBars(intents.channelBreakdown) : undefined

	const dailyVolumeRaw = lastSeriesValue(intents?.volumeChart, 'Daily Volume')
	const dailyVolumeFormatted =
		dailyVolumeRaw != null
			? formatUsd(dailyVolumeRaw, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
			: undefined

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
			<Card padding="md" className="flex flex-col gap-2">
				<div className="flex items-center gap-3">
					<NearIcon />
					<h2 className="mono-xl text-primary">Ecosystem</h2>
				</div>
				<p className="max-w-2xl body-md text-secondary">
					Live metrics across NEAR Intents, base-chain activity, and token supply.
				</p>
			</Card>

			{/* NEAR Intents */}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="heading-xs">NEAR Intents</h2>
				<HeadlinePill label="Total Intent Fees" value={intents?.kpis.totalIntentFees.formatted} />
			</div>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{intents ? (
					<>
						<StatTile label="All-Time Volume" value={intents.kpis.allTimeVolume.formatted} />
						<StatTile label="30-Day Volume" value={intents.kpis.volume30d.formatted} />
						<StatTile label="7-Day Volume" value={intents.kpis.volume7d.formatted} />
						<StatTile label="Daily Volume" value={dailyVolumeFormatted ?? '—'} />

						<StatTile label="All-Time Swaps" value={intents.kpis.totalSwaps.formatted} />
						<StatTile label="30-Day Swaps" value={intents.kpis.swaps30d.formatted} />
						<StatTile label="7-Day Swaps" value={intents.kpis.swaps7d.formatted} />
						<StatTile label="Daily Swaps" value={intents.kpis.dailySwaps.formatted} />

						<StatTile label="Avg Trade Size" value={intents.kpis.avgTradeSize.formatted} />
						<StatTile label="30-Day Unique Users" value={intents.kpis.uniqueUsers30d.formatted} />
						<StatTile label="7-Day Unique Users" value={intents.kpis.uniqueUsers7d.formatted} />
						<StatTile label="1-Day Unique Users" value={intents.kpis.uniqueUsers1d.formatted} />
					</>
				) : (
					<>
						<StatTile label="All-Time Volume" loading />
						<StatTile label="30-Day Volume" loading />
						<StatTile label="7-Day Volume" loading />
						<StatTile label="Daily Volume" loading />

						<StatTile label="All-Time Swaps" loading />
						<StatTile label="30-Day Swaps" loading />
						<StatTile label="7-Day Swaps" loading />
						<StatTile label="Daily Swaps" loading />

						<StatTile label="Avg Trade Size" loading />
						<StatTile label="30-Day Unique Users" loading />
						<StatTile label="7-Day Unique Users" loading />
						<StatTile label="1-Day Unique Users" loading />
					</>
				)}
			</div>

			<ChartPanel>
				<ChartPanelToolbar leading={<ChartPanelTitle>NEAR Intents Daily Volume</ChartPanelTitle>} />
				{isLoading || !intentModels.volume ? (
					<ChartPanelBodyLoading />
				) : (
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={intentModels.volume.dataset}
							charts={intentModels.volume.charts}
							valueSymbol="$"
							containerClassName={CHART_FILL}
							showTotalInTooltip
							showLegend
							exportButtons="hidden"
						/>
					</Suspense>
				)}
			</ChartPanel>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>NEAR Intents Fees</ChartPanelTitle>} />
					{isLoading || !intentModels.fees ? (
						<ChartPanelBodyLoading />
					) : (
						<Suspense fallback={<ChartPanelBodyLoading />}>
							<MultiSeriesChart
								dataset={intentModels.fees.dataset}
								charts={intentModels.fees.charts}
								valueSymbol="$"
								containerClassName={CHART_FILL}
								showTotalInTooltip
								showLegend
								exportButtons="hidden"
							/>
						</Suspense>
					)}
				</ChartPanel>
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>NEAR Intents Swap Activity</ChartPanelTitle>} />
					{isLoading || !intentModels.activity ? (
						<ChartPanelBodyLoading />
					) : (
						<Suspense fallback={<ChartPanelBodyLoading />}>
							<MultiSeriesChart
								dataset={intentModels.activity.dataset}
								charts={intentModels.activity.charts}
								valueSymbol=""
								containerClassName={CHART_FILL}
								showTotalInTooltip
								showLegend
								exportButtons="hidden"
							/>
						</Suspense>
					)}
				</ChartPanel>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>Volume by Token (All-Time, Top 10)</ChartPanelTitle>} />
					{isLoading || !tokenPie ? (
						<ChartPanelBodyLoading />
					) : (
						<Suspense fallback={<ChartPanelBodyLoading />}>
							<PieChart
								chartData={tokenPie}
								valueSymbol="$"
								containerClassName={CHART_FILL}
								showLegend
								legendPosition={{
									orient: 'vertical',
									left: 'right',
									top: 'middle'
								}}
							/>
						</Suspense>
					)}
				</ChartPanel>
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>Volume by Blockchain (All-Time)</ChartPanelTitle>} />
					{isLoading || !blockchainPie ? (
						<ChartPanelBodyLoading />
					) : (
						<Suspense fallback={<ChartPanelBodyLoading />}>
							<PieChart
								chartData={blockchainPie}
								valueSymbol="$"
								containerClassName={CHART_FILL}
								showLegend
								legendPosition={{
									orient: 'vertical',
									left: 'right',
									top: 'middle'
								}}
							/>
						</Suspense>
					)}
				</ChartPanel>
			</div>

			<ChartPanel>
				<ChartPanelToolbar leading={<ChartPanelTitle>Fees by Referral Channel</ChartPanelTitle>} />
				{isLoading || !channelBars ? (
					<ChartPanelBodyLoading />
				) : (
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<HBarChart
							categories={channelBars.categories}
							values={channelBars.values}
							valueSymbol="$"
							colors={channelBars.categories.map((_, i) => BREAKDOWN_PALETTE[i % BREAKDOWN_PALETTE.length])}
						/>
					</Suspense>
				)}
			</ChartPanel>

			{/* Base-Chain Activity */}
			<h2 className="heading-xs">Base-Chain Activity</h2>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
				{eco ? (
					<>
						<StatTile label="Daily Transactions" value={eco.kpis.dailyTxns.formatted} />
						<StatTile label="Avg Daily Txns (7d)" value={eco.kpis.avgDailyTxns7d.formatted} />
						<StatTile label="Avg Daily Txns (30d)" value={eco.kpis.avgDailyTxns30d.formatted} />
					</>
				) : (
					<>
						<StatTile label="Daily Transactions" loading />
						<StatTile label="Avg Daily Txns (7d)" loading />
						<StatTile label="Avg Daily Txns (30d)" loading />
					</>
				)}
			</div>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{eco ? (
					<>
						<StatTile label="Daily Active Accounts" value={eco.kpis.dailyActiveAccounts.formatted} />
						<StatTile label="Monthly Active Accounts" value={eco.kpis.monthlyActiveAccounts.formatted} />
						<StatTile label="New Accounts (30d)" value={eco.kpis.newAccounts30d.formatted} />
						<StatTile label="Daily Gas Fee" value={eco.kpis.dailyGasFeeNear.formatted} />
					</>
				) : (
					<>
						<StatTile label="Daily Active Accounts" loading />
						<StatTile label="Monthly Active Accounts" loading />
						<StatTile label="New Accounts (30d)" loading />
						<StatTile label="Daily Gas Fee" loading />
					</>
				)}
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<ChartPanel>
					{isLoading || !areaDatasets.transactions ? (
						<ChartPanelExportShellLoading />
					) : (
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								title="Daily Transactions"
								headingAs="h3"
								dataset={areaDatasets.transactions}
								charts={DAILY_TRANSACTIONS_CHART}
								valueSymbol=""
								chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
								containerClassName={CHART_FILL}
							/>
						</Suspense>
					)}
				</ChartPanel>
				<ChartPanel>
					{isLoading || !areaDatasets.activeAccounts ? (
						<ChartPanelExportShellLoading />
					) : (
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								title="Daily Active Accounts"
								headingAs="h3"
								dataset={areaDatasets.activeAccounts}
								charts={ACTIVE_ACCOUNTS_CHART}
								valueSymbol=""
								chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
								containerClassName={CHART_FILL}
							/>
						</Suspense>
					)}
				</ChartPanel>
				<ChartPanel>
					{isLoading || !areaDatasets.newAccounts ? (
						<ChartPanelExportShellLoading />
					) : (
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								title="New Accounts Created"
								headingAs="h3"
								dataset={areaDatasets.newAccounts}
								charts={NEW_ACCOUNTS_CHART}
								valueSymbol=""
								chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
								containerClassName={CHART_FILL}
							/>
						</Suspense>
					)}
				</ChartPanel>
				<ChartPanel>
					{isLoading || !areaDatasets.gasFees ? (
						<ChartPanelExportShellLoading />
					) : (
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								title="Daily Gas Fees (NEAR)"
								headingAs="h3"
								dataset={areaDatasets.gasFees}
								charts={GAS_FEES_CHART}
								valueSymbol=" NEAR"
								chartOptions={NEAR_SINGLE_SERIES_CHART_OPTIONS}
								containerClassName={CHART_FILL}
							/>
						</Suspense>
					)}
				</ChartPanel>
			</div>

			{/* Token Overview */}
			<h2 className="heading-xs">Token Overview</h2>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
				{token ? (
					<>
						<StatTile label="NEAR Price" value={token.kpis.nearPrice.formatted} />
						<StatTile label="Market Cap" value={token.kpis.marketCap.formatted} />
						<StatTile label="Circulating Supply" value={token.kpis.circulatingSupply.formatted} />
						<StatTile label="Total Supply" value={token.kpis.totalSupply.formatted} />
						<StatTile label="Locked Supply" value={token.kpis.lockedSupply.formatted} />
					</>
				) : (
					<>
						<StatTile label="NEAR Price" loading />
						<StatTile label="Market Cap" loading />
						<StatTile label="Circulating Supply" loading />
						<StatTile label="Total Supply" loading />
						<StatTile label="Locked Supply" loading />
					</>
				)}
			</div>

			<ChartPanel>
				{isLoading || !areaDatasets.nearPrice ? (
					<ChartPanelExportShellLoading />
				) : (
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="NEAR Price (USD)"
							headingAs="h3"
							dataset={areaDatasets.nearPrice}
							charts={NEAR_PRICE_CHART}
							valueSymbol="$"
							chartOptions={DOLLAR_SINGLE_SERIES_CHART_OPTIONS}
							containerClassName={CHART_FILL}
						/>
					</Suspense>
				)}
			</ChartPanel>

			<ChartPanel>
				<ChartPanelToolbar leading={<ChartPanelTitle>Token Supply</ChartPanelTitle>} />
				{isLoading || !supplyModel ? (
					<ChartPanelBodyLoading />
				) : (
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={supplyModel.dataset}
							charts={supplyModel.charts}
							valueSymbol=" NEAR"
							containerClassName={CHART_FILL}
							showLegend
							exportButtons="hidden"
						/>
					</Suspense>
				)}
			</ChartPanel>

			{/* Protocol */}
			<h2 className="heading-xs">Protocol</h2>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
				{PROTOCOL_STATS.map((stat) => (
					<StatTile key={stat.label} label={stat.label} value={stat.value} sub={stat.description} />
				))}
			</div>
		</div>
	)
}
