import { describe, expect, it } from 'vitest'
import { buildAdapterByChainReadModel } from '../adapterByChainReadModel'
import type { IAdapterChainMetrics } from '../api.types'
import { ADAPTER_TYPES } from '../constants'
import type { IAdapterChainOverview } from '../types'

type AdapterProtocol = IAdapterChainMetrics['protocols'][number]

function protocol(overrides: Partial<AdapterProtocol> = {}): AdapterProtocol {
	return {
		total24h: 10,
		total48hto24h: 5,
		total7d: 70,
		total14dto7d: 60,
		total60dto30d: 250,
		total30d: 300,
		total1y: 3_600,
		annualized1y: 3_600,
		totalAllTime: 5_000,
		average1y: 10,
		monthlyAverage1y: 300,
		change_1d: 100,
		change_7d: 20,
		change_1m: 10,
		change_7dover7d: 16.67,
		change_30dover30d: 20,
		breakdown24h: {},
		breakdown30d: {},
		total7DaysAgo: 8,
		total30DaysAgo: 7,
		defillamaId: 'protocol-a',
		name: 'Protocol A',
		displayName: 'Protocol A',
		module: 'protocol-a',
		category: 'Dexes',
		logo: '',
		chains: ['Ethereum'],
		protocolType: 'protocol',
		methodologyURL: '',
		methodology: {},
		latestFetchIsOk: true,
		parentProtocol: '',
		slug: 'protocol-a',
		linkedProtocols: [],
		id: 'protocol-a',
		...overrides
	}
}

function overview(protocols: AdapterProtocol[]): IAdapterChainOverview {
	return {
		breakdown24h: null,
		breakdown30d: null,
		chain: 'All',
		allCategories: [],
		allChains: ['Ethereum'],
		total24h: 10,
		total48hto24h: 5,
		total7d: 70,
		total14dto7d: 60,
		total60dto30d: 250,
		total30d: 300,
		total1y: 3_600,
		annualized1y: 3_600,
		change_1d: 100,
		change_7d: 20,
		change_1m: 10,
		change_7dover7d: 16.67,
		change_30dover30d: 20,
		total7DaysAgo: 8,
		total30DaysAgo: 7,
		totalAllTime: 5_000,
		protocols,
		totalDataChart: []
	}
}

function buildReadModel({
	protocols,
	protocolsData = { protocols: [], parentProtocols: [] },
	openInterestData = null,
	activeLiquidityData = null,
	normalizedVolumeData = null,
	adapterType = ADAPTER_TYPES.DEXS
}: {
	protocols: AdapterProtocol[]
	protocolsData?: Parameters<typeof buildAdapterByChainReadModel>[0]['protocolsData']
	openInterestData?: IAdapterChainOverview | null
	activeLiquidityData?: IAdapterChainOverview | null
	normalizedVolumeData?: IAdapterChainMetrics | null
	adapterType?: Parameters<typeof buildAdapterByChainReadModel>[0]['adapterType']
}) {
	return buildAdapterByChainReadModel({
		data: overview(protocols),
		protocolsData,
		openInterestData,
		activeLiquidityData,
		normalizedVolumeData,
		adapterType,
		dataType: undefined,
		rankBy: 'total24h',
		cantonIncentivesWarning: null
	})
}

describe('buildAdapterByChainReadModel', () => {
	it('returns an empty read model for an empty protocol response', () => {
		expect(buildReadModel({ protocols: [] })).toEqual({
			protocols: [],
			categories: [],
			openInterest: null,
			activeLiquidity: null
		})
	})

	it('omits optional presentation fields when their values are absent', () => {
		const [result] = buildReadModel({ protocols: [protocol()] }).protocols

		expect(result).toBeDefined()
		expect(result).not.toHaveProperty('pfOrPs')
		expect(result).not.toHaveProperty('methodology')
		expect(result).not.toHaveProperty('doublecounted')
		expect(result).not.toHaveProperty('warning')
		expect(result).not.toHaveProperty('openInterest')
		expect(result).not.toHaveProperty('activeLiquidity')
		expect(result).not.toHaveProperty('normalizedVolume24h')
	})

	it('keeps input order when protocol totals are tied', () => {
		const result = buildReadModel({
			protocols: [
				protocol({ name: 'Protocol A', displayName: 'Protocol A', slug: 'protocol-a' }),
				protocol({ name: 'Protocol B', displayName: 'Protocol B', slug: 'protocol-b' })
			]
		})

		expect(result.protocols.map(({ name }) => name)).toEqual(['Protocol A', 'Protocol B'])
	})

	it('keeps a parent annualized total null when a contributing child is missing it', () => {
		const result = buildReadModel({
			protocols: [
				protocol({
					name: 'Child A',
					displayName: 'Child A',
					slug: 'child-a',
					parentProtocol: 'Parent',
					linkedProtocols: ['Parent', 'Child A']
				}),
				protocol({
					name: 'Child B',
					displayName: 'Child B',
					slug: 'child-b',
					parentProtocol: 'Parent',
					linkedProtocols: ['Parent', 'Child B'],
					annualized1y: null
				})
			]
		})

		expect(result.protocols).toHaveLength(1)
		expect(result.protocols[0]).toMatchObject({ name: 'Parent', total24h: 20, annualized1y: null })
	})

	it('sums parent annualized data when every contributing child provides it', () => {
		const result = buildReadModel({
			protocols: [
				protocol({
					name: 'Child A',
					displayName: 'Child A',
					slug: 'child-a',
					parentProtocol: 'Parent',
					linkedProtocols: ['Parent', 'Child A'],
					annualized1y: 3_600
				}),
				protocol({
					name: 'Child B',
					displayName: 'Child B',
					slug: 'child-b',
					parentProtocol: 'Parent',
					linkedProtocols: ['Parent', 'Child B'],
					annualized1y: 2_400
				})
			]
		})

		expect(result.protocols[0]).toMatchObject({ name: 'Parent', annualized1y: 6_000 })
	})

	it('renames a single linked child without inventing a child collection', () => {
		const result = buildReadModel({
			protocols: [
				protocol({
					name: 'Only Child',
					displayName: 'Only Child',
					slug: 'only-child',
					parentProtocol: 'Solo Parent',
					linkedProtocols: ['Solo Parent', 'Only Child']
				})
			]
		})

		expect(result.protocols).toHaveLength(1)
		expect(result.protocols[0]).toMatchObject({
			name: 'Solo Parent',
			slug: 'solo-parent',
			breakdownAliases: ['Only Child']
		})
		expect(result.protocols[0]).not.toHaveProperty('childProtocols')
	})

	it('uses canonical supplemental totals while retaining protocol-row metrics', () => {
		const protocols = [
			protocol({ name: 'Protocol A', displayName: 'Protocol A', slug: 'protocol-a' }),
			protocol({ name: 'Protocol B', displayName: 'Protocol B', slug: 'protocol-b' })
		]
		const openInterestData = {
			...overview([
				protocol({ name: 'Protocol A', total24h: 10 }),
				protocol({ name: 'Protocol B', total24h: 20, doublecounted: true })
			]),
			total24h: 101
		}
		const activeLiquidityData = {
			...overview([
				protocol({ name: 'Protocol A', total24h: 5 }),
				protocol({ name: 'Protocol B', total24h: 7, doublecounted: true })
			]),
			total24h: 202
		}

		const result = buildReadModel({ protocols, openInterestData, activeLiquidityData })

		expect(result.openInterest).toBe(101)
		expect(result.activeLiquidity).toBe(202)
		expect(result.protocols.find(({ name }) => name === 'Protocol B')).toMatchObject({
			openInterest: 20,
			activeLiquidity: 7
		})
	})

	it('does not turn a null canonical supplemental total into a partial row sum', () => {
		const openInterestData = {
			...overview([protocol({ total24h: 10 })]),
			total24h: null
		}

		expect(buildReadModel({ protocols: [protocol()], openInterestData }).openInterest).toBeNull()
	})

	it('retains zero-valued optional supplemental metrics', () => {
		const protocols = [protocol()]
		const zeroMetrics = { ...overview([protocol({ total24h: 0 })]), total24h: 0 }
		const result = buildReadModel({
			protocols,
			openInterestData: zeroMetrics,
			activeLiquidityData: zeroMetrics,
			normalizedVolumeData: zeroMetrics
		})

		expect(result).toMatchObject({ openInterest: 0, activeLiquidity: 0 })
		expect(result.protocols[0]).toMatchObject({ openInterest: 0, activeLiquidity: 0, normalizedVolume24h: 0 })
	})

	it('caps perp normalized volume at reported volume while preserving lower values', () => {
		const protocols = [
			protocol({ name: 'Higher', displayName: 'Higher', slug: 'higher', total24h: 100 }),
			protocol({ name: 'Lower', displayName: 'Lower', slug: 'lower', total24h: 100 }),
			protocol({ name: 'Unavailable', displayName: 'Unavailable', slug: 'unavailable', total24h: null })
		]
		const normalizedVolumeData = overview([
			protocol({ name: 'Higher', total24h: 120 }),
			protocol({ name: 'Lower', total24h: 80 }),
			protocol({ name: 'Unavailable', total24h: 90 })
		])

		const result = buildReadModel({
			protocols,
			normalizedVolumeData,
			adapterType: ADAPTER_TYPES.PERPS
		})

		expect(result.protocols.find(({ name }) => name === 'Higher')).toMatchObject({ normalizedVolume24h: 100 })
		expect(result.protocols.find(({ name }) => name === 'Lower')).toMatchObject({ normalizedVolume24h: 80 })
		expect(result.protocols.find(({ name }) => name === 'Unavailable')).not.toHaveProperty('normalizedVolume24h')
	})

	it('sums capped normalized volume for parent perp rows', () => {
		const protocols = [
			protocol({
				name: 'Child A',
				displayName: 'Child A',
				slug: 'child-a',
				total24h: 100,
				linkedProtocols: ['Parent', 'Child A']
			}),
			protocol({
				name: 'Child B',
				displayName: 'Child B',
				slug: 'child-b',
				total24h: 50,
				linkedProtocols: ['Parent', 'Child B']
			})
		]
		const normalizedVolumeData = overview([
			protocol({ name: 'Child A', total24h: 120 }),
			protocol({ name: 'Child B', total24h: 40 })
		])

		const result = buildReadModel({
			protocols,
			normalizedVolumeData,
			adapterType: ADAPTER_TYPES.PERPS
		})

		expect(result.protocols[0]).toMatchObject({
			name: 'Parent',
			total24h: 150,
			normalizedVolume24h: 140,
			childProtocols: [{ normalizedVolume24h: 100 }, { normalizedVolume24h: 40 }]
		})
	})
})
