import { chartGrid } from '~/components/ECharts/chartSpacing'
import { createSignedInflowsTooltipFormatter } from '~/components/ECharts/formatters'
import { createTimeSeriesChartOptions } from '~/components/ECharts/timeSeriesChartOptions'
import type { TimestampDataset } from '~/components/ECharts/timeSeriesDataset'
import type { MultiSeriesChart2SeriesConfig } from '~/components/ECharts/types'
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

const TVL_CHARTS: MultiSeriesChart2SeriesConfig[] = [
	{
		type: 'line',
		name: 'TVL',
		encode: { x: 'timestamp', y: 'TVL' },
		color: DASHBOARD_BLUE
	}
]
const USD_INFLOWS_CHARTS: MultiSeriesChart2SeriesConfig[] = [
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
	return chainNames.toSorted(
		(a, b) => ((latest[b] as number | undefined) ?? 0) - ((latest[a] as number | undefined) ?? 0)
	)
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
	const stackColors = Object.create(null) as Record<string, string>
	for (const name of colorNames) {
		stackColors[name] = generateConsistentChartColor(name, '#8884d8', itemType)
	}

	let charts: MultiSeriesChart2SeriesConfig[] = []
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
