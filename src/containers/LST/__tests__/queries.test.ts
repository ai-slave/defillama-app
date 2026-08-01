import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProtocolLite, ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import type { ILsdRateApiItem, IProtocolDetailApiItem, IYieldPoolApiItem } from '../api.types'
import { buildLstInflowsData, buildLstInflowsSeriesData } from '../chartData'
import { getLSTPageData } from '../queries'

const mocks = vi.hoisted(() => ({
	fetchProtocols: vi.fn<() => Promise<ProtocolsResponse>>(),
	fetchProtocolBySlug: vi.fn<(protocolSlug: string) => Promise<IProtocolDetailApiItem>>(),
	fetchYieldPools: vi.fn<() => Promise<{ data: IYieldPoolApiItem[] }>>(),
	fetchLsdRates: vi.fn<() => Promise<ILsdRateApiItem[]>>(),
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
	chains?: string[]
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
	tokens?: Array<{ date: number; tokens: Record<string, number> }> | null
	tokensInUsd?: Array<{ date: number; tokens: Record<string, number> }> | null
	chain?: string
}): IProtocolDetailApiItem {
	return {
		name,
		logo,
		mcap: null,
		chainTvls: {
			[chain]: {
				...(tokens === undefined ? {} : { tokens }),
				...(tokensInUsd === undefined ? {} : { tokensInUsd })
			}
		}
	}
}

describe('getLSTPageData', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.fetchLsdRates.mockResolvedValue([])
	})

	it('preserves LST token ordering, table exclusions, and Lido-required history rows', async () => {
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

		mocks.fetchYieldPools.mockResolvedValue({
			data: [
				{ project: 'lido', chain: 'Ethereum', symbol: 'STETH', apy: 3 },
				{ project: 'rocket-pool', chain: 'Ethereum', symbol: 'RETH', apy: 2 },
				{ project: 'diva', chain: 'Ethereum', symbol: 'DIVAETH', apy: 1 }
			]
		})
		mocks.fetchEthPrice.mockResolvedValue(2_000)
		mocks.fetchLsdRates.mockResolvedValue([
			{
				name: 'Lido',
				symbol: 'stETH',
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
				tokens: null,
				tokensInUsd: null
			})
		}
		mocks.fetchProtocolBySlug.mockImplementation(async (protocolSlug) => {
			const detail = protocolDetails[protocolSlug]
			if (!detail) throw new Error(`Unexpected protocol slug: ${protocolSlug}`)
			return detail
		})

		const result = await getLSTPageData({ readJson: vi.fn() })
		const firstAreaRow = result.areaChartData[0]
		const firstTokenRow = result.tokensList[0]
		if (!firstAreaRow || !firstTokenRow) throw new Error('Expected LST chart and token rows')

		expect(result.tokens).toEqual(['Lido', 'Rocket Pool', 'diva'])
		expect(result.tokensList.map((row) => row.name)).toEqual(['Lido', 'Rocket Pool'])
		expect(result.stakedEthSum).toBe(195)
		expect(result.stakedEthInUsdSum).toBe(390_000)
		expect(result.areaChartData.map((row) => row.date)).toEqual([earlyDate, latestDate])
		expect(firstAreaRow.Lido).toBe(100)
		expect(firstAreaRow['Rocket Pool']).toBe(50)
		expect(firstTokenRow.marketShare).toBeCloseTo((110 / 195) * 100)
		expect(firstTokenRow.apy).toBe(3)
		expect(firstTokenRow.logo).toBeNull()
		expect(firstTokenRow).toMatchObject({
			lsdSymbol: 'stETH',
			ethPeg: -0.1,
			marketRate: 0.999,
			expectedRate: 1,
			fee: 10
		})

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
				[missingLidoDate * 1_000, undefined, 20, undefined],
				[latestDate * 1_000, 10, 10, undefined]
			]
		})
		expect(inflowsChart.barCharts.map(({ name, encode, stack }) => ({ name, encode, stack }))).toEqual([
			{ name: 'Lido', encode: { x: 0, y: 1 }, stack: 'A' },
			{ name: 'Rocket Pool', encode: { x: 0, y: 2 }, stack: 'A' },
			{ name: 'diva', encode: { x: 0, y: 3 }, stack: undefined }
		])

		mocks.fetchLsdRates.mockRejectedValueOnce(new Error('legacy rates unavailable'))
		const resultWithoutLegacyRates = await getLSTPageData({ readJson: vi.fn() })

		expect(resultWithoutLegacyRates.tokensList[0]).toMatchObject({
			apy: 3,
			lsdSymbol: null,
			ethPeg: null,
			fee: null
		})
	})

	it('rejects when a required member history is unavailable', async () => {
		mocks.fetchProtocols.mockResolvedValue({
			protocols: [protocolLite({ name: 'Lido' }), protocolLite({ name: 'Rocket Pool' })],
			chains: ['Ethereum'],
			parentProtocols: [],
			protocolCategories: ['Liquid Staking']
		})
		mocks.fetchYieldPools.mockResolvedValue({ data: [] })
		mocks.fetchEthPrice.mockResolvedValue(0)
		mocks.fetchProtocolBySlug.mockImplementation(async (protocolSlug) => {
			if (protocolSlug === 'rocket-pool') throw new Error('member history unavailable')
			return protocolDetail({ name: protocolSlug, tokens: null, tokensInUsd: null })
		})

		await expect(getLSTPageData({ readJson: vi.fn() })).rejects.toThrow('member history unavailable')
	})

	it('preserves unavailable and explicit-zero LST measurements', async () => {
		const latestDate = 1_609_027_200
		mocks.fetchProtocols.mockResolvedValue({
			protocols: [protocolLite({ name: 'Lido' })],
			chains: ['Ethereum'],
			parentProtocols: [],
			protocolCategories: ['Liquid Staking']
		})
		mocks.fetchYieldPools.mockResolvedValue({ data: [] })
		mocks.fetchEthPrice.mockResolvedValue(null)
		mocks.fetchLsdRates.mockResolvedValue([
			{
				name: 'Lido',
				symbol: 'stETH',
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
				: protocolDetail({ name: 'Crypto.com Liquid Staking', chain: 'Cronos', tokens: null, tokensInUsd: null })
		)

		const unavailableUsd = await getLSTPageData({ readJson: vi.fn() })
		expect(unavailableUsd.stakedEthInUsdSum).toBeNull()
		expect(unavailableUsd.tokensList[0]).toMatchObject({
			stakedEthInUsd: null,
			stakedEthPctChange7d: null,
			stakedEthPctChange30d: null,
			fee: 0
		})

		mocks.fetchProtocolBySlug.mockImplementation(async (protocolSlug) =>
			protocolSlug === 'lido'
				? protocolDetail({
						name: 'Lido',
						tokens: [{ date: latestDate, tokens: { ETH: 10 } }],
						tokensInUsd: [{ date: latestDate, tokens: { ETH: 0 } }]
					})
				: protocolDetail({ name: 'Crypto.com Liquid Staking', chain: 'Cronos', tokens: null, tokensInUsd: null })
		)
		const explicitZeroUsd = await getLSTPageData({ readJson: vi.fn() })
		expect(explicitZeroUsd.stakedEthInUsdSum).toBe(0)
		expect(explicitZeroUsd.tokensList[0]?.stakedEthInUsd).toBe(0)
	})
})
