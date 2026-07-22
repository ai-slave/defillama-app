import { lazy, useMemo } from 'react'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { formattedNum } from '~/utils'
import { useEtherfiCashFeesCharts, useEtherfiCashMetrics, useEtherfiCashTvlChart } from './api'
import { CardSkeleton, ChartCard, KpiCard, KpiSkeleton } from './ui'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const AREA_EXPORT = { csv: true, png: true, filename: 'chart' } as const
const BAR_EXPORT = { csv: true, png: false, filename: 'bar-chart-data' } as const
const DOLLAR_TIME_CHART_OPTIONS = createTimeSeriesChartOptions('$')

const TVL_CHART: IMultiSeriesChartProps['charts'] = [
	{ name: 'TVL', type: 'line', encode: { x: 'timestamp', y: 'TVL' } }
]
const FEES_CHART: IMultiSeriesChartProps['charts'] = [
	{ name: 'Fees', type: 'bar', encode: { x: 'timestamp', y: 'Fees' }, color: '#4FC3F7', stack: 'a' }
]
const REVENUE_CHART: IMultiSeriesChartProps['charts'] = [
	{ name: 'Revenue', type: 'bar', encode: { x: 'timestamp', y: 'Revenue' }, color: '#66BB6A', stack: 'a' }
]
const HOLDERS_REVENUE_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Holders Revenue',
		type: 'bar',
		encode: { x: 'timestamp', y: 'Holders Revenue' },
		color: '#FFA726',
		stack: 'a'
	}
]
const INFLOWS_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'USD Inflows',
		type: 'bar',
		encode: { x: 'timestamp', y: 'USD Inflows' },
		color: '#AB47BC',
		stack: 'a'
	}
]

export default function CreditCard() {
	const { fees, revenue, isLoading: metricsLoading } = useEtherfiCashMetrics()
	const { tvlDataset, inflowsDataset, previousTvl, previousInflow, isLoading: tvlLoading } = useEtherfiCashTvlChart()
	const {
		feesDataset,
		revenueDataset,
		holdersRevenueDataset,
		hasHoldersRevenue,
		isLoading: feesLoading
	} = useEtherfiCashFeesCharts()

	const kpis = useMemo(() => {
		if (metricsLoading || tvlLoading) return null

		return {
			tvl: previousTvl != null ? formattedNum(previousTvl, true) : '—',
			fees24h: fees?.total48hto24h != null ? formattedNum(fees.total48hto24h, true) : '—',
			revenue24h: revenue?.total48hto24h != null ? formattedNum(revenue.total48hto24h, true) : '—',
			inflows: previousInflow != null ? formattedNum(previousInflow, true) : '—'
		}
	}, [fees, revenue, previousTvl, previousInflow, metricsLoading, tvlLoading])

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{kpis ? (
					<>
						<KpiCard label="TVL" value={kpis.tvl} />
						<KpiCard label="Fees (24h)" value={kpis.fees24h} />
						<KpiCard label="Revenue (24h)" value={kpis.revenue24h} />
						<KpiCard label="USD Inflows (Latest)" value={kpis.inflows} />
					</>
				) : (
					<>
						<KpiSkeleton label="TVL" />
						<KpiSkeleton label="Fees (24h)" />
						<KpiSkeleton label="Revenue (24h)" />
						<KpiSkeleton label="USD Inflows (Latest)" />
					</>
				)}
			</div>

			{tvlLoading ? (
				<CardSkeleton title="TVL" />
			) : (
				<ChartCard title="TVL">
					<MultiSeriesChart
						dataset={tvlDataset}
						charts={TVL_CHART}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_TIME_CHART_OPTIONS}
						exportButtons={AREA_EXPORT}
					/>
				</ChartCard>
			)}

			{feesLoading ? (
				<CardSkeleton title="Fees" />
			) : (
				<ChartCard title="Fees">
					<MultiSeriesChart
						dataset={feesDataset}
						charts={FEES_CHART}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_TIME_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}

			{feesLoading ? (
				<CardSkeleton title="Revenue" />
			) : (
				<ChartCard title="Revenue">
					<MultiSeriesChart
						dataset={revenueDataset}
						charts={REVENUE_CHART}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_TIME_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}

			{!feesLoading && hasHoldersRevenue && (
				<ChartCard title="Holders Revenue">
					<MultiSeriesChart
						dataset={holdersRevenueDataset}
						charts={HOLDERS_REVENUE_CHART}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_TIME_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}

			{tvlLoading ? (
				<CardSkeleton title="USD Inflows" />
			) : (
				<ChartCard title="USD Inflows">
					<MultiSeriesChart
						dataset={inflowsDataset}
						charts={INFLOWS_CHART}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_TIME_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}
		</div>
	)
}
