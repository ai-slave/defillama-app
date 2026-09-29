import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '../constants'

const { fetchJsonMock } = vi.hoisted(() => ({ fetchJsonMock: vi.fn() }))

// The protocol list is page context, not the metric under test; answer it outside the asserted mock.
vi.mock('~/utils/async', () => ({
	fetchJson: (url: string, ...rest: Array<unknown>) =>
		url.includes('/lite/protocols2')
			? Promise.resolve({ protocols: [], parentProtocols: [] })
			: fetchJsonMock(url, ...rest)
}))

import {
	getAdapterByChainPageData,
	getChainsByAdapterChartData,
	getChainsByAdapterPageData,
	getChainsByChainNativeFeeRevenuePageData,
	getChainsByREVPageData
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
	})

	test('builds chain rankings from the requested base metric only', async () => {
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

	test('uses adapter type to disambiguate overloaded daily volume metadata', async () => {
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

	test('retains explicit zero supplemental metrics in chain ranking rows', async () => {
		const derivatives = await getChainsByAdapterPageData({
			adapterType: ADAPTER_TYPES.PERPS,
			dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME,
			chainMetadata: {
				base: {
					id: 'base',
					name: 'Base',
					perps: true,
					openInterest: true,
					dimAgg: {
						derivatives: { dv: { '24h': 0 } },
						'open-interest': { doi: { '24h': 0 } }
					}
				}
			},
			includeChartData: false
		})
		const normalizedVolume = await getChainsByAdapterPageData({
			adapterType: ADAPTER_TYPES.NORMALIZED_VOLUME,
			dataType: ADAPTER_DATA_TYPES.DAILY_NORMALIZED_VOLUME,
			chainMetadata: {
				base: {
					id: 'base',
					name: 'Base',
					normalizedVolume: true,
					activeLiquidity: true,
					dimAgg: {
						'normalized-volume': {
							dnvol: { '24h': 0 },
							dal: { '24h': 0 }
						}
					}
				}
			},
			includeChartData: false
		})

		expect(derivatives.chains).toEqual([expect.objectContaining({ name: 'Base', total24h: 0, openInterest: 0 })])
		expect(normalizedVolume.chains).toEqual([
			expect.objectContaining({ name: 'Base', total24h: 0, activeLiquidity: 0 })
		])
	})

	test('builds the chart data shape used by the page', async () => {
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

	test('throws chart fetch failures by default and can explicitly tolerate them', async () => {
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

	test('options page shows options open interest, notional volume, fees and revenue, not perp open interest', async () => {
		const derive = (total24h: number, name = 'Derive Options') =>
			adapterProtocolRow({ defillamaId: 'derive', name, displayName: 'Derive Options', category: 'Options', total24h })
		fetchJsonMock.mockImplementation((url: string) => {
			const { pathname, searchParams } = new URL(url)
			if (pathname.endsWith('/chart/open-interest/category/options')) return Promise.resolve([[1_700_000_000, 50]])
			if (pathname.endsWith('/chart/open-interest')) return Promise.resolve([[1_700_000_000, 999]])
			if (pathname.endsWith('/chart/options')) return Promise.resolve([[1_700_000_000, 10]])
			if (pathname.endsWith('/metrics/open-interest/category/options'))
				return Promise.resolve(adapterMetricsResponse({ total24h: 50, protocols: [derive(50)] }))
			if (pathname.endsWith('/metrics/open-interest'))
				return Promise.resolve(adapterMetricsResponse({ total24h: 999, protocols: [derive(999)] }))
			// The fees listing covers every protocol, not only options exchanges, and its adapter names differ.
			if (pathname.endsWith('/metrics/fees')) {
				const options = searchParams.get('dataType') === 'dailyRevenue' ? 3 : 7
				return Promise.resolve(
					adapterMetricsResponse({
						total24h: options + 1000,
						protocols: [
							derive(options, 'derive-fees'),
							adapterProtocolRow({ defillamaId: 'uniswap', name: 'Uniswap', displayName: 'Uniswap', total24h: 1000 })
						]
					})
				)
			}
			const total24h = searchParams.get('dataType') === 'dailyNotionalVolume' ? 400 : 10
			return Promise.resolve(adapterMetricsResponse({ total24h, protocols: [derive(total24h)] }))
		})

		const data = await getAdapterByChainPageData({
			adapterType: ADAPTER_TYPES.OPTIONS,
			chain: 'All',
			dataType: ADAPTER_DATA_TYPES.DAILY_PREMIUM_VOLUME,
			route: 'options',
			hasOpenInterest: true,
			hasOptionsMetrics: true,
			metricName: 'Options Premium Volume'
		})

		expect(data?.openInterest).toBe(50)
		expect(data?.optionsTotals).toEqual({ notionalVolume24h: 400, fees24h: 7, revenue24h: 3 })
		expect(data?.protocols).toEqual([
			expect.objectContaining({
				name: 'Derive Options',
				total24h: 10,
				notionalVolume24h: 400,
				openInterest: 50,
				fees24h: 7,
				revenue24h: 3,
				notionalToPremium: 40,
				openInterestToPremium: 5
			})
		])
		expect(data?.chartData).toEqual({
			dimensions: ['timestamp', 'Options Premium Volume', 'Notional OI'],
			source: [[1_700_000_000_000, 10, 50]]
		})
	})

	test('uses protocol revenue methodology and falls back to revenue methodology', async () => {
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

	test('uses chain fee metadata to qualify chain-native rankings with one base request', async () => {
		fetchJsonMock.mockResolvedValue(
			adapterMetricsResponse({
				protocols: [
					adapterProtocolRow({
						name: 'Base',
						slug: 'base',
						protocolType: 'chain',
						total24h: 100,
						total7d: 700,
						total30d: 3000
					}),
					adapterProtocolRow({
						name: 'Sui',
						slug: 'sui',
						protocolType: 'chain',
						total24h: 200,
						total7d: 1400,
						total30d: 6000
					}),
					adapterProtocolRow({ name: 'App Only', slug: 'app-only', protocolType: 'chain', total24h: 300 }),
					adapterProtocolRow({ name: 'Protocol Row', slug: 'protocol-row', protocolType: 'protocol', total24h: 400 })
				]
			})
		)

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

	test('uses chain revenue metadata and excludes app-only chains', async () => {
		fetchJsonMock.mockResolvedValue(
			adapterMetricsResponse({
				protocols: [
					adapterProtocolRow({ name: 'Base', slug: 'base', protocolType: 'chain', total24h: 100 }),
					adapterProtocolRow({ name: 'Sui', slug: 'sui', protocolType: 'chain', total24h: 200 }),
					adapterProtocolRow({ name: 'App Only', slug: 'app-only', protocolType: 'chain', total24h: 300 })
				]
			})
		)

		const data = await getChainsByChainNativeFeeRevenuePageData({
			adapterType: ADAPTER_TYPES.FEES,
			dataType: ADAPTER_DATA_TYPES.DAILY_REVENUE,
			chainMetadata: feeRevenueChainMetadata
		})

		expect(data.allChains).toEqual(['Sui'])
		expect(data.chains.map((chain) => chain.name)).toEqual(['Sui'])
	})

	test('keeps REV requests paired with their chain when one protocol request fails', async () => {
		fetchJsonMock.mockImplementation((url: string) => {
			const pathname = new URL(url).pathname
			if (pathname.endsWith('/chain/ethereum')) {
				return Promise.resolve(
					adapterMetricsResponse({
						protocols: [adapterProtocolRow({ slug: 'flashbots', total24h: 10, total30d: 30 })]
					})
				)
			}
			if (pathname.endsWith('/chain/solana')) return Promise.reject(new Error('solana unavailable'))
			return Promise.resolve(
				adapterMetricsResponse({
					protocols: [
						adapterProtocolRow({ slug: 'ethereum', total24h: 100, total30d: 300 }),
						adapterProtocolRow({ slug: 'solana', total24h: 200, total30d: 600 })
					]
				})
			)
		})

		const data = await getChainsByREVPageData({
			chainMetadata: {
				ethereum: { id: 'ethereum', name: 'Ethereum', chainFees: true },
				solana: { id: 'solana', name: 'Solana', chainFees: true }
			}
		})

		expect(data.chains).toEqual([
			expect.objectContaining({ name: 'Solana', slug: 'solana', total24h: 200, total30d: 600 }),
			expect.objectContaining({ name: 'Ethereum', slug: 'ethereum', total24h: 110, total30d: 330 })
		])
	})
})
