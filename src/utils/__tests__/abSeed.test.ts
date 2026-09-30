import { describe, expect, test } from 'vitest'
import { AB_SEED_COOKIE_NAME, AB_VISITOR_COOKIE_NAME, getABSeedFromCookie } from '~/utils/abTesting'

const SEED = '00000000-0000-4000-8000-00000000000a'

// Reading the seed the proxy writes is tested through the proxy in src/__tests__/proxy.test.ts.
describe('getABSeedFromCookie', () => {
	// Older client code wrote only the readable visitor cookie, so no current writer produces this string.
	test('falls back to a client-written visitor cookie from before the seed existed', () => {
		expect(getABSeedFromCookie(`${AB_VISITOR_COOKIE_NAME}=${SEED}`)).toBe(SEED)
	})

	test('returns null for a tampered or missing value instead of sending garbage to analytics', () => {
		expect(getABSeedFromCookie(`${AB_SEED_COOKIE_NAME}=not-a-uuid`)).toBeNull()
		expect(getABSeedFromCookie('')).toBeNull()
	})
})
