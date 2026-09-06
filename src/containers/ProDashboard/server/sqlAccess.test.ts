import { beforeEach, describe, expect, test, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('~/utils/http-client', () => ({ fetchWithPoolingOnServer: fetchMock }))
import { getSqlExecutionAccess } from './sqlAccess'

function response(body: unknown, ok = true) {
	return { ok, json: async () => body }
}

beforeEach(() => fetchMock.mockReset())

describe('SQL execution access', () => {
	test.each([undefined, '', 'Bearer ', 'Basic token'])('rejects missing bearer credentials: %s', async (header) => {
		expect(await getSqlExecutionAccess(header)).toMatchObject({ valid: false, status: 401 })
		expect(fetchMock).not.toHaveBeenCalled()
	})

	test('does not trust an invalid token even if a paid subscription could be returned', async () => {
		fetchMock.mockResolvedValueOnce(response({}, false))
		expect(await getSqlExecutionAccess('Bearer invalid')).toMatchObject({ valid: false, status: 401 })
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	test.each([
		null,
		{ type: 'pro', status: 'active' },
		{ type: 'api', status: 'canceled' },
		{ type: 'api', status: 'expired' }
	])('rejects users without an active API plan: %j', async (subscription) => {
		fetchMock.mockResolvedValueOnce(response({ record: { id: 'user-1' } }))
		fetchMock.mockResolvedValueOnce(response({ subscription }))
		expect(await getSqlExecutionAccess('Bearer user')).toMatchObject({ valid: false, status: 403 })
	})

	test('allows a verified active API subscriber', async () => {
		fetchMock.mockResolvedValueOnce(response({ record: { id: 'user-1' } }))
		fetchMock.mockResolvedValueOnce(response({ subscription: { type: 'api', status: 'active' } }))
		expect(await getSqlExecutionAccess('Bearer paid')).toEqual({ valid: true, userId: 'user-1' })
		expect(fetchMock.mock.calls.every(([, options]) => options.headers.Authorization === 'Bearer paid')).toBe(true)
	})

	test('allows staff only from the verified PocketBase record', async () => {
		fetchMock.mockResolvedValueOnce(response({ record: { id: 'staff-1', flags: { is_llama: true } } }))
		expect(await getSqlExecutionAccess('Bearer staff')).toEqual({ valid: true, userId: 'staff-1' })
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	test('rejects trial accounts', async () => {
		fetchMock.mockResolvedValueOnce(response({ record: { id: 'trial-1', flags: { is_trial: true } } }))
		expect(await getSqlExecutionAccess('Bearer trial')).toMatchObject({ valid: false, status: 403 })
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	test('fails closed when auth or subscription verification is unavailable', async () => {
		fetchMock.mockRejectedValueOnce(new Error('network error'))
		expect(await getSqlExecutionAccess('Bearer user')).toMatchObject({ valid: false, status: 503 })
		fetchMock.mockResolvedValueOnce(response({ record: { id: 'user-1' } }))
		fetchMock.mockRejectedValueOnce(new Error('network error'))
		expect(await getSqlExecutionAccess('Bearer user')).toMatchObject({ valid: false, status: 503 })
	})
})
