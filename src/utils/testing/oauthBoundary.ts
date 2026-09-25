import { afterEach, beforeEach, expect, vi } from 'vitest'

/**
 * Fakes the browser side of social sign-in so `~/auth` runs for real: `window.open` popups,
 * the PocketBase realtime `EventSource` that carries the GitHub OAuth callback, and Google
 * Identity Services (`window.google`), which hands the page a one-time code.
 *
 * PocketBase HTTP calls go through `fetch`: pass `routes` to `installFixtureFetch().serve()`,
 * or call `routes[url.pathname]` first from a hand-written `fetch` stub. The Google code
 * exchange is a plain `fetch` to `${AUTH_SERVER}/auth/google-code-signin`; the test serves it.
 *
 * `GoogleSignInButton` renders its Google script through `next/script`, so a test that clicks
 * it mocks `next/script` to call `onReady` when `window.google` exists.
 */
export function installOAuthBoundary() {
	let source: FakeEventSource | null = null
	let exchange: ((response: Response) => void) | null = null
	let popup: FakePopup | null = null
	let popupsBlocked = false

	class FakeEventSource extends EventTarget {
		closed = false
		constructor() {
			super()
			// The SDK constructs EventSource internally; keep it to deliver the provider callback.
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			source = this
		}
		close() {
			this.closed = true
		}
	}

	function openPopup(): Window {
		const next: FakePopup = {
			closed: false,
			location: { href: 'about:blank' },
			close() {
				next.closed = true
			}
		}
		popup = next
		return next as unknown as Window
	}

	beforeEach(() => {
		source = null
		exchange = null
		popup = null
		popupsBlocked = false
		vi.stubGlobal('EventSource', FakeEventSource)
		vi.stubGlobal('open', () => (popupsBlocked ? null : openPopup()))
		window.google = {
			accounts: {
				id: { revoke: (_loginHint, callback) => callback({ successful: true }) },
				oauth2: {
					initCodeClient: (options) => ({ requestCode: () => options.callback({ code: GOOGLE_CODE }) })
				}
			}
		}
	})
	afterEach(() => {
		delete window.google
		vi.unstubAllGlobals()
	})

	const routes: Record<string, () => Promise<Response>> = {
		'/api/collections/users/auth-methods': async () =>
			Response.json({
				oauth2: {
					providers: [
						{
							name: 'github',
							authURL: 'https://github.com/login/oauth/authorize?redirect_uri=',
							codeVerifier: 'fixture-verifier'
						}
					]
				}
			}),
		'/api/realtime': async () => new Response(null, { status: 204 }),
		'/api/collections/users/auth-with-oauth2': () =>
			new Promise<Response>((resolve) => {
				exchange = resolve
			})
	}

	return {
		/** PocketBase OAuth HTTP routes, keyed by pathname. */
		routes,
		/** The most recent popup `window.open` returned, or null. */
		get popup() {
			return popup
		},
		/** Makes `window.open` return null, as a popup blocker does. */
		blockPopups() {
			popupsBlocked = true
		},
		/** Returns a fresh popup, for code that receives one instead of opening it. */
		openPopup,
		github: {
			/** Resolves once the SDK is listening for the callback and the popup shows GitHub. */
			async waitForPopup() {
				await vi.waitFor(() => expect(source).not.toBeNull(), { timeout: 1000 })
				source!.dispatchEvent(new MessageEvent('PB_CONNECT', { lastEventId: CLIENT_ID, data: '{}' }))
				await vi.waitFor(() => expect(popup?.location.href).toContain('github.com'), { timeout: 1000 })
			},
			/** Delivers GitHub's callback and answers the code exchange with `session`. */
			async approve(session: { token: string; record: Record<string, unknown>; meta?: { isNew?: boolean } }) {
				await this.waitForPopup()
				source!.dispatchEvent(
					new MessageEvent('@oauth2', { data: JSON.stringify({ state: CLIENT_ID, code: 'github-code' }) })
				)
				await vi.waitFor(() => expect(exchange).toBeTypeOf('function'), { timeout: 1000 })
				exchange!(Response.json(session))
			},
			/** Whether the SDK stopped listening for the GitHub callback. */
			get listenerClosed() {
				return source?.closed ?? false
			}
		}
	}
}

/** The code Google Identity Services hands the page after its popup. */
export const GOOGLE_CODE = 'google-fixture-code'
const CLIENT_ID = 'fixture-realtime-client'

type FakePopup = { closed: boolean; location: { href: string }; close: () => void }
