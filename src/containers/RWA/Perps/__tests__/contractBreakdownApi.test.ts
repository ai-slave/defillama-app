import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rwaPerpsContractBreakdown } from '~/containers/RWA/server/api'
import { parseContractBreakdownRequest } from '~/pages/api/public/rwa/perps/contract-breakdown'
import { resultBody } from '~/server/api/__tests__/resultBody'

const mocks = vi.hoisted(() => ({
	fetchRWAPerpsContractBreakdownChartData: vi.fn()
}))

vi.mock('~/containers/RWA/Perps/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/containers/RWA/Perps/api')>()
	return {
		...actual,
		fetchRWAPerpsContractBreakdownChartData: mocks.fetchRWAPerpsContractBreakdownChartData
	}
})

beforeEach(() => {
	vi.clearAllMocks()
})

describe('parseContractBreakdownRequest', () => {
	it('accepts overview contract requests', () => {
		expect(
			parseContractBreakdownRequest({
				query: {
					key: 'markets'
				}
			})
		).toEqual({
			key: 'markets',
			target: { kind: 'all' }
		})
	})

	it('accepts venue, asset-group, asset-class, and asset-class exclusion targets', () => {
		expect(
			parseContractBreakdownRequest({
				query: {
					venue: ' xyz ',
					key: 'openInterest'
				}
			})
		).toEqual({
			key: 'openInterest',
			target: { kind: 'venue', slug: 'xyz' }
		})

		expect(
			parseContractBreakdownRequest({
				query: {
					assetGroup: 'US Equities',
					key: 'volume24h'
				}
			})
		).toEqual({
			key: 'volume24h',
			target: { kind: 'assetGroup', slug: 'US Equities' }
		})

		expect(
			parseContractBreakdownRequest({
				query: {
					assetClass: 'Forex Perps',
					key: 'markets'
				}
			})
		).toEqual({
			key: 'markets',
			target: { kind: 'assetClass', slug: 'Forex Perps' }
		})

		expect(
			parseContractBreakdownRequest({
				query: {
					excludeAssetClass: 'Forex Perps',
					key: 'markets'
				}
			})
		).toEqual({
			key: 'markets',
			target: { kind: 'excludeAssetClass', slug: 'Forex Perps' }
		})
	})

	it('rejects invalid query params', () => {
		expect(
			parseContractBreakdownRequest({
				query: {
					venue: ['xyz'],
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parseContractBreakdownRequest({
				query: {
					assetClass: 'Forex Perps',
					excludeAssetClass: 'Forex Perps',
					key: 'markets'
				}
			})
		).toBeNull()

		expect(
			parseContractBreakdownRequest({
				query: {
					venue: 'xyz',
					assetClass: 'Forex Perps',
					key: 'markets'
				}
			})
		).toBeNull()

		expect(
			parseContractBreakdownRequest({
				query: {
					venue: 'xyz',
					assetGroup: 'US Equities',
					key: 'markets'
				}
			})
		).toBeNull()

		expect(
			parseContractBreakdownRequest({
				query: {
					key: 'activeMcap'
				}
			})
		).toBeNull()
	})
})

describe('rwaPerpsContractBreakdown', () => {
	it('returns serialized transformed contract breakdown data', async () => {
		mocks.fetchRWAPerpsContractBreakdownChartData.mockResolvedValue([{ timestamp: 1, 'KALSHI:SPY': 4, 'HL:AAPL': 9 }])

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
