import * as React from 'react'
import { lazy, Suspense } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import {
	buildSelectedAdditiveChart,
	buildSelectedSeriesCsv,
	DEFAULT_ADDITIVE_SERIES_LIMIT,
	rankSeriesByPeakAbsoluteValue
} from '~/components/ECharts/MultiSeriesChart/selection'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { BridgeChainsTable } from '~/containers/Bridges/BridgeChainsTable'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useSeriesSelection } from '~/hooks/useSeriesSelection'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
type BridgeChainsOverviewProps = {
	allChains: string[]
	tableData: React.ComponentProps<typeof BridgeChainsTable>['data']
	chart: {
		dataset: MultiSeriesChartDataset
		charts: NonNullable<IMultiSeriesChartProps['charts']>
	}
}

export function BridgeChainsOverview({ allChains, tableData, chart }: BridgeChainsOverviewProps) {
	const rankedChains = React.useMemo(
		() => rankSeriesByPeakAbsoluteValue(chart.dataset, allChains),
		[allChains, chart.dataset]
	)
	const {
		activeSeries: selectedChains,
		selectedCharts,
		setSelectedSeries
	} = useSeriesSelection({
		availableSeries: rankedChains
	})
	const presentation = React.useMemo(
		() =>
			buildSelectedAdditiveChart({
				dataset: chart.dataset,
				charts: chart.charts,
				seriesOrder: rankedChains,
				selectedCharts,
				limit: DEFAULT_ADDITIVE_SERIES_LIMIT
			}),
		[chart.charts, chart.dataset, rankedChains, selectedCharts]
	)

	const { chartInstance: exportChartInstance, handleChartReady: onChartReady } = useGetChartInstance()

	return (
		<>
			<ChartPanel>
				<ChartPanelToolbar className="justify-end">
					{rankedChains.length > 1 ? (
						<SelectWithCombobox
							allValues={rankedChains}
							selectedValues={selectedChains}
							setSelectedValues={setSelectedSeries}
							label="Chain"
							labelType="smol"
							variant="filter"
							size="md"
						/>
					) : null}
					<ChartExportButtons
						chartInstance={exportChartInstance}
						filename={`bridge-inflows-by-chain`}
						title="Bridge Inflows"
						prepareCsvDirect={() =>
							buildSelectedSeriesCsv({
								dataset: presentation.dataset,
								charts: presentation.charts,
								selectedCharts: new Set(presentation.charts.map((item) => item.name)),
								filename: 'bridge-inflows-by-chain'
							})
						}
					/>
				</ChartPanelToolbar>

				{presentation.dataset.source.length > 0 ? (
					<Suspense fallback={<ChartPanelBodyFallback />}>
						<MultiSeriesChart
							dataset={presentation.dataset}
							charts={presentation.charts}
							hideDefaultLegend
							valueSymbol="$"
							showTotalInTooltip
							tooltipMaxItems={30}
							exportButtons="hidden"
							onReady={onChartReady}
						/>
					</Suspense>
				) : null}
			</ChartPanel>
			<BridgeChainsTable data={tableData} />
		</>
	)
}
