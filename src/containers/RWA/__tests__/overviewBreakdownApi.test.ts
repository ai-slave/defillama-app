import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rwaOverviewBreakdown } from '~/containers/RWA/server/api'
import { parseOverviewBreakdownRequest } from '~/pages/api/public/rwa/overview-breakdown'
import { resultBody } from '~/server/api/__tests__/resultBody'

const mocks = vi.hoisted(() => ({
	fetchRWACategoryBreakdownChartData: vi.fn()
}))

vi.mock('~/containers/RWA/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/containers/RWA/api')>()
	return {
		...actual,
		fetchRWACategoryBreakdownChartData: mocks.fetchRWACategoryBreakdownChartData
	}
})

beforeEach(() => {
	vi.clearAllMocks()
})

describe('parseOverviewBreakdownRequest', () => {
	it('accepts platform requests when both flags are false', () => {
		expect(
			parseOverviewBreakdownRequest({
				query: {
					breakdown: 'platform',
					key: 'activeMcap',
					includeStablecoin: 'false',
					includeGovernance: 'false'
				}
			})
		).toEqual({
			breakdown: 'platform',
			key: 'activeMcap',
			includeStablecoin: false,
			includeGovernance: false,
			includeBridgeTvl: true
		})
	})

	it('accepts bridge exclusion with both classification flags enabled', () => {
		expect(
			parseOverviewBreakdownRequest({
				query: {
					breakdown: 'platform',
					key: 'activeMcap',
					includeStablecoin: 'true',
					includeGovernance: 'true',
					includeBridgeTvl: 'false'
				}
			})
		).toEqual({
			breakdown: 'platform',
			key: 'activeMcap',
			includeStablecoin: true,
			includeGovernance: true,
			includeBridgeTvl: false
		})
	})

	it('accepts category and asset group requests with mixed inclusion flags', () => {
		expect(
			parseOverviewBreakdownRequest({
				query: {
					breakdown: 'category',
					key: 'activeMcap',
					includeStablecoin: 'true',
					includeGovernance: 'false'
				}
			})
		).toEqual({
			breakdown: 'category',
			key: 'activeMcap',
			includeStablecoin: true,
			includeGovernance: false,
			includeBridgeTvl: true
		})

		expect(
			parseOverviewBreakdownRequest({
				query: {
					breakdown: 'assetGroup',
					key: 'activeMcap',
					includeStablecoin: 'false',
					includeGovernance: 'true'
				}
			})
		).toEqual({
			breakdown: 'assetGroup',
			key: 'activeMcap',
			includeStablecoin: false,
			includeGovernance: true,
			includeBridgeTvl: true
		})
	})

	it('rejects arrays and invalid enum values', () => {
		expect(
			parseOverviewBreakdownRequest({
				query: {
					breakdown: ['platform'],
					key: 'activeMcap',
					includeStablecoin: 'false',
					includeGovernance: 'false'
				}
			})
		).toBeNull()

		expect(
			parseOverviewBreakdownRequest({
				query: {
					breakdown: 'contract',
					key: 'activeMcap',
					includeStablecoin: 'false',
					includeGovernance: 'false'
				}
			})
		).toBeNull()

		expect(
			parseOverviewBreakdownRequest({
				query: {
					breakdown: 'platform',
					key: '',
					includeStablecoin: 'false',
					includeGovernance: 'false'
				}
			})
		).toBeNull()
	})
})

describe('rwaOverviewBreakdown', () => {
	it('returns serialized transformed breakdown data', async () => {
		const timestampMs = 1_774_483_200_000
		mocks.fetchRWACategoryBreakdownChartData.mockResolvedValue([{ timestamp: timestampMs, Treasuries: 42 }])

		const result = await rwaOverviewBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: {
				breakdown: 'category',
				key: 'activeMcap',
				includeStablecoin: 'false',
				includeGovernance: 'false'
			}
		})

		expect(result).toMatchObject({
			status: 200,
			serializedJson: expect.any(String),
			responseBytes: expect.any(Number),
			headers: { 'Content-Type': 'application/json; charset=utf-8' }
		})
		expect(resultBody(result)).toEqual({
			source: [[timestampMs, 42]],
			dimensions: ['timestamp', 'Treasuries']
		})
	})

	it('subtracts bridge TVL from excluded DeFi breakdown history', async () => {
		const timestampMs = 1_774_483_200_000
		mocks.fetchRWACategoryBreakdownChartData
			.mockResolvedValueOnce([{ timestamp: timestampMs, Treasuries: 42, Credit: 3 }])
			.mockResolvedValueOnce([{ timestamp: timestampMs, Treasuries: 2, Credit: 1 }])

		const result = await rwaOverviewBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: {
				breakdown: 'category',
				key: 'defiActiveTvl',
				includeStablecoin: 'false',
				includeGovernance: 'false',
				includeBridgeTvl: 'false'
			}
		})

		expect(mocks.fetchRWACategoryBreakdownChartData).toHaveBeenNthCalledWith(1, {
			key: 'defiActiveTvl',
			includeStablecoin: false,
			includeGovernance: false
		})
		expect(mocks.fetchRWACategoryBreakdownChartData).toHaveBeenNthCalledWith(2, {
			key: 'bridgeTvl',
			includeStablecoin: false,
			includeGovernance: false
		})
		expect(resultBody(result)).toEqual({
			source: [[timestampMs, 40, 2]],
			dimensions: ['timestamp', 'Treasuries', 'Credit']
		})
	})
})
