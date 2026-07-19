import * as React from 'react'
import { lazy, Suspense } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { IMultiSeriesChart2Props, MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { BridgeChainsTable } from '~/containers/Bridges/BridgeChainsTable'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { boundBridgeChainSelection, MAX_VISIBLE_CHAINS } from './bridgeChainsSelection'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>
type BridgeChainsOverviewProps = {
	allChains: string[]
	tableData: React.ComponentProps<typeof BridgeChainsTable>['data']
	chart: {
		dataset: MultiSeriesChart2Dataset
		charts: NonNullable<IMultiSeriesChart2Props['charts']>
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
						<MultiSeriesChart2
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
