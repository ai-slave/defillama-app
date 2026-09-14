import { describe, expect, test } from 'vitest'
import { canonicalizeLegacyYieldsQuery, tokenBySymbolFromOptions } from '../legacyQuery'
import type { TokenOption } from '../types'

// Minimal page vocabulary: an ETH asset + an ETH family sharing the symbol (asset wins),
// plus a distinct BTC asset.
const TOKENS: Array<TokenOption> = [
	['ETH', 'family:eth'],
	['ETH', 'asset:eth'],
	['BTC', 'asset:btc']
]
const tokenBySymbol = tokenBySymbolFromOptions(TOKENS)

const earn = (query: Record<string, string | Array<string> | undefined>) =>
	canonicalizeLegacyYieldsQuery(query, { page: 'earn', tokenBySymbol })

describe('canonicalizeLegacyYieldsQuery', () => {
	test('rewrites the full legacy bookmark to canonical params', () => {
		expect(
			earn({
				project: 'Lido',
				token: 'ETH',
				attribute: 'million_dollar',
				sortBy: 'tvlUsd',
				show1dVolume: 'true',
				excludeToken: 'DAI',
				view: 'table'
			})
		).toEqual({
			protocol: 'Lido',
			token: 'asset:eth',
			minTvl: '1000000',
			sortBy: 'tvl',
			column: 'volumeUsd1d'
		})
	})

	test('resolves token specials and drops unresolvable symbols', () => {
		expect(earn({ token: ['all_usd_stables', 'ETH', 'ZZZ'] })).toEqual({ token: ['family:usd-stables', 'asset:eth'] })
		expect(earn({ token: 'all' })).toEqual({}) // `all` special drops → token param removed
	})

	test('renames excludeProject and keeps an existing protocol untouched', () => {
		expect(earn({ excludeProject: 'Compound' })).toEqual({ excludeProtocol: 'Compound' })
		expect(earn({ project: 'A', protocol: 'B' })).toEqual({ protocol: 'B' })
	})

	test('drops dead attribute values but keeps the live vocabulary', () => {
		expect(earn({ attribute: ['audited', 'no_outlier', 'stablecoins'] })).toEqual({
			attribute: ['audited', 'stablecoins']
		})
	})

	test('maps the interim no_protocol_token attribute back to airdrop', () => {
		expect(earn({ attribute: 'no_protocol_token' })).toEqual({ attribute: 'airdrop' })
		expect(earn({ attribute: ['no_protocol_token', 'audited'] })).toEqual({ attribute: ['airdrop', 'audited'] })
	})

	test('does not override an explicit minTvl when expanding million_dollar', () => {
		expect(earn({ attribute: 'million_dollar', minTvl: '5000000' })).toEqual({ minTvl: '5000000' })
	})

	test('maps the three live show* columns and drops the rest', () => {
		expect(earn({ showTop10Pct: 'true', showAvgPosition: 'true', show7dIL: 'true', showMedianApy: 'true' })).toEqual({
			column: ['top10Pct', 'avgPositionUsd']
		})
		// show*=false is dropped without adding a column.
		expect(earn({ show1dVolume: 'false' })).toEqual({})
	})

	test('retires minAvailable/maxAvailable on earn but keeps them on borrow/loop', () => {
		expect(earn({ minAvailable: '100', maxAvailable: '200' })).toEqual({})
		expect(canonicalizeLegacyYieldsQuery({ minAvailable: '100' }, { page: 'borrow', tokenBySymbol })).toBeNull()
		expect(canonicalizeLegacyYieldsQuery({ maxAvailable: '200' }, { page: 'loop', tokenBySymbol })).toBeNull()
	})

	test('is a no-op (null) on already-canonical queries', () => {
		expect(
			earn({ protocol: 'Lido', token: 'asset:eth', minTvl: '1000000', sortBy: 'tvl', column: 'volumeUsd1d' })
		).toBeNull()
		expect(earn({ chain: 'Ethereum', category: 'Lending', excludeChain: 'Solana' })).toBeNull()
	})
})
