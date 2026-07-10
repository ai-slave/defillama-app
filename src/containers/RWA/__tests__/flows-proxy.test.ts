import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRWAFlowAssetBreakdown, fetchRWAFlowsAssetGroup, fetchRWAFlowsOverview } from '../api'
import {
	useRWAAssetFlows,
	useRWAFlowAssetBreakdown,
	useRWAFlowOverviewSplitWithFilters,
	useRWAFlowSummary
} from '../flows.hooks'
import { buildRWAFlowProxyUrl, rwaFlowsProxy } from '../server/flows'

const useQueryMock = vi.fn((options) => options)
const fetchJsonMock = vi.fn()

vi.mock('@tanstack/react-query', () => ({
	useQuery: (options: unknown) => useQueryMock(options)
}))

vi.mock('~/utils/async', () => ({
	fetchJson: (...args: unknown[]) => fetchJsonMock(...args)
}))

beforeEach(() => {
	useQueryMock.mockClear()
	fetchJsonMock.mockReset()
})

describe('RWA flow browser routes', () => {
	it('fetches every flow scope through the local public API', async () => {
		useRWAFlowSummary()
		useRWAAssetFlows('ondo/usdy', true)
		useRWAFlowOverviewSplitWithFilters('assetGroup', true, false, true)
		useRWAFlowAssetBreakdown({ kind: 'overview' }, true)
		useRWAFlowAssetBreakdown({ kind: 'assetGroup', slug: 'Treasury Funds' }, true)
		useRWAFlowAssetBreakdown({ kind: 'chain', slug: 'Ethereum' }, true)

		for (const [options] of useQueryMock.mock.calls) {
			await (options as { queryFn: () => Promise<unknown> }).queryFn()
		}

		expect(fetchJsonMock.mock.calls.map(([url]) => url)).toEqual([
			'/api/public/rwa/flows/summary',
			'/api/public/rwa/flows/asset/ondo%2Fusdy?withMcap=true',
			'/api/public/rwa/flows/overview?splitBy=assetGroup&includeStablecoin=true&includeGovernance=false',
			'/api/public/rwa/flows/asset-breakdown',
			'/api/public/rwa/flows/asset-breakdown/assetGroup/Treasury%20Funds',
			'/api/public/rwa/flows/asset-breakdown/chain/Ethereum'
		])
	})
})

describe('RWA flow proxy mapping', () => {
	it('maps overview and scoped routes to the direct RWA upstream', () => {
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

	it('preserves validated asset flow parameters and encoded canonical ids', () => {
		expect(
			buildRWAFlowProxyUrl({
				path: ['asset', 'ondo/usdy'],
				start: '1700000000',
				end: '1700086400',
				withMcap: 'true'
			})
		).toMatch(/\/rwa\/flows\/ondo%2Fusdy\?start=1700000000&end=1700086400&withMcap=true$/)
	})

	it('rejects unknown paths and invalid query values before fetching upstream', async () => {
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

	it('caches and returns the serialized upstream payload', async () => {
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
	it('matches the retained aggregate and asset-breakdown API routes', async () => {
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
