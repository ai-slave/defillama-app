import { expect, test } from 'vitest'
import { countActiveYieldFilters } from '../activeFilters'

test('counts a picker only when it narrows the pools', () => {
	const none = new Set<string>()
	expect(countActiveYieldFilters({ chain: 'All', category: '' }, none)).toBe(0)
	expect(countActiveYieldFilters({ excludeChain: 'Solana', category: 'None', minTvl: '1000' }, none)).toBe(3)
})
