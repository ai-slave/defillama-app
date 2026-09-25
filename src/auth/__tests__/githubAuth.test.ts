// @vitest-environment happy-dom
import { BaseAuthStore } from 'pocketbase'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import pb from '~/utils/pocketbase'
import { acceptAuthSession } from '../authRequest'
import { authenticateGithub } from '../githubAuth'

let source: FakeEventSource | null = null
class FakeEventSource extends EventTarget {
	close = vi.fn()
	constructor() {
		super()
		// The SDK constructs EventSource internally; retain it to deliver the provider callback.
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		source = this
	}
}
let exchange: ((response: Response) => void) | null = null
let popup: Window
let saved: ReturnType<typeof vi.spyOn>
beforeEach(() => {
	pb.authStore.clear()
	source = null
	exchange = null
	saved = vi.spyOn(BaseAuthStore.prototype, 'save')
	popup = { closed: false, location: { href: '' }, close: vi.fn() } as unknown as Window
	vi.stubGlobal('EventSource', FakeEventSource)
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url) => {
			if (new URL(String(url)).pathname.endsWith('/auth-methods'))
				return Response.json({
					oauth2: {
						providers: [
							{
								name: 'github',
								authURL: 'https://github.com/login/oauth/authorize?redirect_uri=',
								codeVerifier: 'fixture-verifier'
							}
						]
					}
				})
			if (new URL(String(url)).pathname.endsWith('/api/realtime')) return new Response(null, { status: 204 })
			if (new URL(String(url)).pathname.endsWith('/auth-with-oauth2'))
				return new Promise<Response>((resolve) => {
					exchange = resolve
				})
			throw new Error(`Unexpected request: ${url}`)
		})
	)
})
afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	pb.authStore.clear()
})
async function connect() {
	await vi.waitFor(() => expect(source).not.toBeNull())
	source!.dispatchEvent(new MessageEvent('PB_CONNECT', { lastEventId: 'fixture-client', data: '{}' }))
	await vi.waitFor(() => expect(popup.location.href).toContain('github.com'))
}
test.each([false, true])('keeps the SDK write private until acceptance; cancelled=%s', async (cancelled) => {
	const controller = new AbortController()
	const onAuthenticated = vi.fn()
	const request = { signal: controller.signal, canAccept: () => true, popup, onAuthenticated }
	const result = acceptAuthSession(request, () => authenticateGithub(request))
	await connect()
	source!.dispatchEvent(
		new MessageEvent('@oauth2', { data: JSON.stringify({ state: 'fixture-client', code: 'fixture-code' }) })
	)
	await vi.waitFor(() => expect(exchange).toBeTypeOf('function'))
	if (cancelled) controller.abort()
	// Resolve despite abort, as a late server response can still reach the SDK.
	exchange(
		Response.json({ token: 'accepted-token', record: { id: 'user', collectionId: 'users', collectionName: 'users' } })
	)
	expect((await result)?.id ?? null).toBe(cancelled ? null : 'user')
	await vi.waitFor(() => expect(saved.mock.calls.some((call) => call[0] === 'accepted-token')).toBe(true))
	expect(pb.authStore.token).toBe(cancelled ? '' : 'accepted-token')
	expect(onAuthenticated).toHaveBeenCalledTimes(cancelled ? 0 : 1)
	expect(source!.close).toHaveBeenCalled()
	expect(popup.close).toHaveBeenCalled()
})

test('cancels the SDK realtime subscription while waiting for GitHub', async () => {
	const controller = new AbortController()
	const request = { signal: controller.signal, canAccept: () => true, popup }
	const result = acceptAuthSession(request, () => authenticateGithub(request))
	await connect()
	controller.abort()
	expect(await result).toBeNull()
	expect(source!.close).toHaveBeenCalled()
	expect(popup.close).toHaveBeenCalled()
})
