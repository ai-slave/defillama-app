import { describe, expect, test } from 'vitest'
import { perpsAsset, spotAsset } from '../../table/__tests__/fixtures'
import { buildRwaQuestionsContext, getRwaQuestionsEntityName, getRwaQuestionsEntitySlug } from '../questions'

const metric = (total: number) => ({ total, breakdown: [] }) as never

describe('buildRwaQuestionsContext', () => {
	test('an Assets page sends its scope, totals and largest assets under the page rules', () => {
		const rows = [
			spotAsset({ assetName: 'Small', ticker: 'S', activeMcap: metric(10), onChainMcap: metric(20) }),
			spotAsset({ assetName: 'Large', ticker: 'L', activeMcap: metric(300), onChainMcap: metric(400) }),
			spotAsset({
				assetName: 'Flagged',
				ticker: 'F',
				suspicious: true,
				activeMcap: metric(999),
				onChainMcap: metric(999)
			}),
			spotAsset({
				assetName: 'Stable',
				ticker: 'ST',
				stablecoin: true,
				activeMcap: metric(500),
				onChainMcap: metric(500)
			})
		]
		expect(
			buildRwaQuestionsContext({
				kind: 'chain',
				scopeName: 'Ethereum',
				rows,
				defaultInclusion: { includeStablecoins: false, includeGovernance: false }
			})
		).toEqual({
			page: 'RWA assets on one chain',
			scope: 'Ethereum',
			assetCount: 2,
			totalActiveAum: 310,
			totalOnchainAum: 420,
			topAssets: [
				{ name: 'Large', ticker: 'L', platform: 'Ondo', category: ['Treasuries'], activeAum: 300, onchainAum: 400 },
				{ name: 'Small', ticker: 'S', platform: 'Ondo', category: ['Treasuries'], activeAum: 10, onchainAum: 20 }
			]
		})
	})

	test('an Assets page leaves out the wrapper tokens its headline leaves out', () => {
		const rows = [
			spotAsset({ assetName: 'Fund', ticker: 'F', activeMcap: metric(10), onChainMcap: metric(20) }),
			spotAsset({ assetName: 'Wrapped', ticker: 'W', type: 'Wrapper', activeMcap: metric(5), onChainMcap: metric(5) })
		]
		const context = (includeWrappers?: boolean) =>
			buildRwaQuestionsContext({
				kind: 'overview',
				scopeName: null,
				rows,
				defaultInclusion: { includeStablecoins: false, includeGovernance: false, includeWrappers }
			})
		expect(context()).toMatchObject({ assetCount: 1, totalActiveAum: 10 })
		expect(context(true)).toMatchObject({ assetCount: 2, totalActiveAum: 15 })
	})

	test('a Perps page sends its markets by open interest with their venue', () => {
		const rows = [
			perpsAsset({ contract: 'a:NVDA', openInterest: 50, volume24h: 7, parentPlatform: 'A', assetGroup: 'Stocks' }),
			perpsAsset({ contract: 'b:NVDA', openInterest: 80, volume24h: 3, parentPlatform: 'B', assetGroup: 'Stocks' })
		]
		expect(buildRwaQuestionsContext({ kind: 'perpsAsset', scopeName: 'NVDA', rows })).toEqual({
			page: 'RWA perpetual markets on one underlying asset',
			scope: 'NVDA',
			marketCount: 2,
			totalOpenInterest: 130,
			totalVolume24h: 10,
			topMarkets: [
				{ market: 'b:NVDA', venue: 'B', assetGroup: 'Stocks', openInterest: 80, volume24h: 3 },
				{ market: 'a:NVDA', venue: 'A', assetGroup: 'Stocks', openInterest: 50, volume24h: 7 }
			]
		})
	})

	test('sends a total no row carries as unknown, never as $0', () => {
		const markets = [perpsAsset({ openInterest: null, volume24h: null })]
		expect(buildRwaQuestionsContext({ kind: 'venue', scopeName: 'QFEX', rows: markets })).toMatchObject({
			marketCount: 1,
			totalOpenInterest: null,
			totalVolume24h: null
		})
		const assets = [spotAsset({ activeMcap: null, onChainMcap: null })]
		expect(buildRwaQuestionsContext({ kind: 'overview', scopeName: null, rows: assets })).toMatchObject({
			assetCount: 1,
			totalActiveAum: null,
			totalOnchainAum: null
		})
	})
})

describe('getRwaQuestionsEntityName', () => {
	test('names what the strip asks about', () => {
		expect(getRwaQuestionsEntityName('overview', null)).toBe('RWA')
		expect(getRwaQuestionsEntityName('chain', 'Ethereum')).toBe('RWA on Ethereum')
		expect(getRwaQuestionsEntityName('perpsOverview', null)).toBe('RWA Perps')
		expect(getRwaQuestionsEntityName('venue', 'QFEX')).toBe('QFEX RWA Perps')
		expect(getRwaQuestionsEntityName('platform', 'Ondo')).toBe('Ondo')
	})
})

describe('getRwaQuestionsEntitySlug', () => {
	test('gives every page its own entity, so the server caches questions per page', () => {
		expect(getRwaQuestionsEntitySlug('overview', null)).toBe('rwa')
		expect(getRwaQuestionsEntitySlug('perpsOverview', null)).toBe('rwa-perps')
		expect(getRwaQuestionsEntitySlug('platform', 'Ondo')).toBe('rwa-platform-ondo')
		expect(getRwaQuestionsEntitySlug('venue', 'trade[XYZ]')).toBe('rwa-venue-trade-xyz')
		expect(getRwaQuestionsEntitySlug('perpsAssetGroup', 'Precious Metals')).toBe(
			'rwa-perps-asset-group-precious-metals'
		)
	})
})
