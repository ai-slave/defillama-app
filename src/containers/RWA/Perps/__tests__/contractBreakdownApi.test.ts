import { describe, expect, test } from 'vitest'
import { RWA_PERPS_SERVER_URL } from '~/constants'
import { parsePerpsContractBreakdownRequest, rwaPerpsContractBreakdown } from '~/containers/RWA/server/api'
import { resultBody } from '~/server/api/__tests__/resultBody'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'

const http = installFixtureFetch()

describe('parsePerpsContractBreakdownRequest', () => {
	test('accepts overview contract requests', () => {
		expect(
			parsePerpsContractBreakdownRequest({
				query: {
					key: 'markets'
				}
			})
		).toEqual({
			key: 'markets',
			target: { kind: 'all' },
			includeCex: false
		})
	})

	test('accepts venue, asset-group, asset-class, and asset-class exclusion targets', () => {
		expect(
			parsePerpsContractBreakdownRequest({
				query: {
					venue: ' xyz ',
					key: 'openInterest'
				}
			})
		).toEqual({
			key: 'openInterest',
			target: { kind: 'venue', slug: 'xyz' },
			includeCex: false
		})

		expect(
			parsePerpsContractBreakdownRequest({
				query: {
					assetGroup: 'US Equities',
					includeCex: 'true',
					key: 'volume24h'
				}
			})
		).toEqual({
			key: 'volume24h',
			target: { kind: 'assetGroup', slug: 'US Equities' },
			includeCex: true
		})

		expect(
			parsePerpsContractBreakdownRequest({
				query: {
					assetClass: 'Forex Perps',
					includeCex: 'true',
					key: 'markets'
				}
			})
		).toEqual({
			key: 'markets',
			target: { kind: 'assetClass', slug: 'Forex Perps' },
			includeCex: true
		})

		expect(
			parsePerpsContractBreakdownRequest({
				query: {
					excludeAssetClass: 'Forex Perps',
					key: 'markets'
				}
			})
		).toEqual({
			key: 'markets',
			target: { kind: 'excludeAssetClass', slug: 'Forex Perps' },
			includeCex: false
		})
	})

	test('rejects invalid query params', () => {
		expect(
			parsePerpsContractBreakdownRequest({
				query: {
					baseAsset: 'SK Hynix',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parsePerpsContractBreakdownRequest({
				query: {
					venue: ['xyz'],
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parsePerpsContractBreakdownRequest({
				query: {
					assetClass: 'Forex Perps',
					includeCex: 'yes',
					key: 'markets'
				}
			})
		).toBeNull()

		expect(
			parsePerpsContractBreakdownRequest({
				query: {
					assetClass: 'Forex Perps',
					excludeAssetClass: 'Forex Perps',
					key: 'markets'
				}
			})
		).toBeNull()

		expect(
			parsePerpsContractBreakdownRequest({
				query: {
					venue: 'xyz',
					assetClass: 'Forex Perps',
					key: 'markets'
				}
			})
		).toBeNull()

		expect(
			parsePerpsContractBreakdownRequest({
				query: {
					venue: 'xyz',
					assetGroup: 'US Equities',
					key: 'markets'
				}
			})
		).toBeNull()

		expect(
			parsePerpsContractBreakdownRequest({
				query: {
					key: 'activeMcap'
				}
			})
		).toBeNull()
	})
})

describe('rwaPerpsContractBreakdown', () => {
	test('returns serialized transformed contract breakdown data', async () => {
		http.serve({
			[`${RWA_PERPS_SERVER_URL}/chart/contract-breakdown`]: [{ timestamp: 1, 'KALSHI:SPY': 4, 'HL:AAPL': 9 }]
		})

		const result = await rwaPerpsContractBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: {
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
			source: [{ timestamp: 1000, 'KALSHI:SPY': 4, 'HL:AAPL': 9 }],
			dimensions: ['timestamp', 'HL:AAPL', 'KALSHI:SPY']
		})
	})
})
