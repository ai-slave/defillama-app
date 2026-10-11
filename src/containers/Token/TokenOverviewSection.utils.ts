import { toNonEmptyArrayParam } from '~/utils/routerQuery'
import {
	TOKEN_OVERVIEW_DEFAULT_CHARTS,
	type TokenOverviewChartLabel,
	type TokenOverviewRawChartData
} from './tokenOverview'

export function roundToSignificantFigures(value: number, significantFigures = 4): number {
	if (!Number.isFinite(value) || value === 0) return 0

	return Number(value.toPrecision(significantFigures))
}

export const TOKEN_OVERVIEW_CHART_ORDER = [
	'Token Price',
	'Token Volume',
	'Mcap',
	'FDV'
] as const satisfies ReadonlyArray<TokenOverviewChartLabel>
const TOKEN_OVERVIEW_CHART_LABELS: ReadonlySet<string> = new Set(TOKEN_OVERVIEW_CHART_ORDER)

function isTokenOverviewChartLabel(value: string): value is TokenOverviewChartLabel {
	return TOKEN_OVERVIEW_CHART_LABELS.has(value)
}

function areTokenOverviewChartsEqual(a: Array<TokenOverviewChartLabel>, b: Array<TokenOverviewChartLabel>) {
	return a.length === b.length && a.every((value, index) => value === b[index])
}

/**
 * Which series the chart offers and shows. With a CoinGecko id every series except price is fetched on
 * demand; price, and every series for a token without an id, is offered only when the page carries it.
 * `chart=None` is an explicit empty chart; any other query keeps only the offered series it names.
 */
export function resolveTokenOverviewCharts({
	geckoId,
	rawChartData,
	chartQuery
}: {
	geckoId: string | null
	rawChartData: TokenOverviewRawChartData
	chartQuery: string | Array<string> | undefined
}) {
	const availableCharts = TOKEN_OVERVIEW_CHART_ORDER.filter((label) =>
		geckoId ? label !== 'Token Price' || (rawChartData[label]?.length ?? 0) > 0 : (rawChartData[label]?.length ?? 0) > 0
	)
	const pageDefaults = TOKEN_OVERVIEW_DEFAULT_CHARTS.filter((label) => (rawChartData[label]?.length ?? 0) > 0)
	const defaultCharts = pageDefaults.length > 0 ? pageDefaults : availableCharts.slice(0, 1)
	if (chartQuery === 'None') return { availableCharts, defaultCharts, activeCharts: [] }

	const availableChartsSet = new Set(availableCharts)
	const queryCharts = toNonEmptyArrayParam(chartQuery).filter(
		(chart): chart is TokenOverviewChartLabel => isTokenOverviewChartLabel(chart) && availableChartsSet.has(chart)
	)
	return { availableCharts, defaultCharts, activeCharts: queryCharts.length > 0 ? queryCharts : defaultCharts }
}

/** The `chart` query for a new selection: omitted for the defaults, `None` for an empty chart. */
export function getTokenOverviewChartQuery(
	nextCharts: Array<TokenOverviewChartLabel>,
	availableCharts: Array<TokenOverviewChartLabel>,
	defaultCharts: Array<TokenOverviewChartLabel>
): 'None' | Array<TokenOverviewChartLabel> | undefined {
	const availableChartsSet = new Set(availableCharts)
	const normalizedCharts = nextCharts.filter(
		(chart, index, charts) => availableChartsSet.has(chart) && charts.indexOf(chart) === index
	)
	if (normalizedCharts.length === 0) return 'None'
	return areTokenOverviewChartsEqual(normalizedCharts, defaultCharts) ? undefined : normalizedCharts
}

export type TokenOverviewChartBody =
	| 'wait-for-client'
	| 'error'
	| 'loading'
	| 'chart'
	| 'unavailable'
	| 'select-metrics'
	| 'no-market-data'

/** Series the page did not prefetch load on the client, so the server renders no body for them. */
export function getTokenOverviewChartBody({
	isClient,
	geckoId,
	pendingChartCount,
	readFailed,
	isLoading,
	hasChartData,
	activeChartCount
}: {
	isClient: boolean
	geckoId: string | null
	pendingChartCount: number
	/** A client read failed; it stays true while its Try again runs. */
	readFailed: boolean
	isLoading: boolean
	hasChartData: boolean
	activeChartCount: number
}): TokenOverviewChartBody {
	if (geckoId != null && pendingChartCount > 0) {
		if (!isClient) return 'wait-for-client'
		// A failed series beside ones that drew (FDV without a supply figure) leaves the chart up without it, rather
		// than an error in place of data the reader can use.
		if (readFailed && !hasChartData) return 'error'
		if (isLoading) return 'loading'
	}
	if (hasChartData) return 'chart'
	if (!geckoId) return 'no-market-data'
	return activeChartCount > 0 ? 'unavailable' : 'select-metrics'
}
