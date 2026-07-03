import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rwaAssetBreakdown } from '~/containers/RWA/server/api'
import {
	buildAssetBreakdownUrl,
	normalizeAssetBreakdownRows,
	parseAssetBreakdownRequest
} from '~/pages/api/public/rwa/asset-breakdown'
import { resultBody } from '~/server/api/__tests__/resultBody'

const mocks = vi.hoisted(() => ({
	fetchJson: vi.fn()
}))

vi.mock('~/utils/async', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/utils/async')>()
	return {
		...actual,
		fetchJson: mocks.fetchJson
	}
})

beforeEach(() => {
	vi.clearAllMocks()
})

describe('parseAssetBreakdownRequest', () => {
	it('rejects requests when inclusion flags are omitted', () => {
		expect(
			parseAssetBreakdownRequest({
				query: {
					category: 'rwa-yield-wrapper',
					key: 'activeMcap'
				}
			})
		).toBeNull()
	})

	it('accepts explicit true and false inclusion flags', () => {
		expect(
			parseAssetBreakdownRequest({
				query: {
					platform: 'ondo',
					key: 'onChainMcap',
					includeStablecoin: 'true',
					includeGovernance: 'false'
				}
			})
		).toEqual({
			target: { kind: 'platform', slug: 'ondo' },
			key: 'onChainMcap',
			includeStablecoin: true,
			includeGovernance: false
		})
	})

	it('accepts all-target requests when no route target is present', () => {
		expect(
			parseAssetBreakdownRequest({
				query: {
					key: 'onChainMcap',
					includeStablecoin: 'false',
					includeGovernance: 'false'
				}
			})
		).toEqual({
			target: { kind: 'all' },
			key: 'onChainMcap',
			includeStablecoin: false,
			includeGovernance: false
		})
	})

	it('rejects arrays, blanks, invalid enums, and multiple route targets', () => {
		expect(
			parseAssetBreakdownRequest({
				query: {
					platform: ['ondo'],
					key: 'onChainMcap',
					includeStablecoin: 'true',
					includeGovernance: 'false'
				}
			})
		).toBeNull()

		expect(
			parseAssetBreakdownRequest({
				query: {
					chain: '',
					key: 'onChainMcap',
					includeStablecoin: 'true',
					includeGovernance: 'false'
				}
			})
		).toBeNull()

		expect(
			parseAssetBreakdownRequest({
				query: {
					chain: '   ',
					platform: 'ondo',
					key: 'onChainMcap',
					includeStablecoin: 'true',
					includeGovernance: 'false'
				}
			})
		).toBeNull()

		expect(
			parseAssetBreakdownRequest({
				query: {
					platform: 'ondo',
					key: 'bad-metric',
					includeStablecoin: 'true',
					includeGovernance: 'false'
				}
			})
		).toBeNull()

		expect(
			parseAssetBreakdownRequest({
				query: {
					platform: 'ondo',
					category: 'treasuries',
					key: 'onChainMcap',
					includeStablecoin: 'true',
					includeGovernance: 'false'
				}
			})
		).toBeNull()
	})
})

describe('rwaAssetBreakdown', () => {
	it('returns serialized normalized rows for the requested metric', async () => {
		mocks.fetchJson.mockResolvedValue({
			onChainMcap: [
				{ timestamp: 2, Alpha: 20 },
				{ timestamp: 1, Alpha: 10 }
			]
		})

		const result = await rwaAssetBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: {
				key: 'onChainMcap',
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
		expect(resultBody(result)).toEqual([
			{ timestamp: 1000, Alpha: 10 },
			{ timestamp: 2000, Alpha: 20 }
		])
	})
})

describe('buildAssetBreakdownUrl', () => {
	it('forwards both inclusion flags to the upstream asset-breakdown endpoint', () => {
		expect(
			buildAssetBreakdownUrl({
				target: { kind: 'category', slug: 'rwa-yield-wrapper' },
				key: 'defiActiveTvl',
				includeStablecoin: false,
				includeGovernance: true
			})
		).toContain('/chart/category/rwa-yield-wrapper/asset-breakdown?includeStablecoin=false&includeGovernance=true')
	})

	it('uses the category asset-breakdown endpoint for other-rwas category data', () => {
		expect(
			buildAssetBreakdownUrl({
				target: { kind: 'category', slug: 'other-rwas' },
				key: 'activeMcap',
				includeStablecoin: true,
				includeGovernance: true
			})
		).toContain('/chart/category/other-rwas/asset-breakdown?includeStablecoin=true&includeGovernance=true')
	})
})

describe('normalizeAssetBreakdownRows', () => {
	it('normalizes timestamps and sorts rows chronologically for the requested metric', () => {
		expect(
			normalizeAssetBreakdownRows([
				{ timestamp: 2, alpha: 20 },
				{ timestamp: 1, alpha: 10 }
			])
		).toEqual([
			{ timestamp: 1000, alpha: 10 },
			{ timestamp: 2000, alpha: 20 }
		])
	})
})
