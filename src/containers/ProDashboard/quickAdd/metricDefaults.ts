import {
	CHAIN_CHART_TYPES,
	isDashboardChartTypeForSubject,
	PROTOCOL_CHART_TYPES,
	type MetricAggregator,
	type MetricChartType,
	type MetricWindow,
	type ProDashboardChartType
} from '../types'

export type QuickAddSubjectType = 'protocol' | 'chain'

const FLOW_METRIC_TYPES: ReadonlySet<string> = new Set<ProDashboardChartType>([
	'volume',
	'fees',
	'revenue',
	'perps',
	'aggregators',
	'bridgeAggregators',
	'perpsAggregators',
	'holdersRevenue',
	'optionsPremium',
	'optionsNotional',
	'tokenVolume',
	'txs',
	'activeUsers',
	'newUsers',
	'gasUsed',
	'stablecoinInflows',
	'chainFees',
	'chainRevenue',
	'incentives'
])

export const QUICK_ADD_METRIC_WINDOW: MetricWindow = '30d'
export const QUICK_ADD_METRIC_CHART_TYPE: MetricChartType = 'sparkline'

export function isFlowMetricType(type: string): boolean {
	return FLOW_METRIC_TYPES.has(type)
}

export function getDefaultMetricAggregator(type: string): MetricAggregator {
	return isFlowMetricType(type) ? 'sum' : 'latest'
}

export const QUICK_ADD_METRIC_PRIORITY: ReadonlyArray<ProDashboardChartType> = [
	'tvl',
	'fees',
	'revenue',
	'volume',
	'activeUsers',
	'tokenPrice',
	'tokenMcap',
	'perps',
	'openInterest',
	'txs',
	'newUsers',
	'stablecoins',
	'bridgedTvl',
	'treasury',
	'borrowed',
	'holdersRevenue',
	'incentives',
	'unlocks',
	'medianApy',
	'gasUsed',
	'aggregators',
	'perpsAggregators',
	'bridgeAggregators',
	'optionsPremium',
	'optionsNotional',
	'tokenVolume',
	'stablecoinInflows',
	'chainFees',
	'chainRevenue',
	'chainMcap',
	'chainPrice',
	'pfRatio',
	'psRatio'
]

const CHAIN_METRIC_ALIASES: Partial<Record<ProDashboardChartType, ProDashboardChartType>> = {
	tokenPrice: 'chainPrice',
	tokenMcap: 'chainMcap'
}

const PROTOCOL_METRIC_ALIASES: Partial<Record<ProDashboardChartType, ProDashboardChartType>> = {
	chainPrice: 'tokenPrice',
	chainMcap: 'tokenMcap',
	chainFees: 'fees',
	chainRevenue: 'revenue'
}

export function resolveMetricForSubject(
	subjectType: QuickAddSubjectType,
	type: ProDashboardChartType
): ProDashboardChartType | null {
	if (isDashboardChartTypeForSubject(subjectType, type)) return type
	const alias = subjectType === 'chain' ? CHAIN_METRIC_ALIASES[type] : PROTOCOL_METRIC_ALIASES[type]
	if (alias === undefined) return null
	return isDashboardChartTypeForSubject(subjectType, alias) ? alias : null
}

export function getSubjectMetricPriority(subjectType: QuickAddSubjectType): Array<ProDashboardChartType> {
	const ordered: Array<ProDashboardChartType> = []
	const seen = new Set<ProDashboardChartType>()
	for (const type of QUICK_ADD_METRIC_PRIORITY) {
		const resolved = resolveMetricForSubject(subjectType, type)
		if (resolved === null || seen.has(resolved)) continue
		seen.add(resolved)
		ordered.push(resolved)
	}
	for (const type of subjectType === 'chain' ? CHAIN_CHART_TYPES : PROTOCOL_CHART_TYPES) {
		if (seen.has(type)) continue
		seen.add(type)
		ordered.push(type)
	}
	return ordered
}
