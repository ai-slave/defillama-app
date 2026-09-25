import {
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { TVL_SETTINGS } from '~/contexts/LocalStorage'
import { getChainDenominations } from '~/utils/metadata/chainDenominations'
import { isTruthyQueryParam } from '~/utils/routerQuery'
import { BAR_CHARTS, type ChainChartLabels, chainCharts } from './constants'
import type { IChainOverviewData } from './types'

const normalizeChartInterval = (value: string | null | undefined): LowercaseDwmcGrouping | null => {
	const normalizedValue = value?.toLowerCase() ?? null
	if (DWMC_GROUPING_OPTIONS_LOWERCASE.some((option) => option.value === normalizedValue)) {
		return normalizedValue as LowercaseDwmcGrouping
	}
	return null
}

/** Reads the embedded chain chart's settings from its query params; unknown values fall back to defaults. */
export function getEmbeddedChainChartSettings(
	queryParams: Record<string, any>,
	props: Pick<IChainOverviewData, 'charts' | 'chainTokenInfo' | 'metadata'>
) {
	const chainGeckoId = props.chainTokenInfo?.gecko_id ?? null

	const tvlSettings = {}

	for (const setting in TVL_SETTINGS) {
		tvlSettings[TVL_SETTINGS[setting]] = isTruthyQueryParam(queryParams[`include_${TVL_SETTINGS[setting]}_in_tvl`])
	}

	// The first chart is on unless turned off; every other chart is off unless turned on.
	const toggledCharts = props.charts.filter((tchart, index) =>
		index === 0 ? queryParams[chainCharts[tchart]] !== 'false' : queryParams[chainCharts[tchart]] === 'true'
	) as Array<ChainChartLabels>

	const hasAtleasOneBarChart = toggledCharts.some((chart) => BAR_CHARTS.includes(chart))

	const groupBy =
		hasAtleasOneBarChart && queryParams?.groupBy ? (normalizeChartInterval(queryParams.groupBy) ?? 'daily') : 'daily'

	const denomination =
		getChainDenominations(props.metadata).find(
			({ symbol }) =>
				typeof queryParams.currency === 'string' && symbol.toLowerCase() === queryParams.currency.toLowerCase()
		)?.symbol ?? 'USD'

	const isThemeDark = queryParams.theme === 'dark'

	return {
		chainGeckoId,
		toggledCharts,
		groupBy,
		denomination,
		tvlSettings,
		isThemeDark
	}
}

/**
 * Cumulative has no Active Addresses series. The toggle stays on, so switching back from cumulative
 * restores it: the notice fills the chart when it is the only series and sits above the chart otherwise.
 */
export function getActiveAddressesCumulativeNotice(
	groupBy: string,
	toggledCharts: Array<ChainChartLabels>
): 'fill' | 'inline' | null {
	if (groupBy !== 'cumulative' || !toggledCharts.includes('Active Addresses')) return null
	return toggledCharts.length === 1 ? 'fill' : 'inline'
}
