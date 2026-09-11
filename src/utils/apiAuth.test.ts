import { beforeEach, expect, test, vi } from 'vitest'
import { resolveSubscription } from '~/containers/Yields/server/requestSubscription'
import { validateSubscription } from './apiAuth'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
vi.mock('~/utils/http-client', () => ({ fetchWithPoolingOnServer: fetchMock }))
beforeEach(() => fetchMock.mockReset())

function responses(status: number) {
	fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ subscription: { status: 'active' } }), { status }))
	fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ record: { flags: {} } })))
}

test.each([429, 500, 502, 503])('reports upstream %s as unavailable rather than denial', async (status) => {
	responses(status)
	await expect(validateSubscription('Bearer test')).resolves.toMatchObject({ valid: false, status: 503 })
	responses(status)
	await expect(resolveSubscription('test')).resolves.toBeNull()
})

test.each([401, 403, 404])('preserves denial for upstream %s', async (status) => {
	responses(status)
	await expect(validateSubscription('Bearer test')).resolves.toMatchObject({ valid: false, status: 403 })
	responses(status)
	await expect(resolveSubscription('test')).resolves.toBe(false)
})

test('preserves active access and missing-session behavior', async () => {
	responses(200)
	await expect(resolveSubscription('test')).resolves.toBe(true)
	fetchMock.mockClear()
	await expect(resolveSubscription(null)).resolves.toBe(false)
	await expect(validateSubscription(undefined)).resolves.toMatchObject({ valid: false, status: 401 })
	expect(fetchMock).not.toHaveBeenCalled()
})

test('resolves to unknown when the lookup stalls, even after headers arrive', async () => {
	vi.useFakeTimers()
	try {
		fetchMock
			.mockResolvedValueOnce(new Response(new ReadableStream({ start() {} }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ record: { flags: {} } })))
		const resolution = resolveSubscription('test')
		await vi.advanceTimersByTimeAsync(5000)
		await expect(resolution).resolves.toBeNull()
	} finally {
		vi.useRealTimers()
	}
})
