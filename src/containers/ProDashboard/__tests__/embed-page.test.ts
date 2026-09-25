import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import type { GetServerSidePropsContext, GetServerSidePropsResult } from 'next'
import { describe, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import type { DashboardItemConfig } from '~/containers/ProDashboard/dashboardItemConfig'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'
import { getDashboardEmbedPageProps } from '../server/embedPageProps'

// Dashboard queries open a database client at import; embed props never query it.
vi.mock('~/server/db/llama', () => ({ llamaDb: {} }))
const http = installFixtureFetch()

const EMBED_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=60'

const chartItem: DashboardItemConfig = {
	id: 'chart-1',
	kind: 'chart',
	subjectType: 'protocol',
	protocol: 'aave',
	type: 'fees'
}

const publicDashboard = {
	id: 'dashboard-1',
	slug: 'fees-dash',
	user: 'user-1',
	visibility: 'public' as const,
	collectionId: 'dashboards',
	collectionName: 'dashboards',
	tags: ['fees'],
	description: 'Public dashboard description',
	created: '2026-01-01T00:00:00.000Z',
	updated: '2026-01-02T00:00:00.000Z',
	editedAt: '2026-01-03T00:00:00.000Z',
	data: { dashboardName: 'Public Fees Dashboard', items: [chartItem] }
}

function createSsrContext(
	dashboardId: string,
	query: GetServerSidePropsContext['query'] = {},
	authToken?: string
): GetServerSidePropsContext {
	const req = Object.assign(new IncomingMessage(new Socket()), {
		cookies: authToken ? { pb_auth_token: authToken } : {}
	})
	req.method = 'GET'
	return {
		params: { dashboardId },
		query,
		req,
		res: new ServerResponse(req),
		resolvedUrl: `/pro/embed/${dashboardId}`
	}
}

function readProps<Props extends object>(result: GetServerSidePropsResult<Props>): Props {
	if (!('props' in result)) throw new Error('Expected embed props')
	return result.props as Props
}

async function loadEmbedProps(dashboardId: string, query: GetServerSidePropsContext['query'] = {}) {
	const result = await getDashboardEmbedPageProps(createSsrContext(dashboardId, query))
	return readProps(result)
}

function servePublic(dashboard: unknown = publicDashboard) {
	http.serve({
		[`${FEATURES_SERVER}/dashboards/dashboard-1`]: dashboard,
		[`${FEATURES_SERVER}/dashboards/fees-dash`]: dashboard
	})
}

describe('pro dashboard embed props', () => {
	test('serves public dashboards anonymously with a shared cache header and no Vary', async () => {
		servePublic()
		const context = createSsrContext('dashboard-1', { item: 'chart-1', theme: 'light' }, 'owner-token')

		const result = await getDashboardEmbedPageProps(context)
		const props = readProps(result)

		// An owner cookie must not turn a shared embed response into a private read.
		expect(http.requests.map((request) => new Headers(request.init?.headers).get('Authorization'))).toEqual([null])
		expect(context.res.getHeader('Cache-Control')).toBe(EMBED_CACHE_CONTROL)
		expect(context.res.getHeader('Vary')).toBeUndefined()
		expect(props).toEqual({
			initialDashboard: expect.objectContaining({
				id: 'dashboard-1',
				slug: 'fees-dash',
				visibility: 'public',
				data: expect.objectContaining({ dashboardName: 'Public Fees Dashboard', items: [chartItem] })
			}),
			itemId: 'chart-1',
			theme: 'light'
		})
		expect(props.initialDashboard).not.toHaveProperty('user')
		expect(props.initialDashboard).not.toHaveProperty('collectionId')
	})

	test('defaults to the dark theme and the whole dashboard', async () => {
		servePublic()
		const props = await loadEmbedProps('fees-dash', { theme: 'neon' })
		expect(props.theme).toBe('dark')
		expect(props.itemId).toBeNull()
		const arrayQueryProps = await loadEmbedProps('fees-dash', { item: ['chart-1', 'chart-2'], theme: ['light'] })
		expect(arrayQueryProps.itemId).toBe('chart-1')
		expect(arrayQueryProps.theme).toBe('light')
	})

	test('returns notFound for private and missing dashboards without a public cache header', async () => {
		servePublic({ ...publicDashboard, visibility: 'private' })
		http.serve({ [`${FEATURES_SERVER}/dashboards/missing`]: fixtureStatus(404) })
		const privateContext = createSsrContext('dashboard-1')
		expect(await getDashboardEmbedPageProps(privateContext)).toEqual({ notFound: true })
		expect(privateContext.res.getHeader('Cache-Control')).toBeUndefined()

		expect(await getDashboardEmbedPageProps(createSsrContext('missing'))).toEqual({ notFound: true })
	})
})
