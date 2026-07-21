import { lazy, Suspense, useMemo } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { toRwaMultiSeriesChartDataset } from '~/containers/RWA/chartDataset'
import { useChartImageExport } from '../hooks/useChartImageExport'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import type { RWAAssetChartConfig, RWAOverviewChartMetric } from '../types'
import { filterChartDatasetByTimePeriod } from './datasets/filterChartDataset'
import { useRWAAssetChartData } from './datasets/RWADataset/useRWAChartData'
import { LoadingSpinner } from './LoadingSpinner'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const METRIC_TO_DIMENSION: Record<RWAOverviewChartMetric, string> = {
	activeMcap: 'Active Mcap',
	onChainMcap: 'Onchain Mcap',
	defiActiveTvl: 'DeFi Active TVL'
}

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
		const selectedDimensions = ['timestamp', ...metrics.map((m) => METRIC_TO_DIMENSION[m])]
		const filteredDimensions = chartDataset.dimensions.filter((d) => selectedDimensions.includes(d))
		const selectedDataset = toRwaMultiSeriesChartDataset(chartDataset, filteredDimensions)
		return timePeriod && timePeriod !== 'all'
			? filterChartDatasetByTimePeriod(selectedDataset, timePeriod, customTimePeriod)
			: selectedDataset
	}, [chartDataset, metrics, timePeriod, customTimePeriod])

	const metricsLabel = metrics.map((m) => METRIC_TO_DIMENSION[m]).join(', ')
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
					<ChartPngExportButton chartInstance={chartInstance} filename={imageFilename} title={imageTitle} smol />
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
						<MultiSeriesChart dataset={filteredDataset} hideDefaultLegend={false} onReady={handleChartReady} />
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
