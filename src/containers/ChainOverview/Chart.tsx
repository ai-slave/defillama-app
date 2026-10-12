import { useMemo } from 'react'
import type { HeadlessChartExportButtons } from '~/components/ChartExport/types'
import MultiSeriesChart from '~/components/ECharts/MultiSeriesChart'
import { createOverviewTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/overviewTooltip'
import type {
	ChartTimeGrouping,
	ChartTimeGroupingWithCumulative,
	MultiSeriesChartOptions,
	MultiSeriesYAxisOption
} from '~/components/ECharts/MultiSeriesChart/types'
import { useChartTheme } from '~/components/ECharts/shared/chartTheme'
import { mergeDeep } from '~/components/ECharts/shared/merge'
import { buildChainChartPresentation } from './chartPresentation'
import { buildChainYAxis } from './chartYAxis'
import type { ChainChartLabels } from './constants'
import type { ChainOverviewChartData } from './types'

interface ChainCoreChartProps {
	chartData: ChainOverviewChartData
	/** From `getChainChartColors`, so the series match the page's metric chips. */
	chartColors: Partial<Record<ChainChartLabels, string>>
	valueSymbol?: string
	chartOptions?: MultiSeriesChartOptions
	unlockTokenSymbol?: string
	isThemeDark: boolean
	groupBy?: ChartTimeGroupingWithCumulative
	exportButtons: HeadlessChartExportButtons
}

function mergeYAxisOptions(
	domainAxes: Array<MultiSeriesYAxisOption>,
	override: MultiSeriesChartOptions['yAxis']
): Array<MultiSeriesYAxisOption> {
	if (!override) return domainAxes
	if (Array.isArray(override)) return domainAxes.map((axis, index) => mergeDeep(axis, override[index] ?? {}))
	return domainAxes.map((axis) => mergeDeep(axis, override))
}

const EMPTY_CHART_OPTIONS: NonNullable<ChainCoreChartProps['chartOptions']> = {}

export default function ChainCoreChart({
	chartData,
	chartColors,
	valueSymbol = '',
	chartOptions = EMPTY_CHART_OPTIONS,
	unlockTokenSymbol = '',
	isThemeDark,
	groupBy,
	exportButtons
}: ChainCoreChartProps) {
	const tooltipGroupBy: ChartTimeGrouping = groupBy && groupBy !== 'cumulative' ? groupBy : 'daily'
	const chartTheme = useChartTheme(isThemeDark)
	const presentation = useMemo(
		() => buildChainChartPresentation(chartData, groupBy ?? 'daily', chartColors),
		[chartData, groupBy, chartColors]
	)
	const finalChartOptions = useMemo(() => {
		const domainAxes = buildChainYAxis({
			allYAxis: presentation.allYAxis,
			baseYAxis: {},
			chartColors,
			chartsInSeries: presentation.chartsInSeries,
			themeText: chartTheme.text
		})
		return {
			...chartOptions,
			yAxis: mergeYAxisOptions(domainAxes, chartOptions.yAxis),
			tooltip: mergeDeep(
				{
					formatter: createOverviewTooltipFormatter({
						groupBy: tooltipGroupBy,
						valueSymbol,
						unlockTokenSymbol,
						seriesValueSymbols: presentation.seriesValueSymbols
					})
				},
				chartOptions.tooltip
			)
		} satisfies MultiSeriesChartOptions
	}, [
		chartColors,
		chartOptions,
		chartTheme.text,
		presentation.allYAxis,
		presentation.chartsInSeries,
		presentation.seriesValueSymbols,
		tooltipGroupBy,
		unlockTokenSymbol,
		valueSymbol
	])

	return (
		<MultiSeriesChart
			dataset={presentation.dataset}
			charts={presentation.charts}
			chartOptions={finalChartOptions}
			valueSymbol={valueSymbol}
			{...(groupBy !== undefined ? { groupBy } : {})}
			exportButtons={exportButtons}
			isThemeDark={isThemeDark}
		/>
	)
}
