import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ProtocolLite, ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import type { ILsdRateApiItem, IProtocolDetailApiItem, IYieldPoolApiItem } from '../api.types'
import { buildLstInflowsData, buildLstInflowsSeriesData } from '../chartData'
import { getLSTPageData } from '../queries'

const mocks = vi.hoisted(() => ({
	fetchProtocols: vi.fn<() => Promise<ProtocolsResponse>>(),
	fetchProtocolBySlug: vi.fn<(protocolSlug: string) => Promise<IProtocolDetailApiItem>>(),
	fetchYieldPools: vi.fn<() => Promise<Array<IYieldPoolApiItem>>>(),
	fetchLsdRates: vi.fn<() => Promise<Array<ILsdRateApiItem>>>(),
	fetchEthPrice: vi.fn<() => Promise<number | null>>()
}))

vi.mock('~/containers/ProtocolLists/api', () => ({
	fetchProtocols: mocks.fetchProtocols
}))

vi.mock('../api', () => ({
	fetchProtocolBySlug: mocks.fetchProtocolBySlug,
	fetchYieldPools: mocks.fetchYieldPools,
	fetchLsdRates: mocks.fetchLsdRates,
	fetchEthPrice: mocks.fetchEthPrice
}))

function protocolLite({
	name,
	category = 'Liquid Staking',
	chains = ['Ethereum']
}: {
	name: string
	category?: string
	chains?: Array<string>
}): ProtocolLite {
	return {
		name,
		symbol: '',
		logo: '',
		url: '',
		category,
		chains,
		chainTvls: {},
		tvl: 0,
		tvlPrevDay: 0,
		tvlPrevWeek: 0,
		tvlPrevMonth: 0,
		mcap: null,
		defillamaId: name,
		geckoId: null
	}
}

function protocolDetail({
	name,
	logo = `${name}.png`,
	tokens,
	tokensInUsd,
	chain = 'Ethereum'
}: {
	name: string
	logo?: string | null
	tokens?: Array<{ date: number; tokens: Record<string, number> }>
	tokensInUsd?: Array<{ date: number; tokens: Record<string, number> }>
	chain?: string
}): IProtocolDetailApiItem {
	return {
		name,
		logo,
		mcap: null,
		chainTvls: {
			[chain]: {
				tokens: tokens ?? [],
				tokensInUsd: tokensInUsd ?? []
			}
		}
	}
}

describe('getLSTPageData', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.fetchLsdRates.mockResolvedValue([])
	})

	test('preserves LST token ordering, one output population, and Lido-required history rows', async () => {
		const earlyDate = 1_608_249_600
		const missingLidoDate = 1_608_422_400
		const latestDate = 1_609_027_200

		mocks.fetchProtocols.mockResolvedValue({
			protocols: [
				protocolLite({ name: 'Lido' }),
				protocolLite({ name: 'Rocket Pool' }),
				protocolLite({ name: 'diva' }),
				protocolLite({ name: 'StakeHound' }),
				protocolLite({ name: 'Curve', category: 'Dexes' })
			],
			chains: ['Ethereum'],
			parentProtocols: [],
			protocolCategories: ['Liquid Staking', 'Dexes']
		})

		mocks.fetchYieldPools.mockResolvedValue([
			{ project: 'lido', chain: 'Ethereum', symbol: 'STETH', apy: 3, tvlUsd: 300 },
			{ project: 'rocket-pool', chain: 'Ethereum', symbol: 'RETH', apy: 2, tvlUsd: 200 },
			{ project: 'diva', chain: 'Ethereum', symbol: 'DIVAETH', apy: 1, tvlUsd: 100 }
		])
		mocks.fetchEthPrice.mockResolvedValue(2000)
		mocks.fetchLsdRates.mockResolvedValue([
			{
				name: 'Lido',
				symbol: 'stETH',
				address: '0xlido',
				type: 'rebase',
				ethPeg: -0.1,
				marketRate: 0.999,
				expectedRate: 1,
				fee: 0.1
			}
		])

		const protocolDetails: Record<string, IProtocolDetailApiItem> = {
			lido: protocolDetail({
				name: 'Lido',
				logo: null,
				tokens: [
					{ date: earlyDate, tokens: { ETH: 100 } },
					{ date: latestDate, tokens: { ETH: 110 } }
				],
				tokensInUsd: [{ date: latestDate, tokens: { ETH: 220_000 } }]
			}),
			'rocket-pool': protocolDetail({
				name: 'Rocket Pool',
				tokens: [
					{ date: earlyDate, tokens: { ETH: 50 } },
					{ date: missingLidoDate, tokens: { ETH: 70 } },
					{ date: latestDate, tokens: { ETH: 80 } }
				],
				tokensInUsd: [{ date: latestDate, tokens: { ETH: 160_000 } }]
			}),
			diva: protocolDetail({
				name: 'diva',
				tokens: [{ date: latestDate, tokens: { ETH: 5 } }],
				tokensInUsd: [{ date: latestDate, tokens: { ETH: 10_000 } }]
			}),
			'crypto.com-liquid-staking': protocolDetail({
				name: 'Crypto.com Liquid Staking',
				chain: 'Cronos',
				tokens: [],
				tokensInUsd: []
			})
		}
		mocks.fetchProtocolBySlug.mockImplementation(async (protocolSlug) => {
			const detail = protocolDetails[protocolSlug]
			if (!detail) throw new Error(`Unexpected protocol slug: ${protocolSlug}`)
			return detail
		})

		const result = await getLSTPageData({ generationId: 'test-gen', generatedAt: 0, readJson: vi.fn() })
		const firstAreaRow = result.areaChartData[0]
		const firstTokenRow = result.tokensList[0]
		if (!firstAreaRow || !firstTokenRow) throw new Error('Expected LST chart and token rows')

		expect(result.tokens).toEqual(['Lido', 'Rocket Pool', 'diva'])
		expect(result.tokensList.map((row) => row.name)).toEqual(['Lido', 'Rocket Pool', 'diva'])
		expect(result.stakedEthSum).toBe(195)
		expect(result.stakedEthInUsdSum).toBe(390_000)
		expect(result.areaChartData.map((row) => row.date)).toEqual([earlyDate, latestDate])
		expect(firstAreaRow.Lido).toBe(100)
		expect(firstAreaRow['Rocket Pool']).toBe(50)
		expect(firstTokenRow.marketShare).toBeCloseTo((110 / 195) * 100)
		expect(firstTokenRow.apy).toBe(3)
		expect(firstTokenRow.logo).toBeNull()
		expect(firstTokenRow).toMatchObject({
			protocolSlug: 'lido',
			lsdSymbol: 'stETH',
			ethPeg: { deviation: -0.1, marketRate: 0.999, expectedRate: 1 },
			fee: 10
		})
		expect(result).toMatchObject({ ratesAvailable: true, apyAvailable: true })

		const inflowsData = buildLstInflowsData({ inflowsChartData: result.inflowsChartData, groupBy: 'daily' })
		const inflowsChart = buildLstInflowsSeriesData({
			inflowsData,
			tokens: result.tokens,
			lsdColors: result.lsdColors,
			barChartStacks: result.barChartStacks
		})
		expect(inflowsChart.dataset).toEqual({
			dimensions: ['timestamp', 'Lido', 'Rocket Pool', 'diva'],
			source: [
				[missingLidoDate * 1000, undefined, 20, undefined],
				[latestDate * 1000, 10, 10, undefined]
			]
		})
		expect(inflowsChart.barCharts.map(({ name, encode, stack }) => ({ name, encode, stack }))).toEqual([
			{ name: 'Lido', encode: { x: 0, y: 1 }, stack: 'A' },
			{ name: 'Rocket Pool', encode: { x: 0, y: 2 }, stack: 'A' },
			{ name: 'diva', encode: { x: 0, y: 3 }, stack: undefined }
		])

		mocks.fetchLsdRates.mockRejectedValueOnce(new Error('legacy rates unavailable'))
		const resultWithoutLegacyRates = await getLSTPageData({
			generationId: 'test-gen',
			generatedAt: 0,
			readJson: vi.fn()
		})

		expect(resultWithoutLegacyRates.tokensList[0]).toMatchObject({
			apy: 3,
			lsdSymbol: null,
			ethPeg: null,
			fee: null
		})
		expect(resultWithoutLegacyRates).toMatchObject({ ratesAvailable: false, apyAvailable: true })
	})

	test('rejects when a required member history is unavailable', async () => {
		mocks.fetchProtocols.mockResolvedValue({
			protocols: [protocolLite({ name: 'Lido' }), protocolLite({ name: 'Rocket Pool' })],
			chains: ['Ethereum'],
			parentProtocols: [],
			protocolCategories: ['Liquid Staking']
		})
		mocks.fetchYieldPools.mockResolvedValue([])
		mocks.fetchEthPrice.mockResolvedValue(0)
		mocks.fetchProtocolBySlug.mockImplementation(async (protocolSlug) => {
			if (protocolSlug === 'rocket-pool') throw new Error('member history unavailable')
			return protocolDetail({ name: protocolSlug, tokens: [], tokensInUsd: [] })
		})

		await expect(getLSTPageData({ generationId: 'test-gen', generatedAt: 0, readJson: vi.fn() })).rejects.toThrow(
			'member history unavailable'
		)
	})

	test('selects APY by exact LST symbol before largest-pool fallback', async () => {
		const latestDate = 1_609_027_200
		mocks.fetchProtocols.mockResolvedValue({
			protocols: [protocolLite({ name: 'Lido' })],
			chains: ['Ethereum'],
			parentProtocols: [],
			protocolCategories: ['Liquid Staking']
		})
		mocks.fetchYieldPools.mockResolvedValue([
			{ project: 'lido', chain: 'Ethereum', symbol: 'ETH', apy: 3, tvlUsd: 500 },
			{ project: 'lido', chain: 'Ethereum', symbol: 'stETH', apy: 2, tvlUsd: 100 }
		])
		mocks.fetchLsdRates.mockResolvedValue([
			{
				name: 'Lido',
				symbol: 'stETH',
				address: '0xlido',
				type: 'rebase',
				ethPeg: null,
				marketRate: null,
				expectedRate: 1,
				fee: null
			}
		])
		mocks.fetchEthPrice.mockResolvedValue(2000)
		mocks.fetchProtocolBySlug.mockImplementation(async (protocolSlug) =>
			protocolSlug === 'lido'
				? protocolDetail({
						name: 'Lido',
						tokens: [{ date: latestDate, tokens: { ETH: 10 } }],
						tokensInUsd: [{ date: latestDate, tokens: { ETH: 20_000 } }]
					})
				: protocolDetail({ name: 'Crypto.com Liquid Staking', chain: 'Cronos' })
		)

		const exactSymbol = await getLSTPageData({ generationId: 'test-gen', generatedAt: 0, readJson: vi.fn() })
		expect(exactSymbol.tokensList[0]?.apy).toBe(2)

		mocks.fetchLsdRates.mockResolvedValueOnce([])
		const largestPool = await getLSTPageData({ generationId: 'test-gen', generatedAt: 0, readJson: vi.fn() })
		expect(largestPool.tokensList[0]?.apy).toBe(3)
	})

	test('joins APY with canonical member identity instead of reconstructed casing', async () => {
		const latestDate = 1_609_027_200
		mocks.fetchProtocols.mockResolvedValue({
			protocols: [protocolLite({ name: 'mETH Protocol' })],
			chains: ['Ethereum'],
			parentProtocols: [],
			protocolCategories: ['Liquid Staking']
		})
		mocks.fetchYieldPools.mockResolvedValue([
			{ project: 'meth-protocol', chain: 'Ethereum', symbol: 'mETH', apy: 1.34, tvlUsd: 591_000_000 }
		])
		mocks.fetchLsdRates.mockResolvedValue([
			{
				name: 'mETH Protocol',
				symbol: 'mETH',
				address: '0xmeth',
				type: 'accruing',
				ethPeg: null,
				marketRate: null,
				expectedRate: 1,
				fee: null
			}
		])
		mocks.fetchEthPrice.mockResolvedValue(null)
		mocks.fetchProtocolBySlug.mockImplementation(async (protocolSlug) =>
			protocolSlug === 'meth-protocol'
				? protocolDetail({
						name: 'mETH Protocol',
						tokens: [{ date: latestDate, tokens: { ETH: 10 } }],
						tokensInUsd: [{ date: latestDate, tokens: { ETH: 20_000 } }]
					})
				: protocolDetail({ name: 'Crypto.com Liquid Staking', chain: 'Cronos' })
		)

		const result = await getLSTPageData({ generationId: 'test-gen', generatedAt: 0, readJson: vi.fn() })
		expect(result.tokensList[0]).toMatchObject({ name: 'mETH Protocol', apy: 1.34 })
	})

	test('distinguishes successful empty optional sources from source failure', async () => {
		mocks.fetchProtocols.mockResolvedValue({
			protocols: [],
			chains: [],
			parentProtocols: [],
			protocolCategories: []
		})
		mocks.fetchYieldPools.mockResolvedValue([])
		mocks.fetchLsdRates.mockResolvedValue([])
		mocks.fetchEthPrice.mockResolvedValue(null)
		mocks.fetchProtocolBySlug.mockResolvedValue(protocolDetail({ name: 'Crypto.com Liquid Staking', chain: 'Cronos' }))

		const successfulEmpty = await getLSTPageData({ generationId: 'test-gen', generatedAt: 0, readJson: vi.fn() })
		expect(successfulEmpty).toMatchObject({ ratesAvailable: true, apyAvailable: true })

		mocks.fetchLsdRates.mockRejectedValueOnce(new Error('rates unavailable'))
		mocks.fetchYieldPools.mockRejectedValueOnce(new Error('yields unavailable'))
		const unavailable = await getLSTPageData({ generationId: 'test-gen', generatedAt: 0, readJson: vi.fn() })
		expect(unavailable).toMatchObject({ ratesAvailable: false, apyAvailable: false })

		const missingSnapshot = await getLSTPageData(null)
		expect(missingSnapshot).toMatchObject({ ratesAvailable: true, apyAvailable: false })
		expect(mocks.fetchYieldPools).toHaveBeenCalledTimes(2)
	})

	test('keeps daily multi-token history summed while current ETH uses the largest token balance', async () => {
		const day = 1_700_006_400
		mocks.fetchProtocols.mockResolvedValue({
			protocols: [protocolLite({ name: 'Lido' })],
			chains: ['Ethereum'],
			parentProtocols: [],
			protocolCategories: ['Liquid Staking']
		})
		mocks.fetchYieldPools.mockResolvedValue([])
		mocks.fetchEthPrice.mockResolvedValue(2000)
		mocks.fetchProtocolBySlug.mockImplementation(async (protocolSlug) =>
			protocolSlug === 'lido'
				? protocolDetail({
						name: 'Lido',
						tokens: [
							{ date: day, tokens: { WETH: 50, stETH: 5 } },
							{ date: day + 3600, tokens: { WETH: 60, stETH: 6 } }
						],
						tokensInUsd: [{ date: day + 3600, tokens: { WETH: 120_000, stETH: 12_000 } }]
					})
				: protocolDetail({ name: 'Crypto.com Liquid Staking', chain: 'Cronos' })
		)

		const result = await getLSTPageData({ generationId: 'test-gen', generatedAt: 0, readJson: vi.fn() })
		expect(result.areaChartData).toEqual([{ date: day, Lido: 55 }])
		expect(result.tokensList[0]).toMatchObject({ stakedEth: 60, stakedEthInUsd: 120_000 })
	})

	test('combines Binance Ethereum and BSC balances only at Ethereum timestamps', async () => {
		const day1 = 1_500_000_000
		const day2 = day1 + 86_400
		const bscOnlyDay = day2 + 86_400
		mocks.fetchProtocols.mockResolvedValue({
			protocols: [protocolLite({ name: 'Binance staked ETH' })],
			chains: ['Ethereum'],
			parentProtocols: [],
			protocolCategories: ['Liquid Staking']
		})
		mocks.fetchYieldPools.mockResolvedValue([])
		mocks.fetchEthPrice.mockResolvedValue(null)
		mocks.fetchProtocolBySlug.mockImplementation(async (protocolSlug) => {
			if (protocolSlug !== 'binance-staked-eth') {
				return protocolDetail({ name: 'Crypto.com Liquid Staking', chain: 'Cronos' })
			}
			return {
				name: 'Binance staked ETH',
				logo: null,
				mcap: null,
				chainTvls: {
					Ethereum: {
						tokens: [
							{ date: day1, tokens: { ETH: 10 } },
							{ date: day2, tokens: { ETH: 20 } }
						],
						tokensInUsd: [
							{ date: day1, tokens: { ETH: 20_000 } },
							{ date: day2, tokens: { ETH: 40_000 } }
						]
					},
					BSC: {
						tokens: [
							{ date: day2, tokens: { ETH: 5 } },
							{ date: bscOnlyDay, tokens: { ETH: 7 } }
						],
						tokensInUsd: [
							{ date: day2, tokens: { ETH: 10_000 } },
							{ date: bscOnlyDay, tokens: { ETH: 14_000 } }
						]
					}
				}
			}
		})

		const result = await getLSTPageData({ generationId: 'test-gen', generatedAt: 0, readJson: vi.fn() })
		expect(result.areaChartData.map((row) => row['Binance staked ETH'])).toEqual([10, 25])
		expect(result.tokensList[0]).toMatchObject({ stakedEth: 25, stakedEthInUsd: 50_000 })
	})

	test('preserves unavailable and explicit-zero LST measurements', async () => {
		const latestDate = 1_609_027_200
		mocks.fetchProtocols.mockResolvedValue({
			protocols: [protocolLite({ name: 'Lido' })],
			chains: ['Ethereum'],
			parentProtocols: [],
			protocolCategories: ['Liquid Staking']
		})
		mocks.fetchYieldPools.mockResolvedValue([
			{ project: 'lido', chain: 'Ethereum', symbol: 'stETH', apy: 0, tvlUsd: 100 }
		])
		mocks.fetchEthPrice.mockResolvedValue(null)
		mocks.fetchLsdRates.mockResolvedValue([
			{
				name: 'Lido',
				symbol: 'stETH',
				address: '0xlido',
				type: 'rebase',
				ethPeg: 0,
				marketRate: 1,
				expectedRate: 1,
				fee: 0
			}
		])
		mocks.fetchProtocolBySlug.mockImplementation(async (protocolSlug) =>
			protocolSlug === 'lido'
				? protocolDetail({
						name: 'Lido',
						tokens: [
							{ date: latestDate - 30 * 86_400, tokens: { ETH: 0 } },
							{ date: latestDate - 7 * 86_400, tokens: { ETH: 0 } },
							{ date: latestDate, tokens: { ETH: 10 } }
						],
						tokensInUsd: [{ date: latestDate - 86_400, tokens: { ETH: 999_000 } }]
					})
				: protocolDetail({ name: 'Crypto.com Liquid Staking', chain: 'Cronos', tokens: [], tokensInUsd: [] })
		)

		const unavailableUsd = await getLSTPageData({ generationId: 'test-gen', generatedAt: 0, readJson: vi.fn() })
		expect(unavailableUsd.stakedEthInUsdSum).toBeNull()
		expect(unavailableUsd.tokensList[0]).toMatchObject({
			stakedEthInUsd: null,
			stakedEthPctChange7d: null,
			stakedEthPctChange30d: null,
			ethPeg: { deviation: 0, marketRate: 1, expectedRate: 1 },
			apy: 0,
			fee: 0
		})

		mocks.fetchProtocolBySlug.mockImplementation(async (protocolSlug) =>
			protocolSlug === 'lido'
				? protocolDetail({
						name: 'Lido',
						tokens: [{ date: latestDate, tokens: { ETH: 10 } }],
						tokensInUsd: [{ date: latestDate, tokens: { ETH: 0 } }]
					})
				: protocolDetail({ name: 'Crypto.com Liquid Staking', chain: 'Cronos', tokens: [], tokensInUsd: [] })
		)
		const explicitZeroUsd = await getLSTPageData({ generationId: 'test-gen', generatedAt: 0, readJson: vi.fn() })
		expect(explicitZeroUsd.stakedEthInUsdSum).toBe(0)
		expect(explicitZeroUsd.tokensList[0]?.stakedEthInUsd).toBe(0)
	})
})
