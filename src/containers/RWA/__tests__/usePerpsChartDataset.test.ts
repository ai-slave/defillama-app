import { describe, expect, test } from 'vitest'
import { getRwaPerpsChartScope, getRwaPerpsChartUrl } from '../usePerpsChartDataset'

describe('getRwaPerpsChartUrl', () => {
	test('builds the split and contract routes with the server keys and the CEX flag', () => {
		const all = { kind: 'all' } as const
		expect(
			getRwaPerpsChartUrl({
				source: { kind: 'split', breakdown: 'venue' },
				metric: 'openInterest',
				includeCex: true,
				scope: all
			})
		).toBe('/api/public/rwa/perps/overview-breakdown?breakdown=venue&key=openInterest&includeCex=true')
		expect(
			getRwaPerpsChartUrl({
				source: { kind: 'split', breakdown: 'baseAsset' },
				metric: 'volume',
				includeCex: false,
				scope: all
			})
		).toBe('/api/public/rwa/perps/overview-breakdown?breakdown=baseAsset&key=volume24h')
		expect(
			getRwaPerpsChartUrl({ source: { kind: 'contracts' }, metric: 'openInterest', includeCex: false, scope: all })
		).toBe('/api/public/rwa/perps/contract-breakdown?key=openInterest')
		expect(
			getRwaPerpsChartUrl({
				source: { kind: 'split', breakdown: 'venue' },
				metric: 'markets',
				includeCex: false,
				scope: all
			})
		).toBe('/api/public/rwa/perps/overview-breakdown?breakdown=venue&key=markets')
	})

	test('an asset group page sends its group on both routes', () => {
		const scope = { kind: 'assetGroup', slug: 'US Equities' } as const
		expect(
			getRwaPerpsChartUrl({
				source: { kind: 'split', breakdown: 'venue' },
				metric: 'openInterest',
				includeCex: true,
				scope
			})
		).toBe(
			'/api/public/rwa/perps/overview-breakdown?breakdown=venue&key=openInterest&includeCex=true&assetGroup=US+Equities'
		)
		expect(getRwaPerpsChartUrl({ source: { kind: 'contracts' }, metric: 'volume', includeCex: false, scope })).toBe(
			'/api/public/rwa/perps/contract-breakdown?key=volume24h&assetGroup=US+Equities'
		)
	})

	test('an underlying page reads the market split, which is the one route that takes a base asset', () => {
		const scope = { kind: 'baseAsset', slug: 'S&P 500 Index' } as const
		for (const source of [{ kind: 'split', breakdown: 'venue' } as const, { kind: 'contracts' } as const]) {
			expect(getRwaPerpsChartUrl({ source, metric: 'openInterest', includeCex: true, scope })).toBe(
				'/api/public/rwa/perps/market-breakdown?key=openInterest&includeCex=true&baseAsset=S%26P+500+Index'
			)
		}
	})

	test('a venue page sends its venue: the contracts under None, the split by the Group by otherwise', () => {
		const scope = { kind: 'venue', slug: 'trade[XYZ]' } as const
		expect(
			getRwaPerpsChartUrl({ source: { kind: 'contracts' }, metric: 'openInterest', includeCex: true, scope })
		).toBe('/api/public/rwa/perps/contract-breakdown?key=openInterest&includeCex=true&venue=trade%5BXYZ%5D')
		expect(
			getRwaPerpsChartUrl({
				source: { kind: 'split', breakdown: 'assetGroup' },
				metric: 'volume',
				includeCex: true,
				scope: { kind: 'venue', slug: 'Ostium' }
			})
		).toBe('/api/public/rwa/perps/overview-breakdown?breakdown=assetGroup&key=volume24h&includeCex=true&venue=Ostium')
	})
})

describe('getRwaPerpsChartScope', () => {
	test('reads the asset group from the page frame and the underlying from the page', () => {
		expect(getRwaPerpsChartScope({ assetGroupSlug: null, selectedAssetGroup: 'All' })).toEqual({ kind: 'all' })
		expect(getRwaPerpsChartScope({ assetGroupSlug: 'us-equities', selectedAssetGroup: 'US Equities' })).toEqual({
			kind: 'assetGroup',
			slug: 'US Equities'
		})
		expect(getRwaPerpsChartScope({ assetGroupSlug: null, selectedAssetGroup: 'All' }, 'S&P 500 Index')).toEqual({
			kind: 'baseAsset',
			slug: 'S&P 500 Index'
		})
	})
})
