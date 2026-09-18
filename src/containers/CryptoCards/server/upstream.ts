import { CARDS_SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type { CardsIndexResponse } from '../api.types'

export function fetchCardsIndexFromNetwork(): Promise<CardsIndexResponse> {
	return fetchJson<CardsIndexResponse>(`${CARDS_SERVER_URL}/index`)
}
