import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('~/containers/ProtocolLists/api', () => ({ fetchProtocols: vi.fn() }))
vi.mock('~/containers/ProtocolRankings/queries.server', () => ({
	getProtocolsByChain: vi.fn()
}))
vi.mock('~/utils/metadata', () => ({
	default: {
		chainMetadata: {},
		protocolMetadata: {
			aave: { name: 'aave-v3', displayName: 'Aave V3', forks: true }
		},
		protocolRouteIdBySlug: { 'aave-v3': 'aave' }
	}
}))
vi.mock('../api', () => ({
	fetchForkMetrics: vi.fn(),
	fetchForkProtocolBreakdownChart: vi.fn()
}))

import { fetchProtocols } from '~/containers/ProtocolLists/api'
import type { ProtocolLite } from '~/containers/ProtocolLists/api.types'
import { getProtocolsByChain } from '~/containers/ProtocolRankings/queries.server'
import { fetchForkMetrics, fetchForkProtocolBreakdownChart } from '../api'
import { getForksByProtocolPageData, getForksListPageData } from '../queries'

describe('getForksListPageData', () => {
	test('treats omitted current default TVL as zero', async () => {
		vi.mocked(fetchForkMetrics).mockResolvedValueOnce({ Omitted: [], Explicit: [] })
		vi.mocked(fetchProtocols).mockResolvedValueOnce({
			protocols: [],
			parentProtocols: [],
			chains: [],
			protocolCategories: []
		})
		vi.mocked(fetchForkProtocolBreakdownChart).mockResolvedValueOnce([{ timestamp: 1, Explicit: 0 }])

		const result = await getForksListPageData()

		expect(result?.tableData).toEqual([
			{
				name: 'Omitted',
				logo: null,
				deprecated: false,
				tvl: 0,
				forkedProtocols: 0,
				parentTvl: null,
				ftot: null
			},
			{ name: 'Explicit', logo: null, deprecated: false, tvl: 0, forkedProtocols: 0, parentTvl: null, ftot: null }
		])
	})

	test('counts current Fork relationships even when the metrics cache has no measurement', async () => {
		const protocol = {
			name: 'Unmeasured Fork',
			symbol: 'FORK',
			logo: null,
			url: '',
			chains: [],
			chainTvls: {},
			tvl: null,
			tvlPrevDay: null,
			tvlPrevWeek: null,
			tvlPrevMonth: null,
			mcap: null,
			defillamaId: 'unmeasured-fork',
			geckoId: null,
			category: 'Dexs',
			forkedFrom: ['Aave V3']
		} satisfies ProtocolLite
		vi.mocked(fetchForkMetrics).mockResolvedValueOnce({ 'Aave V3': [] })
		vi.mocked(fetchProtocols).mockResolvedValueOnce({
			protocols: [protocol],
			parentProtocols: [],
			chains: [],
			protocolCategories: []
		})
		vi.mocked(fetchForkProtocolBreakdownChart).mockResolvedValueOnce([])

		const result = await getForksListPageData()

		expect(result?.tableData[0]?.forkedProtocols).toBe(1)
	})
})

describe('getForksByProtocolPageData', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(fetchForkMetrics).mockResolvedValue({
			'Aave V3': ['Seamless V1'],
			Curve: ['Convex']
		})
		vi.mocked(fetchForkProtocolBreakdownChart).mockResolvedValue([{ timestamp: 1, 'Aave V3': 5, Curve: 10 }])
		vi.mocked(getProtocolsByChain).mockResolvedValue(null)
	})

	test('resolves a route slug to the producer canonical Fork identity', async () => {
		const result = await getForksByProtocolPageData({ fork: 'aave-v3' })

		expect(result).toEqual({
			status: 'success',
			data: {
				fork: 'Aave V3',
				forkLinks: [
					{ label: 'All', to: '/forks' },
					{ label: 'Curve', to: '/forks/curve' },
					{ label: 'Aave V3', to: '/forks/aave-v3' }
				],
				protocolTableData: [],
				chartData: [[1, 5]]
			}
		})
		expect(getProtocolsByChain).toHaveBeenCalledWith(expect.objectContaining({ fork: 'Aave V3' }))
	})

	test('returns not-found from metadata before requesting producer data', async () => {
		await expect(getForksByProtocolPageData({ fork: 'unknown-fork' })).resolves.toEqual({ status: 'not-found' })
		expect(fetchForkMetrics).not.toHaveBeenCalled()
		expect(fetchForkProtocolBreakdownChart).not.toHaveBeenCalled()
	})

	test('keeps metadata and producer identity drift unavailable', async () => {
		vi.mocked(fetchForkMetrics).mockResolvedValue({ Curve: ['Convex'] })

		await expect(getForksByProtocolPageData({ fork: 'aave-v3' })).resolves.toEqual({ status: 'unavailable' })
		expect(fetchForkProtocolBreakdownChart).not.toHaveBeenCalled()
	})

	test('keeps a metadata-valid all-extra Fork available with empty default history', async () => {
		vi.mocked(fetchForkProtocolBreakdownChart).mockResolvedValue([{ timestamp: 1, Curve: 10 }])

		const result = await getForksByProtocolPageData({ fork: 'aave-v3' })

		expect(result).toMatchObject({
			status: 'success',
			data: { fork: 'Aave V3', chartData: [] }
		})
	})

	test('keeps a required source failure distinct from not-found', async () => {
		vi.mocked(fetchForkProtocolBreakdownChart).mockRejectedValue(new Error('source unavailable'))

		await expect(getForksByProtocolPageData({ fork: 'Aave V3' })).resolves.toEqual({ status: 'unavailable' })
	})
})
