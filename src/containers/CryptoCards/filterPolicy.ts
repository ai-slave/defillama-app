import type { ParsedUrlQuery } from 'node:querystring'
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
	/** Selected chains (lowercased); null means the filter is inactive. */
	chains: Array<string> | null
	physicalOnly: boolean
	virtualOnly: boolean
	hasActiveFilters: boolean
}

export const CARDS_FILTER_QUERY_KEYS = {
	country: 'country',
	includeUnknown: 'includeUnknown',
	custody: 'custody',
	cardType: 'type',
	network: 'network',
	chain: 'chain',
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

/** URL value meaning "nothing selected" — distinct from an absent param, which means all. */
export const NONE_SELECTED = 'none'

const COUNTRY_CODE = /^[A-Za-z]{2}$/

/** Static facet params: absent means all selected (inactive); the none
 *  sentinel means nothing selected; unknown values fall back to all. */
function resolveSelectedFacet(param: ParsedUrlQuery[string], keys: Array<string>): Array<string> {
	const raw = Array.isArray(param) ? param : param ? [param] : []
	if (raw.length === 0) return keys
	if (raw.some((value) => value.toLowerCase() === NONE_SELECTED)) return []
	const selected = keys.filter((key) => raw.some((value) => value.toLowerCase() === key))
	return selected.length === 0 ? keys : selected
}

/** Dynamic list params (chains): keys aren't known statically, so values pass
 *  through lowercased; null means the param is absent (filter inactive). */
function resolveSelectedList(param: ParsedUrlQuery[string]): Array<string> | null {
	const raw = Array.isArray(param) ? param : param ? [param] : []
	if (raw.length === 0) return null
	if (raw.some((value) => value.toLowerCase() === NONE_SELECTED)) return []
	return raw.map((value) => value.toLowerCase())
}

export function resolveCardsFilterState(query: ParsedUrlQuery): CardsFilterState {
	const rawCountry = readSingleQueryValue(query[CARDS_FILTER_QUERY_KEYS.country])
	const country = rawCountry && COUNTRY_CODE.test(rawCountry) ? rawCountry.toUpperCase() : null
	const includeUnknown = readSingleQueryValue(query[CARDS_FILTER_QUERY_KEYS.includeUnknown]) === 'true'
	const custody = resolveSelectedFacet(query[CARDS_FILTER_QUERY_KEYS.custody], CUSTODY_KEYS)
	const cardTypes = resolveSelectedFacet(query[CARDS_FILTER_QUERY_KEYS.cardType], CARD_TYPE_KEYS)
	const networks = resolveSelectedFacet(query[CARDS_FILTER_QUERY_KEYS.network], NETWORK_KEYS)
	const chains = resolveSelectedList(query[CARDS_FILTER_QUERY_KEYS.chain])
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
