import { lazy } from 'react'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET } from '~/components/ECharts/shared/chartSpacing'
import { formatCompactNumber } from '~/utils/numberFormat'
import { useEtherfiCashTransactions } from './cashApi'
import { CardSkeleton, ChartCard, KpiCard, KpiSkeleton } from './ui'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const BAR_EXPORT = { csv: true, png: false, filename: 'bar-chart-data' } as const
const UNITLESS_TIME_CHART_OPTIONS = createTimeSeriesChartOptions('')

const SCROLL_LEGEND = {
	...UNITLESS_TIME_CHART_OPTIONS,
	legend: { type: 'scroll' as const, orient: 'horizontal' as const, top: CHART_INSET }
} satisfies IMultiSeriesChartProps['chartOptions']

const WEEKLY_TXNS_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Transactions',
		type: 'bar',
		encode: { x: 'timestamp', y: 'Transactions' },
		color: '#4FC3F7',
		stack: 'a'
	}
]
const WEEKLY_USERS_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Active Users',
		type: 'bar',
		encode: { x: 'timestamp', y: 'Active Users' },
		color: '#66BB6A',
		stack: 'a'
	}
]
const WEEKLY_AVG_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Avg Txns per User',
		type: 'bar',
		encode: { x: 'timestamp', y: 'Avg Txns per User' },
		color: '#AB47BC',
		stack: 'a'
	}
]

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
						<KpiCard
							label="Txns All Time"
							value={formatCompactNumber(kpis.allTimeTxns, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
						<KpiCard
							label="Active Users All Time"
							value={formatCompactNumber(kpis.allTimeUsers, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
						<KpiCard
							label="Txns per User All Time"
							value={formatCompactNumber(kpis.allTimeAvg, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
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
						<KpiCard
							label="Txns Last Week"
							value={formatCompactNumber(kpis.lastWeekTxns, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
						<KpiCard
							label="Active Users Last Week"
							value={formatCompactNumber(kpis.lastWeekUsers, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
						<KpiCard
							label="Txns per User Last Week"
							value={formatCompactNumber(kpis.lastWeekAvg, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
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
					<MultiSeriesChart
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
					<MultiSeriesChart
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
					<MultiSeriesChart
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
					<MultiSeriesChart
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
					<MultiSeriesChart
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
