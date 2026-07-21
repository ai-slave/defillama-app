import type * as echarts from 'echarts/core'
import { lazy, useCallback, useRef } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { DOLLAR_SCROLL_CHART_OPTIONS, DOLLAR_STACKED_SCROLL_CHART_OPTIONS, HIDDEN_EXPORT } from './chartDefaults'
import { useDistributionData } from './distributionApi'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

function sparkExportTitle(title: string) {
	const lowerTitle = title.toLowerCase()
	return lowerTitle.includes('spark') || title.startsWith('SPK') ? title : `Spark ${title}`
}

function ChartCard({
	title,
	actions,
	children
}: {
	title: string
	actions?: React.ReactNode
	children: React.ReactNode
}) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<div className="mb-3 flex items-center justify-between gap-2">
				<h3 className="text-sm font-medium text-pro-text-label">{title}</h3>
				{actions}
			</div>
			{children}
		</div>
	)
}

function useChartInstance() {
	const ref = useRef<echarts.ECharts | null>(null)
	const onReady = useCallback((instance: echarts.ECharts | null) => {
		ref.current = instance
	}, [])
	const getInstance = useCallback(() => ref.current, [])
	return { onReady, getInstance }
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

export default function DistributionRewards() {
	const { data, isLoading } = useDistributionData()

	const actualRev = useChartInstance()
	const revProjection = useChartInstance()
	const susdsTvl = useChartInstance()
	const xrSusds = useChartInstance()
	const xrSusdc = useChartInstance()
	const stakedUsds = useChartInstance()

	if (isLoading || !data) {
		return (
			<div className="flex flex-col gap-4">
				<CardSkeleton title="Actual Revenue - User" />
				<CardSkeleton title="Revenue Projection - User" />
				<CardSkeleton title="sUSDS & sUSDC TVL by Spark Referrals" />
				<CardSkeleton title="XR Rewards - sUSDS Crosschain" />
				<CardSkeleton title="XR Rewards - sUSDC Crosschain" />
				<CardSkeleton title="Staked USDS TVL by Spark Referrals" />
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-4">
			<ChartCard
				title="Actual Revenue - User"
				actions={
					<ChartPngExportButton
						chartInstance={actualRev.getInstance}
						filename="actual-revenue-user"
						title={sparkExportTitle('Actual Revenue - User')}
						smol
					/>
				}
			>
				<MultiSeriesChart
					dataset={data.actualRevenue.dataset}
					charts={data.actualRevenue.charts}
					valueSymbol="$"
					title=""
					height="400px"
					hideDefaultLegend={data.actualRevenue.charts.length < 2}
					chartOptions={DOLLAR_SCROLL_CHART_OPTIONS}
					exportButtons={HIDDEN_EXPORT}
					onReady={actualRev.onReady}
				/>
			</ChartCard>

			<ChartCard
				title="Revenue Projection - User"
				actions={
					<ChartPngExportButton
						chartInstance={revProjection.getInstance}
						filename="revenue-projection-user"
						title={sparkExportTitle('Revenue Projection - User')}
						smol
					/>
				}
			>
				<MultiSeriesChart
					dataset={data.revenueProjection.dataset}
					charts={data.revenueProjection.charts}
					valueSymbol="$"
					title=""
					stacked
					solidChartAreaStyle
					height="400px"
					chartOptions={DOLLAR_STACKED_SCROLL_CHART_OPTIONS}
					exportButtons={HIDDEN_EXPORT}
					onReady={revProjection.onReady}
				/>
			</ChartCard>

			<ChartCard
				title="sUSDS & sUSDC TVL by Spark Referrals"
				actions={
					<ChartPngExportButton
						chartInstance={susdsTvl.getInstance}
						filename="susds-susdc-tvl-spark-referrals"
						title={sparkExportTitle('sUSDS & sUSDC TVL by Spark Referrals')}
						smol
					/>
				}
			>
				<MultiSeriesChart
					dataset={data.susdsTvl.dataset}
					charts={data.susdsTvl.charts}
					valueSymbol="$"
					title=""
					stacked
					solidChartAreaStyle
					height="400px"
					chartOptions={DOLLAR_STACKED_SCROLL_CHART_OPTIONS}
					exportButtons={HIDDEN_EXPORT}
					onReady={susdsTvl.onReady}
				/>
			</ChartCard>

			<ChartCard
				title="XR Rewards - sUSDS Crosschain"
				actions={
					<ChartPngExportButton
						chartInstance={xrSusds.getInstance}
						filename="xr-rewards-susds-crosschain"
						title={sparkExportTitle('XR Rewards - sUSDS Crosschain')}
						smol
					/>
				}
			>
				<MultiSeriesChart
					dataset={data.xrSusds.dataset}
					charts={data.xrSusds.charts}
					valueSymbol="$"
					title=""
					height="400px"
					hideDefaultLegend={data.xrSusds.charts.length < 2}
					chartOptions={DOLLAR_SCROLL_CHART_OPTIONS}
					exportButtons={HIDDEN_EXPORT}
					onReady={xrSusds.onReady}
				/>
			</ChartCard>

			<ChartCard
				title="XR Rewards - sUSDC Crosschain"
				actions={
					<ChartPngExportButton
						chartInstance={xrSusdc.getInstance}
						filename="xr-rewards-susdc-crosschain"
						title={sparkExportTitle('XR Rewards - sUSDC Crosschain')}
						smol
					/>
				}
			>
				<MultiSeriesChart
					dataset={data.xrSusdc.dataset}
					charts={data.xrSusdc.charts}
					valueSymbol="$"
					title=""
					height="400px"
					hideDefaultLegend={data.xrSusdc.charts.length < 2}
					chartOptions={DOLLAR_SCROLL_CHART_OPTIONS}
					exportButtons={HIDDEN_EXPORT}
					onReady={xrSusdc.onReady}
				/>
			</ChartCard>

			<ChartCard
				title="Staked USDS TVL by Spark Referrals"
				actions={
					<ChartPngExportButton
						chartInstance={stakedUsds.getInstance}
						filename="staked-usds-tvl-spark-referrals"
						title={sparkExportTitle('Staked USDS TVL by Spark Referrals')}
						smol
					/>
				}
			>
				<MultiSeriesChart
					dataset={data.stakedUsdsTvl.dataset}
					charts={data.stakedUsdsTvl.charts}
					valueSymbol="$"
					title=""
					stacked
					solidChartAreaStyle
					height="400px"
					chartOptions={DOLLAR_STACKED_SCROLL_CHART_OPTIONS}
					exportButtons={HIDDEN_EXPORT}
					onReady={stakedUsds.onReady}
				/>
			</ChartCard>
		</div>
	)
}
