import type * as echarts from 'echarts/core'
import { useMemo } from 'react'
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
import { chainOverviewChartColors } from './constants'
import type { ChainOverviewChartData } from './types'

interface ChainCoreChartProps {
	chartData: ChainOverviewChartData
	valueSymbol?: string
	chartOptions?: MultiSeriesChartOptions
	height?: string
	unlockTokenSymbol?: string
	isThemeDark: boolean
	groupBy?: ChartTimeGroupingWithCumulative
	onReady?: (instance: echarts.ECharts | null) => void
}

function mergeYAxisOptions(
	domainAxes: MultiSeriesYAxisOption[],
	override: MultiSeriesChartOptions['yAxis']
): MultiSeriesYAxisOption[] {
	if (!override) return domainAxes
	if (Array.isArray(override)) return domainAxes.map((axis, index) => mergeDeep(axis, override[index] ?? {}))
	return domainAxes.map((axis) => mergeDeep(axis, override))
}

export default function ChainCoreChart({
	chartData,
	valueSymbol = '',
	chartOptions = {},
	height,
	unlockTokenSymbol = '',
	isThemeDark,
	groupBy,
	onReady
}: ChainCoreChartProps) {
	const isCumulative = groupBy === 'cumulative'
	const tooltipGroupBy: ChartTimeGrouping = groupBy && groupBy !== 'cumulative' ? groupBy : 'daily'
	const chartTheme = useChartTheme(isThemeDark)
	const presentation = useMemo(() => buildChainChartPresentation(chartData, isCumulative), [chartData, isCumulative])
	const finalChartOptions = useMemo(() => {
		const domainAxes = buildChainYAxis({
			allYAxis: presentation.allYAxis,
			baseYAxis: {},
			chartColors: chainOverviewChartColors,
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
			{...(height !== undefined ? { height } : {})}
			autoHideDataZoom={false}
			hideDefaultLegend
			exportButtons="hidden"
			isThemeDark={isThemeDark}
			{...(onReady !== undefined ? { onReady } : {})}
		/>
	)
}
