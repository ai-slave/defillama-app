import type { CardsDetailResponse, CardsIndexCard, CardsIndexResponse } from '../api.types'
import type { CardTierRow } from '../models'

export function cardTierRow(cardId: string, overrides: Partial<CardTierRow> = {}): CardTierRow {
	return {
		rowKind: 'tier',
		cardId,
		cardName: cardId,
		parentId: cardId,
		logo: null,
		url: null,
		countryCodes: [],
		countryCount: 0,
		availabilityUnknown: true,
		tierCount: 1,
		tierId: `${cardId}--standard`,
		tierName: 'Standard',
		region: 'Global',
		cashbackRate: null,
		cashbackCurrency: null,
		maxCashbackPerMonth: null,
		perks: [],
		annualFee: null,
		fxFee: null,
		access: null,
		supportedChains: [],
		supportedCoins: [],
		custodyType: null,
		cardClassification: null,
		network: null,
		virtualPhysical: null,
		issuer: null,
		virtual: null,
		physical: null,
		applePay: null,
		googlePay: null,
		iban: null,
		atmFee: null,
		atmAllowance: null,
		dailySpendingLimit: null,
		monthlySpendingLimit: null,
		...overrides
	}
}

export function cardsIndexCard(id: string, parentId?: string): CardsIndexCard {
	return {
		id,
		name: id,
		...(parentId ? { parent_id: parentId } : {}),
		as_of: '2026-09-29',
		checked_at: '2026-09-30T00:00:00.000Z',
		availability: 'confirmed',
		data_status: 'refreshed',
		roll: { networks: [], classes: [], has_confirmed_ungated_tier: true },
		tiers: [
			{
				id: `${id}--standard`,
				name: 'Standard',
				region: 'Global',
				region_type: 'global',
				availability: 'confirmed',
				access: 'ungated',
				cashback_status: 'not_publicly_disclosed',
				fees: {},
				type: {},
				crypto: {},
				integrations: {},
				atm: { fee_status: 'not_publicly_disclosed' },
				limits: {}
			}
		]
	}
}

export function cardsIndexResponse(cards: Array<CardsIndexCard>): CardsIndexResponse {
	return {
		version: 'run-1',
		countries: {},
		reference: { coin_gecko_ids: {}, defillama_chain_names: {} },
		facets: {
			countries: {},
			networks: {},
			classes: {},
			custody: {},
			chains: {},
			coins: {},
			forms: {},
			perks: {},
			access: {}
		},
		cards
	}
}

export function cardDetail(card: CardsIndexCard): CardsDetailResponse {
	return {
		version: 'run-1',
		id: card.id,
		...(card.parent_id ? { parent_id: card.parent_id } : {}),
		...(card.defillama_slug ? { defillama_slug: card.defillama_slug } : {}),
		...(card.defillama_id ? { defillama_id: card.defillama_id } : {}),
		...(card.defillama_parent_id ? { defillama_parent_id: card.defillama_parent_id } : {}),
		tiers: card.tiers.map((tier) => ({ id: tier.id, other_fees: [], card_issue: [], disclosure: {} }))
	}
}
