import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '../constants'

const { fetchJsonMock, fetchProtocolsMock } = vi.hoisted(() => ({
	fetchJsonMock: vi.fn(),
	fetchProtocolsMock: vi.fn()
}))

vi.mock('~/utils/async', () => ({ fetchJson: fetchJsonMock }))
vi.mock('~/containers/ProtocolLists/api', () => ({ fetchProtocols: fetchProtocolsMock }))

import {
	getAdapterByChainPageData,
	getChainsByAdapterChartData,
	getChainsByAdapterPageData,
	getChainsByChainNativeFeeRevenuePageData
} from '../queries'

const chainMetadata = {
	ethereum: {
		id: 'ethereum',
		name: 'Ethereum',
		dexs: true,
		dimAgg: { dexs: { dv: { '24h': 100, '7d': 700, '30d': 3000 } } }
	}
}

const overloadedVolumeChainMetadata = {
	ethereum: {
		id: 'ethereum',
		name: 'Ethereum',
		dexs: true,
		dimAgg: { dexs: { dv: { '24h': 100 } } }
	},
	solana: {
		id: 'solana',
		name: 'Solana',
		perps: true,
		dimAgg: { derivatives: { dv: { '24h': 200 } } }
	},
	base: {
		id: 'base',
		name: 'Base',
		dexs: true,
		perps: true,
		dimAgg: {
			dexs: { dv: { '24h': 300 } },
			derivatives: { dv: { '24h': 400 } }
		}
	}
}

const feeRevenueChainMetadata = {
	base: { id: 'base', name: 'Base', fees: true, revenue: true, chainFees: true },
	sui: { id: 'sui', name: 'Sui', fees: true, revenue: true, chainRevenue: true },
	appOnly: { id: 'app-only', name: 'App Only', fees: true, revenue: true }
}

const adapterProtocolRow = (overrides: Record<string, unknown>) => ({
	total24h: 0,
	total48hto24h: 0,
	total7d: 0,
	total14dto7d: 0,
	total60dto30d: 0,
	total30d: 0,
	total1y: 0,
	annualized1y: 0,
	totalAllTime: 0,
	average1y: 0,
	monthlyAverage1y: 0,
	change_1d: 0,
	change_7d: 0,
	change_1m: 0,
	change_7dover7d: 0,
	change_30dover30d: 0,
	breakdown24h: {},
	breakdown30d: {},
	total7DaysAgo: 0,
	total30DaysAgo: 0,
	defillamaId: 'adapter-row',
	name: 'Adapter Row',
	displayName: 'Adapter Row',
	module: 'adapter-row',
	category: 'Dexes',
	logo: '',
	chains: ['Base'],
	protocolType: 'protocol',
	methodologyURL: '',
	methodology: {},
	latestFetchIsOk: true,
	parentProtocol: '',
	slug: 'adapter-row',
	linkedProtocols: [],
	id: 'adapter-row',
	...overrides
})

const adapterMetricsResponse = (overrides: Record<string, unknown> = {}) => ({
	breakdown24h: null,
	breakdown30d: null,
	chain: 'Base',
	allChains: ['Base'],
	total24h: 100,
	total48hto24h: 90,
	total7d: 700,
	total14dto7d: 600,
	total60dto30d: 2000,
	total30d: 3000,
	total1y: 36_000,
	annualized1y: 36_000,
	change_1d: 11.11,
	change_7d: 16.67,
	change_1m: 50,
	change_7dover7d: 10,
	change_30dover30d: 20,
	total7DaysAgo: 80,
	total30DaysAgo: 70,
	totalAllTime: 100_000,
	protocols: [],
	...overrides
})

describe('chains by adapter page data', () => {
	beforeEach(() => {
		fetchJsonMock.mockReset()
		fetchProtocolsMock.mockReset()
		fetchProtocolsMock.mockResolvedValue({ protocols: [], parentProtocols: [] })
	})

	it('builds chain rankings from the requested base metric only', async () => {
		const data = await getChainsByAdapterPageData({
			adapterType: ADAPTER_TYPES.DEXS,
			dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME,
			chainMetadata,
			includeChartData: false
		})

		expect(fetchJsonMock).not.toHaveBeenCalled()
		expect(data.chartData).toEqual({ dimensions: ['timestamp'], source: [] })
		expect(data.chains).toEqual([
			expect.objectContaining({ name: 'Ethereum', total24h: 100, total7d: 700, total30d: 3000 })
		])
	})

	it('uses adapter type to disambiguate overloaded daily volume metadata', async () => {
		const dexData = await getChainsByAdapterPageData({
			adapterType: ADAPTER_TYPES.DEXS,
			dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME,
			chainMetadata: overloadedVolumeChainMetadata,
			includeChartData: false
		})
		const perpsData = await getChainsByAdapterPageData({
			adapterType: ADAPTER_TYPES.PERPS,
			dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME,
			chainMetadata: overloadedVolumeChainMetadata,
			includeChartData: false
		})

		expect(dexData.chains.map(({ name, total24h }) => ({ name, total24h }))).toEqual([
			{ name: 'Base', total24h: 300 },
			{ name: 'Ethereum', total24h: 100 }
		])
		expect(perpsData.chains.map(({ name, total24h }) => ({ name, total24h }))).toEqual([
			{ name: 'Base', total24h: 400 },
			{ name: 'Solana', total24h: 200 }
		])
	})

	it('builds the chart data shape used by the page', async () => {
		fetchJsonMock.mockResolvedValue([
			[1, { Ethereum: 10, Optimism: 5, Unknown: 999 }],
			[2, { Ethereum: 20 }]
		])

		const chartData = await getChainsByAdapterChartData({
			adapterType: ADAPTER_TYPES.DEXS,
			dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME,
			allChains: ['Ethereum', 'Optimism']
		})

		expect(chartData).toEqual({
			dimensions: ['timestamp', 'Ethereum', 'Optimism'],
			source: [
				[1000, 10, 5],
				[2000, 20, null]
			]
		})
	})

	it('throws chart fetch failures by default and can explicitly tolerate them', async () => {
		fetchJsonMock.mockRejectedValue(new Error('upstream failed'))

		await expect(
			getChainsByAdapterChartData({
				adapterType: ADAPTER_TYPES.DEXS,
				dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME,
				allChains: ['Ethereum']
			})
		).rejects.toThrow('upstream failed')

		await expect(
			getChainsByAdapterChartData({
				adapterType: ADAPTER_TYPES.DEXS,
				dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME,
				allChains: ['Ethereum'],
				allowEmptyOnError: true
			})
		).resolves.toEqual({ dimensions: ['timestamp', 'Ethereum'], source: [] })
	})

	it('uses protocol revenue methodology and falls back to revenue methodology', async () => {
		fetchJsonMock.mockImplementation((url: string) => {
			if (new URL(url).pathname.includes('/chart/')) return Promise.resolve([])
			return Promise.resolve(
				adapterMetricsResponse({
					protocols: [
						adapterProtocolRow({
							name: 'Protocol Revenue Method',
							displayName: 'Protocol Revenue Method',
							methodology: { ProtocolRevenue: 'Revenue retained by the protocol.', Revenue: 'All revenue.' }
						}),
						adapterProtocolRow({
							name: 'Revenue Fallback Method',
							displayName: 'Revenue Fallback Method',
							methodology: { Revenue: 'Fallback revenue.' }
						})
					]
				})
			)
		})

		const data = await getAdapterByChainPageData({
			adapterType: ADAPTER_TYPES.FEES,
			chain: 'Base',
			dataType: ADAPTER_DATA_TYPES.DAILY_PROTOCOL_REVENUE,
			route: 'protocol-revenue',
			metricName: 'Protocol Revenue'
		})
		const protocolsByName = new Map(data?.protocols.map((protocol) => [protocol.name, protocol]))

		expect(protocolsByName.get('Protocol Revenue Method')?.methodology).toBe('Revenue retained by the protocol')
		expect(protocolsByName.get('Revenue Fallback Method')?.methodology).toBe('Fallback revenue')
	})

	it('uses chain fee metadata to qualify chain-native rankings with one base request', async () => {
		fetchJsonMock.mockResolvedValue({
			protocols: [
				{ name: 'Base', slug: 'base', protocolType: 'chain', total24h: 100, total7d: 700, total30d: 3000 },
				{ name: 'Sui', slug: 'sui', protocolType: 'chain', total24h: 200, total7d: 1400, total30d: 6000 },
				{ name: 'App Only', slug: 'app-only', protocolType: 'chain', total24h: 300 },
				{ name: 'Protocol Row', slug: 'protocol-row', protocolType: 'protocol', total24h: 400 }
			]
		})

		const data = await getChainsByChainNativeFeeRevenuePageData({
			adapterType: ADAPTER_TYPES.FEES,
			dataType: ADAPTER_DATA_TYPES.DAILY_FEES,
			chainMetadata: feeRevenueChainMetadata
		})

		expect(fetchJsonMock).toHaveBeenCalledTimes(1)
		expect(data.allChains).toEqual(['Base'])
		expect(data.chains).toEqual([
			expect.objectContaining({ name: 'Base', total24h: 100, total7d: 700, total30d: 3000 })
		])
	})

	it('uses chain revenue metadata and excludes app-only chains', async () => {
		fetchJsonMock.mockResolvedValue({
			protocols: [
				{ name: 'Base', slug: 'base', protocolType: 'chain', total24h: 100 },
				{ name: 'Sui', slug: 'sui', protocolType: 'chain', total24h: 200 },
				{ name: 'App Only', slug: 'app-only', protocolType: 'chain', total24h: 300 }
			]
		})

		const data = await getChainsByChainNativeFeeRevenuePageData({
			adapterType: ADAPTER_TYPES.FEES,
			dataType: ADAPTER_DATA_TYPES.DAILY_REVENUE,
			chainMetadata: feeRevenueChainMetadata
		})

		expect(data.allChains).toEqual(['Sui'])
		expect(data.chains.map((chain) => chain.name)).toEqual(['Sui'])
	})
})
