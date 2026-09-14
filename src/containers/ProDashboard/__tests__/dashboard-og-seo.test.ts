import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import type { GetServerSidePropsContext, GetServerSidePropsResult } from 'next'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Dashboard } from '~/containers/ProDashboard/dashboardTypes'

const { fetchDashboardConfigWithStatusMock } = vi.hoisted(() => ({
	fetchDashboardConfigWithStatusMock: vi.fn()
}))

vi.mock('~/utils/telemetry', () => ({
	recordRuntimeError: vi.fn(),
	recordRouteRuntimeError: vi.fn(),
	withApiRouteTelemetry: (_route: string, handler: unknown) => handler,
	withServerSidePropsTelemetry: (_route: string, handler: unknown) => handler
}))

vi.mock('~/containers/ProDashboard/queries.server', () => ({
	fetchDashboardConfigWithStatus: fetchDashboardConfigWithStatusMock
}))

vi.mock('~/containers/ProDashboard/server/auth', () => ({
	getAuthTokenFromRequest: (req: { cookies?: Record<string, string> }) => req.cookies?.pb_auth_token ?? null
}))

vi.mock('~/containers/ProDashboard', () => ({
	__esModule: true,
	default: () => null
}))

vi.mock('~/layout', () => ({ __esModule: true, default: () => null }))

vi.mock('~/ui/Icon', () => ({ Icon: () => null }))

vi.mock('~/components/Link', () => ({ BasicLink: () => null }))

vi.mock('~/containers/ProDashboard/components/ProDashboardLoader', () => ({
	ProDashboardLoader: () => null
}))

vi.mock('~/containers/ProDashboard/components/DashboardSeoSummary', () => ({
	DashboardSeoSummary: () => null
}))

vi.mock('~/containers/ProDashboard/hooks/useDashboardEngagement', () => ({
	useDashboardEngagement: () => ({ trackView: vi.fn() })
}))

vi.mock('~/containers/ProDashboard/ProDashboardAPIContext', () => ({
	ProDashboardAPIProvider: () => null,
	useProDashboardDashboard: () => ({
		isLoadingDashboard: false,
		currentDashboard: null
	})
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		isAuthenticated: false,
		loaders: { userLoading: false },
		hasActiveSubscription: false
	})
}))

vi.mock('next/router', () => ({
	useRouter: () => ({ asPath: '/pro/dash-1', query: {}, replace: vi.fn() })
}))

import { getServerSideProps } from '~/pages/pro/[dashboardId]/[[...mode]]'

function createSsrContext(dashboardId: string, authToken?: string): GetServerSidePropsContext {
	const req = Object.assign(new IncomingMessage(new Socket()), {
		cookies: authToken ? { pb_auth_token: authToken } : {}
	})
	req.method = 'GET'
	const res = new ServerResponse(req)
	vi.spyOn(res, 'setHeader')
	return {
		params: { dashboardId },
		query: {},
		req,
		res,
		resolvedUrl: `/pro/${dashboardId}`
	}
}

async function readServerSideProps<Props extends object>(result: GetServerSidePropsResult<Props>): Promise<Props> {
	if (!('props' in result)) throw new Error('Expected dashboard props')
	return result.props as Props
}

function dashboardFixture(overrides: Partial<Dashboard> = {}): Dashboard {
	return {
		id: 'dash-1',
		slug: 'yield-overview',
		data: { dashboardName: 'Yield Overview', items: [] },
		visibility: 'public',
		created: '2026-01-01T00:00:00.000Z',
		updated: '2026-02-01T00:00:00.000Z',
		...overrides
	} as Dashboard
}

describe('dashboard og image seo props', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test('public dashboards get an absolute og image url keyed by slug', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: dashboardFixture(),
			status: 200
		})

		const props = await readServerSideProps(await getServerSideProps(createSsrContext('yield-overview')))

		expect(props.ogImage).toBe('https://defillama.com/api/og/pro/yield-overview')
	})

	test('public dashboards without a slug fall back to the id', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: dashboardFixture({ slug: undefined }),
			status: 200
		})

		const props = await readServerSideProps(await getServerSideProps(createSsrContext('dash-1')))

		expect(props.ogImage).toBe('https://defillama.com/api/og/pro/dash-1')
	})

	test('non-public dashboards get no og image', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: null,
			status: 404
		})

		const props = await readServerSideProps(await getServerSideProps(createSsrContext('dash-1')))

		expect(props.ogImage).toBe(null)
		expect(props.noIndex).toBe(true)
	})
})
