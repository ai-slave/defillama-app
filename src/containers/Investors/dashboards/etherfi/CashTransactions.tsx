import { lazy } from 'react'
import { CHART_INSET } from '~/components/ECharts/chartSpacing'
import { createTimeSeriesChartOptions } from '~/components/ECharts/timeSeriesChartOptions'
import type { IMultiSeriesChart2Props } from '~/components/ECharts/types'
import { formattedNum } from '~/utils'
import { useEtherfiCashTransactions } from './cashApi'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>

const BAR_EXPORT = { csv: true, png: false, filename: 'bar-chart-data' } as const
const UNITLESS_TIME_CHART_OPTIONS = createTimeSeriesChartOptions('')

const SCROLL_LEGEND = {
	...UNITLESS_TIME_CHART_OPTIONS,
	legend: { type: 'scroll' as const, orient: 'horizontal' as const, top: CHART_INSET }
} satisfies IMultiSeriesChart2Props['chartOptions']

const WEEKLY_TXNS_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'Transactions',
		type: 'bar',
		encode: { x: 'timestamp', y: 'Transactions' },
		color: '#4FC3F7',
		stack: 'a'
	}
]
const WEEKLY_USERS_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'Active Users',
		type: 'bar',
		encode: { x: 'timestamp', y: 'Active Users' },
		color: '#66BB6A',
		stack: 'a'
	}
]
const WEEKLY_AVG_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'Avg Txns per User',
		type: 'bar',
		encode: { x: 'timestamp', y: 'Avg Txns per User' },
		color: '#AB47BC',
		stack: 'a'
	}
]

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">{title}</h3>
			{children}
		</div>
	)
}

function CardSkeleton({ title }: { title: string }) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">{title}</h3>
			<div className="flex h-[400px] items-center justify-center">
				<div className="size-5 animate-spin rounded-full border-2 border-tertiary border-t-transparent" />
			</div>
		</div>
	)
}

function KpiCard({ label, value }: { label: string; value: string | number | null }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<span className="text-xs font-medium tracking-wide text-pro-text-label">{label}</span>
			<span className="text-2xl font-semibold text-pro-text-primary">{value ?? '—'}</span>
		</div>
	)
}

function KpiSkeleton({ label }: { label: string }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<span className="text-xs font-medium tracking-wide text-pro-text-label">{label}</span>
			<div className="h-8 w-24 animate-pulse rounded-sm bg-tertiary opacity-20" />
		</div>
	)
}

export default function CashTransactions() {
	const {
		kpis,
		classCharts,
		transactionsByClassDataset,
		usersByClassDataset,
		weeklyTxnsDataset,
		weeklyUsersDataset,
		weeklyAvgDataset,
		isLoading
	} = useEtherfiCashTransactions()

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
				{kpis ? (
					<>
						<KpiCard label="Txns All Time" value={formattedNum(kpis.allTimeTxns)} />
						<KpiCard label="Active Users All Time" value={formattedNum(kpis.allTimeUsers)} />
						<KpiCard label="Txns per User All Time" value={formattedNum(kpis.allTimeAvg)} />
					</>
				) : (
					<>
						<KpiSkeleton label="Txns All Time" />
						<KpiSkeleton label="Active Users All Time" />
						<KpiSkeleton label="Txns per User All Time" />
					</>
				)}
			</div>

			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
				{kpis ? (
					<>
						<KpiCard label="Txns Last Week" value={formattedNum(kpis.lastWeekTxns)} />
						<KpiCard label="Active Users Last Week" value={formattedNum(kpis.lastWeekUsers)} />
						<KpiCard label="Txns per User Last Week" value={formattedNum(kpis.lastWeekAvg)} />
					</>
				) : (
					<>
						<KpiSkeleton label="Txns Last Week" />
						<KpiSkeleton label="Active Users Last Week" />
						<KpiSkeleton label="Txns per User Last Week" />
					</>
				)}
			</div>

			{isLoading ? (
				<CardSkeleton title="Weekly Transactions by Class" />
			) : (
				<ChartCard title="Weekly Transactions by Class">
					<MultiSeriesChart2
						dataset={transactionsByClassDataset}
						charts={classCharts}
						valueSymbol=""
						title=""
						height="400px"
						hideDefaultLegend={classCharts.length < 2}
						chartOptions={SCROLL_LEGEND}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}

			{isLoading ? (
				<CardSkeleton title="Weekly Users by Class" />
			) : (
				<ChartCard title="Weekly Users by Class">
					<MultiSeriesChart2
						dataset={usersByClassDataset}
						charts={classCharts}
						valueSymbol=""
						title=""
						height="400px"
						hideDefaultLegend={classCharts.length < 2}
						chartOptions={SCROLL_LEGEND}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}

			{isLoading ? (
				<CardSkeleton title="Weekly Transactions" />
			) : (
				<ChartCard title="Weekly Transactions">
					<MultiSeriesChart2
						dataset={weeklyTxnsDataset}
						charts={WEEKLY_TXNS_CHART}
						valueSymbol=""
						title=""
						height="400px"
						chartOptions={UNITLESS_TIME_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}

			{isLoading ? (
				<CardSkeleton title="Weekly Active Users" />
			) : (
				<ChartCard title="Weekly Active Users">
					<MultiSeriesChart2
						dataset={weeklyUsersDataset}
						charts={WEEKLY_USERS_CHART}
						valueSymbol=""
						title=""
						height="400px"
						chartOptions={UNITLESS_TIME_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}

			{isLoading ? (
				<CardSkeleton title="Weekly Average Txns per User" />
			) : (
				<ChartCard title="Weekly Average Txns per User">
					<MultiSeriesChart2
						dataset={weeklyAvgDataset}
						charts={WEEKLY_AVG_CHART}
						valueSymbol=""
						title=""
						height="400px"
						chartOptions={UNITLESS_TIME_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}
		</div>
	)
}
