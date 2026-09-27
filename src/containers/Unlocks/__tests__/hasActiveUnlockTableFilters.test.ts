import { describe, expect, test } from 'vitest'
import { getQueryUpdatesFromSelected } from '~/components/Select/query'
import { hasActiveUnlockTableFilters } from '../Table'

const UNLOCK_TYPES = ['airdrop', 'insiders', 'publicSale']

/** The picker writes `undefined` to clear a key; a parsed URL simply lacks it. */
const pickerQuery = (selected: Array<string>) => {
	const query: Record<string, string | Array<string>> = {}
	const updates = getQueryUpdatesFromSelected('unlockType', 'excludeUnlockType', UNLOCK_TYPES, selected)
	for (const key in updates) {
		const value = updates[key]
		if (value !== undefined) query[key] = value
	}
	return query
}

describe('hasActiveUnlockTableFilters', () => {
	test('is off at the page defaults and when the picker selects every type', () => {
		expect(hasActiveUnlockTableFilters({}, UNLOCK_TYPES)).toBe(false)
		expect(hasActiveUnlockTableFilters(pickerQuery(UNLOCK_TYPES), UNLOCK_TYPES)).toBe(false)
		expect(hasActiveUnlockTableFilters({ minUnlockValue: '' }, UNLOCK_TYPES)).toBe(false)
	})

	test('is on for the watchlist toggle, a narrowed type picker and either range', () => {
		expect(hasActiveUnlockTableFilters({ watchlist: 'true' }, UNLOCK_TYPES)).toBe(true)
		expect(hasActiveUnlockTableFilters(pickerQuery(['insiders']), UNLOCK_TYPES)).toBe(true)
		expect(hasActiveUnlockTableFilters(pickerQuery(['airdrop', 'insiders']), UNLOCK_TYPES)).toBe(true)
		expect(hasActiveUnlockTableFilters({ maxUnlockValue: '1000000' }, UNLOCK_TYPES)).toBe(true)
		expect(hasActiveUnlockTableFilters({ minUnlockPerc: '1' }, UNLOCK_TYPES)).toBe(true)
	})
})
