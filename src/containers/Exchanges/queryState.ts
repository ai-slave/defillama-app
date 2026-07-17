import type { ParsedUrlQuery } from 'querystring'
import { readSingleQueryValue } from '~/utils/routerQuery'
import type { DirectoryKind } from './modelHelpers'
import type { ExchangeResearchView, ExchangeSegment } from './models'

export type DirectoryColumnGroup = 'activity' | 'transparency' | 'fees' | 'funding' | 'compliance'
export type DirectoryOverviewTab = 'total' | ExchangeSegment
export type ExchangeResearchPart = 'volume' | 'oi' | 'depth' | 'nvol'
export type MicaFilter = 'all' | 'spot' | 'perp' | 'fiat'
export type ProfileTab = 'markets' | 'reserves' | 'information'
export type ProfileReservesView = 'assets' | 'stablecoins'
export type VenueHistoryMetric = 'volume' | 'oi' | 'depth' | 'nvol' | 'markets'

export const EXCHANGES_QUERY_KEYS = {
	directoryChart: 'chartView',
	directoryScope: 'scope',
	directoryKind: 'venue',
	directoryGroup: 'view',
	micaFilter: 'product',
	profileTab: 'section',
	profileReservesView: 'reservesView',
	profileSegment: 'segment',
	venueHistory: 'history'
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
	return value === 'information' || value === 'reserves' ? value : DEFAULT_PROFILE_TAB
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
