import { afterEach, beforeEach, vi } from 'vitest'

/**
 * Serves `fetch` from fixtures so route handlers and page loaders run for real
 * down to the network boundary. Call once at the top of a test file, then
 * `serve()` fixtures inside each test.
 *
 * A route key is matched against the request's full URL, then its pathname,
 * then as the longest URL prefix. A fixture is a JSON body, or a function that
 * receives the URL and init and returns a body or a `Response`. Use a function
 * for a `Response`: bodies can only be read once.
 *
 * A request no fixture answers throws, and the test fails in `afterEach` even
 * when the code under test swallowed the error.
 *
 * `serveInOrder()` answers one route from a queue: each request takes the next
 * fixture, then `then` answers every later request. Without `then`, a request
 * after the queue runs out counts as unfixtured.
 */
export function installFixtureFetch() {
	const routes: Record<string, Fixture> = {}
	const requests: Array<{ url: URL; init?: RequestInit }> = []
	const unmatched: Array<string> = []

	function resolve(url: URL): Fixture | undefined {
		if (url.href in routes) return routes[url.href]
		if (url.pathname in routes) return routes[url.pathname]
		let best: string | undefined
		for (const key in routes) {
			if (url.href.startsWith(key) && (best === undefined || key.length > best.length)) best = key
		}
		return best === undefined ? undefined : routes[best]
	}

	const fetchFixture = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		const url = new URL(raw, 'http://localhost:3000')
		requests.push({ url, init })
		const fixture = resolve(url)
		if (fixture === undefined) {
			unmatched.push(url.href)
			throw new Error(`Unfixtured request: ${url.href}`)
		}
		return answer(fixture, url, init)
	}

	beforeEach(() => {
		for (const key in routes) delete routes[key]
		requests.length = 0
		unmatched.length = 0
		vi.stubGlobal('fetch', fetchFixture)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		if (unmatched.length > 0) throw new Error(`Requests without a fixture:\n${unmatched.join('\n')}`)
	})

	return {
		serve(next: Record<string, Fixture>) {
			Object.assign(routes, next)
		},
		/** Replaces `route` with a queue; calling again for the same route replaces the queue. */
		serveInOrder(route: string, fixtures: Array<Fixture>, then?: Fixture) {
			const queue = [...fixtures]
			routes[route] = (url: URL, init?: RequestInit) => {
				const next = queue.length > 0 ? queue.shift() : then
				if (next === undefined) {
					unmatched.push(url.href)
					throw new Error(`Fixture queue for ${route} is empty: ${url.href}`)
				}
				return answer(next, url, init)
			}
		},
		requests,
		/** Hrefs requested so far, in order. Assert one only when our own logic chose it, never a fixed template. */
		urls: () => requests.map((request) => request.url.href)
	}
}

async function answer(fixture: Fixture, url: URL, init?: RequestInit): Promise<Response> {
	const body = typeof fixture === 'function' ? await fixture(url, init) : fixture
	return body instanceof Response ? body : Response.json(body)
}

type Fixture = unknown | ((url: URL, init?: RequestInit) => unknown | Response | Promise<unknown | Response>)

/** A fixture that answers with a status and optional JSON body, fresh on every request. */
export function fixtureStatus(status: number, body?: unknown): () => Response {
	return () =>
		new Response(body === undefined ? null : JSON.stringify(body), {
			status,
			headers: { 'content-type': 'application/json' }
		})
}
