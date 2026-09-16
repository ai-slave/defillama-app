// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com"}

import { BaseAuthStore } from 'pocketbase'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { signInWithPassword } from '~/auth/emailSignIn'
import pb from '~/utils/pocketbase'

let requests: Array<{ signal: AbortSignal; resolve: (response: Response) => void }>
const response = (id: string) => new Response(JSON.stringify({ token: `token-${id}`, record: { id } }))
const attempt = (signal = new AbortController().signal, canAccept = () => true) =>
	signInWithPassword({ email: 'person@example.com', password: 'password', signal, canAccept })

beforeEach(() => {
	pb.authStore.clear()
	requests = []
	vi.stubGlobal(
		'fetch',
		vi.fn(
			(_url: string, options: RequestInit) =>
				new Promise<Response>((resolve) => {
					// Deliberately resolve even after abort: accepting results must not depend on transport cooperation.
					requests.push({ signal: options.signal as AbortSignal, resolve })
				})
		)
	)
})
afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	pb.authStore.clear()
})

test('keeps the SDK write private after cancellation and preserves the caller abort signal', async () => {
	const save = vi.spyOn(BaseAuthStore.prototype, 'save')
	const controller = new AbortController()
	const result = attempt(controller.signal)
	await vi.waitFor(() => expect(requests).toHaveLength(1))
	expect(requests[0].signal).toBe(controller.signal)
	controller.abort()
	requests[0].resolve(response('cancelled'))
	expect(await result).toBeNull()
	expect(save).toHaveBeenCalledWith('token-cancelled', expect.objectContaining({ id: 'cancelled' }))
	expect(pb.authStore.token).toBe('')
})

test('accepts one complete session, but does not accept a response after the sheet closes', async () => {
	let open = true
	const cancelled = attempt(undefined, () => open)
	await vi.waitFor(() => expect(requests).toHaveLength(1))
	open = false
	requests[0].resolve(response('closed'))
	expect(await cancelled).toBeNull()
	expect(pb.authStore.token).toBe('')

	const changes = vi.fn()
	const unsubscribe = pb.authStore.onChange(changes)
	const accepted = attempt()
	await vi.waitFor(() => expect(requests).toHaveLength(2))
	requests[1].resolve(response('accepted'))
	expect(await accepted).toMatchObject({ id: 'accepted' })
	expect(changes).toHaveBeenCalledExactlyOnceWith('token-accepted', expect.objectContaining({ id: 'accepted' }))
	unsubscribe()
})

test('does not overwrite a replacement token-only session or resurrect it after logout', async () => {
	const stale = attempt()
	await vi.waitFor(() => expect(requests).toHaveLength(1))
	pb.authStore.save('replacement-token')
	requests[0].resolve(response('old'))
	expect(await stale).toBeNull()
	expect(pb.authStore.token).toBe('replacement-token')

	pb.authStore.clear()
	const alsoStale = attempt()
	await vi.waitFor(() => expect(requests).toHaveLength(2))
	pb.authStore.save('another-token')
	pb.authStore.clear()
	requests[1].resolve(response('old'))
	expect(await alsoStale).toBeNull()
	expect(pb.authStore.token).toBe('')
})

test.each([
	[400, 'Invalid email or password.'],
	[429, 'Too many sign-in attempts. Please wait before trying again.'],
	[503, 'Unable to sign in right now.']
])('gives an actionable error for HTTP %s without changing the session', async (status, message) => {
	const result = attempt()
	await vi.waitFor(() => expect(requests).toHaveLength(1))
	requests[0].resolve(new Response(JSON.stringify({ message: 'Internal details must not leak' }), { status }))
	await expect(result).rejects.toThrow(message)
	expect(pb.authStore.token).toBe('')
})
