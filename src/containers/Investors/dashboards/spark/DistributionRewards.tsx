import { lazy, Suspense } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
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
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<div className="mb-3 flex items-center justify-between gap-2">
				<h3 className="label-md text-secondary">{title}</h3>
				{actions}
			</div>
			{children}
		</div>
	)
}

function CardSkeleton({ title }: { title: string }) {
	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-3 label-md text-secondary">{title}</h3>
			<SurfaceBodyLoadingStatus className="min-h-[400px]" />
		</div>
	)
}

export default function DistributionRewards() {
	const { data, isLoading } = useDistributionData()

	const actualRev = useGetChartInstance()
	const revProjection = useGetChartInstance()
	const susdsTvl = useGetChartInstance()
	const xrSusds = useGetChartInstance()
	const xrSusdc = useGetChartInstance()
	const stakedUsds = useGetChartInstance()

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
						chartInstance={actualRev.chartInstance}
						filename="actual-revenue-user"
						title={sparkExportTitle('Actual Revenue - User')}
						smol
					/>
				}
			>
				<Suspense fallback={<ChartPanelBodyFallback style={{ minHeight: '400px' }} />}>
					<MultiSeriesChart
						dataset={data.actualRevenue.dataset}
						charts={data.actualRevenue.charts}
						valueSymbol="$"
						title=""
						height="400px"
						hideDefaultLegend={data.actualRevenue.charts.length < 2}
						chartOptions={DOLLAR_SCROLL_CHART_OPTIONS}
						exportButtons={HIDDEN_EXPORT}
						onReady={actualRev.handleChartReady}
					/>
				</Suspense>
			</ChartCard>

			<ChartCard
				title="Revenue Projection - User"
				actions={
					<ChartPngExportButton
						chartInstance={revProjection.chartInstance}
						filename="revenue-projection-user"
						title={sparkExportTitle('Revenue Projection - User')}
						smol
					/>
				}
			>
				<Suspense fallback={<ChartPanelBodyFallback style={{ minHeight: '400px' }} />}>
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
						onReady={revProjection.handleChartReady}
					/>
				</Suspense>
			</ChartCard>

			<ChartCard
				title="sUSDS & sUSDC TVL by Spark Referrals"
				actions={
					<ChartPngExportButton
						chartInstance={susdsTvl.chartInstance}
						filename="susds-susdc-tvl-spark-referrals"
						title={sparkExportTitle('sUSDS & sUSDC TVL by Spark Referrals')}
						smol
					/>
				}
			>
				<Suspense fallback={<ChartPanelBodyFallback style={{ minHeight: '400px' }} />}>
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
						onReady={susdsTvl.handleChartReady}
					/>
				</Suspense>
			</ChartCard>

			<ChartCard
				title="XR Rewards - sUSDS Crosschain"
				actions={
					<ChartPngExportButton
						chartInstance={xrSusds.chartInstance}
						filename="xr-rewards-susds-crosschain"
						title={sparkExportTitle('XR Rewards - sUSDS Crosschain')}
						smol
					/>
				}
			>
				<Suspense fallback={<ChartPanelBodyFallback style={{ minHeight: '400px' }} />}>
					<MultiSeriesChart
						dataset={data.xrSusds.dataset}
						charts={data.xrSusds.charts}
						valueSymbol="$"
						title=""
						height="400px"
						hideDefaultLegend={data.xrSusds.charts.length < 2}
						chartOptions={DOLLAR_SCROLL_CHART_OPTIONS}
						exportButtons={HIDDEN_EXPORT}
						onReady={xrSusds.handleChartReady}
					/>
				</Suspense>
			</ChartCard>

			<ChartCard
				title="XR Rewards - sUSDC Crosschain"
				actions={
					<ChartPngExportButton
						chartInstance={xrSusdc.chartInstance}
						filename="xr-rewards-susdc-crosschain"
						title={sparkExportTitle('XR Rewards - sUSDC Crosschain')}
						smol
					/>
				}
			>
				<Suspense fallback={<ChartPanelBodyFallback style={{ minHeight: '400px' }} />}>
					<MultiSeriesChart
						dataset={data.xrSusdc.dataset}
						charts={data.xrSusdc.charts}
						valueSymbol="$"
						title=""
						height="400px"
						hideDefaultLegend={data.xrSusdc.charts.length < 2}
						chartOptions={DOLLAR_SCROLL_CHART_OPTIONS}
						exportButtons={HIDDEN_EXPORT}
						onReady={xrSusdc.handleChartReady}
					/>
				</Suspense>
			</ChartCard>

			<ChartCard
				title="Staked USDS TVL by Spark Referrals"
				actions={
					<ChartPngExportButton
						chartInstance={stakedUsds.chartInstance}
						filename="staked-usds-tvl-spark-referrals"
						title={sparkExportTitle('Staked USDS TVL by Spark Referrals')}
						smol
					/>
				}
			>
				<Suspense fallback={<ChartPanelBodyFallback style={{ minHeight: '400px' }} />}>
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
						onReady={stakedUsds.handleChartReady}
					/>
				</Suspense>
			</ChartCard>
		</div>
	)
}
