import { fetchWithPoolingOnServer } from '~/utils/http-client'
import type {
	ProDashboardProxyParams,
	ProDashboardProxyResponse,
	ProDashboardProxyType
} from '../dashboardProxyContract'
import type { ProDashboardChartRequest } from '../dataContracts'
const PROXY_URL = '/api/private/pro-dashboard/fetch'

async function proxyFetch<TType extends ProDashboardProxyType>(
	type: TType,
	params: ProDashboardProxyParams<TType>,
	authToken: string
): Promise<ProDashboardProxyResponse<TType>> {
	const url = `${PROXY_URL}?type=${encodeURIComponent(type)}&params=${encodeURIComponent(JSON.stringify(params))}`
	const res = await fetchWithPoolingOnServer(url, {
		headers: {
			Authorization: `Bearer ${authToken}`
		}
	})
	if (!res.ok) {
		throw new Error(`Proxy fetch failed: ${res.status}`)
	}
	const json = (await res.json()) as { data: ProDashboardProxyResponse<TType> }
	return json.data
}

export async function fetchChartViaProxy(chart: ProDashboardChartRequest, authToken: string) {
	return proxyFetch('chart', { chart }, authToken)
}

export async function fetchStablecoinsViaProxy(chain: string, authToken: string) {
	return proxyFetch('stablecoins', { chain }, authToken)
}

export async function fetchYieldsViaProxy(poolConfigId: string, authToken: string) {
	return proxyFetch('yields', { poolConfigId }, authToken)
}

export async function fetchYieldsLendBorrowViaProxy(poolConfigId: string, authToken: string) {
	return proxyFetch('yieldsLendBorrow', { poolConfigId }, authToken)
}

export async function fetchTokenUsageViaProxy(symbol: string, authToken: string) {
	return proxyFetch('tokenUsage', { symbol }, authToken)
}

export async function fetchStablecoinsListViaProxy(authToken: string) {
	return proxyFetch('stablecoinsList', {}, authToken)
}

export async function fetchStablecoinAssetViaProxy(slug: string, authToken: string) {
	return proxyFetch('stablecoinAsset', { slug }, authToken)
}

export async function fetchRWABreakdownViaProxy(
	breakdown: ProDashboardProxyParams<'rwaBreakdown'>['breakdown'],
	metric: ProDashboardProxyParams<'rwaBreakdown'>['metric'],
	authToken: string,
	chain?: string
) {
	return proxyFetch('rwaBreakdown', { breakdown, metric, chain }, authToken)
}

export async function fetchRWAAssetChartViaProxy(assetId: string, authToken: string) {
	return proxyFetch('rwaAssetChart', { assetId }, authToken)
}

export async function fetchRWAAssetsListViaProxy(authToken: string) {
	return proxyFetch('rwaAssetsList', {}, authToken)
}

export async function fetchRWAStatsViaProxy(authToken: string) {
	return proxyFetch('rwaStats', {}, authToken)
}

export async function fetchEquitiesCompaniesViaProxy(authToken: string) {
	return proxyFetch('equitiesCompanies', {}, authToken)
}

export async function fetchEquitiesStatementsViaProxy(ticker: string, country: string, authToken: string) {
	return proxyFetch('equitiesStatements', { ticker, country }, authToken)
}

export async function fetchEquitiesFilingsViaProxy(ticker: string, country: string, authToken: string) {
	return proxyFetch('equitiesFilings', { ticker, country }, authToken)
}
