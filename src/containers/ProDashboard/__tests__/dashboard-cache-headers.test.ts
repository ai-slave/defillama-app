import type { GetServerSidePropsContext, NextApiRequest } from 'next'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const {
	fetchDashboardConfigMock,
	fetchDashboardConfigWithStatusMock,
	fetchProtocolsAndChainsMock,
	fetchAppMetadataMock,
	fetchSingleChartDataMock,
	fetchTableServerDataMock,
	fetchProtocolsTableMock,
	fetchAuthenticatedUserIdMock,
	providerPropsMock,
	proDashboardLoaderMock
} = vi.hoisted(() => ({
	fetchDashboardConfigMock: vi.fn(),
	fetchDashboardConfigWithStatusMock: vi.fn(),
	fetchProtocolsAndChainsMock: vi.fn(),
	fetchAppMetadataMock: vi.fn(),
	fetchSingleChartDataMock: vi.fn(),
	fetchTableServerDataMock: vi.fn(),
	fetchProtocolsTableMock: vi.fn(),
	fetchAuthenticatedUserIdMock: vi.fn(),
	providerPropsMock: vi.fn(),
	proDashboardLoaderMock: vi.fn()
}))

vi.mock('~/utils/telemetry', () => ({
	recordRouteRuntimeError: vi.fn(),
	withApiRouteTelemetry: (_route: string, handler: unknown) => handler,
	withServerSidePropsTelemetry: (_route: string, handler: unknown) => handler
}))

vi.mock('next/router', () => ({
	useRouter: () => ({ asPath: '/pro/dashboard-1', query: { dashboardId: 'dashboard-1' }, replace: vi.fn() })
}))

vi.mock('~/ui/Icon', () => ({
	Icon: () => null
}))

vi.mock('~/components/Link', () => ({
	BasicLink: () => null
}))

vi.mock('~/containers/ProDashboard/components/ProDashboardLoader', () => ({
	ProDashboardLoader: (props: unknown) => {
		proDashboardLoaderMock(props)
		return null
	}
}))

vi.mock('~/containers/ProDashboard/hooks/useDashboardEngagement', () => ({
	useDashboardEngagement: () => ({ trackView: vi.fn() })
}))

vi.mock('~/containers/ProDashboard/ProDashboardAPIContext', () => ({
	ProDashboardAPIProvider: ({ children, ...props }: { children: ReactNode }) => {
		providerPropsMock(props)
		return children
	},
	useProDashboardDashboard: () => ({
		isLoadingDashboard: false,
		dashboardVisibility: 'public',
		currentDashboard: null,
		dashboardName: 'Dashboard'
	}),
	useProDashboardServerAppMetadata: () => null
}))

vi.mock('~/containers/ProDashboard/AppMetadataContext', () => ({
	AppMetadataProvider: () => null
}))

vi.mock('~/containers/ProDashboard/server/auth', () => ({
	getAuthTokenFromRequest: (req: { cookies?: Record<string, string> }) => req.cookies?.pb_auth_token ?? null,
	fetchAuthenticatedUserId: fetchAuthenticatedUserIdMock
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		isAuthenticated: false,
		loaders: { userLoading: false },
		hasActiveSubscription: false
	})
}))

vi.mock('~/layout', () => ({
	__esModule: true,
	default: ({ children }: { children: ReactNode }) => children
}))

vi.mock('~/containers/ProDashboard/queries.server', () => ({
	extractChartItems: vi.fn(() => []),
	extractYieldsItems: vi.fn(() => []),
	fetchAppMetadata: fetchAppMetadataMock,
	fetchDashboardConfig: fetchDashboardConfigMock,
	fetchDashboardConfigWithStatus: fetchDashboardConfigWithStatusMock,
	fetchProtocolsAndChains: fetchProtocolsAndChainsMock,
	fetchSingleChartData: fetchSingleChartDataMock,
	withTimeout: (promise: Promise<unknown>) => promise
}))

vi.mock('~/containers/ProDashboard/server/tableQueries', () => ({
	fetchTableServerData: fetchTableServerDataMock
}))

vi.mock('~/containers/ProDashboard/services/ProtocolCharts', () => ({
	__esModule: true,
	default: {}
}))

const protocolChartBuilderDataMock = vi.hoisted(() => ({
	getProtocolChainData: vi.fn(),
	getProtocolBreakdownData: vi.fn()
}))

vi.mock('~/containers/ProDashboard/services/ProtocolChartBuilderData', () => ({
	__esModule: true,
	default: protocolChartBuilderDataMock
}))

vi.mock('~/containers/ProtocolOverview/api', () => ({
	fetchProtocolBySlug: vi.fn()
}))

vi.mock('~/containers/Stablecoins/api', () => ({
	fetchStablecoinAssetsApi: vi.fn(),
	fetchStablecoinChartApi: vi.fn(),
	fetchStablecoinPricesApi: vi.fn(),
	fetchStablecoinRatesApi: vi.fn()
}))

vi.mock('~/containers/Stablecoins/utils', () => ({
	formatPeggedAssetsData: vi.fn()
}))

vi.mock('~/containers/Unlocks/queries', () => ({
	getProtocolEmissionsPieData: vi.fn(),
	getProtocolEmissionsScheduleData: vi.fn()
}))

vi.mock('~/containers/ProDashboard/server/unifiedTable/protocols', () => ({
	fetchProtocolsTable: fetchProtocolsTableMock
}))

vi.mock('~/utils/http-client', () => ({
	fetchWithPoolingOnServer: vi.fn()
}))

import dashboardStreamHandler from '~/pages/api/dynamic/pro-dashboard/[dashboardId]/stream'
import DashboardPage, { getServerSideProps } from '~/pages/pro/[dashboardId]'
import { getServerSideProps as getEditServerSideProps } from '~/pages/pro/[dashboardId]/edit'

const PUBLIC_DASHBOARD_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=60'
const PRIVATE_DASHBOARD_CACHE_CONTROL = 'private, no-cache, no-store, must-revalidate'

function createSsrContext(dashboardId: string, authToken?: string): GetServerSidePropsContext {
	return {
		params: { dashboardId },
		query: {},
		req: { method: 'GET', cookies: authToken ? { pb_auth_token: authToken } : {} },
		res: { setHeader: vi.fn(), statusCode: 200 },
		resolvedUrl: `/pro/${dashboardId}`
	} as unknown as GetServerSidePropsContext
}

function createStreamRequest(dashboardId: string, authToken?: string): NextApiRequest {
	return {
		method: 'GET',
		query: { dashboardId },
		cookies: authToken ? { pb_auth_token: authToken } : {},
		url: `/api/dynamic/pro-dashboard/${dashboardId}/stream`
	} as unknown as NextApiRequest
}

describe('pro dashboard cache headers', () => {
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
			items: [
				{
					id: 'chart-1',
					kind: 'chart',
					chain: 'Ethereum',
					protocol: 'aave',
					type: 'fees'
				}
			]
		}
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '1200')
		fetchDashboardConfigMock.mockResolvedValue(publicDashboard)
		fetchDashboardConfigWithStatusMock.mockResolvedValue({ dashboard: publicDashboard, status: 200 })
		fetchProtocolsAndChainsMock.mockResolvedValue({ protocols: [], chains: [] })
		fetchAppMetadataMock.mockResolvedValue({})
		fetchSingleChartDataMock.mockResolvedValue([[1_700_000_000, 1]])
		fetchTableServerDataMock.mockResolvedValue(null)
		fetchProtocolsTableMock.mockResolvedValue({ rows: [] })
		fetchAuthenticatedUserIdMock.mockResolvedValue('user-1')
	})

	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it('keeps the public dashboard page cache header unjittered', async () => {
		const context = createSsrContext('dashboard-1')

		const result = await getServerSideProps(context)

		expect(context.res.setHeader).toHaveBeenCalledWith('Cache-Control', PUBLIC_DASHBOARD_CACHE_CONTROL)
		expect(fetchDashboardConfigWithStatusMock).toHaveBeenCalledWith('dashboard-1', null)
		expect(result).toEqual({
			props: expect.objectContaining({
				dashboardId: 'dashboard-1',
				initialDashboard: expect.objectContaining({
					id: 'dashboard-1',
					visibility: 'public',
					tags: ['fees', 'ethereum'],
					data: expect.objectContaining({
						dashboardName: 'Public Fees Dashboard',
						items: publicDashboard.data.items
					}),
					viewCount: 7,
					likeCount: 2
				}),
				noIndex: false,
				status: 200,
				seo: expect.objectContaining({
					title: 'Public Fees Dashboard - DefiLlama Pro Dashboard',
					description: 'Public dashboard description',
					canonicalPath: '/pro/dashboard-1'
				})
			})
		})
		expect((result as any).props.initialDashboard).not.toHaveProperty('user')
		expect((result as any).props.initialDashboard).not.toHaveProperty('collectionId')
		expect((result as any).props.initialDashboard).not.toHaveProperty('collectionName')
		expect((result as any).props.initialDashboard).not.toHaveProperty('aiGenerated')
		expect((result as any).props.initialDashboard).not.toHaveProperty('metrics')
		expect(fetchProtocolsAndChainsMock).not.toHaveBeenCalled()
		expect(fetchSingleChartDataMock).not.toHaveBeenCalled()
		expect(fetchTableServerDataMock).not.toHaveBeenCalled()
	})

	it('seeds the provider from public config without rendering the config loader', async () => {
		const result = await getServerSideProps(createSsrContext('dashboard-1'))
		if (!('props' in result)) throw new Error('Expected dashboard props')

		renderToStaticMarkup(createElement(DashboardPage, result.props as any))

		expect(providerPropsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				initialDashboardId: 'dashboard-1',
				initialDashboard: expect.objectContaining({
					id: 'dashboard-1',
					user: '',
					data: expect.objectContaining({ items: publicDashboard.data.items })
				})
			})
		)
		expect(proDashboardLoaderMock).not.toHaveBeenCalled()
	})

	it('seeds authenticated edit config only for the verified owner', async () => {
		const context = createSsrContext('dashboard-1', 'auth-token')

		const result = await getEditServerSideProps(context)

		expect(context.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(fetchAuthenticatedUserIdMock).toHaveBeenCalledWith('auth-token')
		expect(result).toEqual({
			props: expect.objectContaining({
				dashboardId: 'dashboard-1',
				initialDashboard: expect.objectContaining({
					id: 'dashboard-1',
					ownerId: 'user-1',
					data: expect.objectContaining({ items: publicDashboard.data.items })
				})
			})
		})
		expect((result as any).props.initialDashboard).not.toHaveProperty('aiGenerated')
		expect((result as any).props.initialDashboard.data).not.toHaveProperty('aiUndoState')
	})

	it('does not seed edit config for a non-owner', async () => {
		fetchAuthenticatedUserIdMock.mockResolvedValue('other-user')

		const result = await getEditServerSideProps(createSsrContext('dashboard-1', 'auth-token'))

		expect(result).toEqual({ props: { dashboardId: 'dashboard-1', initialDashboard: null } })
	})

	it('redirects anonymous id requests to the canonical slug url', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: { ...publicDashboard, slug: 'public-fees-dashboard' },
			status: 200
		})
		const context = createSsrContext('dashboard-1')

		const result = await getServerSideProps(context)

		expect(result).toEqual({
			redirect: {
				destination: '/pro/public-fees-dashboard',
				permanent: true
			}
		})
	})

	it('redirects anonymous old-slug requests to the canonical slug url', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: { ...publicDashboard, slug: 'public-fees-dashboard' },
			status: 200
		})
		const context = createSsrContext('old-fees-dashboard')

		const result = await getServerSideProps(context)

		expect(result).toEqual({
			redirect: {
				destination: '/pro/public-fees-dashboard',
				permanent: true
			}
		})
	})

	it('redirects authenticated public dashboard ids with private cache headers', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: { ...publicDashboard, slug: 'public-fees-dashboard' },
			status: 200
		})
		const context = createSsrContext('dashboard-1', 'auth-token')

		const result = await getServerSideProps(context)

		expect(context.res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(result).toEqual({
			redirect: {
				destination: '/pro/public-fees-dashboard',
				permanent: true
			}
		})
	})

	it('renders canonical slug requests with a slug-based canonical path', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: { ...publicDashboard, slug: 'public-fees-dashboard' },
			status: 200
		})
		const context = createSsrContext('public-fees-dashboard')

		const result = await getServerSideProps(context)

		expect(context.res.setHeader).toHaveBeenCalledWith('Cache-Control', PUBLIC_DASHBOARD_CACHE_CONTROL)
		expect(result).toEqual({
			props: expect.objectContaining({
				dashboardId: 'public-fees-dashboard',
				initialDashboard: expect.objectContaining({
					id: 'dashboard-1',
					slug: 'public-fees-dashboard'
				}),
				noIndex: false,
				seo: expect.objectContaining({
					canonicalPath: '/pro/public-fees-dashboard'
				})
			})
		})
	})

	it('hydrates authenticated public dashboard pages with private cache headers', async () => {
		const context = createSsrContext('dashboard-1', 'auth-token')

		const result = await getServerSideProps(context)

		expect(context.res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(context.res.setHeader).toHaveBeenCalledWith('Vary', 'Cookie, Authorization')
		expect(fetchDashboardConfigWithStatusMock).toHaveBeenCalledWith('dashboard-1', 'auth-token')
		expect(result).toEqual({
			props: expect.objectContaining({
				dashboardId: 'dashboard-1',
				initialDashboard: expect.objectContaining({
					id: 'dashboard-1',
					visibility: 'public',
					data: expect.objectContaining({ items: publicDashboard.data.items })
				}),
				noIndex: false,
				status: 200
			})
		})
		expect((result as any).props.initialDashboard).not.toHaveProperty('user')
		expect((result as any).props.initialDashboard).not.toHaveProperty('aiGenerated')
	})

	it('seeds authenticated private dashboard pages from the token-authorized config read', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: { ...publicDashboard, visibility: 'private' },
			status: 200
		})
		const context = createSsrContext('dashboard-1', 'auth-token')

		const result = await getServerSideProps(context)

		expect(context.res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(fetchDashboardConfigWithStatusMock).toHaveBeenCalledTimes(1)
		expect(fetchDashboardConfigWithStatusMock).toHaveBeenCalledWith('dashboard-1', 'auth-token')
		expect(result).toEqual({
			props: {
				dashboardId: 'dashboard-1',
				initialDashboard: expect.objectContaining({
					id: 'dashboard-1',
					ownerId: 'user-1',
					visibility: 'private',
					data: expect.objectContaining({ items: publicDashboard.data.items })
				}),
				seo: null,
				noIndex: true,
				status: 200
			}
		})
		expect((result as any).props.initialDashboard).not.toHaveProperty('user')
		expect((result as any).props.initialDashboard).not.toHaveProperty('aiGenerated')
		expect((result as any).props.initialDashboard).not.toHaveProperty('metrics')
	})

	it('keeps authenticated dashboard pages unseeded when the config read fails', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({ dashboard: null, status: 401 })
		const context = createSsrContext('private-dashboard', 'auth-token')

		const result = await getServerSideProps(context)

		expect(context.res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(context.res.setHeader).toHaveBeenCalledWith('Vary', 'Cookie, Authorization')
		expect(fetchDashboardConfigWithStatusMock).toHaveBeenNthCalledWith(1, 'private-dashboard', 'auth-token')
		expect(fetchDashboardConfigWithStatusMock).toHaveBeenNthCalledWith(2, 'private-dashboard', null)
		expect(result).toEqual({
			props: {
				dashboardId: 'private-dashboard',
				initialDashboard: null,
				seo: null,
				noIndex: true,
				status: 200
			}
		})
	})

	it('uses private no-store cache headers for unauthenticated private-dashboard pages', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({ dashboard: null, status: 401 })
		const context = createSsrContext('private-dashboard')

		const result = await getServerSideProps(context)

		expect(context.res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(context.res.statusCode).toBe(401)
		expect(fetchDashboardConfigWithStatusMock).toHaveBeenCalledWith('private-dashboard', null)
		expect(result).toEqual({
			props: expect.objectContaining({
				dashboardId: 'private-dashboard',
				initialDashboard: null,
				noIndex: true,
				status: 401
			})
		})
	})

	it('uses 404 and noindex props for missing dashboard pages', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({ dashboard: null, status: 404 })
		const context = createSsrContext('missing')

		const result = await getServerSideProps(context)

		expect(context.res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(context.res.statusCode).toBe(404)
		expect(result).toEqual({
			props: expect.objectContaining({
				dashboardId: 'missing',
				initialDashboard: null,
				noIndex: true,
				status: 404
			})
		})
	})

	it('keeps the public dashboard stream cache header unjittered', async () => {
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/x-ndjson')
		expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', PUBLIC_DASHBOARD_CACHE_CONTROL)
		expect(fetchDashboardConfigMock).toHaveBeenCalledWith('dashboard-1', null)
		expect(res.end).toHaveBeenCalled()
	})

	it('starts chart fetches and ends the stream without waiting for app metadata', async () => {
		let resolveAppMetadata: (value: null) => void = () => {}
		fetchAppMetadataMock.mockReturnValue(
			new Promise<null>((resolve) => {
				resolveAppMetadata = resolve
			})
		)
		const res = createMockNextApiResponse()

		const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
		await vi.waitFor(() => expect(fetchSingleChartDataMock).toHaveBeenCalled())
		await streamPromise

		expect(res.end).toHaveBeenCalled()
		resolveAppMetadata(null)
	})

	it('settles the initial dashboard item window before starting deferred chart sources', async () => {
		fetchDashboardConfigMock.mockResolvedValue({
			...publicDashboard,
			data: {
				...publicDashboard.data,
				items: Array.from({ length: 9 }, (_, index) => ({
					id: `chart-${index}`,
					kind: 'chart',
					protocol: `protocol-${index}`,
					type: 'fees'
				}))
			}
		})
		const pendingResolutions: Array<(data: [number, number][]) => void> = []
		fetchSingleChartDataMock.mockImplementation(
			() =>
				new Promise<[number, number][]>((resolve) => {
					pendingResolutions.push(resolve)
				})
		)
		const res = createMockNextApiResponse()

		const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
		await vi.waitFor(() => expect(fetchSingleChartDataMock).toHaveBeenCalledTimes(8))
		expect(pendingResolutions).toHaveLength(8)

		for (const resolve of pendingResolutions.slice(0, 8)) resolve([[1_700_000_000, 1]])
		await vi.waitFor(() => expect(fetchSingleChartDataMock).toHaveBeenCalledTimes(9))
		pendingResolutions[8]([[1_700_000_000, 2]])
		await streamPromise

		expect(res.end).toHaveBeenCalled()
	})

	it('does not refetch a shared chart source across stream stages', async () => {
		fetchDashboardConfigMock.mockResolvedValue({
			...publicDashboard,
			data: {
				...publicDashboard.data,
				items: Array.from({ length: 9 }, (_, index) => ({
					id: `chart-${index}`,
					kind: 'chart',
					protocol: 'aave',
					type: 'fees'
				}))
			}
		})
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(fetchSingleChartDataMock).toHaveBeenCalledOnce()
		expect(res.end).toHaveBeenCalled()
	})

	it('shares table and unified-table source claims across stream stages', async () => {
		const claimedTableSources: boolean[] = []
		let tableSourceFetches = 0
		fetchTableServerDataMock.mockImplementation(
			async (_items: unknown, claimSource: (kind: string, key: readonly unknown[]) => boolean) => {
				const claimed = claimSource('test-table-source', ['shared'])
				claimedTableSources.push(claimed)
				if (claimed) tableSourceFetches += 1
				return null
			}
		)
		fetchDashboardConfigMock.mockResolvedValue({
			...publicDashboard,
			data: {
				...publicDashboard.data,
				items: Array.from({ length: 9 }, (_, index) => ({
					id: `table-${index}`,
					kind: 'unified-table',
					rowHeaders: ['protocol'],
					params: { chains: ['Ethereum'] }
				}))
			}
		})
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(claimedTableSources).toEqual([true, false])
		expect(tableSourceFetches).toBe(1)
		expect(fetchProtocolsTableMock).toHaveBeenCalledOnce()
		expect(res.end).toHaveBeenCalled()
	})

	it('does not seed chart-builder data for stream-skipped metrics', async () => {
		fetchDashboardConfigMock.mockResolvedValue({
			...publicDashboard,
			data: {
				...publicDashboard.data,
				items: [
					{
						id: 'builder-1',
						kind: 'builder',
						config: {
							mode: 'chains',
							metric: 'tvl',
							protocol: null,
							chains: [],
							limit: 10,
							categories: [],
							chainCategories: [],
							protocolCategories: [],
							hideOthers: false,
							groupByParent: false,
							filterMode: 'include'
						}
					}
				]
			}
		})
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		const chunks = res.write.mock.calls.map((call) => String(call[0]))
		expect(chunks.some((chunk) => chunk.includes('"type":"chartBuilderData"'))).toBe(false)
		expect(protocolChartBuilderDataMock.getProtocolBreakdownData).not.toHaveBeenCalled()
		expect(res.end).toHaveBeenCalled()
	})

	it('streams chart-builder data for metrics the stream owns', async () => {
		protocolChartBuilderDataMock.getProtocolBreakdownData.mockResolvedValue({
			series: [{ name: 'Aave', data: [[1_700_000_000, 5]] }]
		})
		fetchDashboardConfigMock.mockResolvedValue({
			...publicDashboard,
			data: {
				...publicDashboard.data,
				items: [
					{
						id: 'builder-2',
						kind: 'builder',
						config: {
							mode: 'chains',
							metric: 'fees',
							protocol: null,
							chains: [],
							limit: 10,
							categories: [],
							chainCategories: [],
							protocolCategories: [],
							hideOthers: false,
							groupByParent: false,
							filterMode: 'include'
						}
					}
				]
			}
		})
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		const chunks = res.write.mock.calls.map((call) => String(call[0]))
		expect(chunks.some((chunk) => chunk.includes('"type":"chartBuilderData"') && chunk.includes('Aave'))).toBe(true)
		expect(res.end).toHaveBeenCalled()
	})

	it('uses private no-store cache headers for authenticated dashboard streams', async () => {
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1', 'auth-token'), res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(fetchDashboardConfigMock).toHaveBeenCalledWith('dashboard-1', 'auth-token')
		expect(res.end).toHaveBeenCalled()
	})

	it('uses private no-store cache headers for unauthenticated private-dashboard streams', async () => {
		fetchDashboardConfigMock.mockResolvedValue({ visibility: 'private', data: { items: [] } })
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('private-dashboard'), res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(fetchDashboardConfigMock).toHaveBeenCalledWith('private-dashboard', null)
		expect(res.end).toHaveBeenCalled()
	})

	it('uses private no-store cache headers when dashboard is not found', async () => {
		fetchDashboardConfigMock.mockResolvedValue(null)
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('missing'), res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(res.end).toHaveBeenCalled()
	})
})
