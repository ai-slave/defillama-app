import { lazy, Suspense, useMemo } from 'react'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import type { RWAAssetChartConfig } from '../types'
import { prepareProChartCsv } from './chartCsv'
import { filterChartDatasetByTimePeriod } from './datasets/filterChartDataset'
import { useRWAAssetChartData } from './datasets/RWADataset/useRWAChartData'
import { LoadingSpinner } from './LoadingSpinner'
import { ProCardOverflowMenu } from './ProCardActions'
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
	const { chartInstance, handleChartReady } = useChartImageExport()
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { chartDataset, isLoading } = useRWAAssetChartData(assetId)

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

	if (isLoading) {
		return (
			<div className="flex h-full min-h-[360px] items-center justify-center">
				<LoadingSpinner />
			</div>
		)
	}

	const hasData = filteredDataset && filteredDataset.source.length > 0

	return (
		<div className="flex h-full flex-col p-2">
			<div className="mb-2 flex items-start justify-between gap-2">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold text-pro-text-primary">{assetName}</h3>
					<p className="text-xs text-pro-text-secondary">{metricsLabel}</p>
				</div>
				{hasData ? (
					<ProCardOverflowMenu
						image={{ chartInstance, filename: imageFilename, title: imageTitle }}
						csv={
							filteredDataset
								? {
										prepareCsv: () =>
											prepareProChartCsv(projectRwaAssetDatasetToMetrics(filteredDataset, metrics), imageFilename)
									}
								: undefined
						}
					/>
				) : null}
			</div>
			<div className="flex-1">
				<Suspense
					fallback={
						<div className="flex h-[320px] items-center justify-center">
							<LoadingSpinner />
						</div>
					}
				>
					{filteredDataset ? (
						<MultiSeriesChart
							dataset={filteredDataset}
							charts={charts}
							hideDefaultLegend={false}
							onReady={handleChartReady}
						/>
					) : (
						<div className="flex h-[320px] items-center justify-center text-sm text-pro-text-secondary">
							No data available
						</div>
					)}
				</Suspense>
			</div>
		</div>
	)
}
