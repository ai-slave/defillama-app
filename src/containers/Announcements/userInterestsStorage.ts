import type { UserInterestsResponse } from '~/api/users.types'

/**
 * One key for the whole browser, tagged with the owner. Interests rebuild hourly from a 30-day window,
 * so a day-old answer is almost always the current answer, and a cached one lets a repeat visitor see
 * their banner on the first client render instead of after a round trip.
 */
export const USER_INTERESTS_STORAGE_KEY = 'defillama-user-interests'
/** Bump when the response shape or the category union changes so stale entries are ignored. */
const SCHEMA_VERSION = 1
const TTL_MS = 24 * 60 * 60 * 1000

interface PersistedUserInterests {
	schema: number
	userId: string
	storedAt: number
	value: UserInterestsResponse
}

export function readPersistedUserInterests({
	userId,
	now
}: {
	userId: string
	now: number
}): UserInterestsResponse | null {
	try {
		const raw = localStorage.getItem(USER_INTERESTS_STORAGE_KEY)
		if (!raw) return null
		const stored = JSON.parse(raw) as PersistedUserInterests
		if (stored.schema !== SCHEMA_VERSION || stored.userId !== userId) return null
		if (now - stored.storedAt > TTL_MS) return null
		return stored.value
	} catch {
		return null
	}
}

export function writePersistedUserInterests({
	userId,
	value,
	now
}: {
	userId: string
	value: UserInterestsResponse
	now: number
}): void {
	const stored: PersistedUserInterests = { schema: SCHEMA_VERSION, userId, storedAt: now, value }
	try {
		localStorage.setItem(USER_INTERESTS_STORAGE_KEY, JSON.stringify(stored))
	} catch {
		// Storage can be unavailable or full; the banner just refetches next time.
	}
}

export function clearPersistedUserInterests(): void {
	if (typeof window === 'undefined') return
	try {
		localStorage.removeItem(USER_INTERESTS_STORAGE_KEY)
	} catch {
		// Nothing to clear if storage is unavailable.
	}
}
