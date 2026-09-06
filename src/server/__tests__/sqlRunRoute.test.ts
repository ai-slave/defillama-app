import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
	createMockNextApiRequest,
	createMockNextApiResponse,
	type MockNextApiRequestOptions
} from '~/utils/test/nextApiMocks'

const runServerSqlMock = vi.fn()
const fetchAuthenticatedUserIdMock = vi.fn()

vi.mock('~/server/sql/runner', async () => {
	const actual = await vi.importActual<typeof import('~/server/sql/runner')>('~/server/sql/runner')
	return {
		...actual,
		runServerSql: (...args: Array<unknown>) => runServerSqlMock(...args)
	}
})

vi.mock('~/containers/ProDashboard/server/auth', () => ({
	fetchAuthenticatedUserId: (...args: Array<unknown>) => fetchAuthenticatedUserIdMock(...args)
}))

import { sqlRunHandler } from '~/containers/ProDashboard/server/sqlRunRoute'
import { SqlQueueFullError } from '~/server/sql/runner'

const SQL_ITEM = {
	id: 'widget-1',
	kind: 'sql',
	query: { sql: 'SELECT 1 AS x', tableSources: [] },
	chart: {},
	rowCap: 1000,
	snapshot: null
}

const DASHBOARD = {
	id: 'dash-1',
	user: 'owner-1',
	visibility: 'public',
	data: { items: [SQL_ITEM, { id: 'other', kind: 'text' }] }
}

const FRESH_SNAPSHOT = {
	columns: [{ name: 'x', type: 'INTEGER' }],
	rows: [{ x: 1 }],
	computedAt: new Date().toISOString(),
	rowCount: 1,
	engine: 'server'
}

function request(options: MockNextApiRequestOptions = {}) {
	return createMockNextApiRequest({
		headers: options.headers ?? {},
		method: options.method ?? 'GET',
		query: options.query ?? { dashboardId: 'dash-1', itemId: 'widget-1' }
	})
}

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, status })
}

function stubFetchRoutes(routes: { dashboard?: Response; storedGet?: Response; put?: Response }) {
	const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
		const href = String(url)
		if (href.includes('/dashboards/')) return routes.dashboard ?? jsonResponse(DASHBOARD)
		if (href.includes('/internal/sql-results/') && init?.method === 'PUT') {
			return routes.put ?? jsonResponse({ ok: true })
		}
		if (href.includes('/internal/sql-results/')) {
			return routes.storedGet ?? new Response('not found', { status: 404 })
		}
		throw new Error(`Unexpected fetch: ${href}`)
	})
	vi.stubGlobal('fetch', fetchImpl)
	return fetchImpl
}

function responseBody(res: ReturnType<typeof createMockNextApiResponse>, index = 0): unknown {
	const call = res.json.mock.calls[index]
	if (!call) throw new Error(`Expected JSON response ${index + 1}`)
	return call[0]
}

beforeEach(() => {
	vi.stubEnv('SQL_RESULTS_INTERNAL_KEY', 'internal-key')
	runServerSqlMock.mockReset()
	fetchAuthenticatedUserIdMock.mockReset()
	fetchAuthenticatedUserIdMock.mockResolvedValue('owner-1')
})

afterEach(() => {
	vi.unstubAllEnvs()
	vi.unstubAllGlobals()
})

describe('/api/private/pro-dashboard/sql-run', () => {
	test('rejects non-GET methods', async () => {
		const res = createMockNextApiResponse()
		await sqlRunHandler(request({ method: 'POST' }), res)
		expect(res.status).toHaveBeenCalledWith(405)
	})

	test('rejects missing params', async () => {
		const res = createMockNextApiResponse()
		await sqlRunHandler(request({ query: {} }), res)
		expect(res.status).toHaveBeenCalledWith(400)
	})

	test('maps missing dashboard to 404', async () => {
		stubFetchRoutes({ dashboard: new Response('not found', { status: 404 }) })
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)
		expect(res.status).toHaveBeenCalledWith(404)
	})

	test('passes 401 through for private dashboards', async () => {
		stubFetchRoutes({ dashboard: new Response('unauthorized', { status: 401 }) })
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)
		expect(res.status).toHaveBeenCalledWith(401)
	})

	test('returns 502 when the dashboard backend returns invalid JSON', async () => {
		stubFetchRoutes({ dashboard: new Response('not-json', { status: 200 }) })
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)
		expect(res.status).toHaveBeenCalledWith(502)
		expect(res.json).toHaveBeenCalledWith({ error: 'Dashboard response was not valid JSON' })
		expect(runServerSqlMock).not.toHaveBeenCalled()
	})

	test('returns 404 when item is not a sql widget', async () => {
		stubFetchRoutes({})
		const res = createMockNextApiResponse()
		await sqlRunHandler(request({ query: { dashboardId: 'dash-1', itemId: 'other' } }), res)
		expect(res.status).toHaveBeenCalledWith(404)
		expect(runServerSqlMock).not.toHaveBeenCalled()
	})

	test('serves fresh stored results without executing', async () => {
		stubFetchRoutes({
			storedGet: jsonResponse({ result: FRESH_SNAPSHOT, computedAt: FRESH_SNAPSHOT.computedAt })
		})
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith(FRESH_SNAPSHOT)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(runServerSqlMock).not.toHaveBeenCalled()
	})

	test('bypasses a fresh stored result for an explicit refresh', async () => {
		stubFetchRoutes({
			storedGet: jsonResponse({ result: FRESH_SNAPSHOT, computedAt: FRESH_SNAPSHOT.computedAt })
		})
		runServerSqlMock.mockResolvedValue({ columns: [{ name: 'x', type: 'INTEGER' }], rows: [{ x: 2 }] })
		const res = createMockNextApiResponse()

		await sqlRunHandler(
			request({
				headers: { authorization: 'Bearer owner-token' },
				query: { dashboardId: 'dash-1', itemId: 'widget-1', refresh: '1' }
			}),
			res
		)

		expect(runServerSqlMock).toHaveBeenCalledWith(SQL_ITEM.query)
		expect(responseBody(res)).toMatchObject({ rows: [[2]] })
	})

	test('does not let a read-only viewer force a SQL refresh', async () => {
		stubFetchRoutes({
			storedGet: jsonResponse({ result: FRESH_SNAPSHOT, computedAt: FRESH_SNAPSHOT.computedAt })
		})
		fetchAuthenticatedUserIdMock.mockResolvedValue('viewer-1')
		const res = createMockNextApiResponse()

		await sqlRunHandler(
			request({
				headers: { authorization: 'Bearer viewer-token' },
				query: { dashboardId: 'dash-1', itemId: 'widget-1', refresh: '1' }
			}),
			res
		)

		expect(res.status).toHaveBeenCalledWith(403)
		expect(runServerSqlMock).not.toHaveBeenCalled()
	})

	test('executes on miss, stores the snapshot, and returns it', async () => {
		const fetchImpl = stubFetchRoutes({})
		runServerSqlMock.mockResolvedValue({ columns: [{ name: 'x', type: 'INTEGER' }], rows: [{ x: 1 }] })
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)

		expect(runServerSqlMock).toHaveBeenCalledWith(SQL_ITEM.query)
		expect(res.status).toHaveBeenCalledWith(200)
		expect(responseBody(res)).toMatchObject({ engine: 'server', rows: [[1]] })

		const putCall = fetchImpl.mock.calls.find(([, init]) => init?.method === 'PUT')
		if (!putCall) throw new Error('Expected stored SQL result PUT request')
		expect(putCall[1]?.headers).toMatchObject({ 'x-internal-key': 'internal-key' })
	})

	test('executes when stored result is stale', async () => {
		const staleAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
		stubFetchRoutes({
			storedGet: jsonResponse({ result: { ...FRESH_SNAPSHOT, computedAt: staleAt }, computedAt: staleAt })
		})
		runServerSqlMock.mockResolvedValue({ columns: [{ name: 'x', type: 'INTEGER' }], rows: [{ x: 2 }] })
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)
		expect(runServerSqlMock).toHaveBeenCalled()
		expect(responseBody(res)).toMatchObject({ rows: [[2]] })
	})

	test('falls back to stale stored result when execution fails', async () => {
		const staleAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
		const staleSnapshot = { ...FRESH_SNAPSHOT, computedAt: staleAt }
		stubFetchRoutes({ storedGet: jsonResponse({ result: staleSnapshot, computedAt: staleAt }) })
		runServerSqlMock.mockRejectedValue(new Error('upstream exploded'))
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)
		expect(res.status).toHaveBeenCalledWith(200)
		expect(responseBody(res)).toMatchObject({ rows: staleSnapshot.rows, error: 'upstream exploded' })
	})

	test('returns 502 when execution fails with no stored fallback', async () => {
		stubFetchRoutes({})
		runServerSqlMock.mockRejectedValue(new Error('boom'))
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)
		expect(res.status).toHaveBeenCalledWith(502)
		expect(res.json).toHaveBeenCalledWith({ error: 'boom' })
	})

	test('returns 429 when the runner queue is full', async () => {
		stubFetchRoutes({})
		runServerSqlMock.mockRejectedValue(new SqlQueueFullError())
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)
		expect(res.status).toHaveBeenCalledWith(429)
	})

	test('dedupes concurrent runs of the same query', async () => {
		stubFetchRoutes({})
		let resolveRun: (value: unknown) => void = () => {
			throw new Error('SQL run resolver was not initialized')
		}
		runServerSqlMock.mockReturnValue(
			new Promise((resolve) => {
				resolveRun = resolve
			})
		)
		const resA = createMockNextApiResponse()
		const resB = createMockNextApiResponse()
		const pending = Promise.all([sqlRunHandler(request(), resA), sqlRunHandler(request(), resB)])
		await vi.waitFor(() => expect(runServerSqlMock).toHaveBeenCalled())
		resolveRun({ columns: [{ name: 'x', type: 'INTEGER' }], rows: [{ x: 1 }] })
		await pending
		expect(runServerSqlMock).toHaveBeenCalledTimes(1)
		expect(resA.status).toHaveBeenCalledWith(200)
		expect(resB.status).toHaveBeenCalledWith(200)
	})
})
