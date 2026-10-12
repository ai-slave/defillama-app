import { lazy, type ReactNode, Suspense, useMemo } from 'react'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { MetaLine } from '~/ui/MetaLine'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import type { RWAAssetChartConfig } from '../types'
import { scaledPx, useCardHeightScale } from './cardHeightContext'
import { prepareProChartCsv } from './chartCsv'
import { filterChartDatasetByTimePeriod } from './datasets/filterChartDataset'
import { useRWAAssetChartData } from './datasets/RWADataset/useRWAChartData'
import { PRO_CARD_MENU_EXPORTS } from './ProCardActions'
import { ProCardHeader } from './ProCardHeader'
import { ProCardEmpty, ProCardError, ProCardLoading, ProCardRefreshFailed } from './ProCardStatus'
import {
	buildProRwaAssetChartSeries,
	projectRwaAssetDatasetToMetrics,
	RWA_ASSET_METRIC_DIMENSIONS
} from './rwaAssetChart'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

interface RWAAssetChartCardProps {
	config: RWAAssetChartConfig
}

export function RWAAssetChartCard({ config }: RWAAssetChartCardProps) {
	const { assetId, assetName, metrics } = config
	const chartExport = useGetChartInstance()
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const chartRead = useRWAAssetChartData(assetId)
	const { chartDataset, isLoading, readFailed, refreshFailed } = chartRead

	const filteredDataset = useMemo(() => {
		if (!chartDataset) return null
		return timePeriod && timePeriod !== 'all'
			? filterChartDatasetByTimePeriod(chartDataset, timePeriod, customTimePeriod)
			: chartDataset
	}, [chartDataset, timePeriod, customTimePeriod])
	const charts = useMemo(() => buildProRwaAssetChartSeries(chartDataset, metrics), [chartDataset, metrics])

	const metricsLabel = metrics.map((m) => RWA_ASSET_METRIC_DIMENSIONS[m]).join(', ')
	const imageTitle = `${assetName} - ${metricsLabel}`
	const imageFilename = `rwa-${assetId}-${metrics.join('-')}`

	const cardHeightScale = useCardHeightScale()
	const chartHeight = scaledPx(320, cardHeightScale)

	const renderStatusShell = (status: ReactNode) => (
		<div className="flex h-full min-h-[calc(360px*var(--card-scale,1))] flex-col p-0">
			<ProCardHeader titleAs="h3" title={assetName} subtitle={<MetaLine>{metricsLabel}</MetaLine>} />
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3" style={{ minHeight: chartHeight }}>
				{status}
			</div>
		</div>
	)

	if (readFailed) {
		return renderStatusShell(<ProCardError retry={chartRead} />)
	}

	if (isLoading) {
		return renderStatusShell(<ProCardLoading />)
	}

	const hasData = filteredDataset && filteredDataset.source.length > 0

	return (
		<div className="flex h-full flex-col p-0">
			{refreshFailed ? <ProCardRefreshFailed retry={chartRead} /> : null}
			<ProCardHeader
				titleAs="h3"
				title={assetName}
				subtitle={<MetaLine>{metricsLabel}</MetaLine>}
				menu={
					hasData
						? {
								image: { chartInstance: chartExport.chartInstance, filename: imageFilename, title: imageTitle },
								csv: filteredDataset
									? {
											prepareCsv: () =>
												prepareProChartCsv(projectRwaAssetDatasetToMetrics(filteredDataset, metrics), imageFilename)
										}
									: undefined
							}
						: {}
				}
			/>
			<div className="flex-1 px-3 pb-3">
				<Suspense
					fallback={
						<div className="flex h-[calc(320px*var(--card-scale,1))] items-center justify-center">
							<ProCardLoading />
						</div>
					}
				>
					{filteredDataset ? (
						<MultiSeriesChart
							exportButtons={PRO_CARD_MENU_EXPORTS}
							onReady={chartExport.handleChartReady}
							height={chartHeight}
							dataset={filteredDataset}
							charts={charts}
							showLegend
						/>
					) : (
						<div className="flex h-[calc(320px*var(--card-scale,1))] flex-col justify-center">
							<ProCardEmpty message="No data available" />
						</div>
					)}
				</Suspense>
			</div>
		</div>
	)
}
