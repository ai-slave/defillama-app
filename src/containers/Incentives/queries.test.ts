import { describe, expect, test, vi } from 'vitest'
import { SERVER_URL } from '~/constants'
import type { AdapterChainProtocol } from '~/containers/AdapterMetrics/api.types'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'
import type { EmissionsBreakdownAggregatedResponse, EmissionsBreakdownProtocol } from './api.types'
import { buildDimensionEarningsOverview, getProtocolEmissionsLookupFromAggregated } from './queries'
import type { DimensionEarningsOverviewResult } from './types'

const http = installFixtureFetch()
const ethereumOnly = { Ethereum: 'Ethereum' }

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
		breakdown30d: { Ethereum: { 'Protocol A': 3000 } },
		total24h: 100,
		total7d: 700,
		total30d: 3000,
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
		emissions1y: 3650,
		emissionsAllTime: 5000,
		emissionsAverage1y: 10,
		emissionsMonthlyAverage1y: 300,
		...overrides
	}
}

function emissionsResponse(protocols: Array<EmissionsBreakdownProtocol>): EmissionsBreakdownAggregatedResponse {
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
	test('subtracts the producer annual and all-time emission fields', () => {
		const result = requireAvailable(
			buildDimensionEarningsOverview({
				chain: 'All',
				overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
				totalDataChart: [],
				emissionsData: emissionsResponse([emissionsProtocol()]),
				chainNameMap: {}
			})
		)

		expect(result.protocols[0]).toMatchObject({ total1y: 32_850, totalAllTime: 45_000 })
		expect(result).toMatchObject({
			total1y: 32_850,
			totalAllTime: 45_000,
			annualized1y: null,
			change_1d: null
		})
	})

	test('does not let an inactive child hide its active parent aggregation', () => {
		const parentProtocol = 'parent#protocol'

		const result = requireAvailable(
			buildDimensionEarningsOverview({
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
				totalDataChart: [],
				emissionsData: emissionsResponse([]),
				chainNameMap: {}
			})
		)

		expect(result.protocols).toHaveLength(1)
		expect(result.protocols[0]).toMatchObject({
			total24h: 100,
			breakdown24h: { Ethereum: { 'Protocol A': 100 } }
		})
		expect(result.total24h).toBe(100)
	})

	test('uses zero emissions for a protocol omitted from a successful emissions response', () => {
		const result = requireAvailable(
			buildDimensionEarningsOverview({
				chain: 'All',
				overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
				totalDataChart: [],
				emissionsData: emissionsResponse([]),
				chainNameMap: {}
			})
		)

		expect(result.protocols[0]).toMatchObject({ total24h: 100, total7d: 700, change_1d: null })
		expect(result.total24h).toBe(100)
	})

	test('treats a nullable revenue period in a successful response as zero activity', () => {
		const result = requireAvailable(
			buildDimensionEarningsOverview({
				chain: 'All',
				overviewData: {
					allChains: ['Ethereum'],
					protocols: [protocol({ total24h: null, breakdown24h: null })]
				},
				totalDataChart: [],
				emissionsData: emissionsResponse([emissionsProtocol({ emission24h: 10 })]),
				chainNameMap: {}
			})
		)

		expect(result.protocols[0]?.total24h).toBe(-10)
		expect(result.total24h).toBe(-10)
	})

	test('keeps selected-chain earnings unavailable when chain aliases cannot be loaded', () => {
		const result = buildDimensionEarningsOverview({
			chain: 'Avalanche',
			overviewData: { allChains: ['Avalanche'], protocols: [protocol()] },
			totalDataChart: [],
			emissionsData: emissionsResponse([]),
			chainNameMap: null
		})

		expect(result).toEqual({ status: 'unavailable' })
	})

	test('keeps selected-chain earnings unavailable when the authoritative map has no chain identity', () => {
		const result = buildDimensionEarningsOverview({
			chain: 'Avalanche',
			overviewData: { allChains: ['Avalanche'], protocols: [protocol()] },
			totalDataChart: [],
			emissionsData: emissionsResponse([]),
			chainNameMap: { Ethereum: 'Ethereum' }
		})

		expect(result).toEqual({ status: 'unavailable' })
	})

	test('does not label all-chain earnings windows as chain-specific values', () => {
		const result = requireAvailable(
			buildDimensionEarningsOverview({
				chain: 'Ethereum',
				overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
				totalDataChart: [],
				emissionsData: emissionsResponse([emissionsProtocol()]),
				chainNameMap: ethereumOnly
			})
		)

		expect(result).toMatchObject({ total24h: 90, total7d: null, total30d: 2700, total1y: null, totalAllTime: null })
		expect(result.protocols[0]).toMatchObject({
			total24h: 90,
			total7d: null,
			total30d: 2700,
			total1y: null,
			totalAllTime: null
		})
	})

	test('keeps a matched nullable emissions period unavailable', () => {
		const allChains = requireAvailable(
			buildDimensionEarningsOverview({
				chain: 'All',
				overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
				totalDataChart: [],
				emissionsData: emissionsResponse([emissionsProtocol({ emission24h: null })]),
				chainNameMap: {}
			})
		)
		expect(allChains).toMatchObject({ total24h: null, total7d: 630 })

		const ethereum = requireAvailable(
			buildDimensionEarningsOverview({
				chain: 'Ethereum',
				overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
				totalDataChart: [],
				emissionsData: emissionsResponse([emissionsProtocol({ emission24h: null })]),
				chainNameMap: ethereumOnly
			})
		)
		expect(ethereum).toMatchObject({ total24h: null, total30d: 2700 })
	})

	test('keeps a selected-chain period unavailable when a positive aggregate has no breakdown', () => {
		const result = requireAvailable(
			buildDimensionEarningsOverview({
				chain: 'Ethereum',
				overviewData: {
					allChains: ['Ethereum'],
					protocols: [protocol({ breakdown24h: null })]
				},
				totalDataChart: [],
				emissionsData: emissionsResponse([emissionsProtocol({ emission24h: 0 })]),
				chainNameMap: ethereumOnly
			})
		)

		expect(result).toMatchObject({ total24h: null, total30d: 2700 })
	})

	test('does not allocate nonzero emissions over a zero revenue basis', () => {
		const result = requireAvailable(
			buildDimensionEarningsOverview({
				chain: 'Ethereum',
				overviewData: {
					allChains: ['Ethereum'],
					protocols: [protocol({ total24h: 0, breakdown24h: { Ethereum: {} } })]
				},
				totalDataChart: [],
				emissionsData: emissionsResponse([emissionsProtocol({ emission24h: 10 })]),
				chainNameMap: ethereumOnly
			})
		)

		expect(result.total24h).toBeNull()
		expect(result.protocols[0]?.total24h).toBeNull()
	})

	test('retains selected-chain protocols with activity in either supported period', () => {
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
			buildDimensionEarningsOverview({
				chain: 'Ethereum',
				overviewData: { allChains: ['Ethereum'], protocols: [thirtyDayOnly, dailyOnly] },
				totalDataChart: [],
				emissionsData: emissionsResponse([]),
				chainNameMap: ethereumOnly
			})
		)

		expect(
			result.protocols.map(({ defillamaId, total24h, total30d }) => ({ defillamaId, total24h, total30d }))
		).toEqual([
			{ defillamaId: 'protocol-a', total24h: 0, total30d: 3000 },
			{ defillamaId: 'protocol-b', total24h: 200, total30d: 0 }
		])
		expect(result).toMatchObject({ total24h: 200, total30d: 3000 })
	})

	test('keeps earnings unavailable when the emissions source fails', () => {
		const result = buildDimensionEarningsOverview({
			chain: 'All',
			overviewData: { allChains: ['Ethereum'], protocols: [protocol()] },
			totalDataChart: [[1, 100]],
			emissionsData: null,
			chainNameMap: {}
		})

		expect(result).toEqual({ status: 'unavailable' })
	})
})

describe('protocol emissions lookup availability', () => {
	test('preserves a whole-source failure as unavailable instead of an empty successful lookup', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {})
		http.serve({ [`${SERVER_URL}/emissionsBreakdownAggregated`]: fixtureStatus(404) })

		await expect(getProtocolEmissionsLookupFromAggregated()).resolves.toBeNull()
	})
})
