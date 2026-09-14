import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Dashboard } from '~/containers/ProDashboard/dashboardTypes'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const {
	imageResponseMock,
	dashboardCardMock,
	staticCardMock,
	fetchDashboardConfigWithStatusMock,
	fetchProtocolsAndChainsMock,
	fetchAppMetadataMock,
	fetchSingleChartDataMock,
	withTimeoutMock
} = vi.hoisted(() => ({
	imageResponseMock: vi.fn(),
	dashboardCardMock: vi.fn(),
	staticCardMock: vi.fn(),
	fetchDashboardConfigWithStatusMock: vi.fn(),
	fetchProtocolsAndChainsMock: vi.fn(),
	fetchAppMetadataMock: vi.fn(),
	fetchSingleChartDataMock: vi.fn(),
	withTimeoutMock: vi.fn((promise: Promise<unknown>) => promise)
}))

vi.mock('next/og', () => ({
	ImageResponse: class {
		constructor(element: unknown, options: unknown) {
			imageResponseMock(element, options)
		}

		async arrayBuffer(): Promise<ArrayBuffer> {
			return new Uint8Array([137, 80, 78, 71]).buffer
		}
	}
}))

vi.mock('~/utils/telemetry', () => ({
	recordRouteRuntimeError: vi.fn()
}))

vi.mock('../../queries.server', () => ({
	fetchAppMetadata: fetchAppMetadataMock,
	fetchDashboardConfigWithStatus: fetchDashboardConfigWithStatusMock,
	fetchProtocolsAndChains: fetchProtocolsAndChainsMock,
	fetchSingleChartData: fetchSingleChartDataMock,
	withTimeout: withTimeoutMock
}))

vi.mock('./card', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./card')>()
	return {
		...actual,
		buildDashboardOgCard: (props: Parameters<typeof actual.buildDashboardOgCard>[0]) => {
			dashboardCardMock(props)
			return actual.buildDashboardOgCard(props)
		},
		buildStaticDashboardOgCard: (props: Parameters<typeof actual.buildStaticDashboardOgCard>[0]) => {
			staticCardMock(props)
			return actual.buildStaticDashboardOgCard(props)
		}
	}
})

import { dashboardOgImageHandler } from './route'

const OG_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400'
const DAY_IN_SECONDS = 86_400

function publicDashboard(id: string): Dashboard {
	return {
		id,
		slug: `${id}-slug`,
		data: {
			dashboardName: 'Yield Overview',
			items: [
				{
					id: 'chart-1',
					kind: 'chart',
					type: 'tvl',
					subjectType: 'protocol',
					protocol: 'aave'
				},
				{ id: 'text-1', kind: 'text', content: 'Notes' }
			]
		},
		visibility: 'public',
		author: { slug: 'llama', displayName: 'Llama Analyst' },
		created: '2026-01-01T00:00:00.000Z',
		updated: '2026-02-01T00:00:00.000Z',
		editedAt: '2026-02-02T00:00:00.000Z'
	} as Dashboard
}

function chartSeries(points: number): Array<[number, number]> {
	return Array.from({ length: points }, (_, index): [number, number] => [
		1_700_000_000 + index * DAY_IN_SECONDS,
		500 + index * 11
	])
}

async function callHandler(dashboardId: string, query: Record<string, string> = {}) {
	const req = createMockNextApiRequest({ query: { ...query, dashboardId } })
	const res = createMockNextApiResponse()
	await dashboardOgImageHandler(req, res)
	return res
}

describe('dashboard og image route', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		withTimeoutMock.mockImplementation((promise: Promise<unknown>) => promise)
		fetchProtocolsAndChainsMock.mockResolvedValue(null)
		fetchAppMetadataMock.mockResolvedValue(null)
		fetchSingleChartDataMock.mockResolvedValue(chartSeries(40))
	})

	test('renders a public dashboard as a cacheable png', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: publicDashboard('public-1'),
			status: 200
		})

		const res = await callHandler('public-1-slug')

		expect(res.statusCode).toBe(200)
		expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', OG_CACHE_CONTROL)
		expect(res.setHeader).not.toHaveBeenCalledWith('Vary', expect.anything())
		expect(res.send).toHaveBeenCalledWith(expect.any(Buffer))
		expect(imageResponseMock).toHaveBeenCalledWith(expect.anything(), {
			width: 1200,
			height: 630
		})
		expect(staticCardMock).not.toHaveBeenCalled()
		const [cardProps] = dashboardCardMock.mock.calls[0]
		expect(cardProps.title).toBe('Yield Overview')
		expect(cardProps.authorName).toBe('Llama Analyst')
		expect(cardProps.metaLine).toBe('2 cards · updated Feb 2, 2026')
		expect(cardProps.charts).toHaveLength(1)
		expect(cardProps.charts[0].imageDataUri).toMatch(/^data:image\/svg\+xml;base64,/)
	})

	test('renders the thumb variant at half size', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: publicDashboard('public-2'),
			status: 200
		})

		await callHandler('public-2-slug', { variant: 'thumb' })

		expect(imageResponseMock).toHaveBeenCalledWith(expect.anything(), {
			width: 600,
			height: 315
		})
	})

	test('serves the static card with status 200 for a non-public dashboard', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: null,
			status: 403
		})

		const res = await callHandler('private-1')

		expect(res.statusCode).toBe(200)
		expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', OG_CACHE_CONTROL)
		expect(staticCardMock).toHaveBeenCalledWith({ width: 1200, height: 630 })
		expect(dashboardCardMock).not.toHaveBeenCalled()
	})

	test('falls back to a card without charts when the data times out', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: publicDashboard('public-3'),
			status: 200
		})
		withTimeoutMock.mockImplementation(() => Promise.reject(new Error('timeout')))

		const res = await callHandler('public-3-slug')

		expect(res.statusCode).toBe(200)
		const [cardProps] = dashboardCardMock.mock.calls[0]
		expect(cardProps.charts).toEqual([])
		expect(cardProps.summaryLines).toEqual(['Aave Tvl chart', 'Text note: Notes'])
	})

	test('reuses the cached png while editedAt is unchanged', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: publicDashboard('public-4'),
			status: 200
		})

		await callHandler('public-4-slug')
		const res = await callHandler('public-4-slug')

		expect(imageResponseMock).toHaveBeenCalledTimes(1)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', OG_CACHE_CONTROL)
		expect(res.send).toHaveBeenCalledWith(expect.any(Buffer))
	})

	test('re-renders once editedAt changes', async () => {
		const dashboard = publicDashboard('public-5')
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard,
			status: 200
		})
		await callHandler('public-5-slug')

		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: { ...dashboard, editedAt: '2026-03-03T00:00:00.000Z' },
			status: 200
		})
		await callHandler('public-5-slug')

		expect(imageResponseMock).toHaveBeenCalledTimes(2)
	})
})
