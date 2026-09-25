import { describe, expect, test } from 'vitest'
import { getVerifiedAccessStatus } from '../useVerifiedAccess'

const status = (overrides: Partial<Parameters<typeof getVerifiedAccessStatus>[0]> = {}) =>
	getVerifiedAccessStatus({
		mounted: true,
		isAuthenticated: true,
		hasActiveSubscription: true,
		subscriptionInitialCheck: false,
		...overrides
	})

describe('verified access state', () => {
	test('stays pending through SSR', () => {
		expect(status({ mounted: false })).toBe('pending')
	})

	test('grants access only to an authenticated active subscriber', () => {
		expect(status()).toBe('granted')
		expect(status({ isAuthenticated: false })).toBe('denied')
		expect(status({ hasActiveSubscription: false })).toBe('denied')
	})

	test('waits for the initial check only for signed-in readers without cached access', () => {
		expect(status({ hasActiveSubscription: false, subscriptionInitialCheck: true })).toBe('pending')
		expect(status({ subscriptionInitialCheck: true })).toBe('granted')
		expect(status({ isAuthenticated: false, subscriptionInitialCheck: true })).toBe('denied')
	})
})
