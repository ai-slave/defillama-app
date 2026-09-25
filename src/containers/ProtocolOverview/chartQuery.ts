import {
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { formatCompactNumber, formatUsd } from '~/utils/numberFormat'
import { isTruthyQueryParam } from '~/utils/routerQuery'
import { BAR_CHARTS, PROTOCOL_CHART_LABELS, protocolCharts, type ProtocolChartsLabels } from './constants'
import { PROTOCOL_EXTRA_TVL_KEYS } from './tvlChart'
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

/** Reads chart query values from the browser path, where a repeated key comes back as an array. */
export function readAsPathQuery(asPath: string): (key: string) => ProtocolChartQueryValue {
	const searchParams = new URLSearchParams(asPath.split('?')[1]?.split('#')[0] ?? '')
	return function getQueryValue(key) {
		const values = searchParams.getAll(key)
		if (values.length === 0) return null
		if (values.length === 1) return values[0]
		return values
	}
}

/** Embedded charts take TVL extras from `include_<key>_in_tvl` params instead of saved settings. */
export function resolveEmbedTvlSettings(
	getQueryValue: (key: string) => ProtocolChartQueryValue
): Record<(typeof PROTOCOL_EXTRA_TVL_KEYS)[number], boolean> {
	const tvlSettings = {} as Record<(typeof PROTOCOL_EXTRA_TVL_KEYS)[number], boolean>
	for (const setting of PROTOCOL_EXTRA_TVL_KEYS) {
		tvlSettings[setting] = isTruthyQueryParam(getQueryValue(`include_${setting}_in_tvl`))
	}
	return tvlSettings
}

export function resolveProtocolChartDenomination(
	queryValue: ProtocolChartQueryValue,
	chartDenominations: Array<{ symbol: string }>
): string | null {
	const denomination = getSingleQueryValue(queryValue)?.toLowerCase()
	if (!denomination) return null
	return chartDenominations.find((option) => option.symbol.toLowerCase() === denomination)?.symbol ?? null
}

/**
 * Summary values follow the chart denomination: they switch to the chain token (the second
 * denomination) only once its price has loaded and that token is selected; otherwise they stay USD.
 */
export function formatProtocolSummaryValue(
	value: number | null,
	{
		selectedDenomination,
		tokenSymbol,
		tokenPrice
	}: {
		selectedDenomination: string | null
		tokenSymbol: string | undefined
		tokenPrice: { price: number; symbol: string } | null | undefined
	}
): string | number | null {
	if (value == null) return null
	const compact = { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' } as const
	if (tokenPrice && tokenPrice.price !== 0 && tokenSymbol && tokenSymbol === selectedDenomination) {
		return `${formatCompactNumber(value / tokenPrice.price, compact)} ${tokenPrice.symbol}`
	}
	return formatUsd(value, { compact: true, ...compact })
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
