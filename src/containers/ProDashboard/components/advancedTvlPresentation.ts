import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { chartGrid } from '~/components/ECharts/shared/chartSpacing'
import { createSignedInflowsTooltipFormatter } from '~/components/ECharts/shared/tooltip'
import { buildProtocolV1ChartConfigs } from '~/containers/ProtocolOverview/protocolV1AddlChartsData'
import type { AdvancedTvlChartType } from '../types'
import { generateConsistentChartColor } from '../utils/colorManager'

const DASHBOARD_BLUE = '#326abd'

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

const TVL_CHARTS: MultiSeriesChartSeriesConfig[] = [
	{
		type: 'line',
		name: 'TVL',
		encode: { x: 'timestamp', y: 'TVL' },
		color: DASHBOARD_BLUE
	}
]
const USD_INFLOWS_CHARTS: MultiSeriesChartSeriesConfig[] = [
	{
		type: 'bar',
		name: 'USD Inflows',
		encode: { x: 'timestamp', y: 'USD Inflows' },
		color: DASHBOARD_BLUE,
		stack: 'stackA'
	}
]

export function orderAdvancedTvlChains(dataset: TimestampDataset, chainNames: string[]): string[] {
	const latest = dataset.source[dataset.source.length - 1]
	if (!latest) return chainNames
	const dimensionIndex = new Map(dataset.dimensions.map((dimension, index) => [dimension, index]))
	return chainNames.toSorted((a, b) => {
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
	chainNames: string[]
	tokenNames: string[]
}) {
	const orderedChainNames = orderAdvancedTvlChains(chainsDataset, chainNames)
	const colorNames =
		chartType === 'chainsTvl'
			? orderedChainNames
			: chartType === 'tokenValuesUsd' ||
				  chartType === 'tokensPie' ||
				  chartType === 'tokenBalances' ||
				  chartType === 'tokenInflows'
				? tokenNames
				: []
	const itemType = chartType === 'chainsTvl' ? 'chain' : 'protocol'
	const stackColors = Object.fromEntries(
		colorNames.map((name) => [name, generateConsistentChartColor(name, '#8884d8', itemType)])
	)

	let charts: MultiSeriesChartSeriesConfig[] = []
	let chartOptions = DOLLAR_CHART_OPTIONS
	let valueSymbol = '$'
	let solidChartAreaStyle = false

	switch (chartType) {
		case 'tvl':
			charts = TVL_CHARTS
			break
		case 'chainsTvl':
			charts = buildProtocolV1ChartConfigs({
				seriesNames: orderedChainNames,
				type: 'line',
				colors: stackColors,
				hideAreaStyle: true
			})
			break
		case 'tokenValuesUsd':
			charts = buildProtocolV1ChartConfigs({
				seriesNames: tokenNames,
				type: 'line',
				colors: stackColors,
				stack: 'Total'
			})
			chartOptions = STACKED_DOLLAR_CHART_OPTIONS
			solidChartAreaStyle = true
			break
		case 'tokenBalances':
			charts = buildProtocolV1ChartConfigs({
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
			charts = buildProtocolV1ChartConfigs({
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
