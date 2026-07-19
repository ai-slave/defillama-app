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
			includeGovernance: false
		})
	})

	it('accepts platform requests when both flags are true', () => {
		expect(
			parseOverviewBreakdownRequest({
				query: {
					breakdown: 'platform',
					key: 'activeMcap',
					includeStablecoin: 'true',
					includeGovernance: 'true'
				}
			})
		).toEqual({
			breakdown: 'platform',
			key: 'activeMcap',
			includeStablecoin: true,
			includeGovernance: true
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
			includeGovernance: false
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
			includeGovernance: true
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
			source: [{ timestamp: timestampMs, Treasuries: 42 }],
			dimensions: ['timestamp', 'Treasuries']
		})
	})
})
