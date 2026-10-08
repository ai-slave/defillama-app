import { RWA_PERPS_SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type {
	IRWAPerpsBreakdownChartResponse,
	IRWAPerpsFundingHistoryParams,
	IRWAPerpsFundingHistoryPoint,
	IRWAPerpsFundingHistoryWirePoint,
	IRWAPerpsMarket,
	IRWAPerpsMarketChartPoint
} from './api.types'
import type {
	IRWAPerpsContractBreakdownRequest,
	IRWAPerpsMarketBreakdownRequest,
	IRWAPerpsOverviewBreakdownRequest,
	RWAPerpsMarketBreakdownTarget
} from './types'

export function setRWAPerpsChartScope(
	searchParams: URLSearchParams,
	scope: { target: RWAPerpsMarketBreakdownTarget; includeCex: boolean }
): void {
	if (scope.includeCex) searchParams.set('includeCex', 'true')
	const target = scope.target
	switch (target.kind) {
		case 'all':
			return
		case 'venue':
			searchParams.set('venue', target.slug)
			return
		case 'assetGroup':
			searchParams.set('assetGroup', target.slug)
			return
		case 'assetClass':
			searchParams.set('assetClass', target.slug)
			return
		case 'excludeAssetClass':
			searchParams.set('excludeAssetClass', target.slug)
			return
		case 'baseAsset':
			searchParams.set('baseAsset', target.slug)
	}
}

function createRWAPerpsFundingHistoryUrl(id: string, params?: IRWAPerpsFundingHistoryParams): string {
	const encodedId = encodeURIComponent(id)
	const searchParams = new URLSearchParams()

	if (params?.startTime !== undefined) {
		searchParams.set('startTime', String(params.startTime))
	}

	if (params?.endTime !== undefined) {
		searchParams.set('endTime', String(params.endTime))
	}

	const qs = searchParams.toString()

	return `${RWA_PERPS_SERVER_URL}/funding/${encodedId}${qs ? `?${qs}&cachebust=091626` : '?cachebust=091626'}`
}

/**
 * Fetch the latest snapshot of every market, CEX markets included.
 */
export async function fetchRWAPerpsCurrent(): Promise<Array<IRWAPerpsMarket>> {
	return fetchJson<Array<IRWAPerpsMarket>>(`${RWA_PERPS_SERVER_URL}/current?cachebust=091626&includeCex=true`)
}

/**
 * Fetch all markets for a contract across venues.
 */
export async function fetchRWAPerpsMarketsByContract(contract: string): Promise<Array<IRWAPerpsMarket>> {
	const encodedContract = encodeURIComponent(contract)
	return fetchJson<Array<IRWAPerpsMarket>>(`${RWA_PERPS_SERVER_URL}/contract/${encodedContract}?cachebust=091626`)
}

/**
 * Fetch all markets listed on a venue; none when the server answers 404, its answer for a venue with no market.
 */
export async function fetchRWAPerpsMarketsByVenue(venue: string): Promise<Array<IRWAPerpsMarket>> {
	const encodedVenue = encodeURIComponent(venue)
	return fetchJson<Array<IRWAPerpsMarket>>(`${RWA_PERPS_SERVER_URL}/venue/${encodedVenue}?cachebust=091626`).catch(
		(error) => {
			if (error instanceof Error && error.message.includes('[404]')) return []
			throw error
		}
	)
}

/**
 * Fetch the historical time-series for one market.
 */
export async function fetchRWAPerpsMarketChart(id: string): Promise<Array<IRWAPerpsMarketChartPoint>> {
	const encodedId = encodeURIComponent(id)
	return fetchJson<Array<IRWAPerpsMarketChartPoint>>(`${RWA_PERPS_SERVER_URL}/chart/${encodedId}?cachebust=091626`)
}

export async function fetchRWAPerpsOverviewBreakdownChartData(
	params: IRWAPerpsOverviewBreakdownRequest
): Promise<IRWAPerpsBreakdownChartResponse | null> {
	const searchParams = new URLSearchParams({
		breakdown: params.breakdown,
		key: params.key
	})

	setRWAPerpsChartScope(searchParams, params)

	return fetchJson<IRWAPerpsBreakdownChartResponse>(
		`${RWA_PERPS_SERVER_URL}/chart/overview-breakdown?${searchParams.toString()}`
	).catch((error) => {
		console.error('Failed to fetch RWA perps overview breakdown chart data:', error)
		return null
	})
}

export async function fetchRWAPerpsContractBreakdownChartData(
	params: IRWAPerpsContractBreakdownRequest
): Promise<IRWAPerpsBreakdownChartResponse | null> {
	const searchParams = new URLSearchParams({
		key: params.key
	})

	setRWAPerpsChartScope(searchParams, params)

	return fetchJson<IRWAPerpsBreakdownChartResponse>(
		`${RWA_PERPS_SERVER_URL}/chart/contract-breakdown?${searchParams.toString()}`
	).catch((error) => {
		console.error('Failed to fetch RWA perps contract breakdown chart data:', error)
		return null
	})
}

export async function fetchRWAPerpsMarketBreakdownChartData(
	params: IRWAPerpsMarketBreakdownRequest
): Promise<IRWAPerpsBreakdownChartResponse | null> {
	const searchParams = new URLSearchParams({
		key: params.key
	})

	setRWAPerpsChartScope(searchParams, params)

	return fetchJson<IRWAPerpsBreakdownChartResponse>(
		`${RWA_PERPS_SERVER_URL}/chart/market-breakdown?${searchParams.toString()}`
	).catch((error) => {
		console.error('Failed to fetch RWA perps market breakdown chart data:', error)
		return null
	})
}

/**
 * Fetch funding history with optional startTime and endTime filters.
 */
export async function fetchRWAPerpsFundingHistory(
	id: string,
	params?: IRWAPerpsFundingHistoryParams
): Promise<Array<IRWAPerpsFundingHistoryPoint>> {
	const points = await fetchJson<Array<IRWAPerpsFundingHistoryWirePoint>>(createRWAPerpsFundingHistoryUrl(id, params))
	return points.map((point) => ({
		timestamp: point.timestamp * 1e3,
		id: point.id,
		contract: point.contract,
		venue: point.venue,
		fundingRate: Number(point.funding_rate),
		premium: Number(point.premium),
		openInterest: Number(point.open_interest),
		fundingPayment: Number(point.funding_payment),
		createdAt: point.created_at
	}))
}
