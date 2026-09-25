import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { dashboardDeleteHandler } from '~/containers/ProDashboard/server/deleteRoute'
import { dashboardSaveHandler } from '~/containers/ProDashboard/server/saveRoute'
import {
	createMockNextApiRequest,
	createMockNextApiResponse,
	type MockNextApiRequestOptions
} from '~/utils/testing/nextApiMocks'

function request(options: MockNextApiRequestOptions = {}) {
	return createMockNextApiRequest({
		body: options.body ?? {},
		headers: options.headers ?? { authorization: 'Bearer user-token' },
		method: options.method ?? 'POST',
		query: options.query ?? {}
	})
}

function dashboardResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, status })
}

function lastCall(fetchImpl: ReturnType<typeof vi.fn>) {
	const call = fetchImpl.mock.calls.at(-1)
	if (!call) throw new Error('Expected fetch to have been called')
	return call
}

function callAt(fetchImpl: ReturnType<typeof vi.fn>, index: number) {
	const call = fetchImpl.mock.calls[index]
	if (!call) throw new Error(`Expected fetch call ${index + 1}`)
	return call
}

function callUrl(call: Array<unknown>): URL {
	const input = call[0]
	if (typeof input !== 'string' && !(input instanceof URL)) throw new Error('Expected a URL-compatible fetch input')
	return new URL(input)
}

function purgeFiles(call: Array<unknown>): Array<string> {
	const init = call[1]
	if (typeof init !== 'object' || init === null || !('body' in init) || typeof init.body !== 'string') {
		throw new Error('Expected purge request with a JSON body')
	}
	const payload: unknown = JSON.parse(init.body)
	if (typeof payload !== 'object' || payload === null || !('files' in payload) || !Array.isArray(payload.files)) {
		throw new Error('Expected purge request body to contain files')
	}
	const files: Array<unknown> = payload.files
	if (!files.every((file): file is string => typeof file === 'string'))
		throw new Error('Expected purge files to be URLs')
	return files
}

function isCloudflarePurge(call: Array<unknown>): boolean {
	const input = call[0]
	return typeof input === 'string' && input.includes('api.cloudflare.com')
}

describe('/api/private/pro-dashboard/save', () => {
	beforeEach(() => {
		vi.stubEnv('CF_ZONE', 'zone')
		vi.stubEnv('CF_PURGE_CACHE_AUTH', 'cf-token')
		vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://defillama.test')
		vi.stubEnv('NEXT_BUILD_ID', 'build-test')
	})

	afterEach(() => {
		vi.unstubAllEnvs()
		vi.unstubAllGlobals()
	})

	test('rejects non-POST methods without touching the backend', async () => {
		const fetchImpl = vi.fn()
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await dashboardSaveHandler(request({ method: 'GET' }), res)

		expect(res.status).toHaveBeenCalledWith(405)
		expect(fetchImpl).not.toHaveBeenCalled()
	})

	test('creates a public dashboard and purges its urls', async () => {
		const body = { data: { dashboardName: 'My Dash' }, visibility: 'public' }
		const saved = { id: 'new-1', slug: 'my-dash', visibility: 'public' }
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(dashboardResponse(saved))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await dashboardSaveHandler(request({ body }), res)

		const createCall = callAt(fetchImpl, 0)
		expect(callUrl(createCall).pathname).toBe('/dashboards')
		expect(createCall[1]).toEqual({
			method: 'POST',
			headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
		const purgeCall = lastCall(fetchImpl)
		expect(isCloudflarePurge(purgeCall)).toBe(true)
		expect(purgeFiles(purgeCall)).toEqual(
			expect.arrayContaining(['https://defillama.test/pro/new-1', 'https://defillama.test/pro/my-dash'])
		)
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith(saved)
	})

	test('reads the previous state then purges old and new slugs on a public rename', async () => {
		const before = { id: 'd1', slug: 'old-name', visibility: 'public' }
		const saved = { id: 'd1', slug: 'new-name', visibility: 'public' }
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(dashboardResponse(before))
			.mockResolvedValueOnce(dashboardResponse(saved))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await dashboardSaveHandler(request({ query: { id: 'd1' }, body: { visibility: 'public' } }), res)

		const readCall = callAt(fetchImpl, 0)
		const saveCall = callAt(fetchImpl, 1)
		expect(callUrl(readCall).pathname).toBe('/dashboards/d1')
		expect(readCall[1]).toEqual({ headers: { Authorization: 'Bearer user-token' } })
		expect(callUrl(saveCall).pathname).toBe('/dashboards/d1')
		expect(saveCall[1]).toMatchObject({ method: 'POST' })
		expect(purgeFiles(lastCall(fetchImpl))).toEqual(
			expect.arrayContaining([
				'https://defillama.test/pro/d1',
				'https://defillama.test/pro/new-name',
				'https://defillama.test/pro/old-name'
			])
		)
		expect(res.json).toHaveBeenCalledWith(saved)
	})

	test('purges the canonical dashboard id when an update is addressed by slug', async () => {
		const before = { id: 'canonical-id', slug: 'old-name', visibility: 'public' }
		const saved = { id: 'canonical-id', slug: 'new-name', visibility: 'public' }
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(dashboardResponse(before))
			.mockResolvedValueOnce(dashboardResponse(saved))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await dashboardSaveHandler(request({ query: { id: 'old-name' }, body: { visibility: 'public' } }), res)

		const files = purgeFiles(lastCall(fetchImpl))
		expect(files).toContain('https://defillama.test/pro/canonical-id')
		expect(files).toContain('https://defillama.test/pro/old-name')
		expect(files).toContain('https://defillama.test/pro/new-name')
	})

	test('purges when a public dashboard is made private', async () => {
		const before = { id: 'd2', slug: 'going-private', visibility: 'public' }
		const saved = { id: 'd2', slug: 'going-private', visibility: 'private' }
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(dashboardResponse(before))
			.mockResolvedValueOnce(dashboardResponse(saved))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await dashboardSaveHandler(request({ query: { id: 'd2' }, body: { visibility: 'private' } }), res)

		expect(isCloudflarePurge(lastCall(fetchImpl))).toBe(true)
		expect(res.json).toHaveBeenCalledWith(saved)
	})

	test('passes backend save failure status and body through', async () => {
		const fetchImpl = vi.fn().mockResolvedValueOnce(dashboardResponse({ message: 'Forbidden' }, 403))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await dashboardSaveHandler(request({ body: { visibility: 'public' } }), res)

		expect(fetchImpl).toHaveBeenCalledTimes(1)
		expect(res.status).toHaveBeenCalledWith(403)
		expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' })
	})

	test('returns 502 and does not purge when a successful backend save has invalid JSON', async () => {
		const fetchImpl = vi.fn().mockResolvedValueOnce(new Response('not-json', { status: 200 }))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await dashboardSaveHandler(request({ body: { visibility: 'public' } }), res)

		expect(fetchImpl).toHaveBeenCalledTimes(1)
		expect(res.status).toHaveBeenCalledWith(502)
		expect(res.json).toHaveBeenCalledWith({ error: 'Dashboard save response was not valid JSON' })
	})
})

describe('/api/private/pro-dashboard/delete', () => {
	beforeEach(() => {
		vi.stubEnv('CF_ZONE', 'zone')
		vi.stubEnv('CF_PURGE_CACHE_AUTH', 'cf-token')
		vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://defillama.test')
		vi.stubEnv('NEXT_BUILD_ID', 'build-test')
	})

	afterEach(() => {
		vi.unstubAllEnvs()
		vi.unstubAllGlobals()
	})

	test('requires a dashboard id', async () => {
		const fetchImpl = vi.fn()
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await dashboardDeleteHandler(request({ query: {} }), res)

		expect(res.status).toHaveBeenCalledWith(400)
		expect(fetchImpl).not.toHaveBeenCalled()
	})

	test('deletes a public dashboard and purges its urls', async () => {
		const before = { id: 'd9', slug: 'public-dash', visibility: 'public' }
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(dashboardResponse(before))
			.mockResolvedValueOnce(dashboardResponse({ message: 'Dashboard deleted' }))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await dashboardDeleteHandler(request({ query: { id: 'd9' } }), res)

		expect(callUrl(callAt(fetchImpl, 0)).pathname).toBe('/dashboards/d9')
		expect(callUrl(callAt(fetchImpl, 1)).pathname).toBe('/dashboards/delete/d9')
		expect(purgeFiles(lastCall(fetchImpl))).toEqual(
			expect.arrayContaining(['https://defillama.test/pro/d9', 'https://defillama.test/pro/public-dash'])
		)
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({ message: 'Dashboard deleted' })
	})

	test('purges the canonical dashboard id when deletion is addressed by slug', async () => {
		const before = { id: 'canonical-id', slug: 'public-dash', visibility: 'public' }
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(dashboardResponse(before))
			.mockResolvedValueOnce(dashboardResponse({ message: 'Dashboard deleted' }))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await dashboardDeleteHandler(request({ query: { id: 'public-dash' } }), res)

		const files = purgeFiles(lastCall(fetchImpl))
		expect(files).toContain('https://defillama.test/pro/canonical-id')
		expect(files).toContain('https://defillama.test/pro/public-dash')
	})

	test('passes backend delete failures through without purging', async () => {
		const before = { id: 'd11', slug: 'public-dash', visibility: 'public' }
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(dashboardResponse(before))
			.mockResolvedValueOnce(dashboardResponse({ message: 'Forbidden' }, 403))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await dashboardDeleteHandler(request({ query: { id: 'd11' } }), res)

		expect(fetchImpl).toHaveBeenCalledTimes(2)
		expect(res.status).toHaveBeenCalledWith(403)
		expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' })
	})
})
