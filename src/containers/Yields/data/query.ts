import { createSelectionMatcher } from '~/components/Select/query'
import { queryBoolean, queryEnum, queryString } from '~/server/api/params'
import type { ApiQuery } from '~/server/api/types'
import { legacyProtocolParam } from './legacyQuery'
import { TOKEN_MATCHES, TOKEN_ONS, type TokenMatch, type TokenOn } from './tokenMatch'
import type { ApyComponent, ApyWindow } from './types'

const APY_WINDOWS: ReadonlyArray<ApyWindow> = ['current', 'avg_7d', 'avg_30d']
const APY_COMPONENT_ORDER: ReadonlyArray<ApyComponent> = ['base', 'reward', 'intrinsic']

/** Repeatable query param (`?chain=a&chain=b`) → string list. */
export function toArray(value: string | Array<string> | undefined): Array<string> {
	if (typeof value === 'string') return [value]
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

export function parseNumber(query: ApiQuery, name: string): number | null {
	const raw = queryString(query, name)
	if (raw == null || raw.trim() === '') return null
	const parsed = Number(raw)
	return Number.isFinite(parsed) ? parsed : null
}

// Tri-state boolean attribute filter (absent = no filter; 'true'/'false' = require that
// value). Repeated values are AND-ed: passing both 'true' and 'false' is a contradiction
// that matches zero rows, which is what a single/multi (or has-token/no-token) pair
// selected together produces.
export type TriState = 'true' | 'false' | 'both' | null

export function parseTriState(query: ApiQuery, name: string): TriState {
	let hasTrue = false
	let hasFalse = false
	for (const value of toArray(query[name])) {
		if (value === 'true') hasTrue = true
		else if (value === 'false') hasFalse = true
	}
	if (hasTrue && hasFalse) return 'both'
	if (hasTrue) return 'true'
	if (hasFalse) return 'false'
	return null
}

// True when a row's boolean value satisfies the tri-state filter (null = keep all).
export function matchesTriState(state: TriState, value: boolean | null): boolean {
	if (state == null) return true
	if (state === 'both') return false
	return value === (state === 'true')
}

export function parseApyWindow(query: ApiQuery): ApyWindow {
	return queryEnum(query, 'apyWindow', APY_WINDOWS) ?? 'current'
}

// `base` is always implied; default view is `base,reward`.
export function parseApyComponents(query: ApiQuery): Array<ApyComponent> {
	const raw = queryString(query, 'apyComponents')
	const selected = new Set<ApyComponent>(['base'])
	if (raw == null) {
		selected.add('reward')
	} else {
		for (const part of raw.split(',')) {
			const trimmed = part.trim()
			if (trimmed === 'reward' || trimmed === 'intrinsic') selected.add(trimmed)
		}
	}
	return APY_COMPONENT_ORDER.filter((component) => selected.has(component))
}

/** The category option for rows without one, so the category picker can keep or drop them. */
export const UNCATEGORIZED = 'Uncategorized'

type SelectionMatcher = (value: string) => boolean

export interface CommonFilters {
	ids: Set<string> | null
	matchesChain: SelectionMatcher | null
	matchesProtocol: SelectionMatcher | null
	/** Call with `row.category || UNCATEGORIZED`. */
	matchesCategory: SelectionMatcher | null
	tokens: Array<string>
	includeMemeTokens: boolean
}

export function parseCommonFilters(query: ApiQuery): CommonFilters {
	// Repeatable `id` param restricts the result to an explicit id set (e.g. the
	// watchlist fetches its bookmarked earn pools by id). Cheap, and generally useful.
	const ids = toArray(query.id)
	// Canonical `protocol=`, with a legacy `project=` fallback (see legacyProtocolParam).
	const protocolQuery = { protocol: legacyProtocolParam(query), excludeProtocol: query.excludeProtocol }
	return {
		ids: ids.length > 0 ? new Set(ids) : null,
		matchesChain: createSelectionMatcher(query, 'chain', 'excludeChain'),
		matchesProtocol: createSelectionMatcher(protocolQuery, 'protocol', 'excludeProtocol'),
		matchesCategory: createSelectionMatcher(query, 'category', 'excludeCategory'),
		tokens: toArray(query.token),
		includeMemeTokens: queryBoolean(query, 'includeMemeTokens')
	}
}

export interface TokenPairFilters {
	collateralTokens: Array<string>
	borrowTokens: Array<string>
}

// The /yields/borrow token pickers emit `collateralToken` / `borrowToken` option keys
// (repeatable, independent of the earn `token` param). Markets match them against
// tokenKeys.reference_asset / .borrow_token; routes against their leg token-keys.
export function parseTokenPairFilters(query: ApiQuery): TokenPairFilters {
	return {
		collateralTokens: toArray(query.collateralToken),
		borrowTokens: toArray(query.borrowToken)
	}
}

// True when no tokens are requested, or any requested option key appears in any
// of the given token-keys targets (reference_asset / borrow_token / pool_token).
export function createTokensMatcher(tokens: Array<string>) {
	if (tokens.length === 0) return (_targets: Array<Array<string> | null | undefined>) => true
	const selected = new Set(tokens)
	return (targets: Array<Array<string> | null | undefined>) => {
		for (const target of targets) {
			if (!target) continue
			for (const key of target) if (selected.has(key)) return true
		}
		return false
	}
}

// ---------------------------------------------------------------------------
// Earn token search (Match × On modes)
// ---------------------------------------------------------------------------
// `Match` = how the selected token option keys relate to a pool:
//   exact    — whole-set membership (`exact_any`): a selected option whose members contain
//              the target's ENTIRE token set (e.g. `family:eth` keeps only all-ETH-family
//              pools, NOT a WETH-USDC pair). Uses the served whole-set keys
//              (`reference_asset_exact`).
//   contains — presence (`contains_any`): any selected option key is present in the target.
//   set      — exact set (`exact_set`): per target, the selection is exactly the target's
//              asset composition. Asset-only selections compare asset key sets (each token
//              has one asset, so this is exact parity); a lone family selection means the
//              family contains the whole target set. Mixed asset+family selections aren't
//              fully expressible from the served keys — see matchesSetTarget for the
//              residual gap.
// `On` = which side of the pool the filter matches against:
//   reference — the pool's reference/underlying assets (`reference_asset` keys, default)
//   pool      — the token(s) actually held in the pool (`pool_token` keys)
//   both      — reference and pool targets tested separately, then OR-ed

export type { TokenMatch, TokenOn } from './tokenMatch'

// Absent/invalid values fall back to the defaults (exact / reference) so unknown
// params degrade gracefully to the default behavior.
export function parseTokenMatch(query: ApiQuery): TokenMatch {
	return queryEnum(query, 'tokenMatch', TOKEN_MATCHES) ?? 'exact'
}

export function parseTokenOn(query: ApiQuery): TokenOn {
	return queryEnum(query, 'tokenOn', TOKEN_ONS) ?? 'reference'
}

export interface TokenFilterInput {
	// Presence sets: option keys that *some* token in the target belongs to.
	referenceKeys: Array<string>
	poolKeys: Array<string>
	// Whole-set set for the reference target: option keys the ENTIRE reference token
	// set belongs to (served as `reference_asset_exact`). The pool target holds a single
	// token, so its presence set doubles as its whole-set set.
	referenceExactKeys: Array<string>
}

// Asset-level (`asset:`) keys only — families are groupings, so Set (pair) equality
// compares literal token composition.
function assetKeySet(keys: Array<string>): Set<string> {
	const set = new Set<string>()
	for (const key of keys) if (key.startsWith('asset:')) set.add(key)
	return set
}

function anyPresent(tokens: Set<string>, keys: Array<string>): boolean {
	for (const key of keys) if (tokens.has(key)) return true
	return false
}

// exact_any: a selected option whose members contain the target's ENTIRE token set. The
// reference target consults the served whole-set keys; the single-token pool target's
// whole-set membership is identical to presence (so `poolKeys` is used).
function matchesExactAny(tokens: Set<string>, on: TokenOn, input: TokenFilterInput): boolean {
	if (on === 'pool') return anyPresent(tokens, input.poolKeys)
	if (on === 'reference') return anyPresent(tokens, input.referenceExactKeys)
	return anyPresent(tokens, input.referenceExactKeys) || anyPresent(tokens, input.poolKeys)
}

// exact_set for a single target, as far as the served keys allow:
//   - asset-only selection: the target's asset set equals the selection. Each token has
//     exactly one asset, so present-assets == selected-assets is exact set parity.
//   - a lone family selection: the family must contain the whole target set → the family
//     key appears in the target's whole-set keys (`exactKeys`).
//   - mixed asset+family (or multi-family) selections need per-token membership against the
//     union of the selected options' members, which the served presence/whole-set keys
//     can't reconstruct. We fall back to asset-only equality (ignoring the families), which
//     agrees with true set equality whenever the family is redundant with a selected asset
//     but is a RESIDUAL GAP otherwise — a purely family-constrained composition can't be
//     verified.
function matchesSetTarget(
	want: Set<string>,
	families: Array<string>,
	presentKeys: Array<string>,
	exactKeys: Array<string>
): boolean {
	if (want.size === 0) {
		return families.length === 1 && exactKeys.includes(families[0]!)
	}
	const have = assetKeySet(presentKeys)
	if (want.size !== have.size) return false
	for (const key of want) if (!have.has(key)) return false
	return true
}

function matchesSet(want: Set<string>, families: Array<string>, on: TokenOn, input: TokenFilterInput): boolean {
	if (on === 'pool') return matchesSetTarget(want, families, input.poolKeys, input.poolKeys)
	if (on === 'reference') return matchesSetTarget(want, families, input.referenceKeys, input.referenceExactKeys)
	return (
		matchesSetTarget(want, families, input.referenceKeys, input.referenceExactKeys) ||
		matchesSetTarget(want, families, input.poolKeys, input.poolKeys)
	)
}

// contains_any: the pool contains at least one pick — any selected option key is present
// in the target. An empty selection is a no-op that keeps every row.
function matchesContains(tokens: Set<string>, on: TokenOn, input: TokenFilterInput): boolean {
	if (on === 'reference') return anyPresent(tokens, input.referenceKeys)
	if (on === 'pool') return anyPresent(tokens, input.poolKeys)
	return anyPresent(tokens, input.referenceKeys) || anyPresent(tokens, input.poolKeys)
}

export function createTokenFilterMatcher(tokens: Array<string>, match: TokenMatch, on: TokenOn) {
	if (tokens.length === 0) return (_input: TokenFilterInput) => true
	const selected = new Set(tokens)
	if (match === 'contains') return (input: TokenFilterInput) => matchesContains(selected, on, input)
	if (match === 'set') {
		const assets = assetKeySet(tokens)
		const families = tokens.filter((key) => key.startsWith('family:'))
		return (input: TokenFilterInput) => matchesSet(assets, families, on, input)
	}
	return (input: TokenFilterInput) => matchesExactAny(selected, on, input)
}
