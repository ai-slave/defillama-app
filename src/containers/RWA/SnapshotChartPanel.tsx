import { lazy, Suspense, useDeferredValue, useMemo, type ReactNode } from 'react'
import { ChartCsvExportButton } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import { buildTreemapCsvDataset } from '~/components/ECharts/TreemapChart/csv'
import { CHART_COLORS, OTHERS_COLOR } from '~/constants/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { LoadingIndicator } from '~/ui/Status'
import { limitRwaHorizontalBarData, type RwaNamedValue } from './chartDataset'
import { RWA_MAX_CHART_SERIES } from './chartFold'
import type { RWAChartView } from './chartState'
import { limitRwaPieChartData } from './hooks'
import { buildCompleteRwaTreemapTreeData, type RwaTreemapNode } from './treemap'

const PieChart = lazy(() => import('~/components/ECharts/PieChart'))
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart'))
const TreemapChart = lazy(() => import('~/components/ECharts/TreemapChart'))

const pieChartRadius = ['50%', '70%'] as [string, string]
const pieChartLegendPosition = {
	left: 'center',
	top: 'bottom',
	orient: 'horizontal'
} as const
const pieChartLegendTextStyle = { fontSize: 14 }
const EMPTY_TREEMAP: Array<RwaTreemapNode> = []
/** Ten slices and Others: one more than the chart's series cap, since Others is its own slice here. */
const PIE_LIMIT = RWA_MAX_CHART_SERIES + 1

type RWASnapshotChartPanelProps = {
	view: Exclude<RWAChartView, 'timeSeries' | 'share'>
	/** One value per group, largest first; the panel folds the tail into Others per view. */
	slices: Array<RwaNamedValue>
	valueSymbol: string
	/** What one value measures, such as "Volume, last 7 days". */
	valueLabel: string
	groupLabel: string
	exportTitle: string
	filename: string
	isLoading: boolean
	error: string | null
	/** The metric switch, the view select and any period control, shared with the time series panel. */
	toolbarStart: ReactNode
	/** Controls only the treemap view offers, such as Nested by. */
	treemapControls?: ReactNode
	/** Slices the flat treemap keeps, Others included; every slice by default. */
	treemapLimit?: number
	/** A two-level tree the treemap draws and exports in place of the flat slices when it has nodes. */
	nestedTreemap?: Array<RwaTreemapNode>
}

/**
 * The pie, treemap and bar views of one value per group: the perps splits reduced to a snapshot (perpsSnapshot.ts)
 * and the Assets breakdown (OverviewBreakdownPanel.tsx). The pie keeps the ten largest plus Others, the bars up to
 * twenty, the treemap every group.
 */
export function RWASnapshotChartPanel({
	view,
	slices,
	valueSymbol,
	valueLabel,
	groupLabel,
	exportTitle,
	filename,
	isLoading,
	error,
	toolbarStart,
	treemapControls,
	treemapLimit,
	nestedTreemap = EMPTY_TREEMAP
}: RWASnapshotChartPanelProps) {
	const deferredSlices = useDeferredValue(slices)
	const presentation = useMemo(() => {
		const colors: Record<string, string> = {}
		for (const [index, slice] of deferredSlices.entries()) {
			colors[slice.name] = CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0]
		}
		colors.Others = OTHERS_COLOR
		const bars = limitRwaHorizontalBarData(deferredSlices, { sort: true })
		return {
			colors,
			pie: limitRwaPieChartData(deferredSlices, PIE_LIMIT),
			bars: {
				categories: bars.map((bar) => bar.name),
				values: bars.map((bar) => bar.value),
				colors: bars.map((bar) => colors[bar.name] ?? CHART_COLORS[0])
			},
			treemap: buildCompleteRwaTreemapTreeData({
				nestedTreeData: nestedTreemap,
				completePieData: treemapLimit == null ? deferredSlices : limitRwaPieChartData(deferredSlices, treemapLimit),
				breakdownLabel: groupLabel
			})
		}
	}, [deferredSlices, groupLabel, nestedTreemap, treemapLimit])
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const viewFilename = `${filename}-${view}`

	return (
		<ChartPanel className={view === 'treemap' ? undefined : 'min-h-[420px]'}>
			<ChartPanelToolbar>
				{toolbarStart}
				{view === 'treemap' ? treemapControls : null}
				{view === 'treemap' ? <ChartRestoreButton chartInstance={chartInstance} /> : null}
				<ChartCsvExportButton
					chartInstance={chartInstance}
					filename={viewFilename}
					disabled={isLoading}
					source={{
						type: 'dataset',
						prepare: () =>
							view === 'treemap'
								? buildTreemapCsvDataset(
										buildCompleteRwaTreemapTreeData({
											nestedTreeData: nestedTreemap,
											completePieData: slices,
											breakdownLabel: groupLabel
										})
									)
								: {
										dimensions: [groupLabel, valueLabel],
										source: slices.map(({ name, value }) => [name, value])
									}
					}}
				/>
				<ChartPngExportButton chartInstance={chartInstance} filename={viewFilename} title={exportTitle} />
			</ChartPanelToolbar>
			{error ? (
				<ChartPanelBodyFallback role="alert" className="body-sm text-error">
					{error}
				</ChartPanelBodyFallback>
			) : isLoading ? (
				<ChartPanelBodyFallback role="status" aria-live="polite">
					<LoadingIndicator />
				</ChartPanelBodyFallback>
			) : deferredSlices.length === 0 ? (
				<ChartPanelBodyFallback className="body-sm text-secondary">No data for this view.</ChartPanelBodyFallback>
			) : (
				<Suspense fallback={view === 'treemap' ? <div className="min-h-[600px]" /> : <ChartPanelBodyFallback />}>
					{view === 'pie' ? (
						<PieChart
							chartData={presentation.pie}
							stackColors={presentation.colors}
							radius={pieChartRadius}
							legendPosition={pieChartLegendPosition}
							legendTextStyle={pieChartLegendTextStyle}
							valueSymbol={valueSymbol}
							onReady={handleChartReady}
						/>
					) : view === 'hbar' ? (
						<HBarChart
							categories={presentation.bars.categories}
							values={presentation.bars.values}
							colors={presentation.bars.colors}
							valueSymbol={valueSymbol}
							onReady={handleChartReady}
						/>
					) : (
						<TreemapChart
							treeData={presentation.treemap}
							variant="rwa"
							height="600px"
							valueLabel={valueLabel}
							valueSymbol={valueSymbol}
							onReady={handleChartReady}
						/>
					)}
				</Suspense>
			)}
		</ChartPanel>
	)
}
