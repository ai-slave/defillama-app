import { beforeEach, describe, expect, test, vi } from 'vitest'

const {
	fetchChainsByCategoryMock,
	fetchChainsAssetsMock,
	fetchAdapterChainProtocolTotalsMock,
	getDimensionAdapterOverviewOfAllChainsMock,
	fetchStablecoinAssetsApiMock
} = vi.hoisted(() => ({
	fetchChainsByCategoryMock: vi.fn(),
	fetchChainsAssetsMock: vi.fn(),
	fetchAdapterChainProtocolTotalsMock: vi.fn(),
	getDimensionAdapterOverviewOfAllChainsMock: vi.fn(),
	fetchStablecoinAssetsApiMock: vi.fn()
}))

vi.mock('~/containers/BridgedTVL/api', () => ({
	fetchChainsAssetTotals: fetchChainsAssetsMock
}))

vi.mock('~/containers/Chains/api', () => ({
	fetchChainsByCategory: fetchChainsByCategoryMock,
	fetchNormalizedChainsByCategory: fetchChainsByCategoryMock
}))

vi.mock('~/containers/AdapterMetrics/api', () => ({
	fetchAdapterChainProtocolTotals: fetchAdapterChainProtocolTotalsMock
}))

vi.mock('~/containers/AdapterMetrics/queries', () => ({
	getDimensionAdapterOverviewOfAllChains: getDimensionAdapterOverviewOfAllChainsMock
}))

vi.mock('~/containers/Stablecoins/api', () => ({
	fetchStablecoinAssetsApi: fetchStablecoinAssetsApiMock
}))

import { getChainsByCategory, getChainsByCategoryChartData } from '../queries'

const mockChainsChartResponse = () => {
	fetchChainsByCategoryMock.mockResolvedValue({
		stackedDataset: [
			[
				'1',
				{
					Ethereum: {
						t: 100,
						d: 20,
						l: 30,
						dl: 5,
						s: 10,
						b: 15
					}
				}
			]
		],
		tvlTypes: {
			tvl: 't',
			doublecounted: 'd',
			liquidstaking: 'l',
			dcAndLsOverlap: 'dl',
			staking: 's',
			borrowed: 'b'
		}
	})
}

const chainRow = (name: string) => ({
	name,
	symbol: 'TEST',
	tvl: 100,
	tvlPrevDay: 90,
	tvlPrevWeek: 80,
	tvlPrevMonth: 70,
	mcap: null,
	mcaptvl: null,
	protocols: 1,
	extraTvl: {},
	change_1d: null,
	change_7d: null,
	change_1m: null
})

describe('chains by category chart data', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockChainsChartResponse()
		getDimensionAdapterOverviewOfAllChainsMock.mockResolvedValue({})
		fetchAdapterChainProtocolTotalsMock.mockResolvedValue({ protocols: [] })
		fetchStablecoinAssetsApiMock.mockResolvedValue({ chains: [] })
		fetchChainsAssetsMock.mockResolvedValue({})
	})

	test('returns only normalized base TVL by default', async () => {
		const data = await getChainsByCategoryChartData({ category: 'All' })

		expect(data).toEqual({
			tvlChartsByChain: {
				tvl: {
					Ethereum: {
						1000: 55
					}
				}
			},
			totalTvlByDate: {
				tvl: {
					1000: 55
				}
			}
		})
	})

	test('returns only requested extra TVL chart series and their required overlap series', async () => {
		const data = await getChainsByCategoryChartData({
			category: 'All',
			extraTvlTypes: ['staking', 'doublecounted', 'liquidstaking']
		})

		expect(data.tvlChartsByChain.borrowed).toBeUndefined()
		expect(data.tvlChartsByChain).toEqual({
			tvl: {
				Ethereum: {
					1000: 55
				}
			},
			doublecounted: {
				Ethereum: {
					1000: 20
				}
			},
			liquidstaking: {
				Ethereum: {
					1000: 30
				}
			},
			dcAndLsOverlap: {
				Ethereum: {
					1000: 5
				}
			},
			staking: {
				Ethereum: {
					1000: 10
				}
			}
		})
	})

	test('keeps all extra TVL chart series for pages that still embed chart data', async () => {
		fetchChainsAssetsMock.mockResolvedValue({
			Ethereum: {
				total: { total: 12.5 },
				canonical: { total: 10 },
				thirdParty: { total: 2.5 }
			}
		})
		fetchChainsByCategoryMock.mockResolvedValue({
			categories: [],
			chainsUnique: ['Ethereum'],
			chainTvls: [
				{
					name: 'Ethereum',
					symbol: 'ETH',
					tvl: 100,
					tvlPrevDay: 90,
					tvlPrevWeek: 80,
					tvlPrevMonth: 70,
					mcap: null,
					mcaptvl: null,
					protocols: 1,
					extraTvl: {},
					change_1d: null,
					change_7d: null,
					change_1m: null
				}
			],
			chainsGroupbyParent: {},
			stackedDataset: [
				[
					'1',
					{
						Ethereum: {
							t: 100,
							s: 10,
							b: 15
						}
					}
				]
			],
			tvlTypes: {
				tvl: 't',
				staking: 's',
				borrowed: 'b'
			}
		})

		const data = await getChainsByCategory({
			chainMetadata: {},
			category: 'All'
		})

		expect(data.tvlChartsByChain.staking).toEqual({
			Ethereum: {
				1000: 10
			}
		})
		expect(data.tvlChartsByChain.borrowed).toEqual({
			Ethereum: {
				1000: 15
			}
		})
		expect(data.chains[0]?.chainAssets?.total.total).toBe(12.5)
		expect(data.chains[0]?.chainAssets?.total).not.toHaveProperty('breakdown')
		expect(data.chains[0]?.bridgedTvl).toBe(12.5)
	})

	test('removes stale extra TVL entries when chart data is omitted from page props', async () => {
		fetchChainsByCategoryMock.mockResolvedValue({
			categories: [],
			chainsUnique: ['CosmosHub'],
			chainTvls: [
				{
					name: 'CosmosHub',
					symbol: 'ATOM',
					tvl: 100,
					tvlPrevDay: 100,
					tvlPrevWeek: 100,
					tvlPrevMonth: 100,
					mcap: null,
					mcaptvl: null,
					protocols: 1,
					extraTvl: {
						doublecounted: {
							tvl: 20,
							tvlPrevDay: 20,
							tvlPrevWeek: 20,
							tvlPrevMonth: 20
						},
						liquidstaking: {
							tvl: 30,
							tvlPrevDay: 30,
							tvlPrevWeek: 30,
							tvlPrevMonth: 30
						}
					},
					change_1d: null,
					change_7d: null,
					change_1m: null
				}
			],
			chainsGroupbyParent: {},
			stackedDataset: [
				[
					'1',
					{
						CosmosHub: {
							d: 20
						}
					}
				],
				[
					String(10 * 24 * 60 * 60),
					{
						CosmosHub: {
							t: 100,
							l: 30
						}
					}
				]
			],
			tvlTypes: {
				tvl: 't',
				doublecounted: 'd',
				liquidstaking: 'l'
			}
		})

		const data = await getChainsByCategory({
			chainMetadata: {},
			category: 'All',
			includeChartData: false
		})

		expect(data.tvlChartsByChain).toEqual({})
		expect(data.chains.map((chain) => chain.extraTvl.doublecounted)).toEqual([undefined])
		expect(data.chains).toMatchObject([
			{
				tvl: 70,
				extraTvl: { liquidstaking: { tvl: 30 } }
			}
		])
	})

	test('distinguishes an absent chain group from a populated group', async () => {
		fetchChainsByCategoryMock.mockResolvedValue({
			categories: [],
			chainsUnique: ['Example'],
			chainTvls: [chainRow('Example')],
			chainsGroupbyParent: {},
			stackedDataset: [],
			tvlTypes: { tvl: 't' }
		})

		const withoutOwnGroup = await getChainsByCategory({ chainMetadata: {}, category: 'All' })
		expect(withoutOwnGroup.chains[0]?.childGroups).toBeNull()

		fetchChainsByCategoryMock.mockResolvedValue({
			categories: [],
			chainsUnique: ['Example'],
			chainTvls: [chainRow('Example')],
			chainsGroupbyParent: { Example: { ecosystem: ['Child'] } },
			stackedDataset: [],
			tvlTypes: { tvl: 't' }
		})

		const withOwnGroup = await getChainsByCategory({ chainMetadata: {}, category: 'All' })
		expect(withOwnGroup.chains[0]?.childGroups).toEqual({ ecosystem: ['Child'] })
	})

	test('keeps core chain rows available when auxiliary asset totals fail', async () => {
		const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
		fetchChainsByCategoryMock.mockResolvedValue({
			categories: [],
			chainsUnique: ['Ethereum'],
			chainTvls: [chainRow('Ethereum')],
			chainsGroupbyParent: {},
			stackedDataset: [],
			tvlTypes: { tvl: 't' }
		})
		fetchChainsAssetsMock.mockRejectedValue(new Error('asset totals unavailable'))

		const data = await getChainsByCategory({ chainMetadata: {}, category: 'All' })

		expect(data.chains[0]?.name).toBe('Ethereum')
		expect(data.chains[0]?.chainAssets).toBeNull()
		expect(data.chains[0]?.bridgedTvl).toBeNull()
		expect(consoleLog).toHaveBeenCalledWith(expect.objectContaining({ message: 'asset totals unavailable' }))
		consoleLog.mockRestore()
	})
})

describe('chains by category source availability', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		getDimensionAdapterOverviewOfAllChainsMock.mockReturnValue({})
		fetchAdapterChainProtocolTotalsMock.mockResolvedValue({ protocols: [] })
		fetchStablecoinAssetsApiMock.mockResolvedValue({ chains: [] })
		fetchChainsAssetsMock.mockResolvedValue({})
		fetchChainsByCategoryMock.mockResolvedValue({
			categories: [],
			chainsUnique: ['Active', 'Deprecated'],
			chainTvls: [
				{ ...chainRow('Active'), tvl: 10, tvlPrevDay: 9, tvlPrevWeek: 8, tvlPrevMonth: 7 },
				{
					...chainRow('Deprecated'),
					tvl: 0,
					tvlPrevDay: 0,
					tvlPrevWeek: 0,
					tvlPrevMonth: 0,
					protocols: 0
				}
			],
			chainsGroupbyParent: { Active: { ecosystem: ['Deprecated'] } },
			stackedDataset: [],
			tvlTypes: { tvl: 't' }
		})
	})

	test('uses zero activity for absent rows in successful sources, including deprecated children', async () => {
		const result = await getChainsByCategory({
			chainMetadata: {
				active: { id: 'active', name: 'Active', protocolCount: 1 },
				deprecated: { id: 'deprecated', name: 'Deprecated', protocolCount: 0, deprecated: true }
			},
			category: 'all',
			includeChartData: false
		})

		for (const chain of result.chains) {
			expect(chain).toMatchObject({
				fees24h: 0,
				revenue24h: 0,
				appRevenue24h: 0,
				dexVolume24h: 0,
				activeUsers24h: 0,
				nftVolume24h: 0,
				stablesMcap: 0
			})
		}
	})

	test('preserves only the failed source as unavailable', async () => {
		const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
		fetchAdapterChainProtocolTotalsMock.mockImplementation(async ({ dataType }: { dataType?: string }) => {
			if (dataType === 'dailyRevenue') throw new Error('revenue unavailable')
			return { protocols: [] }
		})

		const result = await getChainsByCategory({
			chainMetadata: {
				active: { id: 'active', name: 'Active', protocolCount: 1 },
				deprecated: { id: 'deprecated', name: 'Deprecated', protocolCount: 0, deprecated: true }
			},
			category: 'all',
			includeChartData: false
		})

		expect(result.chains[0]).toMatchObject({ fees24h: 0, revenue24h: null, activeUsers24h: 0 })
		expect(consoleLog).toHaveBeenCalledWith(expect.objectContaining({ message: 'revenue unavailable' }))
		consoleLog.mockRestore()
	})
})
