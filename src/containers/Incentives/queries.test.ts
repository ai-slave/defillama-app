import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdapterChainProtocol } from '~/containers/AdapterMetrics/api.types'
import { getDimensionChainNameMap } from '~/containers/AdapterMetrics/chainNameMap'
import { fetchEmissionsBreakdownAggregated } from './api'
import type { EmissionsBreakdownAggregatedResponse, EmissionsBreakdownProtocol } from './api.types'
import { getDimensionAdapterChainEarningsOverview } from './queries'
import type { DimensionEarningsOverviewResult } from './types'

vi.mock('./api', () => ({
	fetchEmissionsBreakdownAggregated: vi.fn()
}))
vi.mock('~/containers/AdapterMetrics/chainNameMap', () => ({ getDimensionChainNameMap: vi.fn() }))

function protocol(overrides: Partial<AdapterChainProtocol> = {}): AdapterChainProtocol {
	return {
		defillamaId: 'protocol-a',
		name: 'Protocol A',
		displayName: 'Protocol A',
		module: 'protocol-a',
		category: 'Dexs',
		logo: '',
		chains: ['Ethereum'],
		protocolType: 'protocol',
		methodologyURL: null,
		methodology: null,
		slug: 'protocol-a',
		id: 'protocol-a',
		breakdown24h: { Ethereum: { 'Protocol A': 100 } },
		breakdown30d: { Ethereum: { 'Protocol A': 3_000 } },
		total24h: 100,
		total7d: 700,
		total30d: 3_000,
		total1y: 36_500,
		totalAllTime: 50_000,
		...overrides
	}
}

function emissionsProtocol(overrides: Partial<EmissionsBreakdownProtocol> = {}): EmissionsBreakdownProtocol {
	return {
		name: 'Protocol A',
		defillamaId: 'protocol-a',
		linked: [],
		category: 'Dexs',
		chain: '',
		emission24h: 10,
		emission7d: 70,
		emission30d: 300,
		emissions1y: 3_650,
		emissionsAllTime: 5_000,
		emissionsAverage1y: 10,
		emissionsMonthlyAverage1y: 300,
		...overrides
	}
}

function emissionsResponse(protocols: EmissionsBreakdownProtocol[]): EmissionsBreakdownAggregatedResponse {
	return {
		protocols,
		emission24h: 0,
		emission7d: 0,
		emission30d: 0,
		emissionsMonthlyAverage1y: 0
	}
}

function requireAvailable(result: DimensionEarningsOverviewResult) {
	expect(result.status).toBe('available')
	if (result.status !== 'available') throw new Error('Expected available earnings')
	return result.overview
}

describe('dimension earnings aggregation', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(getDimensionChainNameMap).mockResolvedValue({ Ethereum: 'Ethereum' })
	})

	it('subtracts the producer annual and all-time emission fields', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(emissionsResponse([emissionsProtocol()]))

		const result = requireAvailable(
			await getDimensionAdapterChainEarningsOverview({
				chain: 'All',
				overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
				totalDataChart: []
			})
		)

		expect(result.protocols[0]).toMatchObject({ total1y: 32_850, totalAllTime: 45_000 })
		expect(result).toMatchObject({
			total1y: 32_850,
			totalAllTime: 45_000,
			annualized1y: null,
			change_1d: null
		})
		expect(getDimensionChainNameMap).not.toHaveBeenCalled()
	})

	it('does not let an inactive child hide its active parent aggregation', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(emissionsResponse([]))
		const parentProtocol = 'parent#protocol'

		const result = requireAvailable(
			await getDimensionAdapterChainEarningsOverview({
				chain: 'All',
				overviewData: {
					allChains: ['Ethereum'],
					protocols: [
						protocol({ parentProtocol }),
						protocol({
							defillamaId: 'protocol-b',
							name: 'Protocol B',
							displayName: 'Protocol B',
							parentProtocol,
							total24h: null,
							breakdown24h: null
						})
					]
				},
				totalDataChart: []
			})
		)

		expect(result.protocols).toHaveLength(1)
		expect(result.protocols[0]).toMatchObject({
			total24h: 100,
			breakdown24h: { Ethereum: { 'Protocol A': 100 } }
		})
		expect(result.total24h).toBe(100)
	})

	it('uses zero emissions for a protocol omitted from a successful emissions response', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(emissionsResponse([]))

		const result = requireAvailable(
			await getDimensionAdapterChainEarningsOverview({
				chain: 'All',
				overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
				totalDataChart: []
			})
		)

		expect(result.protocols[0]).toMatchObject({ total24h: 100, total7d: 700, change_1d: null })
		expect(result.total24h).toBe(100)
	})

	it('treats a nullable revenue period in a successful response as zero activity', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(
			emissionsResponse([emissionsProtocol({ emission24h: 10 })])
		)

		const result = requireAvailable(
			await getDimensionAdapterChainEarningsOverview({
				chain: 'All',
				overviewData: {
					allChains: ['Ethereum'],
					protocols: [protocol({ total24h: null, breakdown24h: null })]
				},
				totalDataChart: []
			})
		)

		expect(result.protocols[0]?.total24h).toBe(-10)
		expect(result.total24h).toBe(-10)
	})

	it('keeps selected-chain earnings unavailable when chain aliases cannot be loaded', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(emissionsResponse([]))
		vi.mocked(getDimensionChainNameMap).mockResolvedValueOnce(null)

		const result = await getDimensionAdapterChainEarningsOverview({
			chain: 'Avalanche',
			overviewData: { allChains: ['Avalanche'], protocols: [protocol()] },
			totalDataChart: []
		})

		expect(result).toEqual({ status: 'unavailable' })
	})

	it('keeps selected-chain earnings unavailable when the authoritative map has no chain identity', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(emissionsResponse([]))
		vi.mocked(getDimensionChainNameMap).mockResolvedValueOnce({ Ethereum: 'Ethereum' })

		const result = await getDimensionAdapterChainEarningsOverview({
			chain: 'Avalanche',
			overviewData: { allChains: ['Avalanche'], protocols: [protocol()] },
			totalDataChart: []
		})

		expect(result).toEqual({ status: 'unavailable' })
	})

	it('does not label all-chain earnings windows as chain-specific values', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(emissionsResponse([emissionsProtocol()]))

		const result = requireAvailable(
			await getDimensionAdapterChainEarningsOverview({
				chain: 'Ethereum',
				overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
				totalDataChart: []
			})
		)

		expect(result).toMatchObject({ total24h: 90, total7d: null, total30d: 2_700, total1y: null, totalAllTime: null })
		expect(result.protocols[0]).toMatchObject({
			total24h: 90,
			total7d: null,
			total30d: 2_700,
			total1y: null,
			totalAllTime: null
		})
		expect(getDimensionChainNameMap).toHaveBeenCalledOnce()
	})

	it('keeps a matched nullable emissions period unavailable', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(
			emissionsResponse([emissionsProtocol({ emission24h: null })])
		)

		const allChains = requireAvailable(
			await getDimensionAdapterChainEarningsOverview({
				chain: 'All',
				overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
				totalDataChart: []
			})
		)
		expect(allChains).toMatchObject({ total24h: null, total7d: 630 })

		const ethereum = requireAvailable(
			await getDimensionAdapterChainEarningsOverview({
				chain: 'Ethereum',
				overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
				totalDataChart: []
			})
		)
		expect(ethereum).toMatchObject({ total24h: null, total30d: 2_700 })
	})

	it('keeps a selected-chain period unavailable when a positive aggregate has no breakdown', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(
			emissionsResponse([emissionsProtocol({ emission24h: 0 })])
		)

		const result = requireAvailable(
			await getDimensionAdapterChainEarningsOverview({
				chain: 'Ethereum',
				overviewData: {
					allChains: ['Ethereum'],
					protocols: [protocol({ breakdown24h: null })]
				},
				totalDataChart: []
			})
		)

		expect(result).toMatchObject({ total24h: null, total30d: 2_700 })
	})

	it('does not allocate nonzero emissions over a zero revenue basis', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(
			emissionsResponse([emissionsProtocol({ emission24h: 10 })])
		)

		const result = requireAvailable(
			await getDimensionAdapterChainEarningsOverview({
				chain: 'Ethereum',
				overviewData: {
					allChains: ['Ethereum'],
					protocols: [protocol({ total24h: 0, breakdown24h: { Ethereum: {} } })]
				},
				totalDataChart: []
			})
		)

		expect(result.total24h).toBeNull()
		expect(result.protocols[0]?.total24h).toBeNull()
	})

	it('retains selected-chain protocols with activity in either supported period', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(emissionsResponse([]))
		const thirtyDayOnly = protocol({ total24h: null, breakdown24h: null })
		const dailyOnly = protocol({
			defillamaId: 'protocol-b',
			id: 'protocol-b',
			module: 'protocol-b',
			name: 'Protocol B',
			displayName: 'Protocol B',
			slug: 'protocol-b',
			total24h: 200,
			breakdown24h: { Ethereum: { 'Protocol B': 200 } },
			total30d: null,
			breakdown30d: null
		})

		const result = requireAvailable(
			await getDimensionAdapterChainEarningsOverview({
				chain: 'Ethereum',
				overviewData: { allChains: ['Ethereum'], protocols: [thirtyDayOnly, dailyOnly] },
				totalDataChart: []
			})
		)

		expect(
			result.protocols.map(({ defillamaId, total24h, total30d }) => ({ defillamaId, total24h, total30d }))
		).toEqual([
			{ defillamaId: 'protocol-a', total24h: 0, total30d: 3_000 },
			{ defillamaId: 'protocol-b', total24h: 200, total30d: 0 }
		])
		expect(result).toMatchObject({ total24h: 200, total30d: 3_000 })
	})

	it('keeps earnings unavailable when the emissions source fails', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(null)

		const result = await getDimensionAdapterChainEarningsOverview({
			chain: 'All',
			overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
			totalDataChart: [[1, 100]]
		})

		expect(result).toEqual({ status: 'unavailable' })
	})
})
