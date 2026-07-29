import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardItemConfig } from '../types'

const {
	fetchDimensionDatasetMock,
	fetchProtocolsMock,
	fetchProtocolsByTokenMock,
	getDexVolumeByChainMock,
	getFeesAndRevenueProtocolsByChainMock,
	getOpenInterestByChainMock,
	getPerpsVolumeByChainMock
} = vi.hoisted(() => ({
	fetchDimensionDatasetMock: vi.fn(),
	fetchProtocolsMock: vi.fn(),
	fetchProtocolsByTokenMock: vi.fn(),
	getDexVolumeByChainMock: vi.fn(),
	getFeesAndRevenueProtocolsByChainMock: vi.fn(),
	getOpenInterestByChainMock: vi.fn(),
	getPerpsVolumeByChainMock: vi.fn()
}))

vi.mock('~/containers/AdapterMetrics/server/datasets', () => ({
	DIMENSION_DATASET_SPEC_BY_TYPE: {
		earnings: {
			options: {
				adapterType: 'fees',
				route: 'earnings',
				metricName: 'Earnings',
				dataType: 'dailyEarnings',
				allCaseFetcher: 'chainOverview',
				chainGuard: 'fees',
				withChainBreakdown: true
			}
		},
		aggregators: {
			options: { adapterType: 'aggregators', route: 'dex-aggregators', metricName: 'DEX Aggregator Volume' }
		},
		'bridge-aggregators': {
			options: {
				adapterType: 'bridge-aggregators',
				route: 'bridge-aggregators',
				metricName: 'Bridge Aggregator Volume'
			}
		},
		options: {
			options: { adapterType: 'options', route: 'options', metricName: 'Options Volume' }
		}
	}
}))

vi.mock('./dimensionDataset', () => ({ fetchProDimensionDataset: fetchDimensionDatasetMock }))

vi.mock('~/containers/ProtocolLists/api', () => ({ fetchProtocols: fetchProtocolsMock }))
vi.mock('~/containers/TokenUsage/api', () => ({ fetchProtocolsByToken: fetchProtocolsByTokenMock }))
vi.mock('../components/ProTable/proTable.api', () => ({
	getDexVolumeByChain: getDexVolumeByChainMock,
	getFeesAndRevenueProtocolsByChain: getFeesAndRevenueProtocolsByChainMock,
	getOpenInterestByChain: getOpenInterestByChainMock,
	getPerpsVolumeByChain: getPerpsVolumeByChainMock
}))

import { fetchTableServerData } from './tableQueries'

const unifiedTable: DashboardItemConfig = {
	id: 'unified',
	kind: 'unified-table',
	rowHeaders: ['protocol'],
	params: { chains: ['Ethereum'] }
}

const legacyTable: DashboardItemConfig = {
	id: 'legacy',
	kind: 'table',
	tableType: 'protocols',
	chains: ['Base']
}

const metricHeavyLegacyTable: DashboardItemConfig = {
	...legacyTable,
	id: 'legacy-metric-heavy',
	columnOrder: [
		'name',
		'volume_24h',
		'fees_24h',
		'perps_volume_24h',
		'openInterest',
		'earnings_24h',
		'aggregators_volume_24h',
		'bridge_aggregators_volume_24h',
		'options_volume_24h'
	]
}

const tokenUsageTable: DashboardItemConfig = {
	id: 'token-usage',
	kind: 'table',
	tableType: 'dataset',
	datasetType: 'token-usage',
	chains: [],
	tokenSymbols: ['USDC', 'USDT'],
	includeCex: false
}

describe('fetchTableServerData', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		fetchProtocolsMock.mockResolvedValue({ protocols: [] })
		fetchProtocolsByTokenMock.mockResolvedValue([])
		getDexVolumeByChainMock.mockResolvedValue({ protocols: [] })
		getFeesAndRevenueProtocolsByChainMock.mockResolvedValue([])
		getOpenInterestByChainMock.mockResolvedValue({ protocols: [] })
		getPerpsVolumeByChainMock.mockResolvedValue({ protocols: [] })
		fetchDimensionDatasetMock.mockResolvedValue({ status: 'complete', protocols: [] })
	})

	it('does not load the legacy table bundle for a Unified Table', async () => {
		await expect(fetchTableServerData([unifiedTable])).resolves.toBeNull()

		expect(fetchProtocolsMock).not.toHaveBeenCalled()
		expect(getDexVolumeByChainMock).not.toHaveBeenCalled()
		expect(fetchDimensionDatasetMock).not.toHaveBeenCalled()
	})

	it('loads only the protocols list for a minimal legacy table', async () => {
		const result = await fetchTableServerData([unifiedTable, legacyTable])

		expect(result).not.toBeNull()
		expect(fetchProtocolsMock).toHaveBeenCalledOnce()
		expect(getDexVolumeByChainMock).not.toHaveBeenCalled()
		expect(getFeesAndRevenueProtocolsByChainMock).not.toHaveBeenCalled()
		expect(getPerpsVolumeByChainMock).not.toHaveBeenCalled()
		expect(getOpenInterestByChainMock).not.toHaveBeenCalled()
		expect(fetchDimensionDatasetMock).not.toHaveBeenCalled()
	})

	it('uses a shared protocols-list provider when the stream already owns the request', async () => {
		const sharedProtocols = { protocols: [], chains: [], parentProtocols: [] }
		const getProtocolsList = vi.fn(async () => sharedProtocols)

		const result = await fetchTableServerData([legacyTable], undefined, undefined, getProtocolsList)

		expect(result?.protocolsList).toBe(sharedProtocols)
		expect(getProtocolsList).toHaveBeenCalledOnce()
		expect(fetchProtocolsMock).not.toHaveBeenCalled()
	})

	it('emits the protocols list without waiting for an optional metric source', async () => {
		let resolveFees: ((value: []) => void) | undefined
		getFeesAndRevenueProtocolsByChainMock.mockReturnValue(
			new Promise<[]>((resolve) => {
				resolveFees = resolve
			})
		)
		const emitted: Array<{ protocolsList: unknown; feesByChain: Record<string, unknown> }> = []
		const resultPromise = fetchTableServerData(
			[{ ...legacyTable, columnOrder: ['name', 'fees_24h'] }],
			undefined,
			(data) => emitted.push(data)
		)

		await vi.waitFor(() => expect(emitted.some((data) => data.protocolsList != null)).toBe(true))
		expect(emitted.some((data) => Object.keys(data.feesByChain).length > 0)).toBe(false)

		resolveFees?.([])
		await resultPromise
		expect(emitted.some((data) => Object.hasOwn(data.feesByChain, 'Base'))).toBe(true)
	})

	it('treats an empty metric-heavy table chain list as All', async () => {
		await fetchTableServerData([{ ...metricHeavyLegacyTable, chains: [] }])

		expect(getDexVolumeByChainMock).toHaveBeenCalledWith({
			chain: 'All',
			excludeTotalDataChart: false,
			excludeTotalDataChartBreakdown: true
		})
		expect(fetchDimensionDatasetMock).toHaveBeenCalledWith(expect.anything(), [])
	})

	it('shares aggregate dataset fetches between empty and explicit All chain filters', async () => {
		await fetchTableServerData([
			{ ...metricHeavyLegacyTable, chains: [] },
			{ ...metricHeavyLegacyTable, id: 'legacy-explicit-all', chains: ['All'] }
		])

		expect(fetchDimensionDatasetMock).toHaveBeenCalledTimes(4)
	})

	it('claims legacy table sources once across staged calls', async () => {
		const claimedSources = new Set<string>()
		const claimSource = (kind: string, key: readonly unknown[]) => {
			const source = `${kind}:${JSON.stringify(key)}`
			if (claimedSources.has(source)) return false
			claimedSources.add(source)
			return true
		}

		await fetchTableServerData([metricHeavyLegacyTable], claimSource)
		await expect(
			fetchTableServerData([{ ...metricHeavyLegacyTable, id: 'later-stage' }], claimSource)
		).resolves.toBeNull()

		expect(fetchProtocolsMock).toHaveBeenCalledOnce()
		expect(getDexVolumeByChainMock).toHaveBeenCalledOnce()
		expect(getFeesAndRevenueProtocolsByChainMock).toHaveBeenCalledOnce()
		expect(getPerpsVolumeByChainMock).toHaveBeenCalledOnce()
		expect(getOpenInterestByChainMock).toHaveBeenCalledOnce()
		expect(fetchDimensionDatasetMock).toHaveBeenCalledTimes(4)
	})

	it('keeps specific sources when another legacy table requests All', async () => {
		await fetchTableServerData([
			{ ...metricHeavyLegacyTable, chains: [] },
			{ ...metricHeavyLegacyTable, id: 'legacy-ethereum', chains: ['Ethereum'] }
		])

		expect(getDexVolumeByChainMock).toHaveBeenCalledTimes(2)
		expect(getDexVolumeByChainMock).toHaveBeenCalledWith({
			chain: 'All',
			excludeTotalDataChart: false,
			excludeTotalDataChartBreakdown: true
		})
		expect(getDexVolumeByChainMock).toHaveBeenCalledWith({
			chain: 'Ethereum',
			excludeTotalDataChart: false,
			excludeTotalDataChartBreakdown: true
		})
		expect(fetchDimensionDatasetMock).toHaveBeenCalledTimes(8)
	})

	it('treats All plus specific chains in one legacy table as aggregate-only', async () => {
		await fetchTableServerData([{ ...metricHeavyLegacyTable, chains: ['All', 'Ethereum'] }])

		expect(getDexVolumeByChainMock).toHaveBeenCalledTimes(1)
		expect(getDexVolumeByChainMock).toHaveBeenCalledWith({
			chain: 'All',
			excludeTotalDataChart: false,
			excludeTotalDataChartBreakdown: true
		})
		expect(fetchDimensionDatasetMock).toHaveBeenCalledTimes(4)
	})

	it('streams a reconciled multi-token dataset without loading legacy table sources', async () => {
		fetchProtocolsByTokenMock.mockImplementation(async (symbol: string) => {
			if (symbol === 'USDC') {
				return [
					{ name: 'Aave', category: 'Lending', amountUsd: { Ethereum: 10, Base: 2 } },
					{ name: 'Binance', category: 'CEX', amountUsd: { Ethereum: 100 } }
				]
			}
			return [{ name: 'Aave', category: 'Lending', amountUsd: { Arbitrum: 3 } }]
		})

		const result = await fetchTableServerData([tokenUsageTable])
		const datasets = Object.values(result?.tokenUsageByQueryKey ?? {})

		expect(datasets).toEqual([
			[
				{
					name: 'Aave',
					category: 'Lending',
					amountUsd: 15,
					logo: undefined,
					tokens: { USDC: 12, USDT: 3 }
				}
			]
		])
		expect(fetchProtocolsMock).not.toHaveBeenCalled()
		expect(fetchDimensionDatasetMock).not.toHaveBeenCalled()
	})

	it('uses canonical token symbols for both the cache and payload', async () => {
		fetchProtocolsByTokenMock.mockResolvedValue([{ name: 'Aave', category: 'Lending', amountUsd: { Ethereum: 10 } }])

		const result = await fetchTableServerData([{ ...tokenUsageTable, tokenSymbols: [' usdc ', 'USDC', 'usdt'] }])
		const entry = Object.entries(result?.tokenUsageByQueryKey ?? {})[0]
		expect(entry).toBeDefined()
		if (!entry) return
		const [cacheKey, data] = entry

		expect(cacheKey).toBe('["pro-dashboard","token-usage",["USDC","USDT"],false]')
		expect(fetchProtocolsByTokenMock).toHaveBeenCalledTimes(2)
		expect(fetchProtocolsByTokenMock).toHaveBeenNthCalledWith(1, 'USDC')
		expect(fetchProtocolsByTokenMock).toHaveBeenNthCalledWith(2, 'USDT')
		expect(data).toEqual([
			{
				name: 'Aave',
				category: 'Lending',
				amountUsd: 20,
				logo: undefined,
				tokens: { USDC: 10, USDT: 10 }
			}
		])
	})
})
