import { LIQUIDATIONS_SERVER_URL_V2 } from '~/constants'
import { fetchJson } from '~/utils/async'
import type {
	LiquidationsChainPageProps,
	LiquidationsOverviewPageProps,
	LiquidationsProtocolPageProps,
	RawAllLiquidationsResponse,
	RawProtocolsResponse,
	TokenLiquidationsSectionData
} from './api.types'

type LiquidationsFetch = (url: string) => Promise<Response | null>

export async function fetchProtocolsList(): Promise<RawProtocolsResponse> {
	return fetchJson<RawProtocolsResponse>(`${LIQUIDATIONS_SERVER_URL_V2}/protocols?zz=18`)
}

export async function fetchAllLiquidations(): Promise<RawAllLiquidationsResponse> {
	return fetchJson<RawAllLiquidationsResponse>(`${LIQUIDATIONS_SERVER_URL_V2}/all?zz=18`)
}

async function fetchLiquidationsClient<T>(url: string, fetchFn: LiquidationsFetch): Promise<T> {
	const res = await fetchFn(url)

	if (!res) {
		throw new Error('Authentication required')
	}

	if (!res.ok) {
		const errorData = await res.json().catch(() => null)
		throw new Error(errorData?.error ?? `Failed to fetch liquidations data: ${res.status}`)
	}

	return res.json()
}

export async function fetchLiquidationsOverviewClient(
	fetchFn: LiquidationsFetch
): Promise<LiquidationsOverviewPageProps> {
	return fetchLiquidationsClient<LiquidationsOverviewPageProps>('/api/private/liquidations', fetchFn)
}

export async function fetchLiquidationsProtocolClient(
	protocol: string,
	fetchFn: LiquidationsFetch
): Promise<LiquidationsProtocolPageProps> {
	return fetchLiquidationsClient<LiquidationsProtocolPageProps>(
		`/api/private/liquidations/${encodeURIComponent(protocol)}`,
		fetchFn
	)
}

export async function fetchLiquidationsChainClient(
	protocol: string,
	chain: string,
	fetchFn: LiquidationsFetch
): Promise<LiquidationsChainPageProps> {
	return fetchLiquidationsClient<LiquidationsChainPageProps>(
		`/api/private/liquidations/${encodeURIComponent(protocol)}/${encodeURIComponent(chain)}`,
		fetchFn
	)
}

export async function fetchTokenLiquidationsClient(
	symbol: string,
	fetchFn: LiquidationsFetch
): Promise<TokenLiquidationsSectionData> {
	return fetchLiquidationsClient<TokenLiquidationsSectionData>(
		`/api/private/token-liquidations/${encodeURIComponent(symbol)}`,
		fetchFn
	)
}
