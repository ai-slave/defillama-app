import { describe, expect, test } from 'vitest'
import type { IRWAFlowSummaryResponse } from '../../api.types'
import { groupRwaRows } from '../grouping'
import { buildRwaLeafRows } from '../rows'
import { perpsAsset, spotAsset } from './fixtures'

const flowSummary: IRWAFlowSummaryResponse = {
	generatedAt: 1,
	windows: {
		'7d': {
			asset: {
				'ondo/usdy': {
					flow: 1000,
					mcap: 800_000,
					intensityPct: 0.1,
					coverage: 1,
					byChain: { Ethereum: { status: 'measured', flow: 900, coverage: 1 }, Solana: { status: 'notPriced' } }
				}
			},
			assetGroup: {},
			platform: {},
			category: {},
			chain: {}
		},
		'30d': { asset: {}, assetGroup: {}, platform: {}, category: {}, chain: {} }
	}
}

const ousg = spotAsset({
	id: 'ousg',
	canonicalMarketId: 'ondo/ousg',
	ticker: 'OUSG',
	assetName: 'Ondo OUSG',
	issuer: 'Ondo',
	onChainMcap: { total: 500_000, breakdown: [['Ethereum', 500_000]] },
	activeMcap: { total: 400_000, breakdown: [['Ethereum', 400_000]] },
	defiActiveTvl: { total: 0, breakdown: [] },
	defiActiveTvlByChain: { total: 0, breakdown: [] },
	priors: {
		'1d': { activeMcap: 500_000, onChainMcap: 500_000, defiActiveTvl: 0, bridgeTvl: 0 },
		'7d': { activeMcap: 500_000, onChainMcap: 500_000, defiActiveTvl: 0, bridgeTvl: 0 },
		'1m': { activeMcap: 500_000, onChainMcap: 500_000, defiActiveTvl: 0, bridgeTvl: 0 }
	}
})
const buidl = spotAsset({
	id: 'buidl',
	canonicalMarketId: 'securitize/buidl',
	ticker: 'BUIDL',
	assetName: 'BUIDL',
	issuer: 'BlackRock',
	parentPlatform: 'Securitize',
	onChainMcap: { total: 2_000_000, breakdown: [['Ethereum', 2_000_000]] },
	activeMcap: { total: 2_000_000, breakdown: [['Ethereum', 2_000_000]] },
	priors: {
		'1d': { activeMcap: null, onChainMcap: 2_000_000, defiActiveTvl: 100_000, bridgeTvl: 0 },
		'7d': { activeMcap: null, onChainMcap: 2_000_000, defiActiveTvl: 100_000, bridgeTvl: 0 },
		'1m': { activeMcap: null, onChainMcap: 2_000_000, defiActiveTvl: 100_000, bridgeTvl: 0 }
	}
})

describe('groupRwaRows', () => {
	const rows = buildRwaLeafRows([spotAsset(), ousg, buidl], { flowSummary, includeBridgeTvl: true })

	test('returns the leaf rows untouched for the flat view', () => {
		expect(groupRwaRows(rows, 'none')).toBe(rows)
	})

	test('folds assets under their platform and sums the metrics', () => {
		const groups = groupRwaRows(rows, 'platform')
		expect(groups.map((group) => group.kind)).toEqual(['group', 'group'])
		const ondo = groups[0]
		if (ondo.kind !== 'group') throw new Error('expected a group row')
		expect(ondo.id).toBe('platform:Ondo')
		expect(ondo.label).toBe('Ondo')
		expect(ondo.href).toBe('/rwa/platform/ondo')
		expect(ondo.children.map((child) => child.id)).toEqual(['usdy', 'ousg'])
		expect(ondo.metrics.activeMcap).toBe(1_200_000)
		expect(ondo.metrics.change['7d'].activeMcap).toEqual({ current: 1_200_000, prior: 1_200_000 })
		expect(ondo.metrics.change['1m'].activeMcap).toEqual({ current: 1_200_000, prior: 1_000_000 })
		expect(ondo.metrics.onChainMcap).toBe(1_500_000)
		expect(ondo.metrics.defiActiveTvl).toBe(100_000)
		expect(ondo.metrics.netFlow7d).toBe(1000)
		expect(ondo.metrics.netFlow30d).toBeNull()
		expect(ondo.metrics.price).toBeNull()
		expect(ondo.metrics.assetCount).toBe(2)
		expect(ondo.metrics.issuerCount).toBe(1)
		expect(ondo.metrics.chains).toEqual([
			{ chain: 'Ethereum', value: 1_200_000, share: 0.8 },
			{ chain: 'Solana', value: 295_000, share: 295_000 / 1_500_000 },
			{ chain: 'Mantle', value: 5000, share: 5000 / 1_500_000 }
		])
		expect(ondo.metrics.chainCount).toBe(3)
		expect(ondo.distinct.assetGroup).toEqual(['Bonds'])
		expect(ondo.distinct.venueType).toEqual([])
		expect(ondo.distinct.accessModel).toEqual(['Permissioned'])
		expect(ondo.distinct.issuer).toEqual(['Ondo'])
		expect(ondo.flags.redeemable).toEqual({ yes: 0, known: 0 })
	})

	test('gives an asset under two categories one row per category, each with its own id', () => {
		const groups = groupRwaRows(
			buildRwaLeafRows([spotAsset({ category: ['Treasuries', 'Private Credit'] })], { includeBridgeTvl: true }),
			'category'
		)
		expect(groups.map((group) => (group.kind === 'group' ? group.children.map((child) => child.id) : []))).toEqual([
			['usdy@Treasuries'],
			['usdy@Private Credit']
		])
		expect(groups.map((group) => group.metrics.activeMcap)).toEqual([800_000, 800_000])
	})

	test('compares like for like: a child without a prior leaves both sides of the change', () => {
		const groups = groupRwaRows(rows, 'platform')
		const securitize = groups[1]
		if (securitize.kind !== 'group') throw new Error('expected a group row')
		expect(securitize.metrics.activeMcap).toBe(2_000_000)
		expect(securitize.metrics.change['7d'].activeMcap).toEqual({ current: null, prior: null })
		expect(securitize.metrics.change['7d'].onChainMcap).toEqual({ current: 2_000_000, prior: 2_000_000 })
	})

	test('repeats an asset under every chain it has value on, with the chain slice of each metric', () => {
		const groups = groupRwaRows(rows, 'chain')
		expect(groups.map((group) => (group.kind === 'group' ? group.label : ''))).toEqual(['Ethereum', 'Solana', 'Mantle'])
		const ethereum = groups[0]
		if (ethereum.kind !== 'group') throw new Error('expected a group row')
		expect(ethereum.icon).toEqual({ kind: 'chain', name: 'Ethereum' })
		expect(ethereum.children.map((child) => child.id)).toEqual(['usdy@Ethereum', 'ousg@Ethereum', 'buidl@Ethereum'])
		const usdyOnEthereum = ethereum.children[0]
		expect(usdyOnEthereum.chainScope).toBe('Ethereum')
		expect(usdyOnEthereum.metrics.activeMcap).toBe(600_000)
		expect(usdyOnEthereum.metrics.onChainMcap).toBe(700_000)
		expect(usdyOnEthereum.metrics.defiActiveTvl).toBe(100_000)
		expect(usdyOnEthereum.metrics.netFlow7d).toBe(900)
		// 600k of 800k sits on Ethereum today; the 700k prior is split by that share
		expect(usdyOnEthereum.metrics.change['7d'].activeMcap).toEqual({ current: 600_000, prior: 525_000 })
		expect(usdyOnEthereum.metrics.chains).toEqual([{ chain: 'Ethereum', value: 700_000, share: 0.7 }])
		expect(usdyOnEthereum.breakdowns.activeMcap).toEqual([['Ethereum', 600_000]])
		expect(usdyOnEthereum.breakdowns.defiActiveTvl).toBeNull()
		expect(ethereum.metrics.activeMcap).toBe(3_000_000)
		// usdy 600k/525k and ousg 400k/500k; buidl has no prior and leaves both sides
		expect(ethereum.metrics.change['7d'].activeMcap).toEqual({ current: 1_000_000, prior: 1_025_000 })
		const solana = groups[1]
		if (solana.kind !== 'group') throw new Error('expected a group row')
		expect(solana.children.map((child) => child.id)).toEqual(['usdy@Solana'])
		expect(solana.children[0].metrics.netFlow7d).toBeNull()
	})

	test('leaves funding, premium and leverage empty on a group, where a blend means nothing, and compares OI like for like', () => {
		const perpsRows = buildRwaLeafRows(
			[
				perpsAsset({ id: 'big', openInterest: 9000, premium: 0.01, openInterestChange24h: 12.5 }),
				perpsAsset({ id: 'small', openInterest: 1000, premium: -0.01, openInterestChange24h: null, maxLeverage: 100 })
			],
			{ includeBridgeTvl: true }
		)
		const [venue] = groupRwaRows(perpsRows, 'platform')
		if (venue.kind !== 'group') throw new Error('expected a group row')
		expect(venue.metrics).toMatchObject({ fundingApr: null, fundingRate: null, premium: null, maxLeverage: null })
		expect(venue.metrics.openInterestChange24h).toMatchObject({ current: 9000, prior: 8000 })
	})

	test('a group compares the markets it can rebuild and counts the ones that fell to zero', () => {
		const [venue] = groupRwaRows(
			buildRwaLeafRows(
				[
					perpsAsset({ id: 'up', openInterest: 1_000_000, openInterestChange24h: 25 }),
					perpsAsset({ id: 'gone', openInterest: 0, openInterestChange24h: -100 })
				],
				{ includeBridgeTvl: true }
			),
			'platform'
		)
		if (venue.kind !== 'group') throw new Error('expected a group row')
		expect(venue.metrics.openInterestChange24h).toMatchObject({ percent: 25, dropped: 1 })
		const [allGone] = groupRwaRows(
			buildRwaLeafRows([perpsAsset({ id: 'gone', openInterest: 0, openInterestChange24h: -100 })], {
				includeBridgeTvl: true
			}),
			'platform'
		)
		expect(allGone.metrics.openInterestChange24h).toMatchObject({ percent: -100, dropped: 1 })
	})

	test('sums the perps fees and shares, weights the fee rates by open interest and lists the specs', () => {
		const perpsRows = buildRwaLeafRows(
			[
				perpsAsset({
					id: 'big',
					openInterest: 9000,
					protocolFees30d: 100,
					volumeAllTime: 1000,
					makerFeeRate: 0.0002,
					pair: 'USDY/USDC',
					marginAsset: 'USDC',
					oraclePrice: 1.01
				}),
				perpsAsset({
					id: 'small',
					openInterest: 1000,
					protocolFees30d: null,
					volumeAllTime: 500,
					makerFeeRate: 0.001,
					pair: 'USDY/USDT',
					marginAsset: 'USDC',
					fundingIntervalHours: 1
				})
			],
			{ includeBridgeTvl: true }
		)
		const [venue] = groupRwaRows(perpsRows, 'platform')
		if (venue.kind !== 'group') throw new Error('expected a group row')
		expect(venue.metrics.protocolFees30d).toBe(100)
		expect(venue.metrics.volumeAllTime).toBe(1500)
		expect(venue.metrics.makerFeeRate).toBeCloseTo((0.0002 * 9000 + 0.001 * 1000) / 10_000)
		expect(venue.metrics.oraclePrice).toBeNull()
		expect(venue.distinct.pair).toEqual(['USDY/USDC', 'USDY/USDT'])
		expect(venue.distinct.marginAsset).toEqual(['USDC'])
		expect(venue.distinct.fundingInterval).toEqual(['8h', '1h'])
		expect(venue.distinct.asset).toEqual(['USDY Perp'])
	})
})
