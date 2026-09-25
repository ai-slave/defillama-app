import { beforeEach, describe, expect, test, vi } from 'vitest'
import { parseAssetBreakdownRequest, rwaAssetBreakdown } from '~/containers/RWA/server/api'
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
	test('rejects requests when inclusion flags are omitted', () => {
		expect(
			parseAssetBreakdownRequest({
				query: {
					category: 'rwa-yield-wrapper',
					key: 'activeMcap'
				}
			})
		).toBeNull()
	})

	test('accepts explicit true and false inclusion flags', () => {
		expect(
			parseAssetBreakdownRequest({
				query: {
					platform: 'ondo',
					key: 'onChainMcap',
					includeStablecoin: 'true',
					includeGovernance: 'false',
					includeBridgeTvl: 'false'
				}
			})
		).toEqual({
			target: { kind: 'platform', slug: 'ondo' },
			key: 'onChainMcap',
			includeStablecoin: true,
			includeGovernance: false,
			includeBridgeTvl: false
		})
	})

	test('accepts all-target requests when no route target is present', () => {
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
			includeGovernance: false,
			includeBridgeTvl: true
		})
	})

	test('rejects arrays, blanks, invalid enums, and multiple route targets', () => {
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
	test('returns serialized normalized rows for the requested metric', async () => {
		mocks.fetchJson.mockResolvedValue([
			{ timestamp: 1, Alpha: 10 },
			{ timestamp: 2, Alpha: 20 }
		])

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

	test('subtracts bridge rows for the excluded DeFi TVL cache variant', async () => {
		mocks.fetchJson.mockImplementation((url: string) =>
			Promise.resolve(
				url.endsWith('key=bridgeTvl') ? [{ timestamp: 3, Alpha: 7 }] : [{ timestamp: 3, Alpha: 20, Beta: 5 }]
			)
		)

		const result = await rwaAssetBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: {
				key: 'defiActiveTvl',
				includeStablecoin: 'false',
				includeGovernance: 'false',
				includeBridgeTvl: 'false'
			}
		})

		expect(resultBody(result)).toEqual([{ timestamp: 3000, Alpha: 13, Beta: 5 }])
	})
})
