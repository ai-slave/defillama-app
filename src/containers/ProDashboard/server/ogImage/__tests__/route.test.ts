import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/testing/nextApiMocks'

// next/og needs its WASM renderer, which does not run in Node tests; record what it was asked to draw.
const { renders } = vi.hoisted(() => ({ renders: [] as Array<{ width: number; height: number }> }))
vi.mock('next/og', () => ({
	ImageResponse: class {
		constructor(_element: unknown, options: { width: number; height: number }) {
			renders.push(options)
		}
		async arrayBuffer(): Promise<ArrayBuffer> {
			return new Uint8Array([137, 80, 78, 71]).buffer
		}
	}
}))
// Chart tiles read the protocol catalog from the database; it never answers, like a stalled upstream.
vi.mock('~/server/db/llama', () => ({
	llamaDb: { query: () => new Promise(() => {}), any: () => new Promise(() => {}) }
}))

const http = installFixtureFetch()
const OG_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400'
const PNG = Buffer.from([137, 80, 78, 71])

let handler: typeof import('../route').dashboardOgImageHandler

function serveDashboard(id: string, overrides: Record<string, unknown> = {}) {
	http.serve({
		[`/dashboards/${id}`]: {
			id,
			created: '2026-01-01T00:00:00.000Z',
			updated: '2026-02-01T00:00:00.000Z',
			editedAt: '2026-02-02T00:00:00.000Z',
			visibility: 'public',
			data: { dashboardName: 'Yield Overview', items: [{ id: 'text-1', kind: 'text', content: 'Notes' }] },
			...overrides
		}
	})
}

async function callHandler(dashboardId: string, query: Record<string, string> = {}) {
	const res = createMockNextApiResponse()
	await handler(createMockNextApiRequest({ query: { ...query, dashboardId } }), res)
	return res
}

beforeEach(async () => {
	renders.length = 0
	// The route keeps a module-level PNG cache; a fresh module keeps tests independent.
	vi.resetModules()
	handler = (await import('../route')).dashboardOgImageHandler
})
afterEach(() => {
	vi.useRealTimers()
})

describe('dashboard og image route', () => {
	test('renders a public dashboard as a cacheable png at og size', async () => {
		serveDashboard('d1')
		const res = await callHandler('d1')

		expect(res.statusCode).toBe(200)
		expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', OG_CACHE_CONTROL)
		expect(res.send).toHaveBeenCalledWith(PNG)
		expect(renders).toEqual([{ width: 1200, height: 630 }])
	})

	test('renders the thumb variant at half size', async () => {
		serveDashboard('d1')
		await callHandler('d1', { variant: 'thumb' })
		expect(renders).toEqual([{ width: 600, height: 315 }])
	})

	test('serves the static card with status 200 for a dashboard that is not public', async () => {
		http.serve({ '/dashboards/private': () => new Response(null, { status: 403 }) })
		const res = await callHandler('private')

		expect(res.statusCode).toBe(200)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', OG_CACHE_CONTROL)
		expect(res.send).toHaveBeenCalledWith(PNG)
	})

	test('reuses the cached png while editedAt is unchanged and re-renders once it changes', async () => {
		serveDashboard('d1')
		await callHandler('d1')
		await callHandler('d1')
		expect(renders).toHaveLength(1)

		serveDashboard('d1', { editedAt: '2026-03-03T00:00:00.000Z' })
		await callHandler('d1')
		expect(renders).toHaveLength(2)
	})

	test('sends a chartless card when chart data times out, and does not cache it', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
		const chart = { id: 'chart-1', kind: 'chart', type: 'tvl', subjectType: 'protocol', protocol: 'aave' }
		serveDashboard('d1', { data: { dashboardName: 'Charts', items: [chart] } })
		http.serve({ 'https://': () => new Promise(() => {}) })

		const first = callHandler('d1')
		await vi.advanceTimersByTimeAsync(5000)
		expect((await first).send).toHaveBeenCalledWith(PNG)

		const second = callHandler('d1')
		await vi.advanceTimersByTimeAsync(5000)
		await second
		expect(renders).toHaveLength(2)
	})
})
