import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import type { GetServerSidePropsContext } from 'next'
import { describe, expect, test, vi } from 'vitest'
import { FEATURES_SERVER, POCKETBASE_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'
import { getDashboardPageProps } from '../server/dashboardPageProps'

// Dashboard queries open a database client at import; page props never query it.
vi.mock('~/server/db/llama', () => ({ llamaDb: {} }))
// Authorized reads go through the pooled server client; route them to the same fetch fixtures.
vi.mock('~/utils/http-client', () => ({
	fetchWithPoolingOnServer: (url: string, init?: RequestInit) => fetch(url, init)
}))
const http = installFixtureFetch()

const PUBLIC_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=60'
const PRIVATE_CACHE_CONTROL = 'private, no-cache, no-store, must-revalidate'

const publicDashboard = {
	id: 'dashboard-1',
	user: 'user-1',
	visibility: 'public',
	collectionId: 'dashboards',
	collectionName: 'dashboards',
	aiGenerated: {
		'session-1': {
			mode: 'create',
			prompt: 'private prompt',
			rated: false,
			timestamp: '2026-01-02T00:00:00.000Z',
			userId: 'user-1'
		}
	},
	metrics: { internal: true },
	tags: ['fees', 'ethereum'],
	description: 'Public dashboard description',
	created: '2026-01-01T00:00:00.000Z',
	updated: '2026-01-02T00:00:00.000Z',
	editedAt: '2026-01-03T00:00:00.000Z',
	viewCount: 7,
	likeCount: 2,
	data: {
		dashboardName: 'Public Fees Dashboard',
		items: [{ id: 'chart-1', kind: 'chart', subjectType: 'protocol', protocol: 'aave', type: 'fees' }]
	}
}
const items = publicDashboard.data.items
const slugged = { ...publicDashboard, slug: 'public-fees-dashboard' }

function context(
	dashboardId: string,
	{ token, mode, search = '' }: { token?: string; mode?: Array<string>; search?: string } = {}
): GetServerSidePropsContext {
	const req = Object.assign(new IncomingMessage(new Socket()), { cookies: token ? { pb_auth_token: token } : {} })
	req.method = 'GET'
	return {
		params: { dashboardId, ...(mode ? { mode } : {}) },
		query: {},
		req,
		res: new ServerResponse(req),
		resolvedUrl: `/pro/${dashboardId}${mode ? `/${mode.join('/')}` : ''}${search}`
	}
}

/** Serves a dashboard read, optionally answering token-authorized and anonymous reads differently. */
function serveDashboard(key: string, anonymous: unknown, authorized: unknown = anonymous) {
	http.serve({
		[`${FEATURES_SERVER}/dashboards/${key}`]: (_url: URL, init?: RequestInit) => {
			const body = new Headers(init?.headers).get('Authorization') ? authorized : anonymous
			return typeof body === 'function' ? body() : body
		}
	})
}

function serveSignedInUser(id: string) {
	http.serve({ [`${POCKETBASE_URL}/api/collections/users/auth-refresh`]: { record: { id } } })
}

/** Dashboard reads in order, with whether each carried the session token. */
function dashboardReads() {
	return http.requests
		.filter((request) => request.url.pathname.startsWith('/dashboards/'))
		.map(
			(request) => `${request.url.pathname} ${new Headers(request.init?.headers).get('Authorization') ?? 'anonymous'}`
		)
}

const edit = { token: 'auth-token', mode: ['edit'] }

describe('public dashboard view', () => {
	test('an anonymous read is edge-cacheable and ships public fields only', async () => {
		serveDashboard('dashboard-1', publicDashboard)
		const ctx = context('dashboard-1')

		const result = await getDashboardPageProps(ctx)

		expect(ctx.res.getHeader('Cache-Control')).toBe(PUBLIC_CACHE_CONTROL)
		expect(dashboardReads()).toEqual(['/dashboards/dashboard-1 anonymous'])
		expect(result).toEqual({
			props: {
				dashboardId: 'dashboard-1',
				mode: 'view',
				initialDashboard: {
					id: 'dashboard-1',
					visibility: 'public',
					tags: ['fees', 'ethereum'],
					description: 'Public dashboard description',
					created: '2026-01-01T00:00:00.000Z',
					updated: '2026-01-02T00:00:00.000Z',
					editedAt: '2026-01-03T00:00:00.000Z',
					viewCount: 7,
					likeCount: 2,
					data: expect.objectContaining({ dashboardName: 'Public Fees Dashboard', items })
				},
				seo: expect.objectContaining({
					title: 'Public Fees Dashboard - DefiLlama Pro Dashboard',
					description: 'Public dashboard description',
					canonicalPath: '/pro/dashboard-1'
				}),
				ogImage: 'https://defillama.com/api/og/pro/dashboard-1',
				noIndex: false,
				status: 200
			}
		})
	})

	test('a canonical slug request keys the canonical path and og image by slug', async () => {
		serveDashboard('public-fees-dashboard', slugged)
		const ctx = context('public-fees-dashboard')

		const result = await getDashboardPageProps(ctx)

		expect(ctx.res.getHeader('Cache-Control')).toBe(PUBLIC_CACHE_CONTROL)
		expect(result).toEqual({
			props: expect.objectContaining({
				dashboardId: 'public-fees-dashboard',
				initialDashboard: expect.objectContaining({ id: 'dashboard-1', slug: 'public-fees-dashboard' }),
				seo: expect.objectContaining({ canonicalPath: '/pro/public-fees-dashboard' }),
				ogImage: 'https://defillama.com/api/og/pro/public-fees-dashboard',
				noIndex: false
			})
		})
	})

	test.each([
		['an id', 'dashboard-1', ''],
		['an old slug', 'old-fees-dashboard', ''],
		['an id with a tab and parameters', 'dashboard-1', '?tab=tab-1&var-chain=Base']
	])('%s redirects permanently to the canonical slug', async (_, key, search) => {
		serveDashboard(key, slugged)

		expect(await getDashboardPageProps(context(key, { search }))).toEqual({
			redirect: { destination: `/pro/public-fees-dashboard${search}`, permanent: true }
		})
	})

	test('a signed-in read of a public dashboard is private and varies on the session', async () => {
		serveDashboard('dashboard-1', publicDashboard)
		const ctx = context('dashboard-1', { token: 'auth-token' })

		const result = await getDashboardPageProps(ctx)

		expect(ctx.res.getHeader('Cache-Control')).toBe(PRIVATE_CACHE_CONTROL)
		expect(ctx.res.getHeader('Vary')).toBe('Cookie, Authorization')
		expect(dashboardReads()).toEqual(['/dashboards/dashboard-1 Bearer auth-token'])
		expect(result).toEqual({ props: expect.objectContaining({ noIndex: false, status: 200 }) })
		const props = 'props' in result ? await result.props : null
		expect(props?.initialDashboard).not.toHaveProperty('user')
		expect(props?.initialDashboard).not.toHaveProperty('aiGenerated')
	})

	test('a signed-in redirect to the canonical slug keeps private cache headers', async () => {
		serveDashboard('dashboard-1', slugged)
		const ctx = context('dashboard-1', { token: 'auth-token' })

		expect(await getDashboardPageProps(ctx)).toEqual({
			redirect: { destination: '/pro/public-fees-dashboard', permanent: true }
		})
		expect(ctx.res.getHeader('Cache-Control')).toBe(PRIVATE_CACHE_CONTROL)
	})
})

describe('private and missing dashboard view', () => {
	test('a signed-in owner is seeded from the token-authorized read without private fields', async () => {
		serveDashboard('dashboard-1', fixtureStatus(401), { ...publicDashboard, visibility: 'private' })
		const ctx = context('dashboard-1', { token: 'auth-token' })

		const result = await getDashboardPageProps(ctx)

		expect(ctx.res.getHeader('Cache-Control')).toBe(PRIVATE_CACHE_CONTROL)
		expect(dashboardReads()).toEqual(['/dashboards/dashboard-1 Bearer auth-token'])
		expect(result).toEqual({
			props: {
				dashboardId: 'dashboard-1',
				mode: 'view',
				initialDashboard: expect.objectContaining({
					id: 'dashboard-1',
					ownerId: 'user-1',
					visibility: 'private',
					data: expect.objectContaining({ items })
				}),
				seo: null,
				ogImage: null,
				noIndex: true,
				status: 200
			}
		})
		const props = 'props' in result ? await result.props : null
		expect(props?.initialDashboard).not.toHaveProperty('user')
		expect(props?.initialDashboard).not.toHaveProperty('aiGenerated')
		expect(props?.initialDashboard).not.toHaveProperty('metrics')
	})

	test('a failed signed-in read retries anonymously and stays unseeded', async () => {
		serveDashboard('private-dashboard', fixtureStatus(401))
		const ctx = context('private-dashboard', { token: 'auth-token' })

		const result = await getDashboardPageProps(ctx)

		expect(ctx.res.getHeader('Cache-Control')).toBe(PRIVATE_CACHE_CONTROL)
		expect(ctx.res.getHeader('Vary')).toBe('Cookie, Authorization')
		expect(dashboardReads()).toEqual([
			'/dashboards/private-dashboard Bearer auth-token',
			'/dashboards/private-dashboard anonymous'
		])
		expect(result).toEqual({
			props: {
				dashboardId: 'private-dashboard',
				mode: 'view',
				initialDashboard: null,
				seo: null,
				ogImage: null,
				noIndex: true,
				status: 200
			}
		})
	})

	test.each([
		[401, 401],
		[404, 404],
		[503, 500]
	])('an anonymous read answered %i responds %i with private no-store props', async (upstream, status) => {
		serveDashboard('dashboard-1', fixtureStatus(upstream))
		const ctx = context('dashboard-1')

		const result = await getDashboardPageProps(ctx)

		expect(ctx.res.getHeader('Cache-Control')).toBe(PRIVATE_CACHE_CONTROL)
		expect(ctx.res.statusCode).toBe(status)
		expect(result).toEqual({
			props: {
				dashboardId: 'dashboard-1',
				mode: 'view',
				initialDashboard: null,
				seo: null,
				ogImage: null,
				noIndex: true,
				status
			}
		})
	})
})

describe('dashboard editor route', () => {
	test('an unknown mode segment is a 404 without reading the dashboard', async () => {
		expect(await getDashboardPageProps(context('dashboard-1', { token: 'auth-token', mode: ['anything'] }))).toEqual({
			notFound: true
		})
		expect(http.requests).toHaveLength(0)
	})

	test('an edit request without a session answers 401 without reading the dashboard', async () => {
		const ctx = context('dashboard-1', { mode: ['edit'] })

		const result = await getDashboardPageProps(ctx)

		expect(ctx.res.getHeader('Cache-Control')).toBe('private, no-store')
		expect(ctx.res.statusCode).toBe(401)
		expect(http.requests).toHaveLength(0)
		expect(result).toEqual({
			props: {
				dashboardId: 'dashboard-1',
				mode: 'edit',
				initialDashboard: null,
				seo: null,
				ogImage: null,
				noIndex: true,
				status: 401
			}
		})
	})

	test('an edit request for a dashboard the session cannot read is a 404', async () => {
		serveDashboard('dashboard-1', fixtureStatus(404))
		serveSignedInUser('user-1')

		expect(await getDashboardPageProps(context('dashboard-1', edit))).toEqual({ notFound: true })
	})

	test.each(['', '?tab=tab-1'])('an edit request %j redirects to the canonical slug editor', async (search) => {
		serveDashboard('dashboard-1', slugged)
		serveSignedInUser('user-1')

		expect(await getDashboardPageProps(context('dashboard-1', { ...edit, search }))).toEqual({
			redirect: { destination: `/pro/public-fees-dashboard/edit${search}`, permanent: true }
		})
	})

	test('the verified owner is seeded without AI session or undo state', async () => {
		serveDashboard('dashboard-1', {
			...publicDashboard,
			data: { ...publicDashboard.data, aiUndoState: { items: [], timestamp: '', sessionId: 'session-1' } }
		})
		serveSignedInUser('user-1')
		const ctx = context('dashboard-1', edit)

		const result = await getDashboardPageProps(ctx)

		expect(ctx.res.getHeader('Cache-Control')).toBe('private, no-store')
		expect(result).toEqual({
			props: expect.objectContaining({
				dashboardId: 'dashboard-1',
				mode: 'edit',
				initialDashboard: expect.objectContaining({ id: 'dashboard-1', ownerId: 'user-1' })
			})
		})
		const props = 'props' in result ? await result.props : null
		expect(props?.initialDashboard).not.toHaveProperty('aiGenerated')
		expect(props?.initialDashboard?.data).toEqual({ dashboardName: 'Public Fees Dashboard', items })
	})

	test('a signed-in non-owner gets the editor shell without the dashboard', async () => {
		serveDashboard('dashboard-1', publicDashboard)
		serveSignedInUser('other-user')

		expect(await getDashboardPageProps(context('dashboard-1', edit))).toEqual({
			props: {
				dashboardId: 'dashboard-1',
				mode: 'edit',
				initialDashboard: null,
				seo: null,
				ogImage: null,
				noIndex: true,
				status: 200
			}
		})
	})
})
