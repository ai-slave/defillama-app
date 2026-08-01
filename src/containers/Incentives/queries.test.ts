import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdapterChainProtocol } from '~/containers/AdapterMetrics/api.types'
import { fetchEmissionsBreakdownAggregated, fetchEmissionsChainNameMap } from './api'
import type { EmissionsBreakdownAggregatedResponse, EmissionsBreakdownProtocol } from './api.types'
import { getDimensionAdapterChainEarningsOverview } from './queries'

vi.mock('./api', () => ({
	fetchEmissionsBreakdownAggregated: vi.fn(),
	fetchEmissionsChainNameMap: vi.fn()
}))

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

describe('dimension earnings aggregation', () => {
	beforeEach(() => {
		vi.mocked(fetchEmissionsChainNameMap).mockResolvedValue({ Ethereum: 'Ethereum' })
	})

	it('subtracts the producer annual and all-time emission fields', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(emissionsResponse([emissionsProtocol()]))

		const result = await getDimensionAdapterChainEarningsOverview({
			chain: 'All',
			overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
			totalDataChart: []
		})

		expect(result.protocols[0]).toMatchObject({ total1y: 32_850, totalAllTime: 45_000 })
		expect(result).toMatchObject({
			total1y: 32_850,
			totalAllTime: 45_000,
			annualized1y: null,
			change_1d: null
		})
	})

	it('does not let an inactive child hide its active parent aggregation', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(emissionsResponse([]))
		const parentProtocol = 'parent#protocol'

		const result = await getDimensionAdapterChainEarningsOverview({
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

		expect(result.protocols).toHaveLength(1)
		expect(result.protocols[0]).toMatchObject({
			total24h: 100,
			breakdown24h: { Ethereum: { 'Protocol A': 100 } }
		})
		expect(result.total24h).toBe(100)
	})

	it('uses zero emissions for a protocol omitted from a successful emissions response', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(emissionsResponse([]))

		const result = await getDimensionAdapterChainEarningsOverview({
			chain: 'All',
			overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
			totalDataChart: []
		})

		expect(result.protocols[0]).toMatchObject({ total24h: 100, total7d: 700, change_1d: null })
		expect(result.total24h).toBe(100)
	})

	it('treats a nullable revenue period in a successful response as zero activity', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(
			emissionsResponse([emissionsProtocol({ emission24h: 10 })])
		)

		const result = await getDimensionAdapterChainEarningsOverview({
			chain: 'All',
			overviewData: {
				allChains: ['Ethereum'],
				protocols: [protocol({ total24h: null, breakdown24h: null })]
			},
			totalDataChart: []
		})

		expect(result.protocols[0]?.total24h).toBe(-10)
		expect(result.total24h).toBe(-10)
	})

	it('keeps earnings unavailable for a nullable period on a matched emissions row', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(
			emissionsResponse([emissionsProtocol({ emission24h: null })])
		)

		const result = await getDimensionAdapterChainEarningsOverview({
			chain: 'All',
			overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
			totalDataChart: []
		})

		expect(result.protocols[0]).toMatchObject({ total24h: null, total7d: 630 })
		expect(result).toMatchObject({ total24h: null, total7d: 630 })
	})

	it('does not label all-chain earnings windows as chain-specific values', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(emissionsResponse([emissionsProtocol()]))

		const result = await getDimensionAdapterChainEarningsOverview({
			chain: 'Ethereum',
			overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
			totalDataChart: []
		})

		expect(result).toMatchObject({ total24h: 90, total7d: null, total30d: 2_700, total1y: null, totalAllTime: null })
		expect(result.protocols[0]).toMatchObject({
			total24h: 90,
			total7d: null,
			total30d: 2_700,
			total1y: null,
			totalAllTime: null
		})
	})

	it('keeps selected-chain earnings unavailable for a nullable matched emissions period', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(
			emissionsResponse([emissionsProtocol({ emission24h: null })])
		)

		const result = await getDimensionAdapterChainEarningsOverview({
			chain: 'Ethereum',
			overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
			totalDataChart: []
		})

		expect(result).toMatchObject({ total24h: null, total30d: 2_700 })
		expect(result.protocols[0]).toMatchObject({ total24h: null, total30d: 2_700 })
	})

	it('keeps a 30d-only selected-chain row and treats its inactive 24h period as zero', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(
			emissionsResponse([emissionsProtocol({ emission24h: 0 })])
		)

		const result = await getDimensionAdapterChainEarningsOverview({
			chain: 'Ethereum',
			overviewData: {
				allChains: ['Ethereum'],
				protocols: [protocol({ total24h: null, breakdown24h: null })]
			},
			totalDataChart: []
		})

		expect(result).toMatchObject({ total24h: 0, total30d: 2_700 })
		expect(result.protocols[0]).toMatchObject({ total24h: 0, total30d: 2_700 })
	})

	it('keeps a selected-chain period unavailable when a positive aggregate has no breakdown', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(
			emissionsResponse([emissionsProtocol({ emission24h: 0 })])
		)

		const result = await getDimensionAdapterChainEarningsOverview({
			chain: 'Ethereum',
			overviewData: {
				allChains: ['Ethereum'],
				protocols: [protocol({ breakdown24h: null })]
			},
			totalDataChart: []
		})

		expect(result).toMatchObject({ total24h: null, total30d: 2_700 })
		expect(result.protocols[0]).toMatchObject({ total24h: null, total30d: 2_700 })
	})

	it('does not allocate nonzero emissions over a zero revenue basis', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(
			emissionsResponse([emissionsProtocol({ emission24h: 10 })])
		)

		const result = await getDimensionAdapterChainEarningsOverview({
			chain: 'Ethereum',
			overviewData: {
				allChains: ['Ethereum'],
				protocols: [protocol({ total24h: 0, breakdown24h: { Ethereum: {} } })]
			},
			totalDataChart: []
		})

		expect(result.total24h).toBeNull()
		expect(result.protocols[0]?.total24h).toBeNull()
	})

	it('retains explicit zero selected-chain earnings when revenue and emissions are zero', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(
			emissionsResponse([emissionsProtocol({ emission24h: 0 })])
		)

		const result = await getDimensionAdapterChainEarningsOverview({
			chain: 'Ethereum',
			overviewData: {
				allChains: ['Ethereum'],
				protocols: [protocol({ total24h: 0, breakdown24h: { Ethereum: {} } })]
			},
			totalDataChart: []
		})

		expect(result.total24h).toBe(0)
		expect(result.protocols[0]?.total24h).toBe(0)
	})

	it('keeps earnings unavailable when the emissions source fails', async () => {
		vi.mocked(fetchEmissionsBreakdownAggregated).mockResolvedValue(null)

		const result = await getDimensionAdapterChainEarningsOverview({
			chain: 'All',
			overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
			totalDataChart: [[1, 100]]
		})

		expect(result).toMatchObject({ total24h: null, total7d: null, total30d: null, total1y: null })
		expect(result.totalDataChart).toEqual([])
		expect(result.protocols[0]).toMatchObject({
			total24h: null,
			total7d: null,
			total30d: null,
			total1y: null,
			breakdown24h: null
		})
	})
})
