import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import type { GetServerSidePropsContext, GetServerSidePropsResult } from 'next'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { DashboardItemConfig } from '~/containers/ProDashboard/dashboardItemConfig'

const { fetchDashboardConfigWithStatusMock, providerPropsMock, chartGridMock, itemRendererMock, itemsState } =
	vi.hoisted(() => ({
		fetchDashboardConfigWithStatusMock: vi.fn(),
		providerPropsMock: vi.fn(),
		chartGridMock: vi.fn(),
		itemRendererMock: vi.fn(),
		itemsState: { items: [] as Array<DashboardItemConfig> }
	}))

vi.mock('~/utils/telemetry', () => ({
	withServerSidePropsTelemetry: (_route: string, handler: unknown) => handler
}))

vi.mock('~/containers/ProDashboard/queries.server', () => ({
	fetchDashboardConfigWithStatus: fetchDashboardConfigWithStatusMock
}))

vi.mock('~/containers/ProDashboard/ProDashboardAPIContext', () => ({
	ProDashboardAPIProvider: ({ children, ...props }: { children: ReactNode }) => {
		providerPropsMock(props)
		return children
	},
	useProDashboardItemsState: () => ({ items: itemsState.items }),
	useProDashboardVariables: () => ({ resolvedItems: itemsState.items, unavailableByItemId: new Map() })
}))

vi.mock('~/containers/ProDashboard/components/ChartGrid', () => ({
	ChartGrid: (props: unknown) => {
		chartGridMock(props)
		return null
	},
	DashboardCardStreamScope: ({ children }: { children: ReactNode }) => children,
	DashboardItemRenderer: (props: unknown) => {
		itemRendererMock(props)
		return null
	}
}))

vi.mock('~/ui/Icon', () => ({ Icon: () => null }))
vi.mock('next/head', () => ({ default: () => null }))

import DashboardEmbedPage, { getServerSideProps } from '~/pages/pro/embed/[dashboardId]'

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
	const res = new ServerResponse(req)
	vi.spyOn(res, 'setHeader')
	return {
		params: { dashboardId },
		query,
		req,
		res,
		resolvedUrl: `/pro/embed/${dashboardId}`
	}
}

function readProps<Props extends object>(result: GetServerSidePropsResult<Props>): Props {
	if (!('props' in result)) throw new Error('Expected embed props')
	return result.props as Props
}

async function loadEmbedProps(dashboardId: string, query: GetServerSidePropsContext['query'] = {}) {
	const result = await getServerSideProps(createSsrContext(dashboardId, query))
	return readProps(result)
}

describe('pro dashboard embed page', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		itemsState.items = [chartItem]
		fetchDashboardConfigWithStatusMock.mockResolvedValue({ dashboard: publicDashboard, status: 200 })
	})

	test('serves public dashboards anonymously with a shared cache header and no Vary', async () => {
		const context = createSsrContext('dashboard-1', { item: 'chart-1', theme: 'light' }, 'owner-token')

		const result = await getServerSideProps(context)
		const props = readProps(result)

		expect(fetchDashboardConfigWithStatusMock).toHaveBeenCalledExactlyOnceWith('dashboard-1', null)
		expect(context.res.setHeader).toHaveBeenCalledWith('Cache-Control', EMBED_CACHE_CONTROL)
		expect(context.res.setHeader).not.toHaveBeenCalledWith('Vary', expect.anything())
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

	test('accepts both the slug and the id without redirecting', async () => {
		const results = await Promise.all(
			['dashboard-1', 'fees-dash'].map((key) => getServerSideProps(createSsrContext(key)))
		)
		for (const result of results) {
			expect(result).not.toHaveProperty('redirect')
			expect(result).not.toHaveProperty('notFound')
			expect(readProps(result).initialDashboard.slug).toBe('fees-dash')
		}
	})

	test('defaults to the dark theme and the whole dashboard', async () => {
		const props = await loadEmbedProps('fees-dash', { theme: 'neon' })
		expect(props.theme).toBe('dark')
		expect(props.itemId).toBeNull()
		const arrayQueryProps = await loadEmbedProps('fees-dash', { item: ['chart-1', 'chart-2'], theme: ['light'] })
		expect(arrayQueryProps.itemId).toBe('chart-1')
		expect(arrayQueryProps.theme).toBe('light')
	})

	test('returns notFound for private and missing dashboards without a public cache header', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValueOnce({
			dashboard: { ...publicDashboard, visibility: 'private' },
			status: 200
		})
		const privateContext = createSsrContext('dashboard-1')
		expect(await getServerSideProps(privateContext)).toEqual({ notFound: true })
		expect(privateContext.res.setHeader).not.toHaveBeenCalledWith('Cache-Control', EMBED_CACHE_CONTROL)

		fetchDashboardConfigWithStatusMock.mockResolvedValueOnce({ dashboard: null, status: 404 })
		expect(await getServerSideProps(createSsrContext('missing'))).toEqual({ notFound: true })
	})

	test('renders a single card in view mode with the stream scoped to that card', async () => {
		const props = await loadEmbedProps('fees-dash', { item: 'chart-1' })
		const markup = renderToStaticMarkup(createElement(DashboardEmbedPage, props))

		expect(providerPropsMock).toHaveBeenCalledWith(
			expect.objectContaining({ mode: 'view', initialDashboardId: 'fees-dash', streamItemId: 'chart-1' })
		)
		expect(itemRendererMock).toHaveBeenCalledWith(
			expect.objectContaining({ item: expect.objectContaining({ id: 'chart-1' }), isEditable: false })
		)
		expect(chartGridMock).not.toHaveBeenCalled()
		expect(markup).toContain('id="item-chart-1"')
		expect(markup).toContain('Open on DefiLlama')
		expect(markup).toContain('href="/pro/fees-dash"')
		expect(markup).toContain('target="_blank"')
		expect(markup).toContain('Public Fees Dashboard')
	})

	test('renders the whole dashboard grid when no card is requested', async () => {
		const props = await loadEmbedProps('fees-dash')
		renderToStaticMarkup(createElement(DashboardEmbedPage, props))

		expect(chartGridMock).toHaveBeenCalledWith(expect.objectContaining({ tabQueryParam: 'tab' }))
		expect(providerPropsMock).toHaveBeenCalledWith(expect.not.objectContaining({ streamItemId: expect.anything() }))
		expect(itemRendererMock).not.toHaveBeenCalled()
	})

	test('shows a not-found fallback linking to the dashboard for unknown cards', async () => {
		const props = await loadEmbedProps('fees-dash', { item: 'gone' })
		const markup = renderToStaticMarkup(createElement(DashboardEmbedPage, props))

		expect(markup).toContain('Card not found')
		expect(markup).toContain('href="/pro/fees-dash"')
		expect(itemRendererMock).not.toHaveBeenCalled()
	})
})
