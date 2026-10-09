import { lazy, Suspense, useMemo } from 'react'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_FILL, ChartPanel, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { PanelLoadingStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { formatUsd } from '~/utils/numberFormat'
import { useEtherfiCashFeesCharts, useEtherfiCashMetrics, useEtherfiCashTvlChart } from './api'

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
			tvl:
				previousTvl != null
					? formatUsd(previousTvl, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
					: '—',
			fees24h:
				fees?.total48hto24h != null
					? formatUsd(fees.total48hto24h, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
					: '—',
			revenue24h:
				revenue?.total48hto24h != null
					? formatUsd(revenue.total48hto24h, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})
					: '—',
			inflows:
				previousInflow != null
					? formatUsd(previousInflow, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
					: '—'
		}
	}, [fees, revenue, previousTvl, previousInflow, metricsLoading, tvlLoading])

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{kpis ? (
					<>
						<StatTile label="TVL" value={kpis.tvl} />
						<StatTile label="Fees (24h)" value={kpis.fees24h} />
						<StatTile label="Revenue (24h)" value={kpis.revenue24h} />
						<StatTile label="USD Inflows (Latest)" value={kpis.inflows} />
					</>
				) : (
					<>
						<StatTile label="TVL" loading />
						<StatTile label="Fees (24h)" loading />
						<StatTile label="Revenue (24h)" loading />
						<StatTile label="USD Inflows (Latest)" loading />
					</>
				)}
			</div>

			{tvlLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<ChartPanel>
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart
							title="TVL"
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={tvlDataset}
							charts={TVL_CHART}
							valueSymbol="$"
							chartOptions={DOLLAR_TIME_CHART_OPTIONS}
							exportButtons={AREA_EXPORT}
						/>
					</Suspense>
				</ChartPanel>
			)}

			{feesLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<ChartPanel>
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart
							title="Fees"
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={feesDataset}
							charts={FEES_CHART}
							valueSymbol="$"
							chartOptions={DOLLAR_TIME_CHART_OPTIONS}
							exportButtons={BAR_EXPORT}
						/>
					</Suspense>
				</ChartPanel>
			)}

			{feesLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<ChartPanel>
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart
							title="Revenue"
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={revenueDataset}
							charts={REVENUE_CHART}
							valueSymbol="$"
							chartOptions={DOLLAR_TIME_CHART_OPTIONS}
							exportButtons={BAR_EXPORT}
						/>
					</Suspense>
				</ChartPanel>
			)}

			{!feesLoading && hasHoldersRevenue && (
				<ChartPanel>
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart
							title="Holders Revenue"
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={holdersRevenueDataset}
							charts={HOLDERS_REVENUE_CHART}
							valueSymbol="$"
							chartOptions={DOLLAR_TIME_CHART_OPTIONS}
							exportButtons={BAR_EXPORT}
						/>
					</Suspense>
				</ChartPanel>
			)}

			{tvlLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<ChartPanel>
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart
							title="USD Inflows"
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={inflowsDataset}
							charts={INFLOWS_CHART}
							valueSymbol="$"
							chartOptions={DOLLAR_TIME_CHART_OPTIONS}
							exportButtons={BAR_EXPORT}
						/>
					</Suspense>
				</ChartPanel>
			)}
		</div>
	)
}
