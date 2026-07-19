import type {
	IEquitiesCompanyApiItem,
	IEquitiesFilingApiItem,
	IEquitiesStatementsResponse
} from '~/containers/Equities/api.types'
import type { StablecoinsChartCacheValue } from '~/containers/ProDashboard/server/stablecoinFetchers'
import type {
	IFetchedRWAProject,
	IRWAAssetData,
	IRWABreakdownChartResponse,
	IRWAStatsResponse,
	RWAChartMetricKey,
	RWAOverviewBreakdownRequest
} from '~/containers/RWA/api.types'
import type { StablecoinDetailResponse, StablecoinsListResponse } from '~/containers/Stablecoins/api.types'
import type { RawProtocolTokenUsageEntry } from '~/containers/TokenUsage/api.types'
import type { BorrowMarketHistory, PoolHistory } from '~/containers/Yields/poolDetail/types'
import { fetchWithPoolingOnServer } from '~/utils/http-client'
const PROXY_URL = '/api/private/pro-dashboard/fetch'

async function proxyFetch<T>(type: string, params: Record<string, unknown>, authToken: string): Promise<T> {
	const url = `${PROXY_URL}?type=${encodeURIComponent(type)}&params=${encodeURIComponent(JSON.stringify(params))}`
	const res = await fetchWithPoolingOnServer(url, {
		headers: {
			Authorization: `Bearer ${authToken}`
		}
	})
	if (!res.ok) {
		throw new Error(`Proxy fetch failed: ${res.status}`)
	}
	const json = await res.json()
	return json.data as T
}

export async function fetchChartViaProxy(
	chart: {
		type: string
		protocol?: string
		chain?: string
		geckoId?: string | null
		dataType?: string
	},
	authToken: string
): Promise<[number, number][]> {
	return proxyFetch<[number, number][]>('chart', { chart }, authToken)
}

export async function fetchStablecoinsViaProxy(chain: string, authToken: string): Promise<StablecoinsChartCacheValue> {
	return proxyFetch<StablecoinsChartCacheValue>('stablecoins', { chain }, authToken)
}

export async function fetchAdvancedTvlBasicViaProxy(protocol: string, authToken: string): Promise<[number, number][]> {
	return proxyFetch<[number, number][]>('advancedTvlBasic', { protocol }, authToken)
}

export async function fetchProtocolFullViaProxy(protocol: string, authToken: string): Promise<unknown> {
	return proxyFetch<unknown>('protocolFull', { protocol }, authToken)
}

export async function fetchYieldsViaProxy(poolConfigId: string, authToken: string): Promise<PoolHistory> {
	return proxyFetch<PoolHistory>('yields', { poolConfigId }, authToken)
}

export async function fetchYieldsLendBorrowViaProxy(
	poolConfigId: string,
	authToken: string
): Promise<BorrowMarketHistory> {
	return proxyFetch<BorrowMarketHistory>('yieldsLendBorrow', { poolConfigId }, authToken)
}

export async function fetchTokenUsageViaProxy(
	symbol: string,
	authToken: string
): Promise<RawProtocolTokenUsageEntry[]> {
	return proxyFetch<RawProtocolTokenUsageEntry[]>('tokenUsage', { symbol }, authToken)
}

export async function fetchStablecoinsListViaProxy(authToken: string): Promise<StablecoinsListResponse> {
	return proxyFetch<StablecoinsListResponse>('stablecoinsList', {}, authToken)
}

export async function fetchStablecoinAssetViaProxy(
	slug: string,
	authToken: string
): Promise<StablecoinDetailResponse | null> {
	return proxyFetch<StablecoinDetailResponse | null>('stablecoinAsset', { slug }, authToken)
}

export async function fetchRWABreakdownViaProxy(
	breakdown: RWAOverviewBreakdownRequest['breakdown'],
	metric: RWAChartMetricKey,
	authToken: string,
	chain?: string
): Promise<IRWABreakdownChartResponse | null> {
	return proxyFetch<IRWABreakdownChartResponse | null>('rwaBreakdown', { breakdown, metric, chain }, authToken)
}

export async function fetchRWAAssetChartViaProxy(
	assetId: string,
	authToken: string
): Promise<IRWAAssetData['chartDataset']> {
	return proxyFetch<IRWAAssetData['chartDataset']>('rwaAssetChart', { assetId }, authToken)
}

export async function fetchRWAAssetsListViaProxy(authToken: string): Promise<IFetchedRWAProject[]> {
	return proxyFetch<IFetchedRWAProject[]>('rwaAssetsList', {}, authToken)
}

export async function fetchRWAStatsViaProxy(authToken: string): Promise<IRWAStatsResponse> {
	return proxyFetch<IRWAStatsResponse>('rwaStats', {}, authToken)
}

export async function fetchEquitiesCompaniesViaProxy(authToken: string): Promise<IEquitiesCompanyApiItem[]> {
	return proxyFetch<IEquitiesCompanyApiItem[]>('equitiesCompanies', {}, authToken)
}

export async function fetchEquitiesStatementsViaProxy(
	ticker: string,
	country: string,
	authToken: string
): Promise<IEquitiesStatementsResponse> {
	return proxyFetch<IEquitiesStatementsResponse>('equitiesStatements', { ticker, country }, authToken)
}

export async function fetchEquitiesFilingsViaProxy(
	ticker: string,
	country: string,
	authToken: string
): Promise<IEquitiesFilingApiItem[]> {
	return proxyFetch<IEquitiesFilingApiItem[]>('equitiesFilings', { ticker, country }, authToken)
}
