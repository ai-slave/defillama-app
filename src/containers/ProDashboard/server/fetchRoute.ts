import type { NextApiRequest, NextApiResponse } from 'next'
import type {
	ProDashboardProxyRequest,
	ProDashboardProxyResponseValue
} from '~/containers/ProDashboard/dashboardProxyContract'
import { buildProDashboardProtocolRelations } from '~/containers/ProDashboard/protocolCatalog'
import { fetchProtocolsAndChains, fetchSingleChartData, withTimeout } from '~/containers/ProDashboard/queries.server'
import { buildStablecoinsChartCacheValue } from '~/containers/ProDashboard/stablecoinData'
import { fetchStablecoinAssetsApi, fetchStablecoinChartApi } from '~/containers/Stablecoins/api'
import { fetchBorrowMarketDetailHistory, fetchPoolDetailHistory } from '~/containers/Yields/poolDetail/fetch'
import { requireSubscription } from '~/server/api/requireSubscription'
import { addRouteTelemetryAttributes, recordRouteRuntimeError, withApiRouteTelemetry } from '~/utils/telemetry'

export const config = { api: { responseLimit: false } }

const FETCH_TIMEOUT = 15_000

function dashboardProxyAuthHeader(req: NextApiRequest): string | undefined {
	const authorization = req.headers?.authorization
	const rawHeader = Array.isArray(authorization) ? authorization[0] : authorization
	const token = rawHeader?.trim().replace(/^Bearer\s+/i, '')
	if (!token) return undefined
	return `Bearer ${token}`
}

async function dispatchFetch(request: ProDashboardProxyRequest): Promise<ProDashboardProxyResponseValue> {
	switch (request.type) {
		case 'chart': {
			const { chart } = request.params
			const catalog = chart.subjectType === 'protocol' ? await fetchProtocolsAndChains() : null
			return fetchSingleChartData(chart, 'all', null, buildProDashboardProtocolRelations(catalog))
		}

		case 'stablecoins': {
			const { chain } = request.params

			const peggedData = await withTimeout(fetchStablecoinAssetsApi(), FETCH_TIMEOUT)

			const chainLabel = chain === 'All' ? 'all' : chain
			const chainData = await withTimeout(fetchStablecoinChartApi(chainLabel), FETCH_TIMEOUT)
			return buildStablecoinsChartCacheValue({
				peggedData,
				chainData,
				chain
			})
		}

		case 'yields': {
			const { poolConfigId } = request.params
			return withTimeout(fetchPoolDetailHistory(poolConfigId, 'max'), FETCH_TIMEOUT)
		}

		case 'yieldsLendBorrow': {
			const { poolConfigId } = request.params
			return withTimeout(fetchBorrowMarketDetailHistory(poolConfigId, 'max'), FETCH_TIMEOUT)
		}

		case 'rwaBreakdown': {
			const { breakdown, metric, chain } = request.params
			const rwaApi = await import('~/containers/RWA/api')

			if (chain && chain !== 'All') {
				const rows = await withTimeout(
					rwaApi.fetchRWAChartMetricDataByAsset({
						target: { kind: 'chain', slug: chain },
						metric,
						includeStablecoins: false,
						includeGovernance: false
					}),
					FETCH_TIMEOUT
				)
				return import('~/containers/RWA/breakdownDataset').then(({ toRwaPositionalChartDataset }) =>
					toRwaPositionalChartDataset(rows)
				)
			}

			const breakdownParams = { key: metric, includeStablecoin: false, includeGovernance: false }
			const rows = await (async () => {
				switch (breakdown) {
					case 'category':
						return withTimeout(rwaApi.fetchRWACategoryBreakdownChartData(breakdownParams), FETCH_TIMEOUT)
					case 'platform':
						return withTimeout(rwaApi.fetchRWAPlatformBreakdownChartData(breakdownParams), FETCH_TIMEOUT)
					case 'assetGroup':
						return withTimeout(rwaApi.fetchRWAAssetGroupBreakdownChartData(breakdownParams), FETCH_TIMEOUT)
					default:
						return withTimeout(rwaApi.fetchRWAChainBreakdownChartData(breakdownParams), FETCH_TIMEOUT)
				}
			})()
			const { toRwaPositionalChartDataset } = await import('~/containers/RWA/breakdownDataset')
			return toRwaPositionalChartDataset(rows)
		}

		case 'rwaAssetChart': {
			const { assetId } = request.params
			const { fetchRWAAssetChartData } = await import('~/containers/RWA/api')
			return withTimeout(fetchRWAAssetChartData(assetId), FETCH_TIMEOUT)
		}

		case 'rwaAssetsList': {
			const { fetchRWAActiveTVLs } = await import('~/containers/RWA/api')
			return withTimeout(fetchRWAActiveTVLs(), FETCH_TIMEOUT)
		}

		case 'rwaStats': {
			const { fetchRWAStats } = await import('~/containers/RWA/api')
			return withTimeout(fetchRWAStats(), FETCH_TIMEOUT)
		}

		case 'equitiesCompanies': {
			const { fetchEquitiesCompanies } = await import('~/containers/Equities/api')
			return withTimeout(fetchEquitiesCompanies(), FETCH_TIMEOUT)
		}

		case 'equitiesStatements': {
			const { ticker, country } = request.params
			const { fetchEquitiesStatements } = await import('~/containers/Equities/api')
			return withTimeout(fetchEquitiesStatements(ticker, country), FETCH_TIMEOUT)
		}

		case 'equitiesFilings': {
			const { ticker, country } = request.params
			const { fetchEquitiesFilings } = await import('~/containers/Equities/api')
			return withTimeout(fetchEquitiesFilings(ticker, country), FETCH_TIMEOUT)
		}

		case 'stablecoinsList': {
			return withTimeout(fetchStablecoinAssetsApi(), FETCH_TIMEOUT)
		}

		case 'stablecoinAsset': {
			const { slug } = request.params
			const { fetchStablecoinPeggedConfigApi, fetchStablecoinAssetApi } = await import('~/containers/Stablecoins/api')
			const peggedNameToPeggedIDMapping = await withTimeout(fetchStablecoinPeggedConfigApi(), FETCH_TIMEOUT)
			const peggedID = peggedNameToPeggedIDMapping[slug]
			if (!peggedID) return null
			return withTimeout(fetchStablecoinAssetApi(peggedID), FETCH_TIMEOUT)
		}
	}
}

export async function dashboardFetchHandler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'GET') {
		res.setHeader('Allow', ['GET'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	const auth = await requireSubscription(dashboardProxyAuthHeader(req), res)
	if (!auth) return

	const requestParam = req.query.request
	if (typeof requestParam !== 'string') {
		return res.status(400).json({ error: 'Missing request' })
	}

	let request: ProDashboardProxyRequest
	try {
		request = JSON.parse(requestParam)
	} catch {
		return res.status(400).json({ error: 'Invalid request JSON' })
	}

	try {
		const fetchStart = Date.now()
		const data = await dispatchFetch(request)
		const fetchAllMs = Date.now() - fetchStart
		const constructStart = Date.now()
		const body = { data }
		const payload = JSON.stringify(body)
		addRouteTelemetryAttributes({
			fetch_all_ms: fetchAllMs,
			construct_response_ms: Date.now() - constructStart,
			response_bytes: Buffer.byteLength(payload)
		})
		res.setHeader('Cache-Control', 'private, max-age=300')
		res.setHeader('Content-Type', 'application/json')
		return res.status(200).send(payload)
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute', { type: request.type })
		return res.status(500).json({ error: 'Failed to fetch data' })
	}
}

export const dashboardFetchApiHandler = withApiRouteTelemetry('/api/private/pro-dashboard/fetch', dashboardFetchHandler)
