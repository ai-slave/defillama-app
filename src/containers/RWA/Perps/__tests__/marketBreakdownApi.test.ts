import { beforeEach, describe, expect, test, vi } from 'vitest'
import { rwaPerpsMarketBreakdown } from '~/containers/RWA/server/api'
import { parseMarketBreakdownRequest } from '~/pages/api/public/rwa/perps/market-breakdown'
import { resultBody } from '~/server/api/__tests__/resultBody'

const mocks = vi.hoisted(() => ({
	fetchRWAPerpsMarketBreakdownChartData: vi.fn()
}))

vi.mock('~/containers/RWA/Perps/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/containers/RWA/Perps/api')>()
	return {
		...actual,
		fetchRWAPerpsMarketBreakdownChartData: mocks.fetchRWAPerpsMarketBreakdownChartData
	}
})

beforeEach(() => {
	vi.clearAllMocks()
})

describe('parseMarketBreakdownRequest', () => {
	test('accepts every bounded backend target', () => {
		expect(
			parseMarketBreakdownRequest({
				query: {
					key: 'openInterest'
				}
			})
		).toEqual({
			key: 'openInterest',
			target: { kind: 'all' },
			includeCex: false
		})

		expect(
			parseMarketBreakdownRequest({
				query: {
					venue: 'xyz',
					key: 'openInterest'
				}
			})
		).toEqual({
			key: 'openInterest',
			target: { kind: 'venue', slug: 'xyz' },
			includeCex: false
		})

		expect(
			parseMarketBreakdownRequest({
				query: {
					assetGroup: 'Equities',
					includeCex: 'true',
					key: 'openInterest'
				}
			})
		).toEqual({
			key: 'openInterest',
			target: { kind: 'assetGroup', slug: 'Equities' },
			includeCex: true
		})

		expect(
			parseMarketBreakdownRequest({
				query: {
					assetClass: 'Forex Perps',
					key: 'markets'
				}
			})
		).toEqual({
			key: 'markets',
			target: { kind: 'assetClass', slug: 'Forex Perps' },
			includeCex: false
		})

		expect(
			parseMarketBreakdownRequest({
				query: {
					excludeAssetClass: 'Forex Perps',
					key: 'volume24h'
				}
			})
		).toEqual({
			key: 'volume24h',
			target: { kind: 'excludeAssetClass', slug: 'Forex Perps' },
			includeCex: false
		})

		expect(
			parseMarketBreakdownRequest({
				query: {
					baseAsset: 'SK Hynix',
					includeCex: 'true',
					key: 'openInterest'
				}
			})
		).toEqual({
			key: 'openInterest',
			target: { kind: 'baseAsset', slug: 'SK Hynix' },
			includeCex: true
		})
	})

	test('rejects invalid metrics and conflicting targets', () => {
		expect(
			parseMarketBreakdownRequest({
				query: {
					key: 'activeMcap'
				}
			})
		).toBeNull()

		expect(
			parseMarketBreakdownRequest({
				query: {
					baseAsset: 'SK Hynix',
					venue: 'Binance',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parseMarketBreakdownRequest({
				query: {
					assetClass: 'Forex Perps',
					excludeAssetClass: 'Forex Perps',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parseMarketBreakdownRequest({
				query: {
					assetGroup: 'Equities',
					includeCex: 'yes',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parseMarketBreakdownRequest({
				query: {
					assetClass: 'Forex Perps',
					includeCex: ['true'],
					key: 'openInterest'
				}
			})
		).toBeNull()
	})
})

describe('rwaPerpsMarketBreakdown', () => {
	test('returns serialized transformed market breakdown data', async () => {
		mocks.fetchRWAPerpsMarketBreakdownChartData.mockResolvedValue([{ timestamp: 1, 'alpha:aapl': 4, 'beta:aapl': 9 }])

		const result = await rwaPerpsMarketBreakdown.handle({
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
			source: [{ timestamp: 1000, 'alpha:aapl': 4, 'beta:aapl': 9 }],
			dimensions: ['timestamp', 'beta:aapl', 'alpha:aapl']
		})
	})
})
