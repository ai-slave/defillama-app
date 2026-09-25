import { describe, expect, test } from 'vitest'
import type { AdapterChainProtocol, IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import type { ProtocolLite, ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import { buildCompareTokenProtocols } from '../queries'

function protocol({
	name,
	id,
	tvl,
	chainTvls = {},
	deprecated
}: {
	name: string
	id: string
	tvl: number | null
	chainTvls?: ProtocolLite['chainTvls']
	deprecated?: true
}): ProtocolLite {
	return {
		name,
		symbol: name,
		logo: null,
		url: '',
		category: 'Lending',
		chains: ['Ethereum'],
		chainTvls,
		tvl,
		tvlPrevDay: null,
		tvlPrevWeek: null,
		tvlPrevMonth: null,
		mcap: null,
		defillamaId: id,
		geckoId: null,
		parentProtocol: 'parent#suite',
		...(deprecated ? { deprecated: true } : {})
	}
}

function adapterMetrics(protocols: IAdapterChainMetrics['protocols']): IAdapterChainMetrics {
	return {
		breakdown24h: null,
		breakdown30d: null,
		chain: null,
		allChains: [],
		total24h: 0,
		total48hto24h: 0,
		total7d: 0,
		total14dto7d: 0,
		total60dto30d: 0,
		total30d: 0,
		total1y: 0,
		change_1d: 0,
		change_7d: 0,
		change_1m: 0,
		change_7dover7d: 0,
		change_30dover30d: 0,
		total7DaysAgo: 0,
		total30DaysAgo: 0,
		totalAllTime: 0,
		protocols
	}
}

function adapterProtocol(defillamaId: string, total24h: number | null): AdapterChainProtocol {
	return {
		defillamaId,
		name: defillamaId,
		displayName: defillamaId,
		module: defillamaId,
		category: 'Lending',
		logo: '',
		chains: ['Ethereum'],
		protocolType: 'protocol',
		methodologyURL: null,
		methodology: null,
		slug: defillamaId,
		id: defillamaId,
		breakdown24h: null,
		breakdown30d: null,
		total24h
	}
}

const suite = { id: 'parent#suite', name: 'Suite', chains: ['Ethereum'], gecko_id: null, mcap: null, logo: '' }

function protocolsResponse(protocols: Array<ProtocolLite>): ProtocolsResponse {
	return { protocols, chains: ['Ethereum'], parentProtocols: [suite], protocolCategories: ['Lending'] }
}

function suiteTvl(protocols: Array<ProtocolLite>) {
	const fees = adapterMetrics([])
	return buildCompareTokenProtocols(protocolsResponse(protocols), fees, fees).find((row) => row.name === 'Suite')?.tvl
}

const excludeParent = (tvl: number | null) => ({
	excludeParent: { tvl, tvlPrevDay: 0, tvlPrevWeek: 0, tvlPrevMonth: 0 }
})

describe('compare tokens protocol rows', () => {
	test('a failed revenue source is unavailable while missing fees activity is zero, and parents skip no-TVL children', () => {
		const rows = buildCompareTokenProtocols(
			protocolsResponse([
				protocol({ name: 'Known Child', id: 'known-child', tvl: 100 }),
				protocol({ name: 'Null Child', id: 'null-child', tvl: null, deprecated: true })
			]),
			adapterMetrics([adapterProtocol('known-child', null)]),
			null
		)

		expect(rows).toEqual([
			{ name: 'Known Child', geckoId: null, tvl: 100, fees: 0, revenue: null },
			{ name: 'Null Child', geckoId: null, tvl: null, fees: 0, revenue: null },
			{ name: 'Suite', geckoId: null, tvl: 100, fees: 0, revenue: null }
		])
	})

	test('sums child fees into the parent', () => {
		const rows = buildCompareTokenProtocols(
			protocolsResponse([protocol({ name: 'A', id: 'a', tvl: 1 }), protocol({ name: 'B', id: 'b', tvl: 2 })]),
			adapterMetrics([adapterProtocol('a', 5), adapterProtocol('b', 7)]),
			adapterMetrics([adapterProtocol('a', 1)])
		)

		expect(rows.find((row) => row.name === 'Suite')).toEqual({
			name: 'Suite',
			geckoId: null,
			tvl: 3,
			fees: 12,
			revenue: 1
		})
	})

	test('keeps a parent without any measured child TVL unavailable', () => {
		expect(suiteTvl([protocol({ name: 'Null Child', id: 'null-child', tvl: null, deprecated: true })])).toBeNull()
	})

	test('subtracts each child TVL excluded from its synthetic parent', () => {
		expect(suiteTvl([protocol({ name: 'Child', id: 'child', tvl: 100, chainTvls: excludeParent(30) })])).toBe(70)
	})

	test('keeps synthetic parent TVL unavailable when a required exclusion is unavailable', () => {
		expect(suiteTvl([protocol({ name: 'Child', id: 'child', tvl: 100, chainTvls: excludeParent(null) })])).toBeNull()
	})
})
