import { MARKETS_SERVER_URL } from '~/constants'
import type { MasterDirectoryResponse } from '~/containers/Exchanges/master.types'
import { fetchJson } from '~/utils/async'
import type { TokenExchangeListingsResponse, TokenMarketsListResponse } from '../api.types'

export async function fetchTokenMarketsListFromNetwork(): Promise<TokenMarketsListResponse> {
	return fetchJson<TokenMarketsListResponse>(`${MARKETS_SERVER_URL}/tokens/list.json`)
}

export async function fetchTokenExchangeListingsFromNetwork(): Promise<TokenExchangeListingsResponse> {
	return fetchJson<TokenExchangeListingsResponse>(`${MARKETS_SERVER_URL}/tokens/exchange-listings.json`)
}

export async function fetchExchangeDirectoryFromNetwork(): Promise<MasterDirectoryResponse> {
	return fetchJson<MasterDirectoryResponse>(`${MARKETS_SERVER_URL}/exchanges/directory.json`)
}
