import { describe, expect, test } from 'vitest'
import { AB_SEED_COOKIE_NAME, AB_VISITOR_COOKIE_NAME, getABSeedFromCookie } from '~/utils/abTesting'

const SEED = '00000000-0000-4000-8000-00000000000a'

describe('getABSeedFromCookie', () => {
	test('reads the readable seed so the browser can send it with sign-in and questions', () => {
		expect(getABSeedFromCookie(`foo=1; ${AB_SEED_COOKIE_NAME}=${SEED}`)).toBe(SEED)
	})

	test('falls back to a client-written visitor cookie when the proxy never ran', () => {
		expect(getABSeedFromCookie(`${AB_VISITOR_COOKIE_NAME}=${SEED}`)).toBe(SEED)
	})

	test('returns null for a tampered or missing value instead of sending garbage to analytics', () => {
		expect(getABSeedFromCookie(`${AB_SEED_COOKIE_NAME}=not-a-uuid`)).toBeNull()
		expect(getABSeedFromCookie('')).toBeNull()
	})
})
