import { lazy, Suspense } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanelTitle, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { PanelStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { queryReadFailed } from '~/utils/query'
import { DOLLAR_SCROLL_CHART_OPTIONS, DOLLAR_STACKED_SCROLL_CHART_OPTIONS } from './chartDefaults'
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
			<Panel>
				<ChartPanelToolbar leading={<ChartPanelTitle>Actual Revenue - User</ChartPanelTitle>}>
					<ChartExportButtons
						chart={actualRev}
						filename="actual-revenue-user"
						title={sparkExportTitle('Actual Revenue - User')}
						disabled={!data}
						csvSource={{ type: 'dataset', prepare: () => data.actualRevenue.dataset }}
					/>
				</ChartPanelToolbar>
				{data ? (
					<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
						<MultiSeriesChart
							dataset={data.actualRevenue.dataset}
							charts={data.actualRevenue.charts}
							valueSymbol="$"
							showLegend={data.actualRevenue.charts.length > 1}
							chartOptions={DOLLAR_SCROLL_CHART_OPTIONS}
							exportButtons={actualRev}
						/>
					</Suspense>
				) : (
					<SurfaceBodyLoadingStatus label="Loading chart" />
				)}
			</Panel>

			<Panel>
				<ChartPanelToolbar leading={<ChartPanelTitle>Revenue Projection - User</ChartPanelTitle>}>
					<ChartExportButtons
						chart={revProjection}
						filename="revenue-projection-user"
						title={sparkExportTitle('Revenue Projection - User')}
						disabled={!data}
						csvSource={{ type: 'dataset', prepare: () => data.revenueProjection.dataset }}
					/>
				</ChartPanelToolbar>
				{data ? (
					<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
						<MultiSeriesChart
							dataset={data.revenueProjection.dataset}
							charts={data.revenueProjection.charts}
							valueSymbol="$"
							stacked
							solidChartAreaStyle
							chartOptions={DOLLAR_STACKED_SCROLL_CHART_OPTIONS}
							exportButtons={revProjection}
						/>
					</Suspense>
				) : (
					<SurfaceBodyLoadingStatus label="Loading chart" />
				)}
			</Panel>

			<Panel>
				<ChartPanelToolbar leading={<ChartPanelTitle>sUSDS & sUSDC TVL by Spark referrals</ChartPanelTitle>}>
					<ChartExportButtons
						chart={susdsTvl}
						filename="susds-susdc-tvl-spark-referrals"
						title={sparkExportTitle('sUSDS & sUSDC TVL by Spark referrals')}
						disabled={!data}
						csvSource={{ type: 'dataset', prepare: () => data.susdsTvl.dataset }}
					/>
				</ChartPanelToolbar>
				{data ? (
					<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
						<MultiSeriesChart
							dataset={data.susdsTvl.dataset}
							charts={data.susdsTvl.charts}
							valueSymbol="$"
							stacked
							solidChartAreaStyle
							chartOptions={DOLLAR_STACKED_SCROLL_CHART_OPTIONS}
							exportButtons={susdsTvl}
						/>
					</Suspense>
				) : (
					<SurfaceBodyLoadingStatus label="Loading chart" />
				)}
			</Panel>

			<Panel>
				<ChartPanelToolbar leading={<ChartPanelTitle>XR Rewards - sUSDS cross-chain</ChartPanelTitle>}>
					<ChartExportButtons
						chart={xrSusds}
						filename="xr-rewards-susds-crosschain"
						title={sparkExportTitle('XR Rewards - sUSDS cross-chain')}
						disabled={!data}
						csvSource={{ type: 'dataset', prepare: () => data.xrSusds.dataset }}
					/>
				</ChartPanelToolbar>
				{data ? (
					<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
						<MultiSeriesChart
							dataset={data.xrSusds.dataset}
							charts={data.xrSusds.charts}
							valueSymbol="$"
							showLegend={data.xrSusds.charts.length > 1}
							chartOptions={DOLLAR_SCROLL_CHART_OPTIONS}
							exportButtons={xrSusds}
						/>
					</Suspense>
				) : (
					<SurfaceBodyLoadingStatus label="Loading chart" />
				)}
			</Panel>

			<Panel>
				<ChartPanelToolbar leading={<ChartPanelTitle>XR Rewards - sUSDC cross-chain</ChartPanelTitle>}>
					<ChartExportButtons
						chart={xrSusdc}
						filename="xr-rewards-susdc-crosschain"
						title={sparkExportTitle('XR Rewards - sUSDC cross-chain')}
						disabled={!data}
						csvSource={{ type: 'dataset', prepare: () => data.xrSusdc.dataset }}
					/>
				</ChartPanelToolbar>
				{data ? (
					<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
						<MultiSeriesChart
							dataset={data.xrSusdc.dataset}
							charts={data.xrSusdc.charts}
							valueSymbol="$"
							showLegend={data.xrSusdc.charts.length > 1}
							chartOptions={DOLLAR_SCROLL_CHART_OPTIONS}
							exportButtons={xrSusdc}
						/>
					</Suspense>
				) : (
					<SurfaceBodyLoadingStatus label="Loading chart" />
				)}
			</Panel>

			<Panel>
				<ChartPanelToolbar leading={<ChartPanelTitle>Staked USDS TVL by Spark referrals</ChartPanelTitle>}>
					<ChartExportButtons
						chart={stakedUsds}
						filename="staked-usds-tvl-spark-referrals"
						title={sparkExportTitle('Staked USDS TVL by Spark referrals')}
						disabled={!data}
						csvSource={{ type: 'dataset', prepare: () => data.stakedUsdsTvl.dataset }}
					/>
				</ChartPanelToolbar>
				{data ? (
					<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
						<MultiSeriesChart
							dataset={data.stakedUsdsTvl.dataset}
							charts={data.stakedUsdsTvl.charts}
							valueSymbol="$"
							stacked
							solidChartAreaStyle
							chartOptions={DOLLAR_STACKED_SCROLL_CHART_OPTIONS}
							exportButtons={stakedUsds}
						/>
					</Suspense>
				) : (
					<SurfaceBodyLoadingStatus label="Loading chart" />
				)}
			</Panel>
		</div>
	)
}
