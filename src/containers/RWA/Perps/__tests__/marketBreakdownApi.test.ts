import { beforeEach, describe, expect, it, vi } from 'vitest'
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
	it('accepts all, asset-class, and asset-class exclusion targets', () => {
		expect(
			parseMarketBreakdownRequest({
				query: {
					key: 'openInterest'
				}
			})
		).toEqual({
			key: 'openInterest'
		})

		expect(
			parseMarketBreakdownRequest({
				query: {
					assetClass: 'Forex Perps',
					key: 'markets'
				}
			})
		).toEqual({
			assetClass: 'Forex Perps',
			key: 'markets'
		})

		expect(
			parseMarketBreakdownRequest({
				query: {
					excludeAssetClass: 'Forex Perps',
					key: 'volume24h'
				}
			})
		).toEqual({
			excludeAssetClass: 'Forex Perps',
			key: 'volume24h'
		})
	})

	it('rejects invalid metrics and unsupported targets', () => {
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
					venue: 'xyz',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parseMarketBreakdownRequest({
				query: {
					assetGroup: 'Equities',
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
	})
})

describe('rwaPerpsMarketBreakdown', () => {
	it('returns serialized transformed market breakdown data', async () => {
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
