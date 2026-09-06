import type { ChartBuilderConfig } from '~/containers/ProDashboard/types'
import {
	getProtocolChainBreakdownRoute,
	NON_ADAPTER_BY_CHAIN_BREAKDOWN_METRICS
} from '~/containers/ProDashboard/utils/breakdownMetrics'
import type { ProtocolBreakdownData, ProtocolChainData } from '~/utils/breakdowns'
import { fetchWithPoolingOnServer } from '~/utils/http-client'
import { recordRuntimeError } from '~/utils/telemetry'

type ChartBuilderMetric = ChartBuilderConfig['config']['metric']
export type ProtocolBreakdownMetric = Exclude<ChartBuilderMetric, 'stablecoins' | 'chain-fees' | 'chain-revenue'>
type FilterMode = ChartBuilderConfig['config']['chainFilterMode']

export interface ProtocolBreakdownRequest {
	metric: ProtocolBreakdownMetric
	chains: Array<string>
	limit?: number
	categories?: Array<string>
	groupByParent?: boolean | undefined
	chainFilterMode?: FilterMode
	categoryFilterMode?: FilterMode
}

export interface ProtocolChainBreakdownRequest {
	protocol?: string | undefined
	metric: ChartBuilderMetric
	chains?: Array<string> | undefined
	limit?: number
	chainFilterMode?: FilterMode
	chainCategories?: Array<string> | undefined
	protocolCategories?: Array<string> | undefined
	chainCategoryFilterMode?: FilterMode
	protocolCategoryFilterMode?: FilterMode
}

export async function fetchProtocolBreakdownData({
	metric,
	chains,
	limit = 10,
	categories = [],
	groupByParent,
	chainFilterMode = 'include',
	categoryFilterMode = 'include'
}: ProtocolBreakdownRequest): Promise<ProtocolBreakdownData> {
	const params = new URLSearchParams()
	if (chains.length > 0) params.append('chains', chains.join(','))
	params.append('limit', limit.toString())
	if (categories.length > 0) params.append('categories', categories.join(','))
	if (groupByParent) params.append('groupByParent', 'true')
	params.append('chainFilterMode', chainFilterMode)
	params.append('categoryFilterMode', categoryFilterMode)

	const endpoint =
		metric === 'tvl'
			? '/api/public/pro-dashboard/chart-builder/protocols/breakdowns/tvl'
			: `/api/public/pro-dashboard/chart-builder/adapter-metrics/breakdowns/${metric}`
	try {
		const response = await fetchWithPoolingOnServer(`${endpoint}?${params.toString()}`)
		if (!response.ok) throw new Error(`Failed to fetch ${metric} breakdown data: ${response.statusText}`)
		return response.json()
	} catch (error) {
		recordRuntimeError(error, 'pageBuild')
		throw error
	}
}

export async function fetchProtocolChainBreakdownData({
	protocol,
	metric,
	chains,
	limit = 5,
	chainFilterMode = 'include',
	chainCategories,
	protocolCategories,
	chainCategoryFilterMode = 'include',
	protocolCategoryFilterMode = 'include'
}: ProtocolChainBreakdownRequest): Promise<ProtocolChainData> {
	const params = new URLSearchParams()
	if (protocol) params.append('protocol', protocol)
	if (chains?.length) params.append('chains', chains.join(','))
	if (limit) params.append('limit', String(limit))
	params.append('chainFilterMode', chainFilterMode)
	if (chainCategories?.length) {
		params.append('chainCategories', chainCategories.join(','))
		params.append('chainCategoryFilterMode', chainCategoryFilterMode)
	}
	const supportsProtocolCategoryFilter =
		!NON_ADAPTER_BY_CHAIN_BREAKDOWN_METRICS.has(metric) && (!protocol || protocol.toLowerCase() === 'all')
	if (supportsProtocolCategoryFilter && protocolCategories?.length) {
		params.append('protocolCategories', protocolCategories.join(','))
		params.append('protocolCategoryFilterMode', protocolCategoryFilterMode)
	}

	try {
		const endpoint = getProtocolChainBreakdownRoute(metric)
		const response = await fetchWithPoolingOnServer(`${endpoint}?${params.toString()}`)
		if (!response.ok) throw new Error(`Failed to fetch protocol chain data: ${response.statusText}`)
		return response.json()
	} catch (error) {
		recordRuntimeError(error, 'pageBuild')
		throw error
	}
}
