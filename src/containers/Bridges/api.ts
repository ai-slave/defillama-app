import { BRIDGES_SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type {
	BridgeNetflowPeriod,
	BridgeNetflowsResponse,
	BridgeDayStats,
	BridgeVolumeBySlugResponse,
	BridgeVolumeResponse,
	RawBridgeDayStats,
	RawBridgeLargeTransactionsResponse,
	RawBridgesResponse,
	RawBridgesWithChainsResponse,
	RawBridgeTxCountsResponse,
	RawBridgeTransactionsPage,
	RawBridgeVolumeBySlugResponse,
	RawBridgeVolumeResponse,
	RawBridgeNetflowsResponse
} from './api.types'
import { normalizeBridgeVolumeResponse } from './bridgeOverviewVolumeData'

const BRIDGEDAYSTATS_API = `${BRIDGES_SERVER_URL}/bridgedaystats`
const BRIDGES_API = `${BRIDGES_SERVER_URL}/bridges`
const BRIDGELARGETX_API = `${BRIDGES_SERVER_URL}/largetransactions`
const BRIDGETXCOUNT_API = `${BRIDGES_SERVER_URL}/bridgetxcounts`
const BRIDGEVOLUME_API = `${BRIDGES_SERVER_URL}/bridgevolume`
const BRIDGEVOLUME_API_SLUG = `${BRIDGES_SERVER_URL}/bridgevolume/slug`
const NETFLOWS_API = `${BRIDGES_SERVER_URL}/netflows`

export function fetchBridges(includeChains: true): Promise<RawBridgesWithChainsResponse>
export function fetchBridges(includeChains?: false): Promise<RawBridgesResponse>
export function fetchBridges(includeChains = false): Promise<RawBridgesResponse | RawBridgesWithChainsResponse> {
	const query = includeChains ? '?includeChains=true' : ''
	const url = `${BRIDGES_API}${query}`
	return fetchJson<RawBridgesResponse | RawBridgesWithChainsResponse>(url)
}

export function fetchRawBridgeVolumeAll(id?: string | number): Promise<RawBridgeVolumeResponse> {
	const query = id == null ? '' : `?id=${encodeURIComponent(String(id))}`
	const url = `${BRIDGEVOLUME_API}/all${query}`
	return fetchJson<RawBridgeVolumeResponse>(url)
}

export function fetchBridgeVolumeAll(id?: string | number): Promise<BridgeVolumeResponse> {
	return fetchRawBridgeVolumeAll(id).then(normalizeBridgeVolumeResponse)
}

export function fetchRawBridgeVolumeByChain(chain: string, id?: string | number): Promise<RawBridgeVolumeResponse> {
	const query = id == null ? '' : `?id=${encodeURIComponent(String(id))}`
	const url = `${BRIDGEVOLUME_API}/${encodeURIComponent(chain)}${query}`
	return fetchJson<RawBridgeVolumeResponse>(url)
}

export function fetchBridgeVolumeByChain(chain: string, id?: string | number): Promise<BridgeVolumeResponse> {
	return fetchRawBridgeVolumeByChain(chain, id).then(normalizeBridgeVolumeResponse)
}

export async function fetchBridgeVolumeBySlug(protocolSlug: string): Promise<BridgeVolumeBySlugResponse> {
	const url = `${BRIDGEVOLUME_API_SLUG}/${encodeURIComponent(protocolSlug)}`
	const response = await fetchJson<RawBridgeVolumeBySlugResponse>(url)
	return { bridge: response.bridge, dailyVolumes: normalizeBridgeVolumeResponse(response.dailyVolumes) }
}

export function fetchBridgeDayStats(
	timestamp: number,
	chain: string,
	options?: string | number | { id?: string | number; rollingHours?: number }
): Promise<BridgeDayStats> {
	const utcDayTimestamp = Math.floor(timestamp / 86400) * 86400
	const params = new URLSearchParams()
	if (typeof options === 'string' || typeof options === 'number') {
		params.set('id', String(options))
	} else if (options) {
		if (options.id != null) params.set('id', String(options.id))
		if (options.rollingHours != null) params.set('rollingHours', String(options.rollingHours))
	}
	const query = params.toString() ? `?${params.toString()}` : ''
	const url = `${BRIDGEDAYSTATS_API}/${encodeURIComponent(String(utcDayTimestamp))}/${encodeURIComponent(chain)}${query}`
	return fetchJson<RawBridgeDayStats>(url)
}

export function fetchBridgeLargeTransactions(
	startTimestamp: number,
	endTimestamp: number,
	chain?: string
): Promise<RawBridgeLargeTransactionsResponse> {
	const chainOrAll = chain ? encodeURIComponent(chain) : 'all'
	const url = `${BRIDGELARGETX_API}/${chainOrAll}?starttimestamp=${encodeURIComponent(String(startTimestamp))}&endtimestamp=${encodeURIComponent(String(endTimestamp))}`
	return fetchJson<RawBridgeLargeTransactionsResponse>(url)
}

export function fetchBridgeTxCounts(chain?: string): Promise<RawBridgeTxCountsResponse> {
	const chainOrAll = chain ? encodeURIComponent(chain) : 'all'
	const url = `${BRIDGETXCOUNT_API}/${chainOrAll}`
	return fetchJson<RawBridgeTxCountsResponse>(url)
}

export function fetchBridgeTransactionsClient(
	bridgeId: string | number,
	startTimestamp: number,
	endTimestamp: number,
	cursor?: string
): Promise<RawBridgeTransactionsPage> {
	const params = new URLSearchParams({
		starttimestamp: String(startTimestamp),
		endtimestamp: String(endTimestamp),
		limit: '10000',
		...(cursor ? { cursor } : {})
	})
	const url = `/api/public/bridges/transactions/${encodeURIComponent(String(bridgeId))}?${params.toString()}`
	return fetchJson<RawBridgeTransactionsPage>(url)
}

export function fetchBridgeNetflows(period: BridgeNetflowPeriod): Promise<BridgeNetflowsResponse> {
	const url = `${NETFLOWS_API}/${period}`
	return fetchJson<RawBridgeNetflowsResponse>(url).then(normalizeBridgeNetflowsResponse)
}

export function normalizeBridgeNetflowsResponse(response: RawBridgeNetflowsResponse): BridgeNetflowsResponse {
	return response.map((entry) => ({
		chain: entry.chain,
		netFlow: Number(entry.net_flow),
		depositedUsd: Number(entry.deposited_usd),
		withdrawnUsd: Number(entry.withdrawn_usd)
	}))
}
