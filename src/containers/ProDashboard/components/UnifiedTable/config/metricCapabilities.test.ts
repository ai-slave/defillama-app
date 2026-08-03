import { describe, expect, it } from 'vitest'
import { sanitizeConfigColumns } from './metricCapabilities'

const CHAIN_COLUMNS = ['bridgedTvl', 'stablesMcap', 'tvlShare', 'stablesShare', 'volume24hShare']

describe('Unified Table grouping column capabilities', () => {
	it('removes chain-only layout state outside a top-level chain grouping', () => {
		const sanitized = sanitizeConfigColumns({
			order: ['name', 'tvl', ...CHAIN_COLUMNS],
			visibility: Object.fromEntries(['tvl', ...CHAIN_COLUMNS].map((id) => [id, true])),
			sorting: [
				{ id: 'bridgedTvl', desc: true },
				{ id: 'tvl', desc: true }
			],
			rowHeaders: ['category', 'chain', 'protocol']
		})

		expect(sanitized).toEqual({
			order: ['name', 'tvl'],
			visibility: { tvl: true },
			sorting: [{ id: 'tvl', desc: true }]
		})
	})

	it('retains chain-only layout state for canonical chain groups', () => {
		const sanitized = sanitizeConfigColumns({
			order: ['name', ...CHAIN_COLUMNS],
			visibility: Object.fromEntries(CHAIN_COLUMNS.map((id) => [id, true])),
			sorting: [{ id: 'bridgedTvl', desc: true }],
			rowHeaders: ['chain', 'protocol']
		})

		expect(sanitized.order).toEqual(['name', ...CHAIN_COLUMNS])
		expect(sanitized.visibility).toEqual(Object.fromEntries(CHAIN_COLUMNS.map((id) => [id, true])))
		expect(sanitized.sorting).toEqual([{ id: 'bridgedTvl', desc: true }])
	})
})
