import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	createTokenFilterMatcher,
	parseTokenMatch,
	parseTokenOn,
	type TokenFilterInput,
	type TokenMatch,
	type TokenOn
} from '../query'
import type { ApyTriple, ApyWindows, EarnAttributes, EnrichedEarnRow, TokenKeys } from '../types'

// getEarnPage pulls rows from getEnrichedEarn; mock it so the integration cases
// exercise only the token Match × On filter path.
const getEnrichedEarn = vi.fn<() => Promise<EnrichedEarnRow[]>>()
vi.mock('../enrich.server', () => ({ getEnrichedEarn: () => getEnrichedEarn() }))
vi.mock('../snapshot', async (importOriginal) => ({
	...(await importOriginal<typeof import('../snapshot')>()),
	readYieldsMeta: () => Promise.resolve({ halal: [], meme_pool_ids: [] }),
	readYieldsDepegs: () => Promise.resolve([]),
	readYieldsExploits: () => Promise.resolve([])
}))
vi.mock('../server/raiseValuations', () => ({
	getRaiseValuationsUsd: () => Promise.resolve(new Map<string, number>()),
	getReferralUrls: () => Promise.resolve(new Map<string, string>())
}))

import { getEarnPage as getEarnPageFromSnapshot } from '../earn.server'

const snapshot = {} as never
const getEarnPage = (query: Parameters<typeof getEarnPageFromSnapshot>[1]) => getEarnPageFromSnapshot(snapshot, query)

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

function matchesTokenFilter(tokens: string[], match: TokenMatch, on: TokenOn, value: TokenFilterInput) {
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
	it('no filter: empty selection with non-contains modes keeps every row', () => {
		expect(matchesTokenFilter([], 'exact', 'reference', wethUsdcPair)).toBe(true)
		expect(matchesTokenFilter([], 'set', 'reference', wethUsdcPair)).toBe(true)
	})

	it('exact/reference: master exact_any — a selected option must contain the WHOLE reference set', () => {
		// stETH references only ETH, so its whole set belongs to family:eth / asset:eth.
		expect(matchesTokenFilter(['family:eth'], 'exact', 'reference', stEthPool)).toBe(true)
		expect(matchesTokenFilter(['asset:eth'], 'exact', 'reference', stEthPool)).toBe(true)
		// stETH is the held token, not a reference key.
		expect(matchesTokenFilter(['asset:steth'], 'exact', 'reference', stEthPool)).toBe(false)
	})

	it('exact/reference: a WETH-USDC pair does NOT match family:eth or a single asset (the bug fix)', () => {
		// exact_any rejects these because neither family:eth nor asset:weth contains the
		// whole {weth, usdc} set.
		expect(matchesTokenFilter(['family:eth'], 'exact', 'reference', wethUsdcPair)).toBe(false)
		expect(matchesTokenFilter(['asset:weth'], 'exact', 'reference', wethUsdcPair)).toBe(false)
		expect(matchesTokenFilter(['family:stablecoins'], 'exact', 'reference', wethUsdcPair)).toBe(false)
	})

	it('exact/pool: single-token pool — whole-set membership reduces to presence', () => {
		expect(matchesTokenFilter(['asset:steth'], 'exact', 'pool', stEthPool)).toBe(true)
		expect(matchesTokenFilter(['family:eth'], 'exact', 'pool', stEthPool)).toBe(true)
		expect(matchesTokenFilter(['asset:eth'], 'exact', 'pool', stEthPool)).toBe(false)
	})

	it('exact/both: reference and pool targets tested separately, then OR-ed', () => {
		expect(matchesTokenFilter(['asset:eth'], 'exact', 'both', stEthPool)).toBe(true) // via reference
		expect(matchesTokenFilter(['asset:steth'], 'exact', 'both', stEthPool)).toBe(true) // via pool
		expect(matchesTokenFilter(['asset:xyz'], 'exact', 'both', stEthPool)).toBe(false)
		// The pair matches on neither side.
		expect(matchesTokenFilter(['family:eth'], 'exact', 'both', wethUsdcPair)).toBe(false)
	})

	it('set/reference: exact asset-set equality, families ignored', () => {
		// Exactly {weth, usdc} → match the pair
		expect(matchesTokenFilter(['asset:weth', 'asset:usdc'], 'set', 'reference', wethUsdcPair)).toBe(true)
		// Order independent
		expect(matchesTokenFilter(['asset:usdc', 'asset:weth'], 'set', 'reference', wethUsdcPair)).toBe(true)
		// A superset selection does not equal the pair
		expect(matchesTokenFilter(['asset:weth', 'asset:usdc', 'asset:dai'], 'set', 'reference', wethUsdcPair)).toBe(false)
		// A single asset is not the full set
		expect(matchesTokenFilter(['asset:weth'], 'set', 'reference', wethUsdcPair)).toBe(false)
	})

	it('set/reference: a lone family selection means the family contains the whole reference set', () => {
		// stETH's whole reference set is all-ETH-family → family:eth set-matches.
		expect(matchesTokenFilter(['family:eth'], 'set', 'reference', stEthPool)).toBe(true)
		// The WETH-USDC pair is not entirely one family → no set match.
		expect(matchesTokenFilter(['family:eth'], 'set', 'reference', wethUsdcPair)).toBe(false)
		expect(matchesTokenFilter(['family:stablecoins'], 'set', 'reference', wethUsdcPair)).toBe(false)
	})

	it('set: a single-asset pool matches its lone asset', () => {
		expect(matchesTokenFilter(['asset:eth'], 'set', 'reference', stEthPool)).toBe(true)
	})

	it('set/reference: mixed asset+family falls back to asset-only equality (residual gap)', () => {
		// asset:weth + family:eth on the pair → asset-only equality compares {weth} vs {weth,usdc}
		// → no match. The family constraint itself is not independently verified (documented gap).
		expect(matchesTokenFilter(['asset:weth', 'family:eth'], 'set', 'reference', wethUsdcPair)).toBe(false)
		// On stETH: asset:eth + family:eth → asset-only {eth} equals reference assets {eth} → match.
		expect(matchesTokenFilter(['asset:eth', 'family:eth'], 'set', 'reference', stEthPool)).toBe(true)
	})

	it('set/pool: asset-set equality against the held token', () => {
		expect(matchesTokenFilter(['asset:steth'], 'set', 'pool', stEthPool)).toBe(true)
		expect(matchesTokenFilter(['asset:eth'], 'set', 'pool', stEthPool)).toBe(false)
	})

	it('contains: master contains_any — any selected option key present in the target', () => {
		expect(matchesTokenFilter(['family:eth'], 'contains', 'reference', wethUsdcPair)).toBe(true)
		expect(matchesTokenFilter(['asset:weth'], 'contains', 'reference', wethUsdcPair)).toBe(true)
		// Held token is not a reference key.
		expect(matchesTokenFilter(['asset:steth'], 'contains', 'reference', stEthPool)).toBe(false)
		expect(matchesTokenFilter(['asset:steth'], 'contains', 'pool', stEthPool)).toBe(true)
	})

	it('contains: presence of any selected option key in the target (contains_any)', () => {
		expect(matchesTokenFilter(['asset:weth'], 'contains', 'reference', wethUsdcPair)).toBe(true)
		expect(matchesTokenFilter(['family:eth'], 'contains', 'reference', wethUsdcPair)).toBe(true)
		expect(matchesTokenFilter(['asset:xyz'], 'contains', 'reference', wethUsdcPair)).toBe(false)
		expect(matchesTokenFilter(['asset:steth'], 'contains', 'pool', stEthPool)).toBe(true)
		expect(matchesTokenFilter(['asset:steth'], 'contains', 'reference', stEthPool)).toBe(false)
		// Empty selection is a no-op that keeps every row.
		expect(matchesTokenFilter([], 'contains', 'reference', wethUsdcPair)).toBe(true)
	})
})

describe('token param parsing', () => {
	it('defaults when absent', () => {
		expect(parseTokenMatch({})).toBe('exact')
		expect(parseTokenOn({})).toBe('reference')
	})

	it('reads valid values', () => {
		expect(parseTokenMatch({ tokenMatch: 'set' })).toBe('set')
		expect(parseTokenOn({ tokenOn: 'pool' })).toBe('pool')
	})

	it('falls back to defaults on unknown/invalid values', () => {
		expect(parseTokenMatch({ tokenMatch: 'fuzzy' })).toBe('exact')
		expect(parseTokenOn({ tokenOn: 'sideways' })).toBe('reference')
	})
})

// --------------------------------------------------------------------------
// Integration: param parsing + filtering through getEarnPage
// --------------------------------------------------------------------------

const ZERO_TRIPLE: ApyTriple = { base: null, reward: null, total: null }
const ZERO_APY: ApyWindows = { current: ZERO_TRIPLE, avg_7d: ZERO_TRIPLE, avg_30d: ZERO_TRIPLE }
const ATTRIBUTES: EarnAttributes = {
	stablecoin_only: false,
	single_asset_exposure: false,
	impermanent_loss_risk: false
}

function row(id: string, keys: Partial<TokenKeys>, over: Partial<EnrichedEarnRow> = {}): EnrichedEarnRow {
	return {
		id,
		pool_key: id,
		pool_token: null,
		display: { label: id, detail: null },
		reference_asset_symbol: null,
		url: null,
		protocol: 'p',
		chain: 'Ethereum',
		underlying_tokens: [],
		reward_tokens: [],
		tvl_usd: 1_000,
		apy: ZERO_APY,
		intrinsic: null,
		stability_30d: {},
		holders: null,
		price_per_share: null,
		volume_1d_usd: null,
		attributes: ATTRIBUTES,
		protocolSlug: 'p',
		chainSlug: 'ethereum',
		isEvm: true,
		category: 'Dexs',
		hasAudit: false,
		protocolHasToken: false,
		trend: null,
		tokenKeys: { id, ...keys },
		...over
	}
}

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
	beforeEach(() => getEnrichedEarn.mockReset())

	it('default exact/reference (master exact_any): family:eth keeps only the all-ETH-family pool', async () => {
		getEnrichedEarn.mockResolvedValue([pair, ethTriple, steth])
		const res = await getEarnPage({ token: 'family:eth', pageSize: 'all' })
		// The pair and triple no longer match — their whole reference set isn't all-ETH-family.
		expect(res.rows.map((r) => r.id)).toEqual(['steth'])
		expect(res.rows[0].tokenSymbols).toEqual(['stETH', 'ETH'])
	})

	it('exposes structured pool attributes without deriving them from display labels', async () => {
		getEnrichedEarn.mockResolvedValue([
			row(
				'pool',
				{},
				{
					underlying_tokens: [{ address: '0xusdc', symbol: 'USDC' }],
					attributes: { stablecoin_only: true, single_asset_exposure: true, impermanent_loss_risk: true }
				}
			)
		])
		const res = await getEarnPage({ pageSize: 'all' })
		expect(res.rows[0]).toMatchObject({
			stablecoin: true,
			tokenSymbols: ['USDC'],
			singleAssetExposure: true,
			ilRisk: true
		})
	})

	it('contains (contains_any) keeps every pool whose reference includes family:eth', async () => {
		getEnrichedEarn.mockResolvedValue([pair, ethTriple, steth])
		const res = await getEarnPage({ token: 'family:eth', tokenMatch: 'contains', pageSize: 'all' })
		expect(res.rows.map((r) => r.id).sort()).toEqual(['pair', 'steth', 'triple'])
	})

	it('set matches only the exact pair, excluding the 3-asset pool', async () => {
		getEnrichedEarn.mockResolvedValue([pair, ethTriple, steth])
		const res = await getEarnPage({
			token: ['asset:weth', 'asset:usdc'],
			tokenMatch: 'set',
			pageSize: 'all'
		})
		expect(res.rows.map((r) => r.id)).toEqual(['pair'])
	})

	it('on=pool matches the held token, not the reference', async () => {
		getEnrichedEarn.mockResolvedValue([pair, steth])
		const res = await getEarnPage({ token: 'asset:steth', tokenOn: 'pool', pageSize: 'all' })
		expect(res.rows.map((r) => r.id)).toEqual(['steth'])
	})

	it('contains keeps rows whose target holds any selected option key', async () => {
		getEnrichedEarn.mockResolvedValue([pair, steth])
		const res = await getEarnPage({ token: 'asset:steth', tokenMatch: 'contains', tokenOn: 'pool', pageSize: 'all' })
		expect(res.rows.map((r) => r.id)).toEqual(['steth'])
	})

	it('invalid mode params fall back to the default exact/reference (exact_any) behavior', async () => {
		getEnrichedEarn.mockResolvedValue([pair, ethTriple, steth])
		const res = await getEarnPage({
			token: 'family:eth',
			tokenMatch: 'bogus',
			tokenOn: 'nowhere',
			pageSize: 'all'
		})
		expect(res.rows.map((r) => r.id)).toEqual(['steth'])
	})
})
