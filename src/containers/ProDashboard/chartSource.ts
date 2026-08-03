import type { ProDashboardChartRequest } from './dataContracts'

const PROTOCOL_TOKEN_CHART_TYPES: ReadonlySet<string> = new Set(['tokenMcap', 'tokenPrice', 'tokenVolume'])
const CHAIN_TOKEN_CHART_TYPES: ReadonlySet<string> = new Set(['chainMcap', 'chainPrice'])

export function isProtocolTokenChartType(type: string): boolean {
	return PROTOCOL_TOKEN_CHART_TYPES.has(type)
}

export function isChainTokenChartType(type: string): boolean {
	return CHAIN_TOKEN_CHART_TYPES.has(type)
}

export function chartNeedsGeckoId(type: string, itemType: 'protocol' | 'chain'): boolean {
	return itemType === 'protocol' ? isProtocolTokenChartType(type) : isChainTokenChartType(type)
}

export function normalizeUnlocksDataType(dataType?: string): 'documented' | 'realtime' {
	return dataType === 'realtime' ? 'realtime' : 'documented'
}

export type ProDashboardChartSourceQueryKey = readonly [
	'pro-dashboard',
	'chart-source',
	string,
	'protocol' | 'chain',
	string,
	string | null,
	string | null
]

/** Raw chart identity; presentation grouping, time windows and card IDs are observer-local. */
export function getProDashboardChartSourceQueryKey(chart: ProDashboardChartRequest): ProDashboardChartSourceQueryKey {
	const itemType = chart.subjectType
	const item = chart.subjectType === 'protocol' ? chart.protocol : chart.chain
	const dataType = chart.type === 'unlocks' ? normalizeUnlocksDataType(chart.dataType) : null
	return [
		'pro-dashboard',
		'chart-source',
		chart.type,
		itemType,
		item,
		chartNeedsGeckoId(chart.type, itemType) ? (chart.geckoId ?? null) : null,
		dataType
	]
}
