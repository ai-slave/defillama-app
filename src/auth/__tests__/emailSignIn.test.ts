// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com"}

import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { signInWithPassword } from '~/auth/emailSignIn'
import pb from '~/utils/pocketbase'

let requests: Array<{ signal: AbortSignal; resolve: (response: Response) => void }>
const response = (id: string) => new Response(JSON.stringify({ token: `token-${id}`, record: { id } }))
const attempt = (signal = new AbortController().signal, canAccept = () => true) =>
	signInWithPassword({
		email: 'person@example.com',
		password: 'password',
		turnstileToken: 'captcha-token',
		signal,
		canAccept
	})

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

test('sends the captcha token to the features server and preserves the caller abort signal', async () => {
	const controller = new AbortController()
	const result = attempt(controller.signal)
	await vi.waitFor(() => expect(requests).toHaveLength(1))
	expect(requests[0].signal).toBe(controller.signal)
	const [url, options] = vi.mocked(fetch).mock.calls[0]
	expect(String(url)).toMatch(/\/auth\/login$/)
	expect(JSON.parse(String(options.body))).toEqual({
		email: 'person@example.com',
		password: 'password',
		turnstile_token: 'captcha-token'
	})
	controller.abort()
	requests[0].resolve(response('cancelled'))
	expect(await result).toBeNull()
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
	[400, { message: 'Internal details must not leak' }, 'Invalid email or password.'],
	[400, { error: 'Invalid captcha verification' }, 'Complete the CAPTCHA verification again.'],
	[429, { error: 'Too many attempts' }, 'Too many sign-in attempts. Wait before trying again.'],
	[503, { error: 'Authentication service unavailable' }, 'Unable to sign in right now.']
])('gives an actionable error for HTTP %s %j without changing the session', async (status, body, message) => {
	const result = attempt()
	await vi.waitFor(() => expect(requests).toHaveLength(1))
	requests[0].resolve(new Response(JSON.stringify(body), { status }))
	await expect(result).rejects.toThrow(message)
	expect(pb.authStore.token).toBe('')
})
