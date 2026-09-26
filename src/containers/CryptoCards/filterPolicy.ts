import type { ParsedUrlQuery } from 'node:querystring'
import { readSelectionFromQuery } from '~/components/Select/query'
import { readSingleQueryValue } from '~/utils/routerQuery'
import type { CardTierRow } from './models'

/** A confirmed country list is an allowlist claim; undisclosed availability
 *  can't answer for any country. */
export function isCardAvailableIn(row: CardTierRow, countryCode: string): boolean | null {
	if (row.availabilityUnknown) return null
	return row.countryCodes.includes(countryCode)
}

export interface CardsFilterState {
	country: string | null
	includeUnknown: boolean
	/** Selected facet keys; all options selected means the facet is inactive. */
	custody: Array<string>
	cardTypes: Array<string>
	networks: Array<string>
	/** Selected chain keys (lowercased); null means every chain is selected. */
	chains: Array<string> | null
	physicalOnly: boolean
	virtualOnly: boolean
	hasActiveFilters: boolean
}

export const CARDS_FILTER_QUERY_KEYS = {
	country: 'country',
	includeUnknown: 'includeUnknown',
	custody: 'custody',
	excludeCustody: 'excludeCustody',
	cardType: 'type',
	excludeCardType: 'excludeType',
	network: 'network',
	excludeNetwork: 'excludeNetwork',
	chain: 'chain',
	excludeChain: 'excludeChain',
	physical: 'physical',
	virtual: 'virtual'
} as const

export const CUSTODY_OPTIONS = [
	{ key: 'self-custodial', name: 'Self-custodial' },
	{ key: 'custodial', name: 'Custodial' }
] as const

/** Keys match the leading word of the upstream classification ("Debit card"). */
export const CARD_TYPE_OPTIONS = [
	{ key: 'debit', name: 'Debit' },
	{ key: 'credit', name: 'Credit' },
	{ key: 'prepaid', name: 'Prepaid' },
	{ key: 'spend', name: 'Spend' }
] as const

export const NETWORK_OPTIONS = [
	{ key: 'visa', name: 'Visa' },
	{ key: 'mastercard', name: 'Mastercard' }
] as const

const CUSTODY_KEYS = CUSTODY_OPTIONS.map((option) => option.key as string)
const CARD_TYPE_KEYS = CARD_TYPE_OPTIONS.map((option) => option.key as string)
const NETWORK_KEYS = NETWORK_OPTIONS.map((option) => option.key as string)

const COUNTRY_CODE = /^[A-Za-z]{2}$/

export function resolveCardsAvailability(query: ParsedUrlQuery): { country: string | null; includeUnknown: boolean } {
	const rawCountry = readSingleQueryValue(query[CARDS_FILTER_QUERY_KEYS.country])
	return {
		country: rawCountry && COUNTRY_CODE.test(rawCountry) ? rawCountry.toUpperCase() : null,
		includeUnknown: readSingleQueryValue(query[CARDS_FILTER_QUERY_KEYS.includeUnknown]) === 'true'
	}
}

/** Reads the pickers with the shared rules; chains are read against the chain keys of the listed cards. */
export function resolveCardsFilterState(query: ParsedUrlQuery, chainKeys: Array<string>): CardsFilterState {
	const keys = CARDS_FILTER_QUERY_KEYS
	const { country, includeUnknown } = resolveCardsAvailability(query)
	const custody = readSelectionFromQuery(query, keys.custody, keys.excludeCustody, CUSTODY_KEYS)
	const cardTypes = readSelectionFromQuery(query, keys.cardType, keys.excludeCardType, CARD_TYPE_KEYS)
	const networks = readSelectionFromQuery(query, keys.network, keys.excludeNetwork, NETWORK_KEYS)
	const selectedChains = readSelectionFromQuery(query, keys.chain, keys.excludeChain, chainKeys)
	const chains = selectedChains.length === chainKeys.length ? null : selectedChains
	const physicalOnly = readSingleQueryValue(query[CARDS_FILTER_QUERY_KEYS.physical]) === 'true'
	const virtualOnly = readSingleQueryValue(query[CARDS_FILTER_QUERY_KEYS.virtual]) === 'true'
	return {
		country,
		includeUnknown,
		custody,
		cardTypes,
		networks,
		chains,
		physicalOnly,
		virtualOnly,
		hasActiveFilters:
			country != null ||
			custody.length !== CUSTODY_KEYS.length ||
			cardTypes.length !== CARD_TYPE_KEYS.length ||
			networks.length !== NETWORK_KEYS.length ||
			chains != null ||
			physicalOnly ||
			virtualOnly
	}
}

export function matchesCardsFilters(row: CardTierRow, state: CardsFilterState): boolean {
	if (state.country != null) {
		const available = isCardAvailableIn(row, state.country)
		if (available === null ? !state.includeUnknown : !available) return false
	}
	// Facet values arrive lowercased from the API, matching the option keys exactly.
	// A narrowed facet filter is a positive claim; rows with unknown values drop out.
	if (
		state.custody.length !== CUSTODY_KEYS.length &&
		(row.custodyType == null || !state.custody.includes(row.custodyType))
	)
		return false
	if (
		state.cardTypes.length !== CARD_TYPE_KEYS.length &&
		(row.cardClassification == null || !state.cardTypes.includes(row.cardClassification))
	)
		return false
	if (state.networks.length !== NETWORK_KEYS.length && (row.network == null || !state.networks.includes(row.network)))
		return false
	if (state.chains != null) {
		const chains = state.chains
		if (!row.supportedChains.some((chain) => chains.includes(chain.toLowerCase()))) return false
	}
	if (state.physicalOnly && row.physical !== true) return false
	if (state.virtualOnly && row.virtual !== true) return false
	return true
}

export function filterCards(rows: Array<CardTierRow>, state: CardsFilterState): Array<CardTierRow> {
	if (!state.hasActiveFilters) return rows
	return rows.filter((row) => matchesCardsFilters(row, state))
}

/** Countries pinned to the top of the dropdown, in this order; the rest follow alphabetically. */
const POPULAR_COUNTRIES = [
	'US',
	'GB',
	'DE',
	'NL',
	'FR',
	'ES',
	'IT',
	'CH',
	'CA',
	'JP',
	'KR',
	'IN',
	'AE',
	'TR',
	'BR',
	'AR',
	'AU',
	'SG',
	'HK',
	'MX',
	'NG',
	'ZA',
	'CN'
]

const POPULARITY_RANK = new Map<string, number>(POPULAR_COUNTRIES.map((country, index) => [country, index]))

const COUNTRY_DISPLAY_NAMES =
	typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null

export function countryLabel(country: string): string {
	try {
		return COUNTRY_DISPLAY_NAMES?.of(country) ?? country
	} catch {
		return country
	}
}

/** Selectable chains: every chain any tier supports, alphabetically. */
export function cardsChainOptions(rows: Array<CardTierRow>): Array<{ key: string; name: string }> {
	const chains = new Map<string, string>()
	for (const row of rows) {
		for (const chain of row.supportedChains) chains.set(chain.toLowerCase(), chain)
	}
	return [...chains.entries()].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name))
}

/** Selectable countries: every country code any card's availability names,
 *  popular ones first, the rest alphabetically by display label. */
export function cardsCountryOptions(rows: Array<CardTierRow>): Array<{ key: string; name: string }> {
	const countries = new Set<string>()
	for (const row of rows) {
		for (const code of row.countryCodes) countries.add(code)
	}
	return [...countries]
		.map((country) => ({ key: country, name: countryLabel(country) }))
		.sort((left, right) => {
			const leftRank = POPULARITY_RANK.get(left.key) ?? POPULAR_COUNTRIES.length
			const rightRank = POPULARITY_RANK.get(right.key) ?? POPULAR_COUNTRIES.length
			if (leftRank !== rightRank) return leftRank - rightRank
			return left.name.localeCompare(right.name)
		})
}
