import { beforeEach, describe, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/test/nextApiMocks'

// The runner spawns a DuckDB worker (the database boundary); runner.test covers it for real.
const runServerSql = vi.hoisted(() => vi.fn())
vi.mock('~/server/sql/runner', async (importActual) => ({
	...(await importActual<typeof import('~/server/sql/runner')>()),
	runServerSql
}))

import { sqlRunHandler } from '~/containers/ProDashboard/server/sqlRunRoute'
import { featuresServerUrl } from '~/server/dashboardPurgeProxy'
import { SqlPolicyError } from '~/server/sql/policy'
import { SqlQueueFullError } from '~/server/sql/runner'

const http = installFixtureFetch()

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
const STALE_AT = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
const snapshotAt = (computedAt: string) => ({
	columns: [{ name: 'x', type: 'INTEGER' }],
	rows: [{ x: 1 }],
	computedAt,
	rowCount: 1,
	engine: 'server'
})
const FRESH = snapshotAt(new Date().toISOString())
const STALE = snapshotAt(STALE_AT)

// Bearer tokens map to users: owner and viewer hold API subscriptions, free does not.
const USERS: Record<string, { id: string; plan: string }> = {
	'Bearer owner-token': { id: 'owner-1', plan: 'api' },
	'Bearer viewer-token': { id: 'viewer-1', plan: 'api' },
	'Bearer free-token': { id: 'free-1', plan: 'pro' }
}
const header = (init: RequestInit | undefined) => (init!.headers as Record<string, string>).Authorization

const stores: Array<unknown> = []

function serve({
	dashboard = () => Response.json(DASHBOARD),
	stored
}: {
	dashboard?: () => Response
	stored?: { result: unknown; computedAt: string }
}) {
	http.serve({
		[featuresServerUrl('/dashboards/dash-1')]: dashboard,
		[featuresServerUrl('/internal/sql-results/')]: (_url, init) => {
			if (init?.method !== 'PUT') return stored ? Response.json(stored) : new Response('not found', { status: 404 })
			stores.push({ key: (init.headers as Record<string, string>)['x-internal-key'], ...JSON.parse(String(init.body)) })
			return { ok: true }
		},
		'https://pb.llama.fi/api/collections/users/auth-refresh': (_url, init) => ({
			record: { id: USERS[header(init)].id }
		}),
		'https://features.llama.fi/subscription/status': (_url, init) => ({
			subscription: { type: USERS[header(init)].plan, status: 'active' }
		})
	})
}

async function run({
	token = 'owner-token' as string | null,
	method = 'GET',
	query = { dashboardId: 'dash-1', itemId: 'widget-1' } as Record<string, string>
} = {}) {
	const res = createMockNextApiResponse()
	const headers = token ? { authorization: `Bearer ${token}` } : {}
	await sqlRunHandler(createMockNextApiRequest({ headers, method, query }), res)
	return { status: res.statusCode, body: res.json.mock.calls[0]?.[0], res }
}

const refresh = { dashboardId: 'dash-1', itemId: 'widget-1', refresh: '1' }

beforeEach(() => {
	vi.stubEnv('SQL_RESULTS_INTERNAL_KEY', 'internal-key')
	runServerSql.mockReset()
	stores.length = 0
})

describe('request validation', () => {
	test('rejects non-GET methods and missing params', async () => {
		expect((await run({ method: 'POST' })).status).toBe(405)
		expect((await run({ query: {} })).status).toBe(400)
	})

	test('maps a missing dashboard to 404 and a private one to 401', async () => {
		serve({ dashboard: () => new Response('not found', { status: 404 }) })
		expect((await run()).status).toBe(404)
		serve({ dashboard: () => new Response('unauthorized', { status: 401 }) })
		expect((await run()).status).toBe(401)
	})

	test('returns 502 when the dashboard backend returns invalid JSON', async () => {
		serve({ dashboard: () => new Response('not-json') })
		expect(await run()).toMatchObject({ status: 502, body: { error: 'Something went wrong' } })
	})

	test('returns 404 when the item is not a SQL card', async () => {
		serve({})
		expect((await run({ query: { dashboardId: 'dash-1', itemId: 'other' } })).status).toBe(404)
	})

	test('rejects a now-blocked query and a legacy recipe without tableSources, even when cached', async () => {
		serve({
			dashboard: () =>
				Response.json({
					...DASHBOARD,
					data: { items: [{ ...SQL_ITEM, query: { sql: 'SELECT * FROM system.tables', tableSources: [] } }] }
				}),
			stored: { result: FRESH, computedAt: FRESH.computedAt }
		})
		expect((await run()).status).toBe(400)
		serve({
			dashboard: () => Response.json({ ...DASHBOARD, data: { items: [{ ...SQL_ITEM, query: { sql: 'SELECT 1' } }] } })
		})
		expect((await run()).status).toBe(400)
		expect(runServerSql).not.toHaveBeenCalled()
	})
})

describe('stored results', () => {
	test('serves a fresh stored result to anonymous viewers without executing', async () => {
		serve({ stored: { result: FRESH, computedAt: FRESH.computedAt } })
		const { status, body, res } = await run({ token: null })
		expect(status).toBe(200)
		expect(body).toEqual(FRESH)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(runServerSql).not.toHaveBeenCalled()
	})

	test('executes on a miss, stores the snapshot with the internal key, and returns it', async () => {
		serve({})
		runServerSql.mockResolvedValue({ columns: [{ name: 'x', type: 'INTEGER' }], rows: [{ x: 1 }] })
		const { status, body } = await run()
		expect(status).toBe(200)
		expect(body).toMatchObject({ engine: 'server', rows: [[1]] })
		expect(stores).toMatchObject([{ key: 'internal-key', result: { rows: [[1]] } }])
	})

	test('re-executes a stale result', async () => {
		serve({ stored: { result: STALE, computedAt: STALE_AT } })
		runServerSql.mockResolvedValue({ columns: [{ name: 'x', type: 'INTEGER' }], rows: [{ x: 2 }] })
		expect((await run()).body).toMatchObject({ rows: [[2]] })
	})

	test('the dashboard owner can force a refresh past a fresh result', async () => {
		serve({ stored: { result: FRESH, computedAt: FRESH.computedAt } })
		runServerSql.mockResolvedValue({ columns: [{ name: 'x', type: 'INTEGER' }], rows: [{ x: 2 }] })
		expect((await run({ query: refresh })).body).toMatchObject({ rows: [[2]] })
		expect(runServerSql).toHaveBeenCalledWith(SQL_ITEM.query)
	})

	test('a subscribed viewer who does not own the dashboard cannot force a refresh', async () => {
		serve({ stored: { result: FRESH, computedAt: FRESH.computedAt } })
		expect((await run({ token: 'viewer-token', query: refresh })).status).toBe(403)
		expect(runServerSql).not.toHaveBeenCalled()
	})
})

describe('execution failures', () => {
	test('falls back to a stale stored result when execution fails', async () => {
		serve({ stored: { result: STALE, computedAt: STALE_AT } })
		runServerSql.mockRejectedValue(new Error('upstream exploded'))
		expect(await run()).toMatchObject({ status: 200, body: { rows: STALE.rows, error: 'Something went wrong' } })
	})

	test('returns 502 when execution fails with no stored fallback', async () => {
		serve({})
		runServerSql.mockRejectedValue(new Error('boom'))
		expect(await run()).toMatchObject({ status: 502, body: { error: 'Something went wrong' } })
	})

	test('returns 429 with Retry-After when the runner queue is full', async () => {
		serve({})
		runServerSql.mockRejectedValue(new SqlQueueFullError())
		const { status, res } = await run()
		expect(status).toBe(429)
		expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '5')
	})

	test('returns 400 for engine policy violations rather than serving a stale fallback', async () => {
		serve({ stored: { result: STALE, computedAt: STALE_AT } })
		runServerSql.mockRejectedValue(new SqlPolicyError('Only a single SELECT query is allowed.'))
		expect(await run()).toMatchObject({ status: 400, body: { error: 'Something went wrong' } })
	})

	test('concurrent requests for the same query share one execution', async () => {
		serve({})
		const run1 = Promise.withResolvers<unknown>()
		runServerSql.mockReturnValue(run1.promise)
		const pending = Promise.all([run(), run()])
		await vi.waitFor(() => expect(runServerSql).toHaveBeenCalled())
		run1.resolve({ columns: [{ name: 'x', type: 'INTEGER' }], rows: [{ x: 1 }] })
		const [a, b] = await pending
		expect(runServerSql).toHaveBeenCalledTimes(1)
		expect([a.status, b.status]).toEqual([200, 200])
		expect(b.body).toEqual(a.body)
	})
})

describe('execution access', () => {
	test('an anonymous visitor cannot execute a cache miss', async () => {
		serve({})
		expect(await run({ token: null })).toMatchObject({
			status: 401,
			body: { error: 'Authentication required to run SQL.' }
		})
		expect(runServerSql).not.toHaveBeenCalled()
	})

	test.each([{}, refresh])('a user without an API subscription cannot execute (%o)', async (query) => {
		serve({})
		const { status } = await run({
			token: 'free-token',
			query: { dashboardId: 'dash-1', itemId: 'widget-1', ...query }
		})
		expect(status).toBe(403)
		expect(runServerSql).not.toHaveBeenCalled()
	})

	test('a user without an API subscription reads a stale result without recomputing it', async () => {
		serve({ stored: { result: STALE, computedAt: STALE_AT } })
		expect(await run({ token: 'free-token' })).toMatchObject({
			status: 200,
			body: { computedAt: STALE_AT, error: 'An active API subscription is required to run SQL.' }
		})
		expect(runServerSql).not.toHaveBeenCalled()
	})
})
