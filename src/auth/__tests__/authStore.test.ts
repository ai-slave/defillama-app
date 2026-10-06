// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com"}

import { afterEach, expect, test } from 'vitest'
import pb from '~/utils/pocketbase'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { getAuthStoreSnapshot, getServerSnapshot, refreshSession, subscribeToAuthStore } from '../authStore'

const token = (id: string) => `e30.${btoa(JSON.stringify({ id, exp: 4_102_444_800 }))}.signature`
const record = (id: string) => ({ id, collectionId: '_pb_users_auth_', collectionName: 'users' })

function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((res) => {
		resolve = res
	})
	return { promise, resolve }
}

const http = installFixtureFetch()

/** Holds the refresh response until the test resolves it, so the session can change while it is in flight. */
function holdRefreshResponse() {
	const pending = deferred<unknown>()
	http.serve({ '/api/collections/users/auth-refresh': () => pending.promise })
	return { pending }
}

afterEach(() => {
	pb.authStore.clear()
	localStorage.clear()
})

test('writes the cookie before notifying subscribers and reuses snapshots', () => {
	const observed: Array<string> = []
	// Recorded rather than asserted inside the subscriber, so a notification that never arrives fails
	// the test instead of skipping its assertion.
	const cookieWhileValid: Array<string> = []
	const unsubscribe = subscribeToAuthStore(() => {
		const current = getAuthStoreSnapshot()
		if (current.isValid) cookieWhileValid.push(document.cookie)
		observed.push(current.token)
	})

	pb.authStore.save(token('account-a'), record('account-a'))
	pb.authStore.save(token('refreshed-a'), { ...record('account-a'), name: 'Updated name' })

	expect(observed).toEqual([token('account-a'), token('refreshed-a')])
	// Each valid notification saw its own token already in the cookie, which is the ordering under test.
	expect(cookieWhileValid).toHaveLength(2)
	expect(cookieWhileValid[0]).toContain(`pb_auth_token=${token('account-a')}`)
	expect(cookieWhileValid[1]).toContain(`pb_auth_token=${token('refreshed-a')}`)
	expect(getAuthStoreSnapshot()).toBe(getAuthStoreSnapshot())
	expect(getAuthStoreSnapshot().record?.name).toBe('Updated name')
	expect(getServerSnapshot()).toEqual({ token: '', record: null, isValid: false })

	pb.authStore.clear()
	expect(observed).toHaveLength(3)
	expect(getAuthStoreSnapshot().isValid).toBe(false)
	unsubscribe()

	// Persistence keeps working even while no React component subscribes.
	pb.authStore.save(token('account-b'), record('account-b'))
	expect(document.cookie).toContain(`pb_auth_token=${token('account-b')}`)
	expect(observed).toHaveLength(3)
})

test('commits a refresh that resolves while its session is still current', async () => {
	pb.authStore.save(token('account-a'), record('account-a'))
	const { pending } = holdRefreshResponse()

	const refresh = refreshSession()
	pending.resolve({ token: token('rotated-a'), record: { ...record('account-a'), name: 'Fresh' } })

	await expect(refresh).resolves.toMatchObject({ id: 'account-a', name: 'Fresh' })
	expect(pb.authStore.token).toBe(token('rotated-a'))
	expect(pb.authStore.record?.name).toBe('Fresh')
})

test('discards a refresh that resolves after logout', async () => {
	pb.authStore.save(token('account-a'), record('account-a'))
	const { pending } = holdRefreshResponse()

	const refresh = refreshSession()
	pb.authStore.clear()
	pending.resolve({ token: token('rotated-a'), record: record('account-a') })

	await refresh
	expect(pb.authStore.token).toBe('')
	expect(pb.authStore.isValid).toBe(false)
})

test('discards a refresh that resolves after switching to another account', async () => {
	pb.authStore.save(token('account-a'), record('account-a'))
	const { pending } = holdRefreshResponse()

	const refresh = refreshSession()
	pb.authStore.save(token('account-b'), record('account-b'))
	pending.resolve({ token: token('rotated-a'), record: record('account-a') })

	await refresh
	expect(pb.authStore.token).toBe(token('account-b'))
	expect(pb.authStore.record?.id).toBe('account-b')
})

test('does not undo verification when an older refresh returns with the same token', async () => {
	pb.authStore.save(token('account-a'), { ...record('account-a'), verified: false })
	const { pending } = holdRefreshResponse()
	const refresh = refreshSession()
	pb.authStore.save(token('account-a'), { ...record('account-a'), verified: true })
	pending.resolve({ token: token('rotated-a'), record: { ...record('account-a'), verified: false } })
	await refresh
	expect(pb.authStore.record?.verified).toBe(true)
	expect(pb.authStore.token).toBe(token('account-a'))
})
