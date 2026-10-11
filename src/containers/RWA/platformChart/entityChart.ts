import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { QueryRetry } from '~/utils/query'
import type { RWAFlowGrouping } from '../flows'

/* The metric list of an entity chart (a platform or a venue as one series per metric), read from and written to the
   address. Pure: the panels parse the query with it and write the selection back. */

type RWAEntityChartMetric<K extends string> = {
	key: K
	label: string
	group: string
	description: string
}

export type RWAEntityChartCatalog<K extends string> = {
	/** Every metric in catalog order, the order the chips and the series keep. */
	metrics: ReadonlyArray<RWAEntityChartMetric<K>>
	/** The groups of the Add Metrics dialog, in order. */
	groups: ReadonlyArray<string>
	/** What the chart draws when the address names nothing it knows. */
	defaults: ReadonlyArray<K>
}

export type RWAEntityChart = {
	series: Array<MultiSeriesChartSeriesConfig>
	hallmarks: Array<[number, string]>
}

/** What an entity chart panel draws: the series, the period they were built with, and the load state. */
export type RWAEntityChartData = {
	chart: RWAEntityChart & { period: RWAFlowGrouping }
	isLoading: boolean
	/** The reads that failed, for the chart's Try again; null when none failed. */
	failedRead: QueryRetry | null
}

export const RWA_ENTITY_CHART_METRICS_QUERY_KEY = 'metrics'
export const RWA_ENTITY_CHART_PERIOD_QUERY_KEY = 'chartPeriod'

/** `?metrics=a,b` in catalog order; unknown keys drop; nothing known selected means the defaults. */
export function parseRwaEntityChartMetrics<K extends string>(
	catalog: RWAEntityChartCatalog<K>,
	value: string | Array<string> | undefined
): Array<K> {
	const raw = (Array.isArray(value) ? value : value ? [value] : []).flatMap((entry) => entry.split(','))
	const wanted = new Set(raw.map((entry) => entry.trim()))
	const selected = catalog.metrics.filter((metric) => wanted.has(metric.key)).map((metric) => metric.key)
	return selected.length > 0 ? selected : [...catalog.defaults]
}

/** The default and an empty selection both stay out of the URL: the chart never draws nothing. */
export function getRwaEntityChartMetricsQuery<K extends string>(
	catalog: RWAEntityChartCatalog<K>,
	selected: ReadonlyArray<K>
): string | undefined {
	const ordered = catalog.metrics.filter((metric) => selected.includes(metric.key)).map((metric) => metric.key)
	const isDefault =
		ordered.length === 0 ||
		(ordered.length === catalog.defaults.length && ordered.every((key, index) => key === catalog.defaults[index]))
	return isDefault ? undefined : ordered.join(',')
}
