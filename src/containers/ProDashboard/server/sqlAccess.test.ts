import { describe, expect, test } from 'vitest'
import { AUTH_SERVER, POCKETBASE_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'
import { getSqlExecutionAccess } from './sqlAccess'
const http = installFixtureFetch()
const authUrl = `${POCKETBASE_URL}/api/collections/users/auth-refresh`
const subscriptionUrl = `${AUTH_SERVER}/subscription/status`

describe('SQL execution access', () => {
	test.each([undefined, '', 'Bearer ', 'Basic token'])('rejects missing bearer credentials: %s', async (header) => {
		expect(await getSqlExecutionAccess(header)).toMatchObject({ valid: false, status: 401 })
		expect(http.requests).toHaveLength(0)
	})

	test('does not trust an invalid token even if a paid subscription could be returned', async () => {
		http.serve({ [authUrl]: fixtureStatus(401) })
		expect(await getSqlExecutionAccess('Bearer invalid')).toMatchObject({ valid: false, status: 401 })
		expect(http.requests).toHaveLength(1)
	})

	test.each([
		null,
		{ type: 'pro', status: 'active' },
		{ type: 'api', status: 'canceled' },
		{ type: 'api', status: 'expired' }
	])('rejects users without an active API plan: %j', async (subscription) => {
		http.serve({ [authUrl]: { record: { id: 'user-1' } } })
		http.serve({ [subscriptionUrl]: { subscription } })
		expect(await getSqlExecutionAccess('Bearer user')).toMatchObject({ valid: false, status: 403 })
	})

	test('allows a verified active API subscriber', async () => {
		http.serve({ [authUrl]: { record: { id: 'user-1' } } })
		http.serve({ [subscriptionUrl]: { subscription: { type: 'api', status: 'active' } } })
		expect(await getSqlExecutionAccess('Bearer paid')).toEqual({ valid: true, userId: 'user-1' })
		expect(http.requests.every(({ init }) => new Headers(init?.headers).get('Authorization') === 'Bearer paid')).toBe(
			true
		)
	})

	test('allows staff only from the verified PocketBase record', async () => {
		http.serve({ [authUrl]: { record: { id: 'staff-1', flags: { is_llama: true } } } })
		expect(await getSqlExecutionAccess('Bearer staff')).toEqual({ valid: true, userId: 'staff-1' })
		expect(http.requests).toHaveLength(1)
	})

	test('rejects trial accounts', async () => {
		http.serve({ [authUrl]: { record: { id: 'trial-1', flags: { is_trial: true } } } })
		expect(await getSqlExecutionAccess('Bearer trial')).toMatchObject({ valid: false, status: 403 })
		expect(http.requests).toHaveLength(1)
	})

	test('fails closed when auth or subscription verification is unavailable', async () => {
		http.serve({
			[authUrl]: () => {
				throw new Error('network error')
			}
		})
		expect(await getSqlExecutionAccess('Bearer user')).toMatchObject({ valid: false, status: 503 })
		http.serve({ [authUrl]: { record: { id: 'user-1' } } })
		http.serve({
			[subscriptionUrl]: () => {
				throw new Error('network error')
			}
		})
		expect(await getSqlExecutionAccess('Bearer user')).toMatchObject({ valid: false, status: 503 })
	})
})
