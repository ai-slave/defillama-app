import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IChainMetadata } from '~/utils/metadata/types'

const mocks = vi.hoisted<{
	fetchAdapterChainMetrics: ReturnType<typeof vi.fn>
	getAdapterByChainPageData: ReturnType<typeof vi.fn>
	getAdapterChainOverview: ReturnType<typeof vi.fn>
	metadataCache: { chainMetadata: Record<string, IChainMetadata> }
}>(() => ({
	fetchAdapterChainMetrics: vi.fn(),
	getAdapterByChainPageData: vi.fn(),
	getAdapterChainOverview: vi.fn(),
	metadataCache: { chainMetadata: {} }
}))

vi.mock('../api', () => ({ fetchAdapterChainMetrics: mocks.fetchAdapterChainMetrics }))
vi.mock('../queries', () => ({
	getAdapterByChainPageData: mocks.getAdapterByChainPageData,
	getAdapterChainOverview: mocks.getAdapterChainOverview
}))
vi.mock('~/utils/metadata', () => ({ default: mocks.metadataCache }))

import { fetchDimensionDataset } from '../server/datasets'

const protocol = (name: string, total24h = 10) => ({
	name,
	slug: name.toLowerCase(),
	logo: '',
	chains: [],
	category: null,
	total24h,
	total7d: null,
	total30d: null,
	total1y: null,
	totalAllTime: null,
	mcap: null
})

describe('fetchDimensionDataset', () => {
	beforeEach(() => {
		mocks.fetchAdapterChainMetrics.mockReset()
		mocks.getAdapterByChainPageData.mockReset()
		mocks.getAdapterChainOverview.mockReset()
		mocks.metadataCache.chainMetadata = {}
	})

	it('skips missing metadata and omits absent optional request fields', async () => {
		mocks.metadataCache.chainMetadata = {
			base: { id: 'base', name: 'Base' }
		}
		mocks.getAdapterByChainPageData.mockResolvedValue({ protocols: [protocol('Protocol')] })

		const result = await fetchDimensionDataset({
			adapterType: 'dexs',
			route: 'dexs',
			metricName: 'DEX Volume',
			chains: ['Missing', 'Base'],
			hasOpenInterestByChain: true
		})

		expect(mocks.getAdapterByChainPageData).toHaveBeenCalledTimes(1)
		expect(mocks.getAdapterByChainPageData).toHaveBeenCalledWith({
			adapterType: 'dexs',
			chain: 'Base',
			route: 'dexs',
			metricName: 'DEX Volume'
		})
		expect(result).toEqual({
			status: 'complete',
			protocols: [expect.objectContaining({ name: 'Protocol', displayName: 'Protocol', chains: ['Base'] })]
		})
	})

	it('keeps successful chains after a partial failure and omits absent breakdown fields', async () => {
		const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)
		mocks.metadataCache.chainMetadata = {
			base: { id: 'base', name: 'Base' },
			ethereum: { id: 'ethereum', name: 'Ethereum' }
		}
		mocks.getAdapterByChainPageData.mockImplementation(async ({ chain }: { chain: string }) => {
			if (chain === 'Base') throw new Error('base unavailable')
			return { protocols: [protocol('Protocol')] }
		})

		const result = await fetchDimensionDataset({
			adapterType: 'aggregators',
			route: 'dex-aggregators',
			metricName: 'DEX Aggregator Volume',
			chains: ['Base', 'Ethereum'],
			withChainBreakdown: true
		})

		expect(result.status).toBe('partial')
		if (result.status !== 'partial') return
		expect(result.unavailableChains).toEqual(['Base'])
		expect(result.protocols).toHaveLength(1)
		const chainBreakdown = result.protocols[0]?.chainBreakdown
		expect(chainBreakdown).toBeDefined()
		expect(chainBreakdown?.ethereum).toEqual(expect.objectContaining({ chain: 'Ethereum', total24h: 10 }))
		expect(chainBreakdown?.ethereum).not.toHaveProperty('change_7d')
		expect(consoleInfo).toHaveBeenCalledWith('Chain page data not found aggregators : chain:Base', expect.any(Error))
		consoleInfo.mockRestore()
	})
})
