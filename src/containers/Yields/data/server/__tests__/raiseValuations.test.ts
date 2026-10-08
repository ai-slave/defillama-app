import { describe, expect, test } from 'vitest'
import type { ParentProtocolLite, ProtocolLite } from '~/containers/ProtocolLists/api.types'
import type { Raise } from '~/containers/Raises/model'
import { buildRaiseValuationsUsd, withReferral } from '../raiseValuations'

function raise(over: Partial<Raise>): Raise {
	return {
		date: 0,
		name: '',
		round: '',
		amountUsd: null,
		chains: [],
		sector: '',
		category: '',
		categoryGroup: '',
		leadInvestors: [],
		otherInvestors: [],
		valuationUsd: null,
		source: '',
		...over
	}
}

const noLite = { protocols: [], parentProtocols: [] }

function protocol(
	overrides: Pick<ProtocolLite, 'name' | 'defillamaId'> & Partial<Omit<ProtocolLite, 'name' | 'defillamaId'>>
): ProtocolLite {
	return {
		symbol: '',
		logo: '',
		url: '',
		category: '',
		chains: [],
		chainTvls: {},
		tvl: 0,
		tvlPrevDay: null,
		tvlPrevWeek: null,
		tvlPrevMonth: null,
		mcap: null,
		geckoId: null,
		...overrides
	}
}

function parent(id: string, name: string): ParentProtocolLite {
	return { id, name, symbol: '-', chains: [], gecko_id: null, mcap: null, logo: '' }
}

describe('buildRaiseValuationsUsd', () => {
	test('matches by direct defillamaId (tier 1)', () => {
		const raises = [raise({ date: 1, defillamaId: '111', valuationUsd: 25_000_000 })]
		const protocols = [{ slug: 'morpho-blue', name: 'Morpho Blue' }]
		const lite = {
			protocols: [protocol({ name: 'Morpho Blue', defillamaId: '111' })],
			parentProtocols: []
		}
		const map = buildRaiseValuationsUsd(raises, protocols, lite)
		expect(map.get('morpho-blue')).toBe(25_000_000)
	})

	test('inherits a parent protocol raise for a child (tier 2 via parentProtocol id)', () => {
		// The raise is keyed to the PARENT's defillamaId; the child protocol has no raise of its own
		// but points at that parent via parentProtocol — tier 2 resolves it.
		const raises = [raise({ date: 1, defillamaId: 'parent#1', valuationUsd: 40_000_000 })]
		const protocols = [{ slug: 'aave-v3', name: 'Aave V3' }]
		const lite = {
			protocols: [protocol({ name: 'Aave V3', defillamaId: '500', parentProtocol: 'parent#1' })],
			parentProtocols: [parent('parent#1', 'Aave')]
		}
		const map = buildRaiseValuationsUsd(raises, protocols, lite)
		expect(map.get('aave-v3')).toBe(40_000_000)
	})

	test('matches "name starts with parent name" via a child raise (tier 4)', () => {
		// Parent "Aave" (>= 4 chars) resolves its valuation from a sibling child's defillamaId, then
		// "Aave Lend" matches because it starts with "Aave ".
		const raises = [raise({ date: 1, defillamaId: '999', valuationUsd: 15_000_000 })]
		const protocols = [{ slug: 'aave-lend', name: 'Aave Lend' }]
		const lite = {
			protocols: [protocol({ name: 'Aave V1', defillamaId: '999', parentProtocol: 'parent#aave' })],
			parentProtocols: [parent('parent#aave', 'Aave')]
		}
		const map = buildRaiseValuationsUsd(raises, protocols, lite)
		expect(map.get('aave-lend')).toBe(15_000_000)
	})

	test('falls back to an exact name → raise-name match (tier 3)', () => {
		const raises = [raise({ date: 1, name: 'Acme Protocol', valuationUsd: 12_000_000 })]
		const protocols = [{ slug: 'acme-protocol', name: 'Acme Protocol' }]
		const map = buildRaiseValuationsUsd(raises, protocols, noLite)
		expect(map.get('acme-protocol')).toBe(12_000_000)
	})

	test('matches "name starts with parent name" (tier 4)', () => {
		const raises = [raise({ date: 1, name: 'Phantom', valuationUsd: 8_000_000 })]
		const protocols = [{ slug: 'phantom-sol', name: 'Phantom SOL' }]
		const lite = {
			protocols: [],
			// parent "Phantom" resolves via raise name; "Phantom SOL" starts with "Phantom "
			parentProtocols: [parent('p#phantom', 'Phantom')]
		}
		const map = buildRaiseValuationsUsd(raises, protocols, lite)
		expect(map.get('phantom-sol')).toBe(8_000_000)
	})

	test('keeps the most recent raise (date desc, first write wins)', () => {
		const raises = [
			raise({ date: 100, name: 'Acme', valuationUsd: 50_000_000 }),
			raise({ date: 200, name: 'Acme', valuationUsd: 90_000_000 })
		]
		const protocols = [{ slug: 'acme', name: 'Acme' }]
		const map = buildRaiseValuationsUsd(raises, protocols, noLite)
		expect(map.get('acme')).toBe(90_000_000)
	})

	test('ignores non-finite / non-positive valuations and leaves unmatched protocols unset', () => {
		const raises = [
			raise({ date: 1, name: 'ZeroCo', valuationUsd: 0 }),
			raise({ date: 1, name: 'NanCo', valuationUsd: Number.NaN })
		]
		const protocols = [
			{ slug: 'zeroco', name: 'ZeroCo' },
			{ slug: 'nanco', name: 'NanCo' },
			{ slug: 'unknown', name: 'Unknown' }
		]
		const map = buildRaiseValuationsUsd(raises, protocols, noLite)
		expect(map.has('zeroco')).toBe(false)
		expect(map.has('nanco')).toBe(false)
		expect(map.has('unknown')).toBe(false)
		expect(map.size).toBe(0)
	})
})

describe('withReferral', () => {
	test.each([
		[
			'adds a query referral to the pool URL',
			'https://jup.ag/lend/earn/USDG/deposit',
			'https://jup.ag/?ref=f6y1ryr2snn3',
			'https://jup.ag/lend/earn/USDG/deposit?ref=f6y1ryr2snn3'
		],
		[
			'keeps the pool query and matches hosts across www',
			'https://www.hybra.finance/liquidity/add?token0=0x55&type=v3',
			'https://hybra.finance?code=GRYN2U',
			'https://www.hybra.finance/liquidity/add?token0=0x55&type=v3&code=GRYN2U'
		],
		[
			"leaves the pool's own query encoding untouched",
			'https://app.example.com/pool?chain=1:0xab&ids=a,b&q=a%20b',
			'https://app.example.com/?ref=x',
			'https://app.example.com/pool?chain=1:0xab&ids=a,b&q=a%20b&ref=x'
		],
		[
			'adds a hash-route referral inside the pool hash',
			'https://app.gmx.io/#/earn',
			'https://app.gmx.io/#/?ref=llamao',
			'https://app.gmx.io/#/earn?ref=llamao'
		],
		[
			'merges into an existing hash query',
			'https://app.hyperswap.exchange/#/add/HYPE/0x57?x=1',
			'https://app.hyperswap.exchange/#/?referral=defillama',
			'https://app.hyperswap.exchange/#/add/HYPE/0x57?x=1&referral=defillama'
		],
		[
			"merges into a pool under the referral's page",
			'https://app.ipor.io/fusion/ethereum/0xb9e8',
			'https://app.ipor.io/fusion?f=D0V4',
			'https://app.ipor.io/fusion/ethereum/0xb9e8?f=D0V4'
		],
		[
			'falls back to a referral on its own registration page',
			'https://gmtrade.xyz/pools',
			'https://gmtrade.xyz/referrals/?ref=545',
			'https://gmtrade.xyz/referrals/?ref=545'
		],
		[
			'falls back to a referral on a sibling page',
			'https://www.monetrix.xyz/app/earn?product=mxhype',
			'https://www.monetrix.xyz/app/dashboard?code=TW51HHJ2',
			'https://www.monetrix.xyz/app/dashboard?code=TW51HHJ2'
		],
		[
			'falls back to a hash-route referral on its own page',
			'https://app.gmx.io/#/earn',
			'https://app.gmx.io/#/trade/?ref=llamao',
			'https://app.gmx.io/#/trade/?ref=llamao'
		],
		[
			'falls back to a path referral',
			'https://www.prjx.com/deposit?tokenA=0xb2',
			'https://www.prjx.com/@DEFILLAMA',
			'https://www.prjx.com/@DEFILLAMA'
		],
		[
			'falls back to a referral on another host',
			'https://app.spark.fi/markets/1/0x22',
			'https://app.spark.finance/points/KNQ5HD',
			'https://app.spark.finance/points/KNQ5HD'
		],
		[
			'falls back when the pool URL is only the homepage',
			'https://app.curvance.com',
			'https://app.curvance.com/?referral=defillama',
			'https://app.curvance.com/?referral=defillama'
		],
		[
			'falls back when a hash-route referral meets a pool without one',
			'https://app.kinza.finance/markets',
			'https://app.kinza.finance/#/referral?referralCode=28UAHQ',
			'https://app.kinza.finance/#/referral?referralCode=28UAHQ'
		],
		['falls back when the pool has no URL', null, 'https://jup.ag/?ref=x', 'https://jup.ag/?ref=x'],
		['keeps the pool URL without a referral', 'https://jup.ag/lend', undefined, 'https://jup.ag/lend']
	])('%s', (_, url, referralUrl, expected) => {
		expect(withReferral(url, referralUrl)).toBe(expected)
	})
})
