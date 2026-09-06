import type { ApiQuery } from '~/server/api/types'
import type { TokenOption, YieldsMeta } from './types'

// Normalization for pre-rebuild /yields bookmark params. Deterministic string mappings;
// everything else unknown is dropped by the regular parsers (never zero-rows from
// stale vocabulary).

// v1 `token=` took SYMBOLS ("ETH") and specials; the rebuilt filter takes option keys
// ("asset:eth"). Resolve symbols case-insensitively against the served vocabulary
// (asset first, family fallback) and drop what cannot be resolved.
const LEGACY_TOKEN_SPECIALS: Record<string, string | null> = {
	all: null, // "no token filter"
	all_usd_stables: 'family:usd-stables',
	all_bitcoins: 'family:btc'
}

// Shared symbol→option-key resolution. `bySymbol` is lowercased symbol → option key
// (built from the served vocabulary on the server, or from the page's TokenOption[] on
// the client). Values already carrying a `prefix:` are option keys and pass through.
export function normalizeLegacyTokenList(tokens: Array<string>, bySymbol: Map<string, string>): Array<string> {
	if (tokens.every((value) => value.includes(':'))) return tokens
	const normalized: Array<string> = []
	for (const value of tokens) {
		if (value.includes(':')) {
			normalized.push(value)
			continue
		}
		const lower = value.toLowerCase()
		if (lower in LEGACY_TOKEN_SPECIALS) {
			const mapped = LEGACY_TOKEN_SPECIALS[lower]
			if (mapped) normalized.push(mapped)
			continue
		}
		const resolved = bySymbol.get(lower)
		if (resolved) normalized.push(resolved)
	}
	return normalized
}

export function normalizeLegacyTokens(tokens: Array<string>, meta: YieldsMeta): Array<string> {
	if (tokens.every((value) => value.includes(':'))) return tokens
	const bySymbol = new Map<string, string>()
	for (const family of meta.tokens.families) bySymbol.set(family.symbol.toLowerCase(), family.value)
	// Assets after families so an asset wins when both share a symbol.
	for (const asset of meta.tokens.assets) bySymbol.set(asset.symbol.toLowerCase(), asset.value)
	return normalizeLegacyTokenList(tokens, bySymbol)
}

// Client counterpart: the page's token search vocabulary is served as `[name, value]`
// tuples (value = `asset:*` / `family:*` option key). Assets win over families for a
// shared symbol, mirroring normalizeLegacyTokens.
export function tokenBySymbolFromOptions(tokens: ReadonlyArray<TokenOption>): Map<string, string> {
	const bySymbol = new Map<string, string>()
	for (const [name, value] of tokens) if (value.startsWith('family:')) bySymbol.set(name.toLowerCase(), value)
	for (const [name, value] of tokens) if (value.startsWith('asset:')) bySymbol.set(name.toLowerCase(), value)
	return bySymbol
}

// v1 `attribute=million_dollar` was a disguised TVL floor; an explicit minTvl wins.
export function legacyMinTvl(query: ApiQuery, minTvl: number | null): number | null {
	if (minTvl != null) return minTvl
	const attributes = Array.isArray(query.attribute) ? query.attribute : query.attribute ? [query.attribute] : []
	return attributes.includes('million_dollar') ? 1_000_000 : null
}

// v1's default sort field id; renamed to `tvl` on the rebuilt rows.
export function legacySortBy(sortBy: string | undefined): string | undefined {
	return sortBy === 'tvlUsd' ? 'tvl' : sortBy
}

// v1 filtered protocols via `project=`; the rebuilt pages emit `protocol=`. The server
// reads `protocol` canonically with `project` as a legacy fallback for direct API hits.
export function legacyProtocolParam(query: ApiQuery): string | Array<string> | undefined {
	return query.protocol ?? query.project
}

// ---------------------------------------------------------------------------
// Client-side canonicalization (the bookmark shield). Rewrites a pre-rebuild
// /yields URL query to its canonical form; returns null when nothing changed.
// ---------------------------------------------------------------------------

export type LegacyYieldsPage = 'earn' | 'borrow' | 'loop'

type LegacyQuery = Record<string, string | Array<string> | undefined>

// Dead v1 `attribute=` values dropped at normalize (million_dollar is handled separately →
// minTvl); everything else — including the live vocabulary — is kept as-is.
const DEAD_ATTRIBUTE_VALUES = new Set([
	'no_outlier',
	'stable_outlook',
	'high_confidence',
	'apy_zero',
	'lsd_only',
	'no_bad_debt',
	'no_lockup_collateral',
	'million_dollar_farm',
	'no_bad_debt_',
	'no_memecoins'
])

// Renamed live v1 `attribute=` values: mapped onto their canonical v2 key instead of dropped.
// v1's `airdrop` (token-less protocols) is the v2 `no_protocol_token` filter.
const LEGACY_ATTRIBUTE_ALIASES: Record<string, string> = {
	airdrop: 'no_protocol_token'
}

// The three v1 column-visibility params that map onto a v2 `column=`; every other `show*`
// param is dropped.
const SHOW_TO_COLUMN: Record<string, string> = {
	show1dVolume: 'volumeUsd1d',
	showTop10Pct: 'top10Pct',
	showAvgPosition: 'avgPositionUsd'
}

// v1-only params dropped so canonical links stay clean. minAvailable/maxAvailable are dead
// on earn ONLY (borrow + loop still use them) and handled per-page below.
const DEAD_PARAMS = [
	'excludeToken',
	'exactToken',
	'token_pair',
	'view',
	'includeLsdApy',
	'customLTV',
	'excludeAttribute'
]

function asList(value: string | Array<string> | undefined): Array<string> {
	if (typeof value === 'string') return [value]
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function sameList(a: Array<string>, b: Array<string>): boolean {
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
	return true
}

function isTrue(value: string | Array<string> | undefined): boolean {
	return (Array.isArray(value) ? value[0] : value) === 'true'
}

function packList(values: Array<string>): string | Array<string> {
	return values.length === 1 ? values[0]! : values
}

export function canonicalizeLegacyYieldsQuery(
	query: LegacyQuery,
	{ page, tokenBySymbol }: { page: LegacyYieldsPage; tokenBySymbol: Map<string, string> }
): LegacyQuery | null {
	const next: LegacyQuery = { ...query }
	let changed = false

	// project → protocol (values unchanged); excludeProject → excludeProtocol.
	if (next.project !== undefined) {
		if (next.protocol === undefined) next.protocol = next.project
		delete next.project
		changed = true
	}
	if (next.excludeProject !== undefined) {
		if (next.excludeProtocol === undefined) next.excludeProtocol = next.excludeProject
		delete next.excludeProject
		changed = true
	}

	// token symbols/specials → option keys; unresolvable values dropped.
	if (next.token !== undefined) {
		const tokens = asList(next.token)
		const normalized = normalizeLegacyTokenList(tokens, tokenBySymbol)
		if (!sameList(tokens, normalized)) changed = true
		if (normalized.length === 0) delete next.token
		else next.token = packList(normalized)
	}

	// attribute=million_dollar → minTvl floor; map renamed attributes; drop dead values; keep the rest.
	if (next.attribute !== undefined) {
		const attributes = asList(next.attribute)
		const kept: Array<string> = []
		let million = false
		let attributesChanged = false
		for (const attribute of attributes) {
			if (attribute === 'million_dollar') {
				million = true
				attributesChanged = true
				continue
			}
			const alias = LEGACY_ATTRIBUTE_ALIASES[attribute]
			if (alias) {
				if (!kept.includes(alias)) kept.push(alias)
				attributesChanged = true
				continue
			}
			if (DEAD_ATTRIBUTE_VALUES.has(attribute)) {
				attributesChanged = true
				continue
			}
			kept.push(attribute)
		}
		if (million && next.minTvl === undefined) next.minTvl = '1000000'
		if (attributesChanged) {
			changed = true
			if (kept.length === 0) delete next.attribute
			else next.attribute = packList(kept)
		}
	}

	// v1 default sort id.
	if (next.sortBy === 'tvlUsd') {
		next.sortBy = 'tvl'
		changed = true
	}

	// show* column-visibility params: three map onto `column=`, the rest are dropped.
	const columns = asList(next.column)
	let columnsChanged = false
	for (const key of Object.keys(next)) {
		if (!key.startsWith('show')) continue
		const columnId = SHOW_TO_COLUMN[key]
		if (columnId && isTrue(next[key]) && !columns.includes(columnId)) {
			columns.push(columnId)
			columnsChanged = true
		}
		delete next[key]
		changed = true
	}
	if (columnsChanged) next.column = packList(columns)

	// Dead params (earn also retires the borrow/loop-only availability range).
	const dead = page === 'earn' ? [...DEAD_PARAMS, 'minAvailable', 'maxAvailable'] : DEAD_PARAMS
	for (const key of dead) {
		if (next[key] !== undefined) {
			delete next[key]
			changed = true
		}
	}

	return changed ? next : null
}
