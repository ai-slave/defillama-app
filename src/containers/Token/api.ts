import { RISK_SERVER_URL } from '~/constants'
import type { TokenMarketsResponse } from '~/containers/Markets/api.types'
import { fetchJson } from '~/utils/async'
import type { TokenRiskBorrowCapacityResponse } from './api.types'

export async function getTokenRiskBorrowCapacityFromNetwork(): Promise<TokenRiskBorrowCapacityResponse> {
	const data = await fetchJson<TokenRiskBorrowCapacityResponse>(`${RISK_SERVER_URL}/get-borrow-capacity-by-asset`)
	return data
}

export async function getTokenRiskBorrowCapacity(): Promise<TokenRiskBorrowCapacityResponse> {
	return getTokenRiskBorrowCapacityFromNetwork()
}

export async function fetchTokenMarkets(tokenSymbol: string): Promise<TokenMarketsResponse> {
	return fetchJson<TokenMarketsResponse>(`/api/public/markets/${encodeURIComponent(tokenSymbol.toLowerCase())}`)
}
