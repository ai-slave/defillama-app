import * as React from 'react'
import { lazy, Suspense } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { IMultiSeriesChart2Props } from '~/components/ECharts/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { BridgeChainsTable } from '~/containers/Bridges/BridgeChainsTable'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>
const MAX_VISIBLE_CHAINS = 30

export function BridgeChainsOverview({ allChains, tableData, chart }) {
	const [selectedChains, setSelectedChains] = React.useState<string[]>(() =>
		allChains ? allChains.slice(0, MAX_VISIBLE_CHAINS) : []
	)
	const setBoundedSelectedChains = React.useCallback((values: string[]) => {
		setSelectedChains((current) => {
			if (values.length <= MAX_VISIBLE_CHAINS) return values
			const addedValues = values.filter((value) => !current.includes(value))
			if (addedValues.length === 1) {
				const added = addedValues[0]
				return [...values.filter((value) => value !== added).slice(0, MAX_VISIBLE_CHAINS - 1), added]
			}
			return values.slice(0, MAX_VISIBLE_CHAINS)
		})
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
