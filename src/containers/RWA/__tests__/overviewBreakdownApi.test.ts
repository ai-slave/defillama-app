import { beforeEach, describe, expect, test, vi } from 'vitest'
import { parseRWAOverviewBreakdownRequest, rwaOverviewBreakdown } from '~/containers/RWA/server/api'
import { resultBody } from '~/server/api/__tests__/resultBody'

const upstream = vi.hoisted(() => ({
	rowsByKey: {} as Record<string, Array<Record<string, number>>>,
	requests: [] as Array<string>
}))

vi.mock('~/utils/async', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/async')>()),
	fetchJson: async (url: string) => {
		const { pathname, search, searchParams } = new URL(url)
		if (!pathname.endsWith('/chart/category-breakdown')) throw new Error(`Unrouted upstream request: ${url}`)
		upstream.requests.push(search)
		return upstream.rowsByKey[searchParams.get('key') ?? 'onChainMcap']
	}
}))

beforeEach(() => {
	upstream.rowsByKey = {}
	upstream.requests = []
})

// The RWA server reports seconds; the route answers in milliseconds.
const timestampSeconds = 1_774_483_200
const timestampMs = timestampSeconds * 1000

describe('parseRWAOverviewBreakdownRequest', () => {
	test('accepts platform requests when both flags are false', () => {
		expect(
			parseRWAOverviewBreakdownRequest({
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

	test('accepts bridge exclusion with both classification flags enabled', () => {
		expect(
			parseRWAOverviewBreakdownRequest({
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

	test.each(['chain', 'category', 'platform', 'assetGroup'])(
		'accepts %s requests with mixed inclusion flags',
		(breakdown) => {
			expect(
				parseRWAOverviewBreakdownRequest({
					query: { breakdown, key: 'activeMcap', includeStablecoin: 'true', includeGovernance: 'false' }
				})
			).toEqual({
				breakdown,
				key: 'activeMcap',
				includeStablecoin: true,
				includeGovernance: false,
				includeBridgeTvl: true
			})
		}
	)

	test('rejects arrays and invalid enum values', () => {
		expect(
			parseRWAOverviewBreakdownRequest({
				query: {
					breakdown: ['platform'],
					key: 'activeMcap',
					includeStablecoin: 'false',
					includeGovernance: 'false'
				}
			})
		).toBeNull()

		expect(
			parseRWAOverviewBreakdownRequest({
				query: {
					breakdown: 'contract',
					key: 'activeMcap',
					includeStablecoin: 'false',
					includeGovernance: 'false'
				}
			})
		).toBeNull()

		expect(
			parseRWAOverviewBreakdownRequest({
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
	test('returns serialized transformed breakdown data', async () => {
		upstream.rowsByKey.activeMcap = [{ timestamp: timestampSeconds, Treasuries: 42 }]

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

	test('subtracts bridge TVL from excluded DeFi breakdown history', async () => {
		upstream.rowsByKey.defiActiveTvl = [{ timestamp: timestampSeconds, Treasuries: 42, Credit: 3 }]
		upstream.rowsByKey.bridgeTvl = [{ timestamp: timestampSeconds, Treasuries: 2, Credit: 1 }]

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

		expect(upstream.requests.sort()).toEqual(['?key=bridgeTvl', '?key=defiActiveTvl'])
		expect(resultBody(result)).toEqual({
			source: [[timestampMs, 40, 2]],
			dimensions: ['timestamp', 'Treasuries', 'Credit']
		})
	})
})
