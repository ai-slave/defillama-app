import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { chartGrid } from '~/components/ECharts/shared/chartSpacing'
import { createSignedInflowsTooltipFormatter } from '~/components/ECharts/shared/tooltip'
import { CHART_COLORS, chartColor, OTHERS_COLOR } from '~/constants/colors'
import { buildProtocolBreakdownChartConfigs } from '~/containers/ProtocolOverview/buildProtocolBreakdownChartConfigs'
import type { AdvancedTvlChartType } from '../types'

const DOLLAR_CHART_OPTIONS = {
	...createTimeSeriesChartOptions('$'),
	grid: chartGrid()
}
const STACKED_DOLLAR_CHART_OPTIONS = {
	...createTimeSeriesChartOptions('$'),
	grid: chartGrid()
}
const UNITLESS_CHART_OPTIONS = {
	...createTimeSeriesChartOptions(''),
	grid: chartGrid()
}
const INFLOWS_CHART_OPTIONS = {
	tooltip: { formatter: createSignedInflowsTooltipFormatter('$') },
	grid: chartGrid()
}
const SINGLE_INFLOWS_CHART_OPTIONS = {
	tooltip: { formatter: createSignedInflowsTooltipFormatter('$', true) },
	grid: chartGrid()
}

const TVL_CHARTS: Array<MultiSeriesChartSeriesConfig> = [
	{
		type: 'line',
		name: 'TVL',
		encode: { x: 'timestamp', y: 'TVL' },
		color: CHART_COLORS[0]
	}
]
const USD_INFLOWS_CHARTS: Array<MultiSeriesChartSeriesConfig> = [
	{
		type: 'bar',
		name: 'USD Inflows',
		encode: { x: 'timestamp', y: 'USD Inflows' },
		color: CHART_COLORS[0],
		stack: 'stackA'
	}
]

export function orderAdvancedTvlChains(dataset: TimestampDataset, chainNames: Array<string>): Array<string> {
	const latest = dataset.source[dataset.source.length - 1]
	if (!latest) return chainNames
	const dimensionIndex = new Map(dataset.dimensions.map((dimension, index) => [dimension, index]))
	// Largest first by the latest value, with the folded Others last.
	return chainNames.toSorted((a, b) => {
		if (a === 'Others' || b === 'Others') return (a === 'Others' ? 1 : 0) - (b === 'Others' ? 1 : 0)
		const bIndex = dimensionIndex.get(b)
		const aIndex = dimensionIndex.get(a)
		const bValue = bIndex === undefined ? undefined : (latest[bIndex] as number | null | undefined)
		const aValue = aIndex === undefined ? undefined : (latest[aIndex] as number | null | undefined)
		return (bValue ?? 0) - (aValue ?? 0)
	})
}

export function buildAdvancedTvlPresentation({
	chartType,
	chainsDataset,
	chainNames,
	tokenNames
}: {
	chartType: AdvancedTvlChartType
	chainsDataset: TimestampDataset
	chainNames: Array<string>
	tokenNames: Array<string>
}) {
	const orderedChainNames = orderAdvancedTvlChains(chainsDataset, chainNames)
	const colorNames =
		chartType === 'chainsTvl'
			? orderedChainNames
			: chartType === 'tokenValuesUsd' || chartType === 'tokenBalances' || chartType === 'tokenInflows'
				? tokenNames
				: []
	// Series take the palette by rank in the chart; the folded remainder is always the Others grey.
	const stackColors: Record<string, string> = {}
	let rank = 0
	for (const name of colorNames) stackColors[name] = name === 'Others' ? OTHERS_COLOR : chartColor(rank++)

	let charts: Array<MultiSeriesChartSeriesConfig> = []
	let chartOptions = DOLLAR_CHART_OPTIONS
	let valueSymbol = '$'
	let solidChartAreaStyle = false

	switch (chartType) {
		case 'tvl':
			charts = TVL_CHARTS
			break
		case 'chainsTvl':
			charts = buildProtocolBreakdownChartConfigs({
				seriesNames: orderedChainNames,
				dimensions: chainsDataset.dimensions,
				type: 'line',
				colors: stackColors,
				hideAreaStyle: true
			})
			break
		case 'tokenValuesUsd':
			charts = buildProtocolBreakdownChartConfigs({
				seriesNames: tokenNames,
				type: 'line',
				colors: stackColors,
				stack: 'Total'
			})
			chartOptions = STACKED_DOLLAR_CHART_OPTIONS
			solidChartAreaStyle = true
			break
		case 'tokenBalances':
			charts = buildProtocolBreakdownChartConfigs({
				seriesNames: tokenNames,
				type: 'line',
				colors: stackColors,
				hideAreaStyle: true
			})
			chartOptions = UNITLESS_CHART_OPTIONS
			valueSymbol = ''
			break
		case 'usdInflows':
			charts = USD_INFLOWS_CHARTS
			chartOptions = SINGLE_INFLOWS_CHART_OPTIONS
			break
		case 'tokenInflows':
			charts = buildProtocolBreakdownChartConfigs({
				seriesNames: tokenNames,
				type: 'bar',
				colors: stackColors,
				stack: 'stackA'
			})
			chartOptions = INFLOWS_CHART_OPTIONS
			break
	}

	return {
		chartOptions,
		charts,
		hideDataZoom: chartType !== 'usdInflows' && chartType !== 'tokenInflows',
		orderedChainNames,
		solidChartAreaStyle,
		stackColors,
		valueSymbol
	}
}
