import { useMemo } from 'react'
import MultiSeriesChart from '~/components/ECharts/MultiSeriesChart'
import { createOverviewTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/overviewTooltip'
import type {
	ChartTimeGrouping,
	MultiSeriesChartOptions,
	MultiSeriesYAxisOption
} from '~/components/ECharts/MultiSeriesChart/types'
import { mergeDeep } from '~/components/ECharts/shared/merge'
import { buildProtocolChartPresentation, shouldHideProtocolDataZoom } from './chartPresentation'
import { buildProtocolYAxis } from './chartYAxis'
import type { IProtocolCoreChartProps } from './types'

function mergeYAxisOptions(
	domainAxes: Array<MultiSeriesYAxisOption>,
	override: MultiSeriesChartOptions['yAxis']
): Array<MultiSeriesYAxisOption> {
	if (!override) return domainAxes
	if (Array.isArray(override)) return domainAxes.map((axis, index) => mergeDeep(axis, override[index] ?? {}))
	return domainAxes.map((axis) => mergeDeep(axis, override))
}

const EMPTY_CHART_OPTIONS: NonNullable<IProtocolCoreChartProps['chartOptions']> = {}

export default function ProtocolChart({
	chartData,
	chartColors,
	valueSymbol = '',
	hallmarks,
	rangeHallmarks,
	chartOptions = EMPTY_CHART_OPTIONS,
	unlockTokenSymbol = '',
	gasUsedValueSymbol,
	isThemeDark,
	groupBy,
	hideDataZoom = false,
	onReady
}: IProtocolCoreChartProps) {
	const tooltipGroupBy: ChartTimeGrouping = groupBy && groupBy !== 'cumulative' ? groupBy : 'daily'
	const effectiveHideDataZoom = shouldHideProtocolDataZoom(chartData, hideDataZoom)
	const presentation = useMemo(
		() =>
			buildProtocolChartPresentation({
				chartData,
				chartColors,
				groupBy: groupBy ?? 'daily'
			}),
		[chartData, chartColors, groupBy]
	)
	const finalChartOptions = useMemo(() => {
		const normalizedUnlockTokenSymbol = unlockTokenSymbol ?? ''
		const domainAxes = buildProtocolYAxis({
			allYAxis: presentation.allYAxis,
			baseYAxis: {},
			chartColors,
			chartsInSeries: presentation.chartsInSeries,
			unlockTokenSymbol: normalizedUnlockTokenSymbol,
			gasUsedValueSymbol: gasUsedValueSymbol ?? valueSymbol
		})
		return {
			...chartOptions,
			yAxis: mergeYAxisOptions(domainAxes, chartOptions.yAxis),
			tooltip: mergeDeep(
				{
					formatter: createOverviewTooltipFormatter({
						groupBy: tooltipGroupBy,
						valueSymbol,
						unlockTokenSymbol: normalizedUnlockTokenSymbol,
						...(gasUsedValueSymbol ? { seriesValueSymbols: new Map([['Gas Used', gasUsedValueSymbol]]) } : {})
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
			{...(hallmarks !== null ? { hallmarks } : {})}
			rangeHallmarks={rangeHallmarks}
			hideDataZoom={effectiveHideDataZoom}
			exportButtons="hidden"
			isThemeDark={isThemeDark}
			{...(onReady !== undefined ? { onReady } : {})}
		/>
	)
}
