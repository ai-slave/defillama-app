import { describe, expect, test } from 'vitest'
import { meta } from '../../PlatformPage/__tests__/platformFixture'
import { perpsAsset, spotAsset } from '../../table/__tests__/fixtures'
import {
	getRwaVenueCountedMarkets,
	getRwaVenueSpotHref,
	getRwaVenueType,
	sumRwaPerpsOpenInterestByVenueType,
	summarizeRwaVenueMarkets
} from '../venueData'

describe('summarizeRwaVenueMarkets', () => {
	const rows = [
		spotAsset(),
		perpsAsset({ id: 'a', assetGroup: 'Equity Indices', openInterest: 400, assetClass: ['Stock Perp'] }),
		perpsAsset({ id: 'b', assetGroup: 'Equity Indices', openInterest: 100, assetClass: ['Stock Perp'] }),
		perpsAsset({ id: 'c', assetGroup: 'Fiat Currencies', openInterest: 300, assetClass: ['Forex Perps'] }),
		perpsAsset({ id: 'd', assetGroup: 'Metals', openInterest: 50, volume24h: 0, maxLeverage: 200 }),
		perpsAsset({ id: 'e', assetGroup: 'Energy', openInterest: 20, volume24h: null, oracleProvider: 'Stork' }),
		perpsAsset({ id: 'f', assetGroup: 'Rates', openInterest: 10, fundingIntervalHours: 1 }),
		perpsAsset({ id: 'g', assetGroup: 'Crypto', openInterest: 5, marginAsset: 'USDT' })
	]
	const summary = summarizeRwaVenueMarkets(rows)

	test('ranks open interest by asset group, five shown and the rest folded into Others', () => {
		const { shown, others } = summary.openInterestByAssetGroup
		expect(shown.map(({ name, value }) => [name, value])).toEqual([
			['Equity Indices', 500],
			['Fiat Currencies', 300],
			['Metals', 50],
			['Energy', 20],
			['Rates', 10]
		])
		expect(others).toMatchObject({ count: 1, value: 5 })
	})

	test('leaves out an asset group whose markets carry no open interest instead of ranking it at $0', () => {
		const { shown, others } = summarizeRwaVenueMarkets([
			perpsAsset({ id: 'a', assetGroup: 'Metals', openInterest: 50 }),
			perpsAsset({ id: 'b', assetGroup: 'Energy', openInterest: null })
		]).openInterestByAssetGroup
		expect(shown.map(({ name }) => name)).toEqual(['Metals'])
		expect(others).toBeNull()
	})

	test('gives every asset group row, Others included, its share of all open interest for the bar', () => {
		const shares = summarizeRwaVenueMarkets([
			perpsAsset({ id: 'a', assetGroup: 'Public Equities', openInterest: 600 }),
			perpsAsset({ id: 'b', assetGroup: 'Oil', openInterest: 250 }),
			...['Metals', 'Energy', 'Rates', 'Crypto', 'Credit'].map((group, index) =>
				perpsAsset({ id: `g${index}`, assetGroup: group, openInterest: 30 })
			)
		]).openInterestByAssetGroup
		expect(shares.shown.map((entry) => entry.share)).toEqual([60, 25, 3, 3, 3])
		expect(shares.others).toEqual({ count: 2, value: 60, share: 6 })
		expect(summarizeRwaVenueMarkets([perpsAsset({ openInterest: 0 })]).openInterestByAssetGroup.shown[0].share).toBe(0)
	})

	test('counts markets per asset class and lists the distinct contract terms', () => {
		expect(summary.assetClasses).toEqual([
			{ name: 'Bond Perp', count: 4 },
			{ name: 'Stock Perp', count: 2 },
			{ name: 'Forex Perps', count: 1 }
		])
		expect(summary.marginAssets).toEqual(['USDC', 'USDT'])
		expect(summary.oracleProviders).toEqual({ shown: ['Stork'], more: 0, full: ['Stork'] })
		expect(summary.maxLeverage).toEqual({ min: 50, max: 200 })
		expect(summary.fundingIntervalHours).toEqual([1, 8])
		expect(summary.accessModels).toEqual(['Permissionless'])
	})
})

describe('the oracle providers the Markets panel names', () => {
	test('shortens each methodology to its provider, ranks by markets, shows two and keeps the full list', () => {
		const oracle = (id: string, oracleProvider: string) => perpsAsset({ id, oracleProvider })
		const { oracleProviders } = summarizeRwaVenueMarkets([
			oracle('a', 'Pyth equity feed'),
			oracle('b', 'Pyth equity feed'),
			oracle('c', 'Pyth equity feed'),
			oracle('d', 'Pyth Lazer, Chainlink and ICE at equal weights'),
			oracle('e', 'Pyth Lazer'),
			oracle('f', 'Internal (Hyperp-style); 30-min EWMA of prior-day mark prices'),
			oracle('g', 'Stork / QUODD'),
			oracle('h', 'Pyth / external FX reference methodology')
		])
		expect(oracleProviders.shown).toEqual(['Pyth equity feed', 'Pyth Lazer'])
		expect(oracleProviders.more).toBe(3)
		expect(oracleProviders.full).toEqual([
			'Pyth equity feed',
			'Pyth Lazer',
			'Pyth Lazer, Chainlink and ICE at equal weights',
			'Internal (Hyperp-style); 30-min EWMA of prior-day mark prices',
			'Pyth / external FX reference methodology',
			'Stork / QUODD'
		])
	})

	test('shows the whole text of each methodology when the venue has one or two', () => {
		const { oracleProviders } = summarizeRwaVenueMarkets([
			perpsAsset({ id: 'a', oracleProvider: 'Stork / QUODD' }),
			perpsAsset({ id: 'b', oracleProvider: 'Stork / QUODD' })
		])
		expect(oracleProviders).toEqual({ shown: ['Stork / QUODD'], more: 0, full: ['Stork / QUODD'] })
		expect(
			summarizeRwaVenueMarkets([
				perpsAsset({ id: 'a', oracleProvider: 'MEXC per-contract indexOrigin, Binance, OKX' }),
				perpsAsset({ id: 'b', oracleProvider: 'Pyth Lazer' })
			]).oracleProviders.shown
		).toEqual(['MEXC per-contract indexOrigin, Binance, OKX', 'Pyth Lazer'])
	})

	test('names none when no market names an oracle', () => {
		expect(summarizeRwaVenueMarkets([perpsAsset()]).oracleProviders).toEqual({ shown: [], more: 0, full: [] })
	})
})

describe('the venue type and the open interest of its peers', () => {
	const markets = [
		perpsAsset({ id: 'a', openInterest: 400 }),
		perpsAsset({ id: 'b', openInterest: 100, suspicious: true }),
		perpsAsset({ id: 'c', venueType: 'CEX', openInterest: 300 }),
		perpsAsset({ id: 'd', venueType: 'CEX', openInterest: null })
	]

	test('sums open interest per venue type over every counted market, suspicious ones left out as on the card', () => {
		expect(sumRwaPerpsOpenInterestByVenueType(markets)).toEqual({ DEX: 400, CEX: 300 })
		expect(sumRwaPerpsOpenInterestByVenueType([])).toEqual({ DEX: null, CEX: null })
	})

	test('reads the venue type its markets name, or none', () => {
		expect(getRwaVenueType([perpsAsset({ venueType: 'CEX' })])).toBe('CEX')
		expect(getRwaVenueType([spotAsset()])).toBeNull()
	})
})

describe('the spot link', () => {
	test('links the platform page only when the platform holds spot AUM', () => {
		expect(getRwaVenueSpotHref(meta({ slug: 'ostium', onchainAum: 1000 }))).toBe('/rwa/platform/ostium')
		expect(getRwaVenueSpotHref(meta({ slug: 'ostium', onchainAum: 0, activeAum: 10 }))).toBe('/rwa/platform/ostium')
		expect(getRwaVenueSpotHref(meta({ slug: 'ostium', onchainAum: 0, activeAum: 0 }))).toBeNull()
		expect(getRwaVenueSpotHref(null)).toBeNull()
	})
})

describe('getRwaVenueCountedMarkets', () => {
	test('leaves suspicious markets out of what the card and the panels count', () => {
		const counted = getRwaVenueCountedMarkets([
			perpsAsset({ id: 'a' }),
			perpsAsset({ id: 'b', suspicious: true }),
			perpsAsset({ id: 'c' })
		])
		expect(counted.map((market) => market.id)).toEqual(['a', 'c'])
	})
})
