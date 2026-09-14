// @vitest-environment happy-dom

import { beforeEach, describe, expect, test } from 'vitest'
import {
	pushQuickAddRecent,
	QUICK_ADD_RECENTS_LIMIT,
	QUICK_ADD_RECENTS_STORAGE_KEY,
	type QuickAddRecent,
	readQuickAddRecents
} from './quickAddRecents'

function createRecent(recent: Partial<QuickAddRecent> = {}): QuickAddRecent {
	return { subjectType: 'protocol', id: 'uniswap', name: 'Uniswap', kind: 'chart', metric: 'fees', ...recent }
}

describe('quick add recents', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	test('returns an empty list when nothing is stored', () => {
		expect(readQuickAddRecents()).toEqual([])
	})

	test('keeps the newest entry first', () => {
		pushQuickAddRecent(createRecent())
		pushQuickAddRecent(createRecent({ id: 'aave', name: 'Aave', metric: 'revenue' }))
		expect(readQuickAddRecents().map((recent) => recent.id)).toEqual(['aave', 'uniswap'])
	})

	test('raises a duplicate to the top instead of storing it twice', () => {
		pushQuickAddRecent(createRecent())
		pushQuickAddRecent(createRecent({ id: 'aave', name: 'Aave', metric: 'revenue' }))
		pushQuickAddRecent(createRecent())
		const recents = readQuickAddRecents()
		expect(recents.map((recent) => recent.id)).toEqual(['uniswap', 'aave'])
		expect(recents).toHaveLength(2)
	})

	test('treats the same entity with another metric or kind as its own entry', () => {
		pushQuickAddRecent(createRecent())
		pushQuickAddRecent(createRecent({ metric: 'tvl' }))
		pushQuickAddRecent(createRecent({ kind: 'metric' }))
		expect(readQuickAddRecents()).toHaveLength(3)
	})

	test('caps the list at the recents limit', () => {
		for (let position = 0; position < QUICK_ADD_RECENTS_LIMIT + 4; position++) {
			pushQuickAddRecent(createRecent({ id: `protocol-${position}`, name: `Protocol ${position}` }))
		}
		const recents = readQuickAddRecents()
		expect(recents).toHaveLength(QUICK_ADD_RECENTS_LIMIT)
		expect(recents[0]?.id).toBe(`protocol-${QUICK_ADD_RECENTS_LIMIT + 3}`)
	})

	test('drops malformed and unknown entries when reading', () => {
		localStorage.setItem(
			QUICK_ADD_RECENTS_STORAGE_KEY,
			JSON.stringify([
				{ subjectType: 'protocol', id: 'uniswap', name: 'Uniswap', kind: 'chart', metric: 'not-a-metric' },
				{ subjectType: 'galaxy', id: 'x', name: 'X', kind: 'chart' },
				{ subjectType: 'chain', id: '', name: 'Empty', kind: 'chart' },
				{ subjectType: 'chain', id: 'Ethereum', name: 'Ethereum', kind: 'nope' },
				'nonsense',
				null
			])
		)
		const recents = readQuickAddRecents()
		expect(recents).toEqual([{ subjectType: 'protocol', id: 'uniswap', name: 'Uniswap', kind: 'chart' }])
	})

	test('ignores a stored value that is not an array', () => {
		localStorage.setItem(QUICK_ADD_RECENTS_STORAGE_KEY, JSON.stringify({ id: 'uniswap' }))
		expect(readQuickAddRecents()).toEqual([])
	})
})
