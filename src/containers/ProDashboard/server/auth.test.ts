import { expect, test } from 'vitest'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'
import { fetchAuthenticatedUserId } from './auth'

const http = installFixtureFetch()
test('returns the user id only after PocketBase validates the token', async () => {
	http.serve({ '/api/collections/users/auth-refresh': { record: { id: 'owner-1' } } })
	await expect(fetchAuthenticatedUserId('valid-token')).resolves.toBe('owner-1')
	expect(http.requests[0].init?.method).toBe('POST')
	expect(new Headers(http.requests[0].init?.headers).get('Authorization')).toBe('Bearer valid-token')
})
test('does not trust an unvalidated token', async () => {
	// A rejected refresh can still carry a JSON body, so the status alone decides.
	http.serve({ '/api/collections/users/auth-refresh': fixtureStatus(401, { record: { id: 'owner-1' } }) })
	await expect(fetchAuthenticatedUserId('invalid-token')).resolves.toBeNull()
})
