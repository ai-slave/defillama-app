import { describe, expect, test } from 'vitest'
import { buildChainDisplayNameLookupRecord } from '../displayLookups'

describe('metadata display lookups', () => {
	test('indexes chain display names by metadata key, slugged name, and chain id', () => {
		const lookup = buildChainDisplayNameLookupRecord({
			avalanche: {
				id: 'avax',
				name: 'Avalanche'
			},
			'polygon-pos': {
				id: 'polygon',
				name: 'Polygon'
			}
		})

		expect(lookup.avalanche).toBe('Avalanche')
		expect(lookup.avax).toBe('Avalanche')
		expect(lookup.polygon).toBe('Polygon')
		expect(lookup['polygon-pos']).toBe('Polygon')
	})
})
