import { CARDS_SERVER_URL } from '~/constants'
import { ok, upstreamError } from '~/server/api/respond'
import { defineApiRoute } from '~/server/api/types'
import { fetchJson } from '~/utils/async'
import type { CardsDetailResponse, CardsIndexResponse } from '../api.types'
import { getCryptoCardIssuerSlugs } from '../models'

export function fetchCardsIndexFromNetwork(): Promise<CardsIndexResponse> {
	return fetchJson<CardsIndexResponse>(`${CARDS_SERVER_URL}/index`)
}

export function fetchCardDetailFromNetwork(cardId: string): Promise<CardsDetailResponse> {
	return fetchJson<CardsDetailResponse>(`${CARDS_SERVER_URL}/cards/${encodeURIComponent(cardId)}`)
}

export const cryptoCardIssuers = defineApiRoute({
	route: '/api/dynamic/crypto-cards/issuers',
	cacheControl: 'public, s-maxage=300, stale-while-revalidate=600',
	async handle() {
		try {
			const index = await fetchCardsIndexFromNetwork()
			return ok({ issuers: getCryptoCardIssuerSlugs(index.cards) })
		} catch {
			return upstreamError('Failed to fetch crypto card issuers')
		}
	}
})
