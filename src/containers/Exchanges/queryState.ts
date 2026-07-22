import type { ParsedUrlQuery } from 'querystring'
import { readSingleQueryValue } from '~/utils/routerQuery'
import type { DirectoryKind } from './modelHelpers'
import type { ExchangeResearchView, ExchangeSegment } from './models'

export type DirectoryColumnGroup = 'activity' | 'transparency' | 'fees' | 'funding' | 'compliance'
export type DirectoryOverviewTab = 'total' | ExchangeSegment
export type ExchangeResearchPart = 'volume' | 'oi' | 'depth' | 'nvol'
export type ExchangeResearchRange = '30d' | '90d' | '1y' | '2y' | 'all'
export type MicaFilter = 'all' | 'spot' | 'perp' | 'fiat'
export type ProfileTab = 'markets' | 'reserves' | 'information' | 'history'
export type ProfileReservesView = 'assets' | 'stablecoins'
export type VenueHistoryMetric = 'volume' | 'oi' | 'depth' | 'nvol' | 'markets'
export type TokenFinderMode = 'all' | 'any'

export const EXCHANGES_QUERY_KEYS = {
	directoryChart: 'chartView',
	directoryScope: 'scope',
	directoryKind: 'venue',
	directoryGroup: 'view',
	micaFilter: 'product',
	profileTab: 'section',
	profileReservesView: 'reservesView',
	country: 'country',
	profileSegment: 'segment',
	venueHistory: 'history',
	researchRange: 'range',
	tokenFinderTokens: 'tokens',
	tokenFinderMode: 'match'
} as const

export const DEFAULT_DIRECTORY_QUERY_STATE = {
	scope: 'spot',
	kind: 'all',
	group: 'activity'
} as const satisfies {
	scope: ExchangeSegment
	kind: DirectoryKind
	group: DirectoryColumnGroup
}

export const DEFAULT_DIRECTORY_OVERVIEW_TAB: DirectoryOverviewTab = 'total'
export const DEFAULT_MICA_FILTER: MicaFilter = 'all'
export const DEFAULT_PROFILE_TAB: ProfileTab = 'markets'
export const DEFAULT_PROFILE_RESERVES_VIEW: ProfileReservesView = 'assets'
export const DEFAULT_RESEARCH_RANGE: ExchangeResearchRange = '1y'

export function getResearchRange(query: ParsedUrlQuery): ExchangeResearchRange {
	const value = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.researchRange])
	return value === '30d' || value === '90d' || value === '1y' || value === '2y' || value === 'all'
		? value
		: DEFAULT_RESEARCH_RANGE
}

export function getTokenFinderTokens(query: ParsedUrlQuery): string[] {
	const value = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.tokenFinderTokens])
	if (!value) return []
	const tokens: string[] = []
	for (const valuePart of value.split(',')) {
		const token = valuePart.trim().toLowerCase()
		if (token && !tokens.includes(token)) tokens.push(token)
		if (tokens.length === 8) break
	}
	return tokens
}

export function getTokenFinderMode(query: ParsedUrlQuery): TokenFinderMode {
	return readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.tokenFinderMode]) === 'any' ? 'any' : 'all'
}

export function getDirectoryQueryState(query: ParsedUrlQuery): {
	scope: ExchangeSegment
	kind: DirectoryKind
	group: DirectoryColumnGroup
} {
	const scopeQuery = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.directoryScope])
	const kindQuery = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.directoryKind])
	const groupQuery = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.directoryGroup])

	const scope: ExchangeSegment = scopeQuery === 'linear_perp' || scopeQuery === 'inverse_perp' ? scopeQuery : 'spot'
	const kind: DirectoryKind = kindQuery === 'cex' || kindQuery === 'dex' ? kindQuery : 'all'
	const group: DirectoryColumnGroup =
		groupQuery === 'transparency' || groupQuery === 'fees' || groupQuery === 'funding' || groupQuery === 'compliance'
			? groupQuery
			: 'activity'

	return { scope, kind, group }
}

export function getDirectoryOverviewTab(query: ParsedUrlQuery): DirectoryOverviewTab {
	const value = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.directoryChart])
	return value === 'spot' || value === 'linear_perp' || value === 'inverse_perp'
		? value
		: DEFAULT_DIRECTORY_OVERVIEW_TAB
}

export function getMicaFilter(query: ParsedUrlQuery): MicaFilter {
	const value = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.micaFilter])
	return value === 'spot' || value === 'perp' || value === 'fiat' ? value : DEFAULT_MICA_FILTER
}

export function getProfileTab(query: ParsedUrlQuery): ProfileTab {
	const value = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.profileTab])
	return value === 'information' || value === 'reserves' || value === 'history' ? value : DEFAULT_PROFILE_TAB
}

export function getProfileReservesView(query: ParsedUrlQuery): ProfileReservesView {
	return readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.profileReservesView]) === 'stablecoins'
		? 'stablecoins'
		: DEFAULT_PROFILE_RESERVES_VIEW
}

export function getProfileSegment(query: ParsedUrlQuery): ExchangeSegment | null {
	const value = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.profileSegment])
	return value === 'spot' || value === 'linear_perp' || value === 'inverse_perp' ? value : null
}

export function parseExchangeCountry(query: ParsedUrlQuery): string | null {
	const value = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.country])
	return value && /^[a-z]{2}$/i.test(value) ? value.toUpperCase() : null
}

/** Carry the active country selection onto a link between the country-aware exchange pages. */
export function withCountryParam(href: string, country: string | null): string {
	if (!country) return href
	return `${href}${href.includes('?') ? '&' : '?'}${EXCHANGES_QUERY_KEYS.country}=${country.toLowerCase()}`
}

export function getVenueHistoryMetric(query: ParsedUrlQuery): VenueHistoryMetric | null {
	const value = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.venueHistory])
	return value === 'volume' || value === 'oi' || value === 'depth' || value === 'nvol' || value === 'markets'
		? value
		: null
}

const RESEARCH_VIEW_QUERY_KEYS: Record<ExchangeResearchPart, string> = {
	volume: 'volumeView',
	oi: 'oiView',
	depth: 'depthView',
	nvol: 'nvolView'
}

export function getResearchViewQueryKey(part: ExchangeResearchPart): string {
	return RESEARCH_VIEW_QUERY_KEYS[part]
}

export function getResearchView(query: ParsedUrlQuery, part: ExchangeResearchPart): ExchangeResearchView | null {
	const value = readSingleQueryValue(query[getResearchViewQueryKey(part)])
	return value === 'spot-exchanges' ||
		value === 'linear-perp-exchanges' ||
		value === 'inverse-perp-exchanges' ||
		value === 'volume-types' ||
		value === 'open-interest-linear-exchanges' ||
		value === 'open-interest-inverse-exchanges' ||
		value === 'open-interest-types' ||
		value === 'normalized-spot-exchanges' ||
		value === 'normalized-linear-exchanges' ||
		value === 'normalized-inverse-exchanges' ||
		value === 'normalized-types' ||
		value === 'normalized-segments' ||
		value === 'survival-spot-exchanges' ||
		value === 'survival-linear-exchanges' ||
		value === 'survival-inverse-exchanges' ||
		value === 'depth-spot-exchanges' ||
		value === 'depth-linear-exchanges' ||
		value === 'depth-inverse-exchanges' ||
		value === 'depth-types' ||
		value === 'btc-depth'
		? value
		: null
}
