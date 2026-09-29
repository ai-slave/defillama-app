import { CARDS_SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type { CardsDetailResponse, CardsIndexResponse } from '../api.types'

export function fetchCardsIndexFromNetwork(): Promise<CardsIndexResponse> {
	return fetchJson<CardsIndexResponse>(`${CARDS_SERVER_URL}/index`)
}

export function fetchCardDetailFromNetwork(cardId: string): Promise<CardsDetailResponse> {
	return fetchJson<CardsDetailResponse>(`${CARDS_SERVER_URL}/cards/${encodeURIComponent(cardId)}`)
}
