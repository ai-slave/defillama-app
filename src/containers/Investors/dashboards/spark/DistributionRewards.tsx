import { lazy, Suspense } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { CHART_FILL, ChartPanel, ChartPanelBodyLoading, ChartPanelTitle, ChartPanelToolbar } from '~/ui/ChartPanel'
import { PanelStatus } from '~/ui/Status'
import { queryReadFailed } from '~/utils/query'
import { DOLLAR_SCROLL_CHART_OPTIONS, DOLLAR_STACKED_SCROLL_CHART_OPTIONS, HIDDEN_EXPORT } from './chartDefaults'
import { useDistributionData } from './distributionApi'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

function sparkExportTitle(title: string) {
	const lowerTitle = title.toLowerCase()
	return lowerTitle.includes('spark') || title.startsWith('SPK') ? title : `Spark ${title}`
}

export default function DistributionRewards() {
	const query = useDistributionData()
	const data = query.data ?? null

	const actualRev = useGetChartInstance()
	const revProjection = useGetChartInstance()
	const susdsTvl = useGetChartInstance()
	const xrSusds = useGetChartInstance()
	const xrSusdc = useGetChartInstance()
	const stakedUsds = useGetChartInstance()

	// Checked before the panels' loading states, so a retry keeps the error and its button on screen until it succeeds.
	if (queryReadFailed(query))
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn&apos;t load Spark distribution rewards.
			</PanelStatus>
		)

	return (
		<div className="flex flex-col gap-4">
			<ChartPanel>
				<ChartPanelToolbar leading={<ChartPanelTitle>Actual Revenue - User</ChartPanelTitle>}>
					<ChartPngExportButton
						chartInstance={actualRev.chartInstance}
						filename="actual-revenue-user"
						title={sparkExportTitle('Actual Revenue - User')}
						smol
					/>
				</ChartPanelToolbar>
				{data ? (
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={data.actualRevenue.dataset}
							charts={data.actualRevenue.charts}
							valueSymbol="$"
							containerClassName={CHART_FILL}
							showLegend={data.actualRevenue.charts.length > 1}
							chartOptions={DOLLAR_SCROLL_CHART_OPTIONS}
							exportButtons={HIDDEN_EXPORT}
							onReady={actualRev.handleChartReady}
						/>
					</Suspense>
				) : (
					<ChartPanelBodyLoading />
				)}
			</ChartPanel>

			<ChartPanel>
				<ChartPanelToolbar leading={<ChartPanelTitle>Revenue Projection - User</ChartPanelTitle>}>
					<ChartPngExportButton
						chartInstance={revProjection.chartInstance}
						filename="revenue-projection-user"
						title={sparkExportTitle('Revenue Projection - User')}
						smol
					/>
				</ChartPanelToolbar>
				{data ? (
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={data.revenueProjection.dataset}
							charts={data.revenueProjection.charts}
							valueSymbol="$"
							stacked
							solidChartAreaStyle
							containerClassName={CHART_FILL}
							chartOptions={DOLLAR_STACKED_SCROLL_CHART_OPTIONS}
							exportButtons={HIDDEN_EXPORT}
							onReady={revProjection.handleChartReady}
						/>
					</Suspense>
				) : (
					<ChartPanelBodyLoading />
				)}
			</ChartPanel>

			<ChartPanel>
				<ChartPanelToolbar leading={<ChartPanelTitle>sUSDS & sUSDC TVL by Spark Referrals</ChartPanelTitle>}>
					<ChartPngExportButton
						chartInstance={susdsTvl.chartInstance}
						filename="susds-susdc-tvl-spark-referrals"
						title={sparkExportTitle('sUSDS & sUSDC TVL by Spark Referrals')}
						smol
					/>
				</ChartPanelToolbar>
				{data ? (
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={data.susdsTvl.dataset}
							charts={data.susdsTvl.charts}
							valueSymbol="$"
							stacked
							solidChartAreaStyle
							containerClassName={CHART_FILL}
							chartOptions={DOLLAR_STACKED_SCROLL_CHART_OPTIONS}
							exportButtons={HIDDEN_EXPORT}
							onReady={susdsTvl.handleChartReady}
						/>
					</Suspense>
				) : (
					<ChartPanelBodyLoading />
				)}
			</ChartPanel>

			<ChartPanel>
				<ChartPanelToolbar leading={<ChartPanelTitle>XR Rewards - sUSDS Crosschain</ChartPanelTitle>}>
					<ChartPngExportButton
						chartInstance={xrSusds.chartInstance}
						filename="xr-rewards-susds-crosschain"
						title={sparkExportTitle('XR Rewards - sUSDS Crosschain')}
						smol
					/>
				</ChartPanelToolbar>
				{data ? (
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={data.xrSusds.dataset}
							charts={data.xrSusds.charts}
							valueSymbol="$"
							containerClassName={CHART_FILL}
							showLegend={data.xrSusds.charts.length > 1}
							chartOptions={DOLLAR_SCROLL_CHART_OPTIONS}
							exportButtons={HIDDEN_EXPORT}
							onReady={xrSusds.handleChartReady}
						/>
					</Suspense>
				) : (
					<ChartPanelBodyLoading />
				)}
			</ChartPanel>

			<ChartPanel>
				<ChartPanelToolbar leading={<ChartPanelTitle>XR Rewards - sUSDC Crosschain</ChartPanelTitle>}>
					<ChartPngExportButton
						chartInstance={xrSusdc.chartInstance}
						filename="xr-rewards-susdc-crosschain"
						title={sparkExportTitle('XR Rewards - sUSDC Crosschain')}
						smol
					/>
				</ChartPanelToolbar>
				{data ? (
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={data.xrSusdc.dataset}
							charts={data.xrSusdc.charts}
							valueSymbol="$"
							containerClassName={CHART_FILL}
							showLegend={data.xrSusdc.charts.length > 1}
							chartOptions={DOLLAR_SCROLL_CHART_OPTIONS}
							exportButtons={HIDDEN_EXPORT}
							onReady={xrSusdc.handleChartReady}
						/>
					</Suspense>
				) : (
					<ChartPanelBodyLoading />
				)}
			</ChartPanel>

			<ChartPanel>
				<ChartPanelToolbar leading={<ChartPanelTitle>Staked USDS TVL by Spark Referrals</ChartPanelTitle>}>
					<ChartPngExportButton
						chartInstance={stakedUsds.chartInstance}
						filename="staked-usds-tvl-spark-referrals"
						title={sparkExportTitle('Staked USDS TVL by Spark Referrals')}
						smol
					/>
				</ChartPanelToolbar>
				{data ? (
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={data.stakedUsdsTvl.dataset}
							charts={data.stakedUsdsTvl.charts}
							valueSymbol="$"
							stacked
							solidChartAreaStyle
							containerClassName={CHART_FILL}
							chartOptions={DOLLAR_STACKED_SCROLL_CHART_OPTIONS}
							exportButtons={HIDDEN_EXPORT}
							onReady={stakedUsds.handleChartReady}
						/>
					</Suspense>
				) : (
					<ChartPanelBodyLoading />
				)}
			</ChartPanel>
		</div>
	)
}
