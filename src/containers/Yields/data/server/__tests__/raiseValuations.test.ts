import { describe, expect, test } from 'vitest'
import type { ParentProtocolLite, ProtocolLite } from '~/containers/ProtocolLists/api.types'
import type { Raise } from '~/containers/Raises/model'
import { buildRaiseValuationsUsd } from '../raiseValuations'

function raise(over: Partial<Raise>): Raise {
	return {
		date: 0,
		name: '',
		round: '',
		amountUsd: null,
		chains: [],
		sector: '',
		category: '',
		categoryGroup: '',
		leadInvestors: [],
		otherInvestors: [],
		valuationUsd: null,
		source: '',
		...over
	}
}

const noLite = { protocols: [], parentProtocols: [] }

function protocol(
	overrides: Pick<ProtocolLite, 'name' | 'defillamaId'> & Partial<Omit<ProtocolLite, 'name' | 'defillamaId'>>
): ProtocolLite {
	return {
		symbol: '',
		logo: '',
		url: '',
		category: '',
		chains: [],
		chainTvls: {},
		tvl: 0,
		tvlPrevDay: null,
		tvlPrevWeek: null,
		tvlPrevMonth: null,
		mcap: null,
		geckoId: null,
		...overrides
	}
}

function parent(id: string, name: string): ParentProtocolLite {
	return { id, name, symbol: '-', chains: [], gecko_id: null, mcap: null, logo: '' }
}

describe('buildRaiseValuationsUsd', () => {
	test('matches by direct defillamaId (tier 1)', () => {
		const raises = [raise({ date: 1, defillamaId: '111', valuationUsd: 25_000_000 })]
		const protocols = [{ slug: 'morpho-blue', name: 'Morpho Blue' }]
		const lite = {
			protocols: [protocol({ name: 'Morpho Blue', defillamaId: '111' })],
			parentProtocols: []
		}
		const map = buildRaiseValuationsUsd(raises, protocols, lite)
		expect(map.get('morpho-blue')).toBe(25_000_000)
	})

	test('inherits a parent protocol raise for a child (tier 2 via parentProtocol id)', () => {
		// The raise is keyed to the PARENT's defillamaId; the child protocol has no raise of its own
		// but points at that parent via parentProtocol — tier 2 resolves it.
		const raises = [raise({ date: 1, defillamaId: 'parent#1', valuationUsd: 40_000_000 })]
		const protocols = [{ slug: 'aave-v3', name: 'Aave V3' }]
		const lite = {
			protocols: [protocol({ name: 'Aave V3', defillamaId: '500', parentProtocol: 'parent#1' })],
			parentProtocols: [parent('parent#1', 'Aave')]
		}
		const map = buildRaiseValuationsUsd(raises, protocols, lite)
		expect(map.get('aave-v3')).toBe(40_000_000)
	})

	test('matches "name starts with parent name" via a child raise (tier 4)', () => {
		// Parent "Aave" (>= 4 chars) resolves its valuation from a sibling child's defillamaId, then
		// "Aave Lend" matches because it starts with "Aave ".
		const raises = [raise({ date: 1, defillamaId: '999', valuationUsd: 15_000_000 })]
		const protocols = [{ slug: 'aave-lend', name: 'Aave Lend' }]
		const lite = {
			protocols: [protocol({ name: 'Aave V1', defillamaId: '999', parentProtocol: 'parent#aave' })],
			parentProtocols: [parent('parent#aave', 'Aave')]
		}
		const map = buildRaiseValuationsUsd(raises, protocols, lite)
		expect(map.get('aave-lend')).toBe(15_000_000)
	})

	test('falls back to an exact name → raise-name match (tier 3)', () => {
		const raises = [raise({ date: 1, name: 'Acme Protocol', valuationUsd: 12_000_000 })]
		const protocols = [{ slug: 'acme-protocol', name: 'Acme Protocol' }]
		const map = buildRaiseValuationsUsd(raises, protocols, noLite)
		expect(map.get('acme-protocol')).toBe(12_000_000)
	})

	test('matches "name starts with parent name" (tier 4)', () => {
		const raises = [raise({ date: 1, name: 'Phantom', valuationUsd: 8_000_000 })]
		const protocols = [{ slug: 'phantom-sol', name: 'Phantom SOL' }]
		const lite = {
			protocols: [],
			// parent "Phantom" resolves via raise name; "Phantom SOL" starts with "Phantom "
			parentProtocols: [parent('p#phantom', 'Phantom')]
		}
		const map = buildRaiseValuationsUsd(raises, protocols, lite)
		expect(map.get('phantom-sol')).toBe(8_000_000)
	})

	test('keeps the most recent raise (date desc, first write wins)', () => {
		const raises = [
			raise({ date: 100, name: 'Acme', valuationUsd: 50_000_000 }),
			raise({ date: 200, name: 'Acme', valuationUsd: 90_000_000 })
		]
		const protocols = [{ slug: 'acme', name: 'Acme' }]
		const map = buildRaiseValuationsUsd(raises, protocols, noLite)
		expect(map.get('acme')).toBe(90_000_000)
	})

	test('ignores non-finite / non-positive valuations and leaves unmatched protocols unset', () => {
		const raises = [
			raise({ date: 1, name: 'ZeroCo', valuationUsd: 0 }),
			raise({ date: 1, name: 'NanCo', valuationUsd: Number.NaN })
		]
		const protocols = [
			{ slug: 'zeroco', name: 'ZeroCo' },
			{ slug: 'nanco', name: 'NanCo' },
			{ slug: 'unknown', name: 'Unknown' }
		]
		const map = buildRaiseValuationsUsd(raises, protocols, noLite)
		expect(map.has('zeroco')).toBe(false)
		expect(map.has('nanco')).toBe(false)
		expect(map.has('unknown')).toBe(false)
		expect(map.size).toBe(0)
	})
})
