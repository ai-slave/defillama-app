import { getBorrowRoutesForTokenKeys } from '../borrow.server'
import { getEarnPage } from '../earn.server'
import { readYieldsMeta, type YieldsSnapshot } from '../snapshot'
import { TOKEN_PAGE_EARN_QUERY } from '../tokenPageQuery'
import type { EarnPageRow, RouteTableRow } from '../types'

// Wrapper prefixes/suffixes (WRAPPER_PREFIXES + the Avalanche-bridged `.e` suffix). Only
// used as a last-resort fallback when a symbol resolves to neither a family nor a direct
// asset option, so the risk of an over-broad match is low (we only ever return option keys
// that actually exist).
const WRAPPER_PREFIXES = ['w', 'st', 'cb', 'r', 't'] as const

function dedupe(values: Array<string>): Array<string> {
	return Array.from(new Set(values))
}

function buildWrappedVariants(symbol: string): Set<string> {
	const variants = new Set<string>()
	for (const prefix of WRAPPER_PREFIXES) variants.add(`${prefix}${symbol}`)
	variants.add(`${symbol}.e`)
	return variants
}

// Resolve a token symbol (e.g. 'BTC') to the token option keys to filter by, using the
// /v2/meta vocabulary. ASSET options only — a token page is about that specific token,
// so family options (which sweep in wrapped/staked variants) are deliberately not used.
// Direct symbol match first; else the asset options matching a common wrapped variant.
export async function resolveTokenOptionKeys(snapshot: YieldsSnapshot, symbol: string): Promise<Array<string>> {
	const normalized = symbol.trim().toLowerCase()
	if (!normalized) return []

	const meta = await readYieldsMeta(snapshot)

	const directAssets = meta.tokens.assets.filter((option) => option.symbol.toLowerCase() === normalized)
	if (directAssets.length > 0) return dedupe(directAssets.map((option) => option.value))

	const variants = buildWrappedVariants(normalized)
	const wrapped = meta.tokens.assets.filter((option) => variants.has(option.symbol.toLowerCase()))
	return dedupe(wrapped.map((option) => option.value))
}

export interface TokenBorrowRoutes {
	// Routes where the page token is used AS COLLATERAL (borrowing something else).
	useAsCollateral: Array<RouteTableRow>
	// Routes where the page token is the BORROWED asset (against other collateral).
	borrowThis: Array<RouteTableRow>
	tokenKeys: Array<string>
}

// Produce the borrow routes for the token page's two tabs by reusing the shared
// enriched-routes + toRouteTableRow machinery (getBorrowRoutesPage) with the
// resolved token keys applied to the collateral leg vs the borrow leg respectively.
export async function getTokenBorrowRoutes(snapshot: YieldsSnapshot, symbol: string): Promise<TokenBorrowRoutes> {
	const tokenKeys = await resolveTokenOptionKeys(snapshot, symbol)
	if (tokenKeys.length === 0) return { useAsCollateral: [], borrowThis: [], tokenKeys }

	const { useAsCollateral, borrowThis } = await getBorrowRoutesForTokenKeys(snapshot, tokenKeys)

	return { useAsCollateral, borrowThis, tokenKeys }
}

export interface TokenEarnRows {
	rows: Array<EarnPageRow>
	tokenKeys: Array<string>
}

// Produce the earn rows for the token page's yields section by reusing the shared
// getEarnPage machinery (filter by token keys on both targets, default tvl desc).
export async function getTokenEarnRows(snapshot: YieldsSnapshot, symbol: string): Promise<TokenEarnRows> {
	const tokenKeys = await resolveTokenOptionKeys(snapshot, symbol)
	if (tokenKeys.length === 0) return { rows: [], tokenKeys }

	// Token pages include meme pools: the page's token selection already scopes the noise,
	// and hiding a meme token's own pools on its own page serves nobody.
	// tokenOn 'both': a token page should list pools where the token is the reference
	// asset AND pools that merely hold it, not just the reference-asset subset.
	const page = await getEarnPage(snapshot, {
		token: tokenKeys,
		...TOKEN_PAGE_EARN_QUERY
	})
	return { rows: page.rows, tokenKeys }
}
