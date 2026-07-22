import type { NextApiRequest, NextApiResponse } from 'next'
import {
	isProDashboardProxyType,
	type ProDashboardProxyRequest,
	type ProDashboardProxyResponseValue
} from '~/containers/ProDashboard/dashboardProxyContract'
import { buildProDashboardProtocolRelations } from '~/containers/ProDashboard/protocolCatalog'
import { fetchProtocolsAndChains, fetchSingleChartData, withTimeout } from '~/containers/ProDashboard/queries.server'
import { buildStablecoinsChartCacheValue } from '~/containers/ProDashboard/server/stablecoinFetchers'
import { fetchStablecoinAssetsApi, fetchStablecoinChartApi } from '~/containers/Stablecoins/api'
import { fetchProtocolsByToken } from '~/containers/TokenUsage/api'
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
			if (!chart?.type) throw new Error('Missing chart config')
			const catalog = chart.protocol ? await fetchProtocolsAndChains() : null
			return fetchSingleChartData(chart, 'all', null, buildProDashboardProtocolRelations(catalog))
		}

		case 'stablecoins': {
			const { chain } = request.params
			if (!chain) throw new Error('Missing chain param')

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
			if (!poolConfigId) throw new Error('Missing poolConfigId param')
			return withTimeout(fetchPoolDetailHistory(poolConfigId, 'max'), FETCH_TIMEOUT)
		}

		case 'yieldsLendBorrow': {
			const { poolConfigId } = request.params
			if (!poolConfigId) throw new Error('Missing poolConfigId param')
			return withTimeout(fetchBorrowMarketDetailHistory(poolConfigId, 'max'), FETCH_TIMEOUT)
		}

		case 'tokenUsage': {
			const { symbol } = request.params
			if (!symbol) throw new Error('Missing symbol param')
			return withTimeout(fetchProtocolsByToken(symbol), FETCH_TIMEOUT)
		}

		case 'rwaBreakdown': {
			const { breakdown, metric, chain } = request.params
			if (!breakdown) throw new Error('Missing breakdown param')
			const rwaApi = await import('~/containers/RWA/api')

			if (chain && chain !== 'All') {
				const rows = await withTimeout(
					rwaApi.fetchRWAChartMetricDataByAsset({
						target: { kind: 'chain', slug: chain },
						metric: metric || 'activeMcap',
						includeStablecoins: false,
						includeGovernance: false
					}),
					FETCH_TIMEOUT
				)
				return import('~/containers/RWA/breakdownDataset').then(({ toRwaPositionalChartDataset }) =>
					toRwaPositionalChartDataset(rows)
				)
			}

			const breakdownParams = { key: metric || 'activeMcap', includeStablecoin: false, includeGovernance: false }
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
			if (!assetId) throw new Error('Missing assetId param')
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
			const { ticker, country = 'US' } = request.params
			if (!ticker) throw new Error('Missing ticker param')
			const { fetchEquitiesStatements } = await import('~/containers/Equities/api')
			return withTimeout(fetchEquitiesStatements(ticker, country), FETCH_TIMEOUT)
		}

		case 'equitiesFilings': {
			const { ticker, country = 'US' } = request.params
			if (!ticker) throw new Error('Missing ticker param')
			const { fetchEquitiesFilings } = await import('~/containers/Equities/api')
			return withTimeout(fetchEquitiesFilings(ticker, country), FETCH_TIMEOUT)
		}

		case 'stablecoinsList': {
			return withTimeout(fetchStablecoinAssetsApi(), FETCH_TIMEOUT)
		}

		case 'stablecoinAsset': {
			const { slug } = request.params
			if (!slug) throw new Error('Missing slug param')
			const { fetchStablecoinPeggedConfigApi, fetchStablecoinAssetApi } = await import('~/containers/Stablecoins/api')
			const peggedNameToPeggedIDMapping = await withTimeout(fetchStablecoinPeggedConfigApi(), FETCH_TIMEOUT)
			const peggedID = peggedNameToPeggedIDMapping[slug]
			if (!peggedID) return null
			return withTimeout(fetchStablecoinAssetApi(peggedID), FETCH_TIMEOUT)
		}
	}
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'GET') {
		res.setHeader('Allow', ['GET'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	const auth = await requireSubscription(dashboardProxyAuthHeader(req), res)
	if (!auth) return

	const { type, params: paramsStr } = req.query
	if (!isProDashboardProxyType(type) || typeof paramsStr !== 'string') {
		return res.status(400).json({ error: 'Missing type or params' })
	}

	let params: unknown
	try {
		params = JSON.parse(paramsStr)
	} catch {
		return res.status(400).json({ error: 'Invalid params JSON' })
	}
	if (!params || typeof params !== 'object' || Array.isArray(params)) {
		return res.status(400).json({ error: 'Invalid params JSON' })
	}
	const request = { type, params } as ProDashboardProxyRequest

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
		recordRouteRuntimeError(error, 'apiRoute', { type })
		return res.status(500).json({ error: 'Failed to fetch data' })
	}
}

export default withApiRouteTelemetry('/api/private/pro-dashboard/fetch', handler)
