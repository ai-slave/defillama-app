// Fetchers + types for the /yields/rates (stablecoin reference rates) page. These
// hit the reference-rates endpoints directly (they are not dataset-cache artifacts).
// The current snapshot is loaded on the server; history can also be fetched in
// the browser and uses the local proxy there.
import { YIELDS_V2_SERVER_URL } from '~/constants'
import { getYieldsHistoryUrl } from '../constants'

export type RateRange = '30d' | '90d' | 'max'

export interface RefRateStat {
	apy: number | null
}

export interface RefRateSet {
	supply: RefRateStat
	borrow: RefRateStat
	spread: { apy: number | null }
}

export interface RefRateProtocol {
	protocol: { slug: string; name: string }
	apy: number | null
	weight_usd: number | null
	weight_pct: number | null
}

export interface RefRateAssetSet extends Omit<RefRateSet, 'supply'> {
	supply: RefRateStat & { market_count: number }
}

export interface RefRateCompositionSides {
	supply: RefRateProtocol[]
	borrow: RefRateProtocol[]
}

export interface StablecoinRatesCurrent {
	assets: string[]
	rates: RefRateSet
	by_asset: { asset: string; rates: RefRateAssetSet }[]
	composition: {
		by_protocol: RefRateCompositionSides
		by_asset: { asset: string; by_protocol: RefRateCompositionSides }[]
	}
}

export interface RefRatePoint {
	date: string
	rates: RefRateSet
}

export interface StablecoinRatesHistory {
	assets: string[]
	range: RateRange
	series: RefRatePoint[]
	by_asset: { asset: string; series: RefRatePoint[] }[]
}

export class ApiError extends Error {
	status: number
	url: string

	constructor(status: number, url: string) {
		super(`yields ${status}: ${url}`)
		this.name = 'ApiError'
		this.status = status
		this.url = url
	}
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, { ...init, headers: { Accept: 'application/json', ...(init?.headers ?? {}) } })
	if (!res.ok) throw new ApiError(res.status, url)
	const body = (await res.json()) as { data: T }
	return body.data
}

export function fetchStablecoinRatesCurrent(): Promise<StablecoinRatesCurrent> {
	return getJson<StablecoinRatesCurrent>(`${YIELDS_V2_SERVER_URL}/v2/reference-rates/stablecoins/current`)
}

export function fetchStablecoinRatesHistory(
	range: RateRange = '30d',
	opts: { signal?: AbortSignal } = {}
): Promise<StablecoinRatesHistory> {
	return getJson<StablecoinRatesHistory>(
		getYieldsHistoryUrl(`/v2/reference-rates/stablecoins/history?range=${range}`),
		opts.signal ? { signal: opts.signal } : undefined
	)
}
