import type { ParsedUrlQuery } from 'node:querystring'
import { readSingleQueryValue } from '~/utils/routerQuery'
import type { DirectoryKind } from './modelHelpers'
import type { ExchangeResearchView, ExchangeSegment } from './models'

export type DirectoryColumnGroup = 'activity' | 'transparency' | 'fees' | 'funding' | 'compliance'
/**
 * The listing's market scope. `all` is the default cross-segment view: one row per
 * venue with spot and USD perps side by side. COIN perps are deliberately absent from
 * it — too few venues run one for the columns to compare, and folding them into the
 * perp columns would mix coin-settled and quote-settled books. The three exact
 * segment scopes keep their own tables unchanged, so anyone wanting per-segment
 * detail (COIN perps included) still has it.
 */
export type DirectoryScope = 'all' | ExchangeSegment
/** The segments the `all` view merges, in render order. */
export const DIRECTORY_ALL_SEGMENTS = ['spot', 'linear_perp'] as const satisfies ReadonlyArray<ExchangeSegment>
export type DirectoryOverviewTab = 'total' | ExchangeSegment
export type ExchangeResearchPart = 'volume' | 'oi' | 'depth' | 'nvol'
/** Chart windows, in the order the control renders them. */
export const RESEARCH_RANGES = ['30d', '90d', '1y', '2y', 'all'] as const
export type ExchangeResearchRange = (typeof RESEARCH_RANGES)[number]
export type MicaFilter = 'all' | 'spot' | 'perp' | 'fiat'
export type ProfileTab = 'markets' | 'execution' | 'reserves' | 'information' | 'history'
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
	tokenFinderMode: 'match',
	rampCurrency: 'ccy',
	rampSize: 'size'
} as const

export const DEFAULT_DIRECTORY_QUERY_STATE = {
	// Cross-segment by default: the metrics worth leading with are the measured ones,
	// and behind a scope tab almost nobody sees them.
	scope: 'all',
	kind: 'all',
	group: 'activity'
} as const satisfies {
	scope: DirectoryScope
	kind: DirectoryKind
	group: DirectoryColumnGroup
}

// Literal type, not the union: comparing a tab against it has to narrow away 'total'.
export const DEFAULT_DIRECTORY_OVERVIEW_TAB = 'total' as const satisfies DirectoryOverviewTab
export const DEFAULT_MICA_FILTER: MicaFilter = 'all'
export const DEFAULT_PROFILE_TAB: ProfileTab = 'markets'
export const DEFAULT_PROFILE_RESERVES_VIEW: ProfileReservesView = 'assets'
// Full history by default: these series are short enough to read whole, and a window
// that hides when a metric started collecting is how a coverage step gets mistaken for
// a market move.
export const DEFAULT_RESEARCH_RANGE: ExchangeResearchRange = 'all'

/**
 * URL spelling of each segment. The payload keys stay `linear_perp`/`inverse_perp`
 * because that is what the producer publishes, but nothing a reader sees — labels,
 * tooltips, the address bar — says linear or inverse.
 */
const SEGMENT_QUERY_VALUES: Record<ExchangeSegment, string> = {
	spot: 'spot',
	linear_perp: 'usd_perp',
	inverse_perp: 'coin_perp'
}
// A Map, not an object: this is looked up with a raw query value, and an object would
// answer `?scope=constructor` with a function off the prototype instead of null.
const SEGMENT_BY_QUERY_VALUE = new Map<string, ExchangeSegment>([
	['spot', 'spot'],
	['usd_perp', 'linear_perp'],
	['coin_perp', 'inverse_perp']
])

export function segmentQueryValue(segment: ExchangeSegment): string {
	return SEGMENT_QUERY_VALUES[segment]
}

export function segmentFromQueryValue(value: string | null): ExchangeSegment | null {
	return (value ? SEGMENT_BY_QUERY_VALUE.get(value) : null) ?? null
}

export function getResearchRange(query: ParsedUrlQuery): ExchangeResearchRange {
	const value = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.researchRange])
	return RESEARCH_RANGES.find((range) => range === value) ?? DEFAULT_RESEARCH_RANGE
}

export function getTokenFinderTokens(query: ParsedUrlQuery): Array<string> {
	const value = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.tokenFinderTokens])
	if (!value) return []
	const tokens: Array<string> = []
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
	scope: DirectoryScope
	kind: DirectoryKind
	group: DirectoryColumnGroup
} {
	const scopeQuery = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.directoryScope])
	const kindQuery = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.directoryKind])
	const groupQuery = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.directoryGroup])

	const scope: DirectoryScope = segmentFromQueryValue(scopeQuery) ?? 'all'
	const kind: DirectoryKind = kindQuery === 'cex' || kindQuery === 'dex' ? kindQuery : 'all'
	const group: DirectoryColumnGroup =
		groupQuery === 'transparency' || groupQuery === 'fees' || groupQuery === 'funding' || groupQuery === 'compliance'
			? groupQuery
			: 'activity'

	return { scope, kind, group }
}

export function getDirectoryOverviewTab(query: ParsedUrlQuery): DirectoryOverviewTab {
	const value = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.directoryChart])
	return segmentFromQueryValue(value) ?? DEFAULT_DIRECTORY_OVERVIEW_TAB
}

export function getMicaFilter(query: ParsedUrlQuery): MicaFilter {
	const value = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.micaFilter])
	return value === 'spot' || value === 'perp' || value === 'fiat' ? value : DEFAULT_MICA_FILTER
}

export function getProfileTab(query: ParsedUrlQuery): ProfileTab {
	const value = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.profileTab])
	return value === 'information' || value === 'reserves' || value === 'history' || value === 'execution'
		? value
		: DEFAULT_PROFILE_TAB
}

export function getProfileReservesView(query: ParsedUrlQuery): ProfileReservesView {
	return readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.profileReservesView]) === 'stablecoins'
		? 'stablecoins'
		: DEFAULT_PROFILE_RESERVES_VIEW
}

/** `all` is the per-token rollup across segments; the rest are the exact segment
 *  tables, unchanged. Null means "no selection", which resolves to the default. */
export type ProfileSegmentSelection = 'all' | ExchangeSegment

export function getProfileSegment(query: ParsedUrlQuery): ProfileSegmentSelection | null {
	const value = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.profileSegment])
	return value === 'all' ? 'all' : segmentFromQueryValue(value)
}

/** Selected fiat currency on /ramp; null means "cheapest rail in any currency". */
export function getRampCurrency(query: ParsedUrlQuery): string | null {
	const value = readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.rampCurrency])
	return value && /^[a-z]{3}$/i.test(value) ? value.toUpperCase() : null
}

/** Order size on /ramp, in USD. Validated against the sizes the producer published. */
export function getRampSize(query: ParsedUrlQuery, sizes: Array<number>): number {
	const value = Number(readSingleQueryValue(query[EXCHANGES_QUERY_KEYS.rampSize]))
	return sizes.includes(value) ? value : (sizes[0] ?? 1000)
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

const RESEARCH_VIEWS: ReadonlyArray<ExchangeResearchView> = [
	'spot-exchanges',
	'usd-perp-exchanges',
	'coin-perp-exchanges',
	'volume-types',
	'open-interest-base-share',
	'open-interest-usd-exchanges',
	'open-interest-coin-exchanges',
	'open-interest-types',
	'normalized-spot-exchanges',
	'normalized-usd-exchanges',
	'normalized-coin-exchanges',
	'normalized-types',
	'normalized-segments',
	'survival-spot-exchanges',
	'survival-usd-exchanges',
	'survival-coin-exchanges',
	'depth-spot-exchanges',
	'depth-usd-exchanges',
	'depth-coin-exchanges',
	'depth-types',
	'btc-depth'
]

export function getResearchView(query: ParsedUrlQuery, part: ExchangeResearchPart): ExchangeResearchView | null {
	const value = readSingleQueryValue(query[getResearchViewQueryKey(part)])
	if (!value) return null
	return RESEARCH_VIEWS.find((view) => view === value) ?? null
}
