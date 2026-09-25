// @vitest-environment happy-dom

import { beforeEach, describe, expect, test } from 'vitest'
import type { UserInterestsResponse } from '~/api/users.types'
import {
	clearPersistedUserInterests,
	readPersistedUserInterests,
	USER_INTERESTS_STORAGE_KEY,
	writePersistedUserInterests
} from '../userInterestsStorage'

const value: UserInterestsResponse = { interests: [{ category: 'yields', score: 0.6 }], segments: [] }
const now = Date.parse('2026-09-22T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

describe('persisted user interests', () => {
	beforeEach(() => localStorage.clear())

	test('caches an empty profile too, so a reader without interests does not refetch every load', () => {
		const empty: UserInterestsResponse = { interests: [], segments: [] }
		writePersistedUserInterests({ userId: 'user-a', value: empty, now })
		expect(readPersistedUserInterests({ userId: 'user-a', now: now + 1 })).toEqual(empty)
	})

	test('never serves one account the interests of another', () => {
		writePersistedUserInterests({ userId: 'user-a', value, now })
		expect(readPersistedUserInterests({ userId: 'user-a', now })).toEqual(value)
		expect(readPersistedUserInterests({ userId: 'user-b', now })).toBeNull()
	})

	test('expires after a day', () => {
		writePersistedUserInterests({ userId: 'user-a', value, now })
		expect(readPersistedUserInterests({ userId: 'user-a', now: now + DAY })).toEqual(value)
		expect(readPersistedUserInterests({ userId: 'user-a', now: now + DAY + 1 })).toBeNull()
	})

	test('ignores entries written under an older schema', () => {
		writePersistedUserInterests({ userId: 'user-a', value, now })
		const current = JSON.parse(localStorage.getItem(USER_INTERESTS_STORAGE_KEY)!)
		expect(readPersistedUserInterests({ userId: 'user-a', now })).toEqual(value)
		localStorage.setItem(USER_INTERESTS_STORAGE_KEY, JSON.stringify({ ...current, schema: current.schema - 1 }))
		expect(readPersistedUserInterests({ userId: 'user-a', now })).toBeNull()
	})

	test('ignores corrupt storage', () => {
		localStorage.setItem(USER_INTERESTS_STORAGE_KEY, '{not json')
		expect(readPersistedUserInterests({ userId: 'user-a', now })).toBeNull()
	})

	test('logout clears the entry', () => {
		writePersistedUserInterests({ userId: 'user-a', value, now })
		expect(readPersistedUserInterests({ userId: 'user-a', now })).toEqual(value)
		clearPersistedUserInterests()
		expect(readPersistedUserInterests({ userId: 'user-a', now })).toBeNull()
	})
})
