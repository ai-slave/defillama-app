import { describe, expect, test } from 'vitest'
import { RWA_PERPS_SERVER_URL } from '~/constants'
import { parsePerpsOverviewBreakdownRequest, rwaPerpsOverviewBreakdown } from '~/containers/RWA/server/api'
import { resultBody } from '~/server/api/__tests__/resultBody'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'

const http = installFixtureFetch()

describe('parsePerpsOverviewBreakdownRequest', () => {
	test('accepts overview requests without a target', () => {
		expect(
			parsePerpsOverviewBreakdownRequest({
				query: {
					breakdown: 'assetGroup',
					key: 'openInterest'
				}
			})
		).toEqual({
			breakdown: 'assetGroup',
			key: 'openInterest',
			target: { kind: 'all' },
			includeCex: false
		})
	})

	test.each([
		{ query: { venue: ' xyz ' }, target: { kind: 'venue', slug: 'xyz' } },
		{ query: { assetGroup: 'US Equities' }, target: { kind: 'assetGroup', slug: 'US Equities' } },
		{ query: { assetClass: 'Forex Perps' }, target: { kind: 'assetClass', slug: 'Forex Perps' } },
		{ query: { excludeAssetClass: 'Forex Perps' }, target: { kind: 'excludeAssetClass', slug: 'Forex Perps' } }
	])('accepts $target.kind-targeted requests', ({ query, target }) => {
		expect(
			parsePerpsOverviewBreakdownRequest({
				query: { ...query, includeCex: 'true', breakdown: 'baseAsset', key: 'volume24h' }
			})
		).toEqual({ breakdown: 'baseAsset', key: 'volume24h', target, includeCex: true })
	})

	test('rejects the retired venueType query', () => {
		expect(
			parsePerpsOverviewBreakdownRequest({
				query: {
					breakdown: 'assetGroup',
					key: 'openInterest',
					venueType: 'DEX'
				}
			})
		).toBeNull()
	})

	test('rejects contract breakdowns and invalid target combinations', () => {
		expect(
			parsePerpsOverviewBreakdownRequest({
				query: {
					baseAsset: 'SK Hynix',
					breakdown: 'venue',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parsePerpsOverviewBreakdownRequest({
				query: {
					breakdown: 'contract',
					key: 'markets'
				}
			})
		).toBeNull()

		expect(
			parsePerpsOverviewBreakdownRequest({
				query: {
					assetGroup: 'US Equities',
					includeCex: 'yes',
					breakdown: 'venue',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parsePerpsOverviewBreakdownRequest({
				query: {
					venue: 'xyz',
					breakdown: 'venue',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parsePerpsOverviewBreakdownRequest({
				query: {
					assetGroup: 'US Equities',
					breakdown: 'assetGroup',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parsePerpsOverviewBreakdownRequest({
				query: {
					assetGroup: 'US Equities',
					assetClass: 'Forex Perps',
					breakdown: 'baseAsset',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parsePerpsOverviewBreakdownRequest({
				query: {
					assetClass: 'Forex Perps',
					excludeAssetClass: 'Forex Perps',
					breakdown: 'baseAsset',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parsePerpsOverviewBreakdownRequest({
				query: {
					venue: 'xyz',
					assetGroup: 'US Equities',
					breakdown: 'baseAsset',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parsePerpsOverviewBreakdownRequest({
				query: {
					venue: '   ',
					breakdown: 'baseAsset',
					key: 'openInterest'
				}
			})
		).toBeNull()
	})
})

describe('rwaPerpsOverviewBreakdown', () => {
	test('returns serialized transformed breakdown data', async () => {
		http.serve({ [`${RWA_PERPS_SERVER_URL}/chart/overview-breakdown`]: [{ timestamp: 1, Hyperliquid: 3, GMX: 5 }] })

		const result = await rwaPerpsOverviewBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: {
				breakdown: 'venue',
				key: 'openInterest'
			}
		})

		expect(result).toMatchObject({
			status: 200,
			serializedJson: expect.any(String),
			responseBytes: expect.any(Number),
			headers: { 'Content-Type': 'application/json; charset=utf-8' }
		})
		expect(resultBody(result)).toEqual({
			source: [{ timestamp: 1000, Hyperliquid: 3, GMX: 5 }],
			dimensions: ['timestamp', 'GMX', 'Hyperliquid']
		})
	})
})
