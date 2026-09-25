import { expect, test } from 'vitest'
import { installFixtureFetch } from '../fixtureFetch'

const http = installFixtureFetch()
const ROUTE = 'https://api.example.test/items'
const body = async (response: Promise<Response>) => (await response).json()

test('a queued route answers each request in order, then its fallback', async () => {
	http.serveInOrder(ROUTE, [{ n: 1 }, () => Response.json({ n: 2 }, { status: 503 })], { n: 'rest' })
	expect(await body(fetch(ROUTE))).toEqual({ n: 1 })
	const second = await fetch(`${ROUTE}?page=2`)
	expect([second.status, await second.json()]).toEqual([503, { n: 2 }])
	expect(await body(fetch(ROUTE))).toEqual({ n: 'rest' })
	expect(await body(fetch(ROUTE))).toEqual({ n: 'rest' })
})

test('serving a route again replaces its queue', async () => {
	http.serveInOrder(ROUTE, [{ n: 1 }, { n: 2 }])
	http.serveInOrder(ROUTE, [{ n: 'fresh' }], { n: 'fresh rest' })
	expect(await body(fetch(ROUTE))).toEqual({ n: 'fresh' })
	http.serve({ [ROUTE]: { n: 'served' } })
	expect(await body(fetch(ROUTE))).toEqual({ n: 'served' })
	expect(await body(fetch(ROUTE))).toEqual({ n: 'served' })
})

// The helper fails the test in afterEach, even when the code under test swallows the rejected fetch.
test.fails('a request past a queue without a fallback fails the test', async () => {
	http.serveInOrder(ROUTE, [{ n: 1 }])
	await fetch(ROUTE)
	await fetch(ROUTE).catch(() => undefined)
	expect(http.urls()).toEqual([ROUTE, ROUTE])
})
