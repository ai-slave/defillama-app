import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rwaPerpsOverviewBreakdown } from '~/containers/RWA/server/api'
import { parseOverviewBreakdownRequest } from '~/pages/api/public/rwa/perps/overview-breakdown'
import { resultBody } from '~/server/api/__tests__/resultBody'

const mocks = vi.hoisted(() => ({
	fetchRWAPerpsOverviewBreakdownChartData: vi.fn()
}))

vi.mock('~/containers/RWA/Perps/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/containers/RWA/Perps/api')>()
	return {
		...actual,
		fetchRWAPerpsOverviewBreakdownChartData: mocks.fetchRWAPerpsOverviewBreakdownChartData
	}
})

beforeEach(() => {
	vi.clearAllMocks()
})

describe('parseOverviewBreakdownRequest', () => {
	it('accepts overview requests without a target', () => {
		expect(
			parseOverviewBreakdownRequest({
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

	it('accepts venue-targeted requests', () => {
		expect(
			parseOverviewBreakdownRequest({
				query: {
					venue: ' xyz ',
					breakdown: 'baseAsset',
					key: 'volume24h'
				}
			})
		).toEqual({
			breakdown: 'baseAsset',
			key: 'volume24h',
			target: { kind: 'venue', slug: 'xyz' },
			includeCex: false
		})
	})

	it('accepts asset-group-targeted requests', () => {
		expect(
			parseOverviewBreakdownRequest({
				query: {
					assetGroup: 'US Equities',
					includeCex: 'true',
					breakdown: 'venue',
					key: 'markets'
				}
			})
		).toEqual({
			breakdown: 'venue',
			key: 'markets',
			target: { kind: 'assetGroup', slug: 'US Equities' },
			includeCex: true
		})
	})

	it('accepts asset-class-targeted requests', () => {
		expect(
			parseOverviewBreakdownRequest({
				query: {
					assetClass: 'Forex Perps',
					includeCex: 'true',
					breakdown: 'assetGroup',
					key: 'openInterest'
				}
			})
		).toEqual({
			breakdown: 'assetGroup',
			key: 'openInterest',
			target: { kind: 'assetClass', slug: 'Forex Perps' },
			includeCex: true
		})
	})

	it('accepts asset-class exclusion requests', () => {
		expect(
			parseOverviewBreakdownRequest({
				query: {
					excludeAssetClass: 'Forex Perps',
					breakdown: 'assetGroup',
					key: 'openInterest'
				}
			})
		).toEqual({
			breakdown: 'assetGroup',
			key: 'openInterest',
			target: { kind: 'excludeAssetClass', slug: 'Forex Perps' },
			includeCex: false
		})
	})

	it('rejects the retired venueType query', () => {
		expect(
			parseOverviewBreakdownRequest({
				query: {
					breakdown: 'assetGroup',
					key: 'openInterest',
					venueType: 'DEX'
				}
			})
		).toBeNull()
	})

	it('rejects contract breakdowns and invalid target combinations', () => {
		expect(
			parseOverviewBreakdownRequest({
				query: {
					breakdown: 'contract',
					key: 'markets'
				}
			})
		).toBeNull()

		expect(
			parseOverviewBreakdownRequest({
				query: {
					assetGroup: 'US Equities',
					includeCex: 'yes',
					breakdown: 'venue',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parseOverviewBreakdownRequest({
				query: {
					venue: 'xyz',
					breakdown: 'venue',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parseOverviewBreakdownRequest({
				query: {
					assetGroup: 'US Equities',
					breakdown: 'assetGroup',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parseOverviewBreakdownRequest({
				query: {
					assetGroup: 'US Equities',
					assetClass: 'Forex Perps',
					breakdown: 'baseAsset',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parseOverviewBreakdownRequest({
				query: {
					assetClass: 'Forex Perps',
					excludeAssetClass: 'Forex Perps',
					breakdown: 'baseAsset',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parseOverviewBreakdownRequest({
				query: {
					venue: 'xyz',
					assetGroup: 'US Equities',
					breakdown: 'baseAsset',
					key: 'openInterest'
				}
			})
		).toBeNull()

		expect(
			parseOverviewBreakdownRequest({
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
	it('returns serialized transformed breakdown data', async () => {
		mocks.fetchRWAPerpsOverviewBreakdownChartData.mockResolvedValue([{ timestamp: 1, Hyperliquid: 3, GMX: 5 }])

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
