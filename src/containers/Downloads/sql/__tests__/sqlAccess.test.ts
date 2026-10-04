import { expect, test } from 'vitest'
import { sqlWorkspaceAccess } from '../sqlAccess'

const signedIn = {
	userLoading: false,
	isAuthenticated: true,
	subscriptionLoading: false,
	subscriptionError: false,
	isApiPlan: false,
	isLlama: false
}

test('a failed subscription refresh keeps the workspace for a cached active API plan', () => {
	expect(sqlWorkspaceAccess({ ...signedIn, subscriptionError: true, isApiPlan: true })).toBe('allowed')
})

test('a failed subscription read without a known API plan asks to retry instead of upselling', () => {
	expect(sqlWorkspaceAccess({ ...signedIn, subscriptionError: true })).toBe('unknown')
	expect(sqlWorkspaceAccess({ ...signedIn })).toBe('upsell')
	expect(sqlWorkspaceAccess({ ...signedIn, isAuthenticated: false, subscriptionError: true })).toBe('upsell')
})
