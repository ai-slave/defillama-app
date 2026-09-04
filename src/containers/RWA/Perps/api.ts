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
	RWAPerpsMarketBreakdownTarget
} from './types'

function encodeRWAPerpsPathSegment(value: string): string {
	return encodeURIComponent(value)
}

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
			return
	}
}

function createRWAPerpsScopedUrl(path: string, includeCex: boolean): string {
	const searchParams = new URLSearchParams({ zz: '18' })
	if (includeCex) searchParams.set('includeCex', 'true')
	return `${RWA_PERPS_SERVER_URL}/${path}?${searchParams.toString()}`
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

	return `${RWA_PERPS_SERVER_URL}/funding/${encodedId}${qs ? `?${qs}&zz=19` : '?zz=19'}`
}

/**
 * Fetch the latest DEX snapshot, optionally including CEX markets.
 */
export async function fetchRWAPerpsCurrent(includeCex: boolean): Promise<IRWAPerpsMarket[]> {
	return fetchJson<IRWAPerpsMarket[]>(createRWAPerpsScopedUrl('current', includeCex))
}

/**
 * Fetch the DEX filter options, optionally including CEX options.
 */
export async function fetchRWAPerpsList(includeCex: boolean): Promise<IRWAPerpsListResponse> {
	return fetchJson<IRWAPerpsListResponse>(createRWAPerpsScopedUrl('list', includeCex))
}

/**
 * Fetch DEX aggregate totals, optionally including CEX totals.
 */
export async function fetchRWAPerpsStats(includeCex: boolean): Promise<IRWAPerpsStatsResponse> {
	return fetchJson<IRWAPerpsStatsResponse>(createRWAPerpsScopedUrl('stats', includeCex))
}
/**
 * Fetch a single market by its venue:contract ID.
 */
export async function fetchRWAPerpsMarketById(id: string): Promise<IRWAPerpsMarket> {
	const encodedId = encodeRWAPerpsPathSegment(id)
	return fetchJson<IRWAPerpsMarket>(`${RWA_PERPS_SERVER_URL}/market/${encodedId}?zz=19`)
}

/**
 * Fetch all markets for a contract across venues.
 */
export async function fetchRWAPerpsMarketsByContract(contract: string): Promise<IRWAPerpsMarket[]> {
	const encodedContract = encodeRWAPerpsPathSegment(contract)
	return fetchJson<IRWAPerpsMarket[]>(`${RWA_PERPS_SERVER_URL}/contract/${encodedContract}?zz=19`)
}

/**
 * Fetch all markets listed on a venue.
 */
export async function fetchRWAPerpsMarketsByVenue(venue: string): Promise<IRWAPerpsMarket[]> {
	const encodedVenue = encodeRWAPerpsPathSegment(venue)
	return fetchJson<IRWAPerpsMarket[]>(`${RWA_PERPS_SERVER_URL}/venue/${encodedVenue}?zz=19`)
}

/**
 * Fetch all markets for an asset group.
 */
export async function fetchRWAPerpsMarketsByAssetGroup(
	assetGroup: string,
	includeCex: boolean
): Promise<IRWAPerpsMarket[]> {
	const encodedAssetGroup = encodeRWAPerpsPathSegment(assetGroup)
	return fetchJson<IRWAPerpsMarket[]>(createRWAPerpsScopedUrl(`assetGroup/${encodedAssetGroup}`, includeCex))
}

/**
 * Fetch all markets mapped to one canonical reference asset.
 */
export async function fetchRWAPerpsMarketsByAsset(asset: string, includeCex: boolean): Promise<IRWAPerpsMarket[]> {
	const encodedAsset = encodeRWAPerpsPathSegment(asset)
	return fetchJson<IRWAPerpsMarket[]>(createRWAPerpsScopedUrl(`asset/${encodedAsset}`, includeCex))
}

/**
 * Fetch the historical time-series for one market.
 */
export async function fetchRWAPerpsMarketChart(id: string): Promise<IRWAPerpsMarketChartPoint[]> {
	const encodedId = encodeRWAPerpsPathSegment(id)
	return fetchJson<IRWAPerpsMarketChartPoint[]>(`${RWA_PERPS_SERVER_URL}/chart/${encodedId}?zz=19`)
}

/**
 * Fetch historical constituent rows for a venue.
 */
export async function fetchRWAPerpsVenueChart(venue: string): Promise<IRWAPerpsAggregateHistoricalPoint[]> {
	const encodedVenue = encodeRWAPerpsPathSegment(venue)
	return fetchJson<IRWAPerpsAggregateHistoricalPoint[]>(`${RWA_PERPS_SERVER_URL}/chart/venue/${encodedVenue}?zz=19`)
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
