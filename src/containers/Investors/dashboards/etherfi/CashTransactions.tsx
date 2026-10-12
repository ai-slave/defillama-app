import { lazy, Suspense } from 'react'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET } from '~/components/ECharts/shared/chartSpacing'
import { ChartPanelExportShellLoading } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { PanelLoadingStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { formatCompactNumber } from '~/utils/numberFormat'
import { useEtherfiCashTransactions } from './cashApi'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

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
						<StatTile
							label="Txns All Time"
							value={formatCompactNumber(kpis.allTimeTxns, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
						<StatTile
							label="Active Users All Time"
							value={formatCompactNumber(kpis.allTimeUsers, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
						<StatTile
							label="Txns per User All Time"
							value={formatCompactNumber(kpis.allTimeAvg, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
					</>
				) : (
					<>
						<StatTile label="Txns All Time" loading />
						<StatTile label="Active Users All Time" loading />
						<StatTile label="Txns per User All Time" loading />
					</>
				)}
			</div>

			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
				{kpis ? (
					<>
						<StatTile
							label="Txns Last Week"
							value={formatCompactNumber(kpis.lastWeekTxns, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
						<StatTile
							label="Active Users Last Week"
							value={formatCompactNumber(kpis.lastWeekUsers, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
						<StatTile
							label="Txns per User Last Week"
							value={formatCompactNumber(kpis.lastWeekAvg, {
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						/>
					</>
				) : (
					<>
						<StatTile label="Txns Last Week" loading />
						<StatTile label="Active Users Last Week" loading />
						<StatTile label="Txns per User Last Week" loading />
					</>
				)}
			</div>

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Weekly Transactions by class"
							headingAs="h3"
							dataset={transactionsByClassDataset}
							charts={classCharts}
							valueSymbol=""
							showLegend={classCharts.length > 1}
							chartOptions={SCROLL_LEGEND}
							exportButtons="auto"
						/>
					</Suspense>
				</Panel>
			)}

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Weekly Users by class"
							headingAs="h3"
							dataset={usersByClassDataset}
							charts={classCharts}
							valueSymbol=""
							showLegend={classCharts.length > 1}
							chartOptions={SCROLL_LEGEND}
							exportButtons="auto"
						/>
					</Suspense>
				</Panel>
			)}

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Weekly Transactions"
							headingAs="h3"
							dataset={weeklyTxnsDataset}
							charts={WEEKLY_TXNS_CHART}
							valueSymbol=""
							chartOptions={UNITLESS_TIME_CHART_OPTIONS}
							exportButtons="auto"
						/>
					</Suspense>
				</Panel>
			)}

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Weekly Active Users"
							headingAs="h3"
							dataset={weeklyUsersDataset}
							charts={WEEKLY_USERS_CHART}
							valueSymbol=""
							chartOptions={UNITLESS_TIME_CHART_OPTIONS}
							exportButtons="auto"
						/>
					</Suspense>
				</Panel>
			)}

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Weekly Average Txns per User"
							headingAs="h3"
							dataset={weeklyAvgDataset}
							charts={WEEKLY_AVG_CHART}
							valueSymbol=""
							chartOptions={UNITLESS_TIME_CHART_OPTIONS}
							exportButtons="auto"
						/>
					</Suspense>
				</Panel>
			)}
		</div>
	)
}
