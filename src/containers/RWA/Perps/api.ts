import { RWA_PERPS_SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type {
	IRWAPerpsAggregateHistoricalPoint,
	IRWAPerpsBreakdownChartResponse,
	IRWAPerpsFundingHistoryParams,
	IRWAPerpsFundingHistoryPoint,
	IRWAPerpsFundingHistoryWirePoint,
	IRWAPerpsListResponse,
	IRWAPerpsMarket,
	IRWAPerpsMarketChartPoint,
	IRWAPerpsStatsResponse
} from './api.types'
import type {
	IRWAPerpsContractBreakdownRequest,
	IRWAPerpsMarketBreakdownRequest,
	IRWAPerpsOverviewBreakdownRequest,
	RWAPerpsChartTarget
} from './types'

function encodeRWAPerpsPathSegment(value: string): string {
	return encodeURIComponent(value)
}

export function setRWAPerpsChartTarget(searchParams: URLSearchParams, target: RWAPerpsChartTarget): void {
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
	}
}

function createRWAPerpsFundingHistoryUrl(id: string, params?: IRWAPerpsFundingHistoryParams): string {
	const encodedId = encodeRWAPerpsPathSegment(id)
	const searchParams = new URLSearchParams()

	if (params?.startTime !== undefined) {
		searchParams.set('startTime', String(params.startTime))
	}

	if (params?.endTime !== undefined) {
		searchParams.set('endTime', String(params.endTime))
	}

	const qs = searchParams.toString()

	return `${RWA_PERPS_SERVER_URL}/funding/${encodedId}${qs ? `?${qs}&zz=18` : '?zz=18'}`
}

/**
 * Fetch all markets from the latest snapshot.
 */
export async function fetchRWAPerpsCurrent(): Promise<IRWAPerpsMarket[]> {
	return fetchJson<IRWAPerpsMarket[]>(`${RWA_PERPS_SERVER_URL}/current?zz=18`)
}

/**
 * Fetch the available contracts, venues, and categories.
 */
export async function fetchRWAPerpsList(): Promise<IRWAPerpsListResponse> {
	return fetchJson<IRWAPerpsListResponse>(`${RWA_PERPS_SERVER_URL}/list?zz=18`)
}

/**
 * Fetch aggregate totals by venue and category.
 */
export async function fetchRWAPerpsStats(): Promise<IRWAPerpsStatsResponse> {
	return fetchJson<IRWAPerpsStatsResponse>(`${RWA_PERPS_SERVER_URL}/stats?zz=18`)
}
/**
 * Fetch a single market by its venue:contract ID.
 */
export async function fetchRWAPerpsMarketById(id: string): Promise<IRWAPerpsMarket> {
	const encodedId = encodeRWAPerpsPathSegment(id)
	return fetchJson<IRWAPerpsMarket>(`${RWA_PERPS_SERVER_URL}/market/${encodedId}?zz=18`)
}

/**
 * Fetch all markets for a contract across venues.
 */
export async function fetchRWAPerpsMarketsByContract(contract: string): Promise<IRWAPerpsMarket[]> {
	const encodedContract = encodeRWAPerpsPathSegment(contract)
	return fetchJson<IRWAPerpsMarket[]>(`${RWA_PERPS_SERVER_URL}/contract/${encodedContract}?zz=18`)
}

/**
 * Fetch all markets listed on a venue.
 */
export async function fetchRWAPerpsMarketsByVenue(venue: string): Promise<IRWAPerpsMarket[]> {
	const encodedVenue = encodeRWAPerpsPathSegment(venue)
	return fetchJson<IRWAPerpsMarket[]>(`${RWA_PERPS_SERVER_URL}/venue/${encodedVenue}?zz=18`)
}

/**
 * Fetch all markets for an asset group.
 */
export async function fetchRWAPerpsMarketsByAssetGroup(assetGroup: string): Promise<IRWAPerpsMarket[]> {
	const encodedAssetGroup = encodeRWAPerpsPathSegment(assetGroup)
	return fetchJson<IRWAPerpsMarket[]>(`${RWA_PERPS_SERVER_URL}/assetGroup/${encodedAssetGroup}?zz=18`)
}

/**
 * Fetch the historical time-series for one market.
 */
export async function fetchRWAPerpsMarketChart(id: string): Promise<IRWAPerpsMarketChartPoint[]> {
	const encodedId = encodeRWAPerpsPathSegment(id)
	return fetchJson<IRWAPerpsMarketChartPoint[]>(`${RWA_PERPS_SERVER_URL}/chart/${encodedId}?zz=18`)
}

/**
 * Fetch historical constituent rows for a venue.
 */
export async function fetchRWAPerpsVenueChart(venue: string): Promise<IRWAPerpsAggregateHistoricalPoint[]> {
	const encodedVenue = encodeRWAPerpsPathSegment(venue)
	return fetchJson<IRWAPerpsAggregateHistoricalPoint[]>(`${RWA_PERPS_SERVER_URL}/chart/venue/${encodedVenue}?zz=18`)
}

export async function fetchRWAPerpsOverviewBreakdownChartData(
	params: IRWAPerpsOverviewBreakdownRequest
): Promise<IRWAPerpsBreakdownChartResponse | null> {
	const searchParams = new URLSearchParams({
		breakdown: params.breakdown,
		key: params.key
	})

	setRWAPerpsChartTarget(searchParams, params.target)

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

	setRWAPerpsChartTarget(searchParams, params.target)

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

	setRWAPerpsChartTarget(searchParams, params.target)

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
): Promise<IRWAPerpsFundingHistoryPoint[]> {
	const points = await fetchJson<IRWAPerpsFundingHistoryWirePoint[]>(createRWAPerpsFundingHistoryUrl(id, params))
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
