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

vi.mock('~/containers/ProtocolOverview/api', () => ({
	fetchProtocolBySlug: mocks.fetchProtocolBySlug
}))

vi.mock('../api', () => ({
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
		defillamaId: name
	}
}

function protocolDetail({
	name,
	tokens,
	tokensInUsd,
	chain = 'Ethereum'
}: {
	name: string
	tokens?: Array<{ date: number; tokens: Record<string, number> }>
	tokensInUsd?: Array<{ date: number; tokens: Record<string, number> }>
	chain?: string
}): IProtocolDetailApiItem {
	return {
		name,
		logo: `${name}.png`,
		mcap: null,
		chainTvls: {
			[chain]: {
				tokens,
				tokensInUsd
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
			parentProtocols: []
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
				chain: 'Cronos'
			})
		}
		mocks.fetchProtocolBySlug.mockImplementation(async (protocolSlug) => {
			const detail = protocolDetails[protocolSlug]
			if (!detail) throw new Error(`Unexpected protocol slug: ${protocolSlug}`)
			return detail
		})

		const result = await getLSTPageData({ readJson: vi.fn() })

		expect(result.tokens).toEqual(['Lido', 'Rocket Pool', 'diva'])
		expect(result.tokensList.map((row) => row.name)).toEqual(['Lido', 'Rocket Pool'])
		expect(result.stakedEthSum).toBe(195)
		expect(result.stakedEthInUsdSum).toBe(390_000)
		expect(result.areaChartData.map((row) => row.date)).toEqual([earlyDate, latestDate])
		expect(result.areaChartData[0].Lido).toBeCloseTo((100 / 150) * 100)
		expect(result.areaChartData[0]['Rocket Pool']).toBeCloseTo((50 / 150) * 100)
		expect(result.tokensList[0].marketShare).toBeCloseTo((110 / 195) * 100)
		expect(result.tokensList[0].apy).toBe(3)
		expect(result.tokensList[0]).toMatchObject({
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
				{ timestamp: missingLidoDate * 1_000, 'Rocket Pool': 20 },
				{ timestamp: latestDate * 1_000, Lido: 10, 'Rocket Pool': 10 }
			]
		})
		expect(inflowsChart.barCharts.map(({ name, encode, stack }) => ({ name, encode, stack }))).toEqual([
			{ name: 'Lido', encode: { x: 'timestamp', y: 'Lido' }, stack: 'A' },
			{ name: 'Rocket Pool', encode: { x: 'timestamp', y: 'Rocket Pool' }, stack: 'A' },
			{ name: 'diva', encode: { x: 'timestamp', y: 'diva' }, stack: undefined }
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
})
