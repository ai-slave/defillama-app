import { useMemo } from 'react'
import MultiSeriesChart from '~/components/ECharts/MultiSeriesChart'
import { createOverviewTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/overviewTooltip'
import type {
	ChartTimeGrouping,
	MultiSeriesChartOptions,
	MultiSeriesYAxisOption
} from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET } from '~/components/ECharts/shared/chartSpacing'
import { useChartTheme } from '~/components/ECharts/shared/chartTheme'
import { mergeDeep } from '~/components/ECharts/shared/merge'
import { buildProtocolChartPresentation } from './chartPresentation'
import { buildProtocolYAxis } from './chartYAxis'
import type { IProtocolCoreChartProps } from './types'

function mergeYAxisOptions(
	domainAxes: MultiSeriesYAxisOption[],
	override: MultiSeriesChartOptions['yAxis']
): MultiSeriesYAxisOption[] {
	if (!override) return domainAxes
	if (Array.isArray(override)) return domainAxes.map((axis, index) => mergeDeep(axis, override[index] ?? {}))
	return domainAxes.map((axis) => mergeDeep(axis, override))
}

export default function ProtocolChart({
	chartData,
	chartColors,
	valueSymbol = '',
	hallmarks,
	rangeHallmarks,
	chartOptions = {},
	height,
	unlockTokenSymbol = '',
	gasUsedValueSymbol,
	isThemeDark,
	groupBy,
	hideDataZoom = false,
	onReady
}: IProtocolCoreChartProps) {
	const tooltipGroupBy: ChartTimeGrouping = groupBy && groupBy !== 'cumulative' ? groupBy : 'daily'
	const chartTheme = useChartTheme(isThemeDark)
	const effectiveHideDataZoom =
		hideDataZoom || Object.values(chartData).every((seriesData) => (seriesData?.length ?? 0) < 2)
	const presentation = useMemo(
		() =>
			buildProtocolChartPresentation({
				chartData,
				chartColors,
				isCumulative: groupBy === 'cumulative',
				rangeHallmarks,
				isThemeDark,
				themeText: chartTheme.text
			}),
		[chartData, chartColors, chartTheme.text, groupBy, isThemeDark, rangeHallmarks]
	)
	const finalChartOptions = useMemo(() => {
		const domainAxes = buildProtocolYAxis({
			allYAxis: presentation.allYAxis,
			baseYAxis: {},
			chartColors,
			chartsInSeries: presentation.chartsInSeries,
			unlockTokenSymbol: unlockTokenSymbol ?? '',
			gasUsedValueSymbol: gasUsedValueSymbol ?? valueSymbol
		})
		return {
			...chartOptions,
			grid: mergeDeep({ top: rangeHallmarks?.length ? 18 : CHART_INSET }, chartOptions.grid),
			yAxis: mergeYAxisOptions(domainAxes, chartOptions.yAxis),
			tooltip: mergeDeep(
				{
					formatter: createOverviewTooltipFormatter({
						groupBy: tooltipGroupBy,
						valueSymbol,
						unlockTokenSymbol: unlockTokenSymbol ?? '',
						seriesValueSymbols: gasUsedValueSymbol ? new Map([['Gas Used', gasUsedValueSymbol]]) : undefined
					})
				},
				chartOptions.tooltip
			)
		} satisfies MultiSeriesChartOptions
	}, [
		chartOptions,
		chartColors,
		gasUsedValueSymbol,
		presentation.allYAxis,
		presentation.chartsInSeries,
		rangeHallmarks,
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
			groupBy={groupBy}
			hallmarks={hallmarks ?? undefined}
			rangeHallmarks={rangeHallmarks}
			hallmarksInMs
			height={height}
			hideDataZoom={effectiveHideDataZoom}
			autoHideDataZoom={false}
			hideDefaultLegend
			exportButtons="hidden"
			isThemeDark={isThemeDark}
			onReady={onReady}
		/>
	)
}
