import * as React from 'react'
import { lazy, Suspense } from 'react'
import { ChartExportButtons } from '~/components/ButtonStyled/ChartExportButtons'
import type { IMultiSeriesChart2Props } from '~/components/ECharts/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { BridgeChainsTable } from '~/containers/Bridges/BridgeChainsTable'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Panel } from '~/ui/Panel'
import { ChartPanelToolbar } from '~/ui/Toolbar'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>

export function BridgeChainsOverview({ allChains, tableData, chart }) {
	const [selectedChains, setSelectedChains] = React.useState<string[]>(() => (allChains ? [...allChains] : []))

	const selectedCharts = React.useMemo(() => new Set(selectedChains), [selectedChains])

	const { chartInstance: exportChartInstance, handleChartReady: onChartReady } = useGetChartInstance()

	return (
		<>
			<Panel>
				<ChartPanelToolbar className="justify-end">
					<SelectWithCombobox
						allValues={allChains}
						selectedValues={selectedChains}
						setSelectedValues={setSelectedChains}
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
					<Suspense fallback={<div className="h-[360px]" />}>
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
			</Panel>
			<BridgeChainsTable data={tableData} />
		</>
	)
}
