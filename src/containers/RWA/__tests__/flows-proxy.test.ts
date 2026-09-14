import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchRWAFlowAssetBreakdown, fetchRWAFlowsAssetGroup, fetchRWAFlowsOverview } from '../api'
import {
	useRWAAssetFlows,
	useRWAFlowAssetBreakdown,
	useRWAFlowOverviewSplitWithFilters,
	useRWAFlowSeries,
	useRWAFlowSummary
} from '../flows.hooks'
import { buildRWAFlowProxyUrl, rwaFlowsProxy } from '../server/flows'

const useQueryMock = vi.fn((options) => options)
const fetchJsonMock = vi.fn()

vi.mock('@tanstack/react-query', () => ({
	useQuery: (options: unknown) => useQueryMock(options)
}))

vi.mock('~/utils/async', () => ({
	fetchJson: (...args: Array<unknown>) => fetchJsonMock(...args)
}))

beforeEach(() => {
	useQueryMock.mockClear()
	fetchJsonMock.mockReset()
})

describe('RWA flow browser routes', () => {
	test('fetches every flow scope through the local public API', async () => {
		useRWAFlowSummary()
		useRWAAssetFlows('ondo/usdy', true)
		useRWAFlowOverviewSplitWithFilters('assetGroup', true, false, true)
		useRWAFlowAssetBreakdown({ kind: 'assetGroup', slug: 'Treasury Funds' }, true)
		useRWAFlowAssetBreakdown({ kind: 'chain', slug: 'Ethereum' }, true)

		for (const [options] of useQueryMock.mock.calls) {
			await (options as { queryFn: () => Promise<unknown> }).queryFn()
		}

		expect(fetchJsonMock.mock.calls.map(([url]) => url)).toEqual([
			'/api/public/rwa/flows/summary',
			'/api/public/rwa/flows/asset/ondo%2Fusdy?withMcap=true',
			'/api/public/rwa/flows/overview?splitBy=assetGroup&includeStablecoin=true&includeGovernance=false',
			'/api/public/rwa/flows/asset-breakdown/assetGroup/Treasury%20Funds',
			'/api/public/rwa/flows/asset-breakdown/chain/Ethereum'
		])
	})

	test('never fetches an asset breakdown without a scope', () => {
		useRWAFlowAssetBreakdown(null, true)
		const [options] = useQueryMock.mock.calls[0] as [{ enabled: boolean; queryFn: () => unknown }]
		expect(options.enabled).toBe(false)
		expect(() => options.queryFn()).toThrow('The overview reads the flows split, not the asset breakdown')
		expect(fetchJsonMock).not.toHaveBeenCalled()
	})
})

describe('useRWAFlowSeries', () => {
	function getQueries() {
		return useQueryMock.mock.calls.map(([options]) => options as { queryKey: Array<unknown>; enabled: boolean })
	}

	test('reads the summed asset group split on the front page and leaves the asset breakdown off', async () => {
		fetchJsonMock.mockResolvedValue([{ timestamp: 1, Bonds: 3, 'Precious Metals': 4 }])
		useRWAFlowSeries({ scope: { kind: 'overview' }, includeStablecoin: false, includeGovernance: true, enabled: true })
		const [split, breakdown] = getQueries()
		expect(split.queryKey).toEqual(['rwa-flows', 'overview-split', 'assetGroup', false, true])
		expect(split.enabled).toBe(true)
		expect(breakdown.enabled).toBe(false)
		await (split as unknown as { queryFn: () => Promise<unknown> }).queryFn()
		expect(fetchJsonMock.mock.calls.map(([url]) => url)).toEqual([
			'/api/public/rwa/flows/overview?splitBy=assetGroup&includeStablecoin=false&includeGovernance=true'
		])
	})

	test('reads the split the Group by asks for', () => {
		useRWAFlowSeries({
			scope: { kind: 'overview' },
			splitBy: 'chain',
			includeStablecoin: false,
			includeGovernance: false,
			enabled: true
		})
		expect(getQueries()[0]!.queryKey).toEqual(['rwa-flows', 'overview-split', 'chain', false, false])
	})

	test('reads the scoped asset breakdown on a scoped page and leaves the split off', () => {
		useRWAFlowSeries({
			scope: { kind: 'platform', slug: 'Ondo' },
			includeStablecoin: false,
			includeGovernance: false,
			enabled: true
		})
		const [split, breakdown] = getQueries()
		expect(split.enabled).toBe(false)
		expect(breakdown.enabled).toBe(true)
		expect(breakdown.queryKey).toEqual(['rwa-flows', 'asset-breakdown', 'platform', 'Ondo'])
	})

	test('disables both queries when the flows chart is not shown', () => {
		useRWAFlowSeries({
			scope: { kind: 'overview' },
			includeStablecoin: false,
			includeGovernance: false,
			enabled: false
		})
		expect(getQueries().map((query) => query.enabled)).toEqual([false, false])
	})

	test('returns the split points for the front page and the asset rows for a scoped page', () => {
		useQueryMock.mockImplementationOnce(() => ({ data: [{ timestamp: 1, Bonds: 3 }], isLoading: false, error: null }))
		useQueryMock.mockImplementationOnce(() => ({ data: undefined, isLoading: false, error: null }))
		const overview = useRWAFlowSeries({
			scope: { kind: 'overview' },
			includeStablecoin: false,
			includeGovernance: false,
			enabled: true
		})
		expect(overview).toEqual({
			splitPoints: [{ timestamp: 1, Bonds: 3 }],
			assetRows: undefined,
			isLoading: false,
			error: null
		})

		useQueryMock.mockImplementationOnce(() => ({ data: undefined, isLoading: false, error: null }))
		useQueryMock.mockImplementationOnce(() => ({
			data: [{ timestamp: 1, 'ondo/usdy': 3 }],
			isLoading: true,
			error: null
		}))
		const scoped = useRWAFlowSeries({
			scope: { kind: 'chain', slug: 'Ethereum' },
			includeStablecoin: false,
			includeGovernance: false,
			enabled: true
		})
		expect(scoped).toEqual({
			splitPoints: undefined,
			assetRows: [{ timestamp: 1, 'ondo/usdy': 3 }],
			isLoading: true,
			error: null
		})
	})
})

describe('RWA flow proxy mapping', () => {
	test('maps overview and scoped routes to the direct RWA upstream', () => {
		expect(buildRWAFlowProxyUrl({ path: ['overview'], splitBy: 'category' })).toMatch(
			/\/rwa\/flows\/overview\?splitBy=category$/
		)
		expect(buildRWAFlowProxyUrl({ path: ['summary'] })).toMatch(/\/rwa\/flows\/summary$/)
		expect(
			buildRWAFlowProxyUrl({
				path: ['overview'],
				splitBy: 'platform',
				includeStablecoin: 'true',
				includeGovernance: 'true'
			})
		).toMatch(/\/rwa\/flows\/overview\?splitBy=platform&includeStablecoin=true&includeGovernance=true$/)
		expect(buildRWAFlowProxyUrl({ path: ['assetGroup', 'Treasury Funds'] })).toMatch(
			/\/rwa\/flows\/assetGroup\/Treasury%20Funds$/
		)
		expect(buildRWAFlowProxyUrl({ path: ['asset-breakdown'] })).toMatch(/\/rwa\/flows\/asset-breakdown$/)
		expect(buildRWAFlowProxyUrl({ path: ['asset-breakdown', 'chain', 'Ethereum'] })).toMatch(
			/\/rwa\/flows\/asset-breakdown\/chain\/Ethereum$/
		)
	})

	test('preserves validated asset flow parameters and encoded canonical ids', () => {
		expect(
			buildRWAFlowProxyUrl({
				path: ['asset', 'ondo/usdy'],
				start: '1700000000',
				end: '1700086400',
				withMcap: 'true'
			})
		).toMatch(/\/rwa\/flows\/ondo%2Fusdy\?start=1700000000&end=1700086400&withMcap=true$/)
	})

	test('rejects unknown paths and invalid query values before fetching upstream', async () => {
		expect(buildRWAFlowProxyUrl({ path: ['leaderboard'] })).toBeNull()
		expect(buildRWAFlowProxyUrl({ path: ['overview'], splitBy: 'issuer' })).toBeNull()
		expect(buildRWAFlowProxyUrl({ path: ['overview'], splitBy: 'assetGroup', includeStablecoin: 'yes' })).toBeNull()
		expect(buildRWAFlowProxyUrl({ path: ['asset', 'ondo/usdy'], start: 'yesterday' })).toBeNull()

		const result = await rwaFlowsProxy.handle({
			method: 'GET',
			url: '/api/public/rwa/flows/leaderboard',
			query: { path: ['leaderboard'] },
			headers: {}
		})
		expect(result).toEqual({ status: 400, body: { error: 'Invalid RWA flow request' } })
		expect(fetchJsonMock).not.toHaveBeenCalled()
	})

	test('caches and returns the serialized upstream payload', async () => {
		fetchJsonMock.mockResolvedValue({ series: [{ timestamp: 1, netFlowUsd: 2 }] })
		const request = {
			method: 'GET',
			url: '/api/public/rwa/flows/asset/cache-test',
			query: { path: ['asset', 'cache-test'] },
			headers: {}
		}

		const first = await rwaFlowsProxy.handle(request)
		const second = await rwaFlowsProxy.handle(request)

		expect(first).toMatchObject({
			status: 200,
			serializedJson: JSON.stringify({ series: [{ timestamp: 1, netFlowUsd: 2 }] })
		})
		expect(second).toEqual(first)
		expect(fetchJsonMock).toHaveBeenCalledTimes(1)
	})
})

describe('RWA flow server fetchers', () => {
	test('matches the retained aggregate and asset-breakdown API routes', async () => {
		await fetchRWAFlowsOverview({
			splitBy: 'assetGroup',
			includeStablecoin: false,
			includeGovernance: true
		})
		await fetchRWAFlowsAssetGroup('Treasury Funds')
		await fetchRWAFlowAssetBreakdown({ kind: 'all' })
		await fetchRWAFlowAssetBreakdown({ kind: 'assetGroup', slug: 'Treasury Funds' })

		expect(fetchJsonMock.mock.calls.map(([url]) => url)).toEqual([
			expect.stringMatching(
				/\/rwa\/flows\/overview\?splitBy=assetGroup&includeStablecoin=false&includeGovernance=true$/
			),
			expect.stringMatching(/\/rwa\/flows\/assetGroup\/Treasury%20Funds$/),
			expect.stringMatching(/\/rwa\/flows\/asset-breakdown$/),
			expect.stringMatching(/\/rwa\/flows\/asset-breakdown\/assetGroup\/Treasury%20Funds$/)
		])
	})
})
