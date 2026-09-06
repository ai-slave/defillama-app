import {
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { BAR_CHARTS, PROTOCOL_CHART_LABELS, protocolCharts, type ProtocolChartsLabels } from './constants'
import { createDisabledProtocolToggledMetrics, type IToggledMetrics } from './types'

type ProtocolChartMetricQueryKey = (typeof protocolCharts)[ProtocolChartsLabels]
export type ProtocolChartQueryKey = ProtocolChartMetricQueryKey | 'denomination' | 'events' | 'groupBy'
export type ProtocolChartQueryValue = string | Array<string> | null | undefined

const getSingleQueryValue = (value: ProtocolChartQueryValue): string | null =>
	typeof value === 'string' ? value : null

const resolveVisibility = (queryValue: ProtocolChartQueryValue, defaultEnabled: boolean): 'true' | 'false' => {
	const value = getSingleQueryValue(queryValue)
	if (value === 'true') return 'true'
	if (value === 'false') return 'false'
	return defaultEnabled ? 'true' : 'false'
}

const normalizeChartInterval = (value: ProtocolChartQueryValue): LowercaseDwmcGrouping | null => {
	const normalizedValue = getSingleQueryValue(value)?.toLowerCase() ?? null
	return DWMC_GROUPING_OPTIONS_LOWERCASE.find((option) => option.value === normalizedValue)?.value ?? null
}

export function resolveProtocolChartDenomination(
	queryValue: ProtocolChartQueryValue,
	chartDenominations: Array<{ symbol: string }>
): string | null {
	const denomination = getSingleQueryValue(queryValue)?.toLowerCase()
	if (!denomination) return null
	return chartDenominations.find((option) => option.symbol.toLowerCase() === denomination)?.symbol ?? null
}

export function resolveProtocolChartQuery({
	getQueryValue,
	availableCharts,
	defaultToggledCharts,
	chartDenominations,
	hallmarks,
	rangeHallmarks,
	defaultChartView
}: {
	getQueryValue: (key: ProtocolChartQueryKey) => ProtocolChartQueryValue
	availableCharts: Array<ProtocolChartsLabels>
	defaultToggledCharts: Array<ProtocolChartsLabels>
	chartDenominations: Array<{ symbol: string }>
	hallmarks: Array<[number, string]>
	rangeHallmarks: Array<[[number, number], string]>
	defaultChartView: string | undefined
}): {
	toggledMetrics: IToggledMetrics
	toggledCharts: Array<ProtocolChartsLabels>
	hasAtLeastOneBarChart: boolean
	hasEvents: boolean
	groupBy: LowercaseDwmcGrouping
	defaultEnabledCharts: Partial<Record<ProtocolChartsLabels, boolean>>
} {
	const defaultEnabledChartSet = new Set(defaultToggledCharts)
	const defaultEnabledCharts: Partial<Record<ProtocolChartsLabels, boolean>> = {}
	const toggledMetrics = createDisabledProtocolToggledMetrics()

	for (const chartLabel of PROTOCOL_CHART_LABELS) {
		const chartKey = protocolCharts[chartLabel]
		const defaultEnabled = defaultEnabledChartSet.has(chartLabel)
		defaultEnabledCharts[chartLabel] = defaultEnabled
		toggledMetrics[chartKey] = resolveVisibility(getQueryValue(chartKey), defaultEnabled)
	}

	const hasEvents = hallmarks.length > 0 || rangeHallmarks.length > 0
	toggledMetrics.events = hasEvents ? resolveVisibility(getQueryValue('events'), true) : 'false'
	toggledMetrics.denomination = resolveProtocolChartDenomination(getQueryValue('denomination'), chartDenominations)

	const toggledCharts = availableCharts.filter((chart) => toggledMetrics[protocolCharts[chart]] === 'true')
	const hasAtLeastOneBarChart = toggledCharts.some((chart) => BAR_CHARTS.includes(chart))
	const groupBy = hasAtLeastOneBarChart
		? (normalizeChartInterval(getQueryValue('groupBy')) ?? normalizeChartInterval(defaultChartView) ?? 'daily')
		: 'daily'

	return {
		toggledMetrics,
		toggledCharts,
		hasAtLeastOneBarChart,
		hasEvents,
		groupBy,
		defaultEnabledCharts
	}
}
