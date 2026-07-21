import * as React from 'react'
import { lazy, Suspense } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { BridgeChainsTable } from '~/containers/Bridges/BridgeChainsTable'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { boundBridgeChainSelection, MAX_VISIBLE_CHAINS } from './bridgeChainsSelection'

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
	const [selectedChains, setSelectedChains] = React.useState<string[]>(() =>
		allChains ? allChains.slice(0, MAX_VISIBLE_CHAINS) : []
	)
	const setBoundedSelectedChains = React.useCallback((values: string[]) => {
		setSelectedChains((current) => boundBridgeChainSelection(current, values))
	}, [])

	const selectedCharts = React.useMemo(() => new Set(selectedChains), [selectedChains])

	const { chartInstance: exportChartInstance, handleChartReady: onChartReady } = useGetChartInstance()

	return (
		<>
			<ChartPanel>
				<ChartPanelToolbar className="justify-end">
					<SelectWithCombobox
						allValues={allChains}
						selectedValues={selectedChains}
						setSelectedValues={setBoundedSelectedChains}
						label="Chain"
						labelType="smol"
						variant="filter"
						size="md"
					/>
					<ChartExportButtons
						chartInstance={exportChartInstance}
						filename={`bridge-inflows-by-chain`}
						title="Bridge Inflows"
					/>
				</ChartPanelToolbar>

				{chart?.dataset?.source?.length > 0 ? (
					<Suspense fallback={<ChartPanelBodyFallback />}>
						<MultiSeriesChart
							dataset={chart.dataset}
							charts={chart.charts}
							selectedCharts={selectedCharts}
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
