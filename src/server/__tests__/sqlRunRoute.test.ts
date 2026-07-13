import type { NextApiRequest } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const runServerSqlMock = vi.fn()

vi.mock('~/server/sql/runner', async () => {
	const actual = await vi.importActual<typeof import('~/server/sql/runner')>('~/server/sql/runner')
	return {
		...actual,
		runServerSql: (...args: unknown[]) => runServerSqlMock(...args)
	}
})

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

const DASHBOARD = { id: 'dash-1', data: { items: [SQL_ITEM, { id: 'other', kind: 'text' }] } }

const FRESH_SNAPSHOT = {
	columns: [{ name: 'x', type: 'INTEGER' }],
	rows: [{ x: 1 }],
	computedAt: new Date().toISOString(),
	rowCount: 1,
	engine: 'server'
}

function request(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
	return {
		method: 'GET',
		headers: {},
		query: { dashboardId: 'dash-1', itemId: 'widget-1' },
		...overrides
	} as NextApiRequest
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

beforeEach(() => {
	vi.stubEnv('SQL_RESULTS_INTERNAL_KEY', 'internal-key')
	runServerSqlMock.mockReset()
})

afterEach(() => {
	vi.unstubAllEnvs()
	vi.unstubAllGlobals()
})

describe('/api/private/pro-dashboard/sql-run', () => {
	it('rejects non-GET methods', async () => {
		const res = createMockNextApiResponse()
		await sqlRunHandler(request({ method: 'POST' }), res)
		expect(res.status).toHaveBeenCalledWith(405)
	})

	it('rejects missing params', async () => {
		const res = createMockNextApiResponse()
		await sqlRunHandler(request({ query: {} }), res)
		expect(res.status).toHaveBeenCalledWith(400)
	})

	it('maps missing dashboard to 404', async () => {
		stubFetchRoutes({ dashboard: new Response('not found', { status: 404 }) })
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)
		expect(res.status).toHaveBeenCalledWith(404)
	})

	it('passes 401 through for private dashboards', async () => {
		stubFetchRoutes({ dashboard: new Response('unauthorized', { status: 401 }) })
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)
		expect(res.status).toHaveBeenCalledWith(401)
	})

	it('returns 404 when item is not a sql widget', async () => {
		stubFetchRoutes({})
		const res = createMockNextApiResponse()
		await sqlRunHandler(request({ query: { dashboardId: 'dash-1', itemId: 'other' } }), res)
		expect(res.status).toHaveBeenCalledWith(404)
		expect(runServerSqlMock).not.toHaveBeenCalled()
	})

	it('serves fresh stored results without executing', async () => {
		stubFetchRoutes({
			storedGet: jsonResponse({ result: FRESH_SNAPSHOT, computedAt: FRESH_SNAPSHOT.computedAt })
		})
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith(FRESH_SNAPSHOT)
		expect(runServerSqlMock).not.toHaveBeenCalled()
	})

	it('executes on miss, stores the snapshot, and returns it', async () => {
		const fetchImpl = stubFetchRoutes({})
		runServerSqlMock.mockResolvedValue({ columns: [{ name: 'x', type: 'INTEGER' }], rows: [{ x: 1 }] })
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)

		expect(runServerSqlMock).toHaveBeenCalledWith(SQL_ITEM.query)
		expect(res.status).toHaveBeenCalledWith(200)
		const body = res.json.mock.calls[0][0]
		expect(body.engine).toBe('server')
		expect(body.rows).toEqual([{ x: 1 }])

		const putCall = fetchImpl.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'PUT')
		expect(putCall).toBeTruthy()
		expect((putCall![1] as RequestInit).headers).toMatchObject({ 'x-internal-key': 'internal-key' })
	})

	it('executes when stored result is stale', async () => {
		const staleAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
		stubFetchRoutes({
			storedGet: jsonResponse({ result: { ...FRESH_SNAPSHOT, computedAt: staleAt }, computedAt: staleAt })
		})
		runServerSqlMock.mockResolvedValue({ columns: [{ name: 'x', type: 'INTEGER' }], rows: [{ x: 2 }] })
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)
		expect(runServerSqlMock).toHaveBeenCalled()
		expect(res.json.mock.calls[0][0].rows).toEqual([{ x: 2 }])
	})

	it('falls back to stale stored result when execution fails', async () => {
		const staleAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
		const staleSnapshot = { ...FRESH_SNAPSHOT, computedAt: staleAt }
		stubFetchRoutes({ storedGet: jsonResponse({ result: staleSnapshot, computedAt: staleAt }) })
		runServerSqlMock.mockRejectedValue(new Error('upstream exploded'))
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json.mock.calls[0][0]).toMatchObject({ rows: staleSnapshot.rows, error: 'upstream exploded' })
	})

	it('returns 502 when execution fails with no stored fallback', async () => {
		stubFetchRoutes({})
		runServerSqlMock.mockRejectedValue(new Error('boom'))
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)
		expect(res.status).toHaveBeenCalledWith(502)
		expect(res.json).toHaveBeenCalledWith({ error: 'boom' })
	})

	it('returns 429 when the runner queue is full', async () => {
		stubFetchRoutes({})
		runServerSqlMock.mockRejectedValue(new SqlQueueFullError())
		const res = createMockNextApiResponse()
		await sqlRunHandler(request(), res)
		expect(res.status).toHaveBeenCalledWith(429)
	})

	it('dedupes concurrent runs of the same query', async () => {
		stubFetchRoutes({})
		let resolveRun: (value: unknown) => void
		runServerSqlMock.mockReturnValue(
			new Promise((resolve) => {
				resolveRun = resolve
			})
		)
		const resA = createMockNextApiResponse()
		const resB = createMockNextApiResponse()
		const pending = Promise.all([sqlRunHandler(request(), resA), sqlRunHandler(request(), resB)])
		await vi.waitFor(() => expect(runServerSqlMock).toHaveBeenCalled())
		resolveRun!({ columns: [{ name: 'x', type: 'INTEGER' }], rows: [{ x: 1 }] })
		await pending
		expect(runServerSqlMock).toHaveBeenCalledTimes(1)
		expect(resA.status).toHaveBeenCalledWith(200)
		expect(resB.status).toHaveBeenCalledWith(200)
	})
})
