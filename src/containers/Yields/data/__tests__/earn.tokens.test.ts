import { describe, expect, test } from 'vitest'
import { installYieldsFixtures } from '~/utils/testing/yieldsSnapshotFixture'
import {
	createTokenFilterMatcher,
	parseTokenMatch,
	parseTokenOn,
	type TokenFilterInput,
	type TokenMatch,
	type TokenOn
} from '../query'
import type { EarnRow, TokenKeys } from '../types'
import { earnPage, pool } from './earnSnapshot'

installYieldsFixtures()

// --------------------------------------------------------------------------
// Pure matcher unit tests (all Match × On combinations)
// --------------------------------------------------------------------------
// The modes: exact = exact_any (whole-set membership), contains = contains_any
// (presence over selections), set = exact_set.

function input(over: Partial<TokenFilterInput> = {}): TokenFilterInput {
	return {
		referenceKeys: [],
		poolKeys: [],
		referenceExactKeys: [],
		...over
	}
}

function matchesTokenFilter(tokens: Array<string>, match: TokenMatch, on: TokenOn, value: TokenFilterInput) {
	return createTokenFilterMatcher(tokens, match, on)(value)
}

// A canonical WETH/USDC pair. Its reference set is present in each asset + derived
// families, but NO single option contains the WHOLE {weth, usdc} set — so its
// whole-set (`referenceExactKeys`) is empty, and Exact must reject family:eth/asset:weth.
const wethUsdcPair = input({
	referenceKeys: ['asset:usdc', 'asset:weth', 'family:eth', 'family:stablecoins', 'family:usd-stables'],
	referenceExactKeys: [],
	poolKeys: ['asset:weth-usdc-gmx-v2']
})

// A single-asset stETH pool: references ETH (whole reference set belongs to both
// asset:eth and family:eth), but the held token is stETH.
const stEthPool = input({
	referenceKeys: ['asset:eth', 'family:eth'],
	referenceExactKeys: ['asset:eth', 'family:eth'],
	poolKeys: ['asset:steth', 'family:eth']
})

describe('matchesTokenFilter', () => {
	test('no filter: empty selection with non-contains modes keeps every row', () => {
		expect(matchesTokenFilter([], 'exact', 'reference', wethUsdcPair)).toBe(true)
		expect(matchesTokenFilter([], 'set', 'reference', wethUsdcPair)).toBe(true)
	})

	test('exact/reference: master exact_any — a selected option must contain the WHOLE reference set', () => {
		// stETH references only ETH, so its whole set belongs to family:eth / asset:eth.
		expect(matchesTokenFilter(['family:eth'], 'exact', 'reference', stEthPool)).toBe(true)
		expect(matchesTokenFilter(['asset:eth'], 'exact', 'reference', stEthPool)).toBe(true)
		// stETH is the held token, not a reference key.
		expect(matchesTokenFilter(['asset:steth'], 'exact', 'reference', stEthPool)).toBe(false)
	})

	test('exact/reference: a WETH-USDC pair does NOT match family:eth or a single asset (the bug fix)', () => {
		// exact_any rejects these because neither family:eth nor asset:weth contains the
		// whole {weth, usdc} set.
		expect(matchesTokenFilter(['family:eth'], 'exact', 'reference', wethUsdcPair)).toBe(false)
		expect(matchesTokenFilter(['asset:weth'], 'exact', 'reference', wethUsdcPair)).toBe(false)
		expect(matchesTokenFilter(['family:stablecoins'], 'exact', 'reference', wethUsdcPair)).toBe(false)
	})

	test('exact/pool: single-token pool — whole-set membership reduces to presence', () => {
		expect(matchesTokenFilter(['asset:steth'], 'exact', 'pool', stEthPool)).toBe(true)
		expect(matchesTokenFilter(['family:eth'], 'exact', 'pool', stEthPool)).toBe(true)
		expect(matchesTokenFilter(['asset:eth'], 'exact', 'pool', stEthPool)).toBe(false)
	})

	test('exact/both: reference and pool targets tested separately, then OR-ed', () => {
		expect(matchesTokenFilter(['asset:eth'], 'exact', 'both', stEthPool)).toBe(true) // via reference
		expect(matchesTokenFilter(['asset:steth'], 'exact', 'both', stEthPool)).toBe(true) // via pool
		expect(matchesTokenFilter(['asset:xyz'], 'exact', 'both', stEthPool)).toBe(false)
		// The pair matches on neither side.
		expect(matchesTokenFilter(['family:eth'], 'exact', 'both', wethUsdcPair)).toBe(false)
	})

	test('set/reference: exact asset-set equality, families ignored', () => {
		// Exactly {weth, usdc} → match the pair
		expect(matchesTokenFilter(['asset:weth', 'asset:usdc'], 'set', 'reference', wethUsdcPair)).toBe(true)
		// Order independent
		expect(matchesTokenFilter(['asset:usdc', 'asset:weth'], 'set', 'reference', wethUsdcPair)).toBe(true)
		// A superset selection does not equal the pair
		expect(matchesTokenFilter(['asset:weth', 'asset:usdc', 'asset:dai'], 'set', 'reference', wethUsdcPair)).toBe(false)
		// A single asset is not the full set
		expect(matchesTokenFilter(['asset:weth'], 'set', 'reference', wethUsdcPair)).toBe(false)
	})

	test('set/reference: a lone family selection means the family contains the whole reference set', () => {
		// stETH's whole reference set is all-ETH-family → family:eth set-matches.
		expect(matchesTokenFilter(['family:eth'], 'set', 'reference', stEthPool)).toBe(true)
		// The WETH-USDC pair is not entirely one family → no set match.
		expect(matchesTokenFilter(['family:eth'], 'set', 'reference', wethUsdcPair)).toBe(false)
		expect(matchesTokenFilter(['family:stablecoins'], 'set', 'reference', wethUsdcPair)).toBe(false)
	})

	test('set: a single-asset pool matches its lone asset', () => {
		expect(matchesTokenFilter(['asset:eth'], 'set', 'reference', stEthPool)).toBe(true)
	})

	test('set/reference: an asset plus its own family matches the single-asset pool', () => {
		expect(matchesTokenFilter(['asset:eth', 'family:eth'], 'set', 'reference', stEthPool)).toBe(true)
	})

	test('set/pool: asset-set equality against the held token', () => {
		expect(matchesTokenFilter(['asset:steth'], 'set', 'pool', stEthPool)).toBe(true)
		expect(matchesTokenFilter(['asset:eth'], 'set', 'pool', stEthPool)).toBe(false)
	})

	test('contains: master contains_any — any selected option key present in the target', () => {
		expect(matchesTokenFilter(['family:eth'], 'contains', 'reference', wethUsdcPair)).toBe(true)
		expect(matchesTokenFilter(['asset:weth'], 'contains', 'reference', wethUsdcPair)).toBe(true)
		// Held token is not a reference key.
		expect(matchesTokenFilter(['asset:steth'], 'contains', 'reference', stEthPool)).toBe(false)
		expect(matchesTokenFilter(['asset:steth'], 'contains', 'pool', stEthPool)).toBe(true)
		expect(matchesTokenFilter(['asset:xyz'], 'contains', 'reference', wethUsdcPair)).toBe(false)
	})
})

describe('token param parsing', () => {
	test('defaults when absent', () => {
		expect(parseTokenMatch({})).toBe('exact')
		expect(parseTokenOn({})).toBe('reference')
	})

	test('reads valid values', () => {
		expect(parseTokenMatch({ tokenMatch: 'set' })).toBe('set')
		expect(parseTokenOn({ tokenOn: 'pool' })).toBe('pool')
	})

	test('falls back to defaults on unknown/invalid values', () => {
		expect(parseTokenMatch({ tokenMatch: 'fuzzy' })).toBe('exact')
		expect(parseTokenOn({ tokenOn: 'sideways' })).toBe('reference')
	})
})

// --------------------------------------------------------------------------
// Integration: param parsing + filtering through the earn page loader
// --------------------------------------------------------------------------

type TokenPool = { row: EarnRow; keys: TokenKeys }

function row(id: string, keys: Partial<TokenKeys>, over: Partial<EarnRow> = {}): TokenPool {
	return { row: pool(id, over), keys: { id, ...keys } }
}

const page = (pools: Array<TokenPool>, query: Parameters<typeof earnPage>[1]) =>
	earnPage({ earn: pools.map((item) => item.row), tokenKeys: pools.map((item) => item.keys) }, query)

// A WETH-USDC pair and a WETH-USDC-DAI triple: neither has a whole-set option, so
// `reference_asset_exact` is absent (Exact rejects family:eth for both).
const pair = row('pair', { reference_asset: ['asset:weth', 'asset:usdc', 'family:eth'], pool_token: ['asset:lp'] })
const ethTriple = row('triple', {
	reference_asset: ['asset:weth', 'asset:usdc', 'asset:dai', 'family:eth']
})
// A single-asset stETH pool: its whole reference set belongs to asset:eth and family:eth.
const steth = row(
	'steth',
	{
		reference_asset: ['asset:eth', 'family:eth'],
		reference_asset_exact: ['asset:eth', 'family:eth'],
		pool_token: ['asset:steth', 'family:eth']
	},
	{ reference_asset_symbol: 'ETH', pool_token: { address: '0x', symbol: 'stETH', name: 'stETH' } }
)

describe('getEarnPage token filter', () => {
	test('default exact/reference (master exact_any): family:eth keeps only the all-ETH-family pool', async () => {
		const res = await page([pair, ethTriple, steth], { token: 'family:eth', pageSize: 'all' })
		// The pair and triple no longer match — their whole reference set isn't all-ETH-family.
		expect(res.rows.map((r) => r.id)).toEqual(['steth'])
		expect(res.rows[0]!.tokenSymbols).toEqual(['stETH', 'ETH'])
	})

	test('exposes structured pool attributes without deriving them from display labels', async () => {
		const res = await page(
			[
				row(
					'pool',
					{},
					{
						underlying_tokens: [{ address: '0xusdc', symbol: 'USDC', decimals: null }],
						attributes: { stablecoin_only: true, single_asset_exposure: true, impermanent_loss_risk: true }
					}
				)
			],
			{ pageSize: 'all' }
		)
		expect(res.rows[0]).toMatchObject({
			stablecoin: true,
			tokenSymbols: ['USDC'],
			singleAssetExposure: true,
			ilRisk: true
		})
	})

	test('contains (contains_any) keeps every pool whose reference includes family:eth', async () => {
		const res = await page([pair, ethTriple, steth], { token: 'family:eth', tokenMatch: 'contains', pageSize: 'all' })
		expect(res.rows.map((r) => r.id).sort()).toEqual(['pair', 'steth', 'triple'])
	})

	test('set matches only the exact pair, excluding the 3-asset pool', async () => {
		const res = await page([pair, ethTriple, steth], {
			token: ['asset:weth', 'asset:usdc'],
			tokenMatch: 'set',
			pageSize: 'all'
		})
		expect(res.rows.map((r) => r.id)).toEqual(['pair'])
	})

	test('on=pool matches the held token, not the reference', async () => {
		const res = await page([pair, steth], { token: 'asset:steth', tokenOn: 'pool', pageSize: 'all' })
		expect(res.rows.map((r) => r.id)).toEqual(['steth'])
	})
})
