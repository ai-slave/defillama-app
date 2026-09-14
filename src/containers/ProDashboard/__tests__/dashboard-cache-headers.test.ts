import { EventEmitter } from 'node:events'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import type { GetServerSidePropsContext, GetServerSidePropsResult, NextApiRequest } from 'next'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { getProDashboardChartSourceQueryKey } from '~/containers/ProDashboard/chartSource'
import {
	INITIAL_DASHBOARD_STREAM_ITEM_COUNT,
	type DashboardStreamChunk
} from '~/containers/ProDashboard/dashboardStreamContract'
import type { DashboardVariable } from '~/containers/ProDashboard/dashboardTypes'
import { createVariableCatalog, resolveDashboardItems } from '~/containers/ProDashboard/dashboardVariables/resolve'
import type { ChartConfig } from '~/containers/ProDashboard/types'
import { recordRouteRuntimeError, recordRuntimeError } from '~/utils/telemetry'
import { createMockNextApiResponse, type MockNextApiResponse } from '~/utils/test/nextApiMocks'

async function readServerSideProps<Props extends object>(result: GetServerSidePropsResult<Props>): Promise<Props> {
	if (!('props' in result)) throw new Error('Expected dashboard props')
	return result.props
}

const catalogProtocol = (protocolSlug: string) => ({
	id: protocolSlug,
	name: protocolSlug,
	slug: protocolSlug,
	symbol: protocolSlug.toUpperCase(),
	tvl: 1,
	oracles: [],
	chains: [],
	geckoId: null
})

const {
	fetchDashboardConfigMock,
	fetchDashboardConfigWithStatusMock,
	fetchProtocolsMock,
	fetchOracleMetricsMock,
	fetchProtocolsAndChainsMock,
	fetchAppMetadataMock,
	fetchSingleChartDataMock,
	withTimeoutMock,
	streamProTokenUsageDataMock,
	fetchChartBuilderServerDataMock,
	fetchProtocolsTableMock,
	fetchAuthenticatedUserIdMock,
	providerPropsMock,
	proDashboardLoaderMock
} = vi.hoisted(() => ({
	fetchDashboardConfigMock: vi.fn(),
	fetchDashboardConfigWithStatusMock: vi.fn(),
	fetchProtocolsMock: vi.fn(),
	fetchOracleMetricsMock: vi.fn(),
	fetchProtocolsAndChainsMock: vi.fn(),
	fetchAppMetadataMock: vi.fn(),
	fetchSingleChartDataMock: vi.fn(),
	withTimeoutMock: vi.fn((promise: Promise<unknown>, _ms?: number) => promise),
	streamProTokenUsageDataMock: vi.fn(),
	fetchChartBuilderServerDataMock: vi.fn(),
	fetchProtocolsTableMock: vi.fn(),
	fetchAuthenticatedUserIdMock: vi.fn(),
	providerPropsMock: vi.fn(),
	proDashboardLoaderMock: vi.fn()
}))

const routerQueryMock = vi.hoisted(
	() => ({ dashboardId: 'dashboard-1' }) as { dashboardId: string; mode?: Array<string> }
)

vi.mock('~/utils/telemetry', () => ({
	recordRuntimeError: vi.fn(),
	recordRouteRuntimeError: vi.fn(),
	withApiRouteTelemetry: (_route: string, handler: unknown) => handler,
	withServerSidePropsTelemetry: (_route: string, handler: unknown) => handler
}))

vi.mock('next/router', () => ({
	default: { replace: vi.fn() },
	useRouter: () => ({
		asPath: '/pro/dashboard-1',
		query: routerQueryMock,
		replace: vi.fn()
	})
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
	})
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
	fetchAppMetadata: fetchAppMetadataMock,
	fetchDashboardConfig: fetchDashboardConfigMock,
	fetchDashboardConfigWithStatus: fetchDashboardConfigWithStatusMock,
	fetchProtocolsAndChains: fetchProtocolsAndChainsMock,
	fetchSingleChartData: fetchSingleChartDataMock,
	withTimeout: withTimeoutMock
}))

vi.mock('~/containers/ProDashboard/server/tableQueries', () => ({
	streamProTokenUsageData: streamProTokenUsageDataMock
}))

vi.mock('~/containers/ProtocolLists/api', () => ({
	fetchProtocols: fetchProtocolsMock
}))

vi.mock('~/containers/Oracles/api', () => ({
	fetchOracleMetrics: fetchOracleMetricsMock
}))

vi.mock('~/containers/ProDashboard/services/ProtocolCharts', () => ({
	fetchProProtocolChartData: vi.fn()
}))

vi.mock('~/containers/ProDashboard/server/chartBuilder/data', () => ({
	fetchChartBuilderServerData: fetchChartBuilderServerDataMock
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

import {
	DASHBOARD_CONFIG_STREAM_TIMEOUT_MS,
	DASHBOARD_STREAM_CLASSIC_SOURCE_LIMIT,
	DASHBOARD_STREAM_SOURCE_CONCURRENCY
} from '~/containers/ProDashboard/server/stream'
import dashboardStreamHandler from '~/pages/api/dynamic/pro-dashboard/[dashboardId]/stream'
import DashboardPage, { getServerSideProps } from '~/pages/pro/[dashboardId]/[[...mode]]'

const PUBLIC_DASHBOARD_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=60'
const PRIVATE_DASHBOARD_CACHE_CONTROL = 'private, no-cache, no-store, must-revalidate'

function createSsrContext(
	dashboardId: string,
	authToken?: string,
	mode?: Array<string>,
	search = ''
): GetServerSidePropsContext {
	const req = Object.assign(new IncomingMessage(new Socket()), {
		cookies: authToken ? { pb_auth_token: authToken } : {}
	})
	req.method = 'GET'
	const res = new ServerResponse(req)
	vi.spyOn(res, 'setHeader')
	return {
		params: { dashboardId, ...(mode ? { mode } : {}) },
		query: {},
		req,
		res,
		resolvedUrl: `/pro/${dashboardId}${mode ? `/${mode.join('/')}` : ''}${search}`
	}
}

function createEditSsrContext(dashboardId: string, authToken?: string, search = ''): GetServerSidePropsContext {
	return createSsrContext(dashboardId, authToken, ['edit'], search)
}

function createStreamRequest(
	dashboardId: string,
	authToken?: string,
	query: Record<string, string> = {}
): NextApiRequest {
	const req = Object.assign(new IncomingMessage(new Socket()), {
		query: { ...query, dashboardId },
		cookies: authToken ? { pb_auth_token: authToken } : {},
		body: null,
		env: {}
	})
	req.method = 'GET'
	req.url = `/api/dynamic/pro-dashboard/${dashboardId}/stream`
	return req
}

function streamChunks(res: MockNextApiResponse): Array<DashboardStreamChunk> {
	return res.write.mock.calls.map((call) => JSON.parse(String(call[0])) as DashboardStreamChunk)
}

function readyItemIds(chunks: ReadonlyArray<DashboardStreamChunk>): Array<string> {
	return chunks.flatMap((chunk) => (chunk.type === 'itemReady' ? chunk.itemIds : []))
}

function readyIndex(chunks: ReadonlyArray<DashboardStreamChunk>, itemId: string): number {
	return chunks.findIndex((chunk) => chunk.type === 'itemReady' && chunk.itemIds.includes(itemId))
}

function chunkIndex(chunks: ReadonlyArray<DashboardStreamChunk>, type: DashboardStreamChunk['type']): number {
	return chunks.findIndex((chunk) => chunk.type === type)
}

const catalogChain = (name: string) => ({
	name,
	gecko_id: null,
	tvl: 1,
	tokenSymbol: null,
	chainId: null,
	cmcId: null
})

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
					subjectType: 'protocol',
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
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: publicDashboard,
			status: 200
		})
		fetchProtocolsMock.mockResolvedValue({
			protocols: [],
			chains: [],
			parentProtocols: []
		})
		fetchOracleMetricsMock.mockResolvedValue({
			oracles: {},
			chainsByOracle: {},
			oraclesTVS: {}
		})
		fetchProtocolsAndChainsMock.mockResolvedValue({
			protocols: [catalogProtocol('aave')],
			chains: []
		})
		fetchAppMetadataMock.mockResolvedValue({})
		fetchSingleChartDataMock.mockResolvedValue([[1_700_000_000, 1]])
		streamProTokenUsageDataMock.mockResolvedValue(undefined)
		fetchChartBuilderServerDataMock.mockResolvedValue({ series: [] })
		fetchProtocolsTableMock.mockResolvedValue({ rows: [], parentMetrics: {} })
		fetchAuthenticatedUserIdMock.mockResolvedValue('user-1')
	})

	afterEach(() => {
		vi.unstubAllEnvs()
	})

	test('keeps the public dashboard page cache header unjittered', async () => {
		const context = createSsrContext('dashboard-1')

		const result = await getServerSideProps(context)
		const props = await readServerSideProps(result)

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
		expect(props.initialDashboard).not.toHaveProperty('user')
		expect(props.initialDashboard).not.toHaveProperty('collectionId')
		expect(props.initialDashboard).not.toHaveProperty('collectionName')
		expect(props.initialDashboard).not.toHaveProperty('aiGenerated')
		expect(props.initialDashboard).not.toHaveProperty('metrics')
		expect(fetchProtocolsAndChainsMock).not.toHaveBeenCalled()
		expect(fetchSingleChartDataMock).not.toHaveBeenCalled()
		expect(streamProTokenUsageDataMock).not.toHaveBeenCalled()
	})

	test('seeds the provider from public config without rendering the config loader', async () => {
		const result = await getServerSideProps(createSsrContext('dashboard-1'))
		const props = await readServerSideProps(result)

		renderToStaticMarkup(createElement(DashboardPage, props))

		expect(providerPropsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				initialDashboardId: 'dashboard-1',
				mode: 'view',
				initialDashboard: expect.objectContaining({
					id: 'dashboard-1',
					user: '',
					data: expect.objectContaining({ items: publicDashboard.data.items })
				})
			})
		)
		expect(proDashboardLoaderMock).not.toHaveBeenCalled()
	})

	test('seeds the provider in edit mode from the route segment', async () => {
		const result = await getServerSideProps(createEditSsrContext('dashboard-1', 'auth-token'))
		const props = await readServerSideProps(result)
		routerQueryMock.mode = ['edit']

		try {
			renderToStaticMarkup(createElement(DashboardPage, props))
		} finally {
			delete routerQueryMock.mode
		}

		expect(providerPropsMock).toHaveBeenCalledWith(
			expect.objectContaining({ initialDashboardId: 'dashboard-1', mode: 'edit' })
		)
	})

	test('answers unknown mode segments with a 404', async () => {
		const result = await getServerSideProps(createSsrContext('dashboard-1', 'auth-token', ['anything']))

		expect(result).toEqual({ notFound: true })
		expect(fetchDashboardConfigMock).not.toHaveBeenCalled()
		expect(fetchDashboardConfigWithStatusMock).not.toHaveBeenCalled()
	})

	test('refuses edit requests without an auth token', async () => {
		const context = createEditSsrContext('dashboard-1')

		const result = await getServerSideProps(context)

		expect(context.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(context.res.statusCode).toBe(401)
		expect(fetchDashboardConfigMock).not.toHaveBeenCalled()
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

	test('redirects edit requests to the canonical slug url', async () => {
		fetchDashboardConfigMock.mockResolvedValue({ ...publicDashboard, slug: 'public-fees-dashboard' })

		const result = await getServerSideProps(createEditSsrContext('dashboard-1', 'auth-token'))

		expect(result).toEqual({
			redirect: { destination: '/pro/public-fees-dashboard/edit', permanent: true }
		})
	})

	test('keeps the requested tab and parameters when redirecting to the canonical slug', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: { ...publicDashboard, slug: 'public-fees-dashboard' },
			status: 200
		})

		const result = await getServerSideProps(
			createSsrContext('dashboard-1', undefined, undefined, '?tab=tab-1&var-chain=Base')
		)

		expect(result).toEqual({
			redirect: {
				destination: '/pro/public-fees-dashboard?tab=tab-1&var-chain=Base',
				permanent: true
			}
		})
	})

	test('keeps the query string when redirecting an edit request to the canonical slug', async () => {
		fetchDashboardConfigMock.mockResolvedValue({ ...publicDashboard, slug: 'public-fees-dashboard' })

		const result = await getServerSideProps(createEditSsrContext('dashboard-1', 'auth-token', '?tab=tab-1'))

		expect(result).toEqual({
			redirect: { destination: '/pro/public-fees-dashboard/edit?tab=tab-1', permanent: true }
		})
	})

	test('seeds authenticated edit config only for the verified owner', async () => {
		const context = createEditSsrContext('dashboard-1', 'auth-token')

		const result = await getServerSideProps(context)
		const props = await readServerSideProps(result)

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
		expect(props.initialDashboard).not.toHaveProperty('aiGenerated')
		expect(props.initialDashboard?.data).not.toHaveProperty('aiUndoState')
	})

	test('does not seed edit config for a non-owner', async () => {
		fetchAuthenticatedUserIdMock.mockResolvedValue('other-user')

		const result = await getServerSideProps(createEditSsrContext('dashboard-1', 'auth-token'))

		expect(result).toEqual({
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

	test('redirects anonymous id requests to the canonical slug url', async () => {
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

	test('redirects anonymous old-slug requests to the canonical slug url', async () => {
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

	test('redirects authenticated public dashboard ids with private cache headers', async () => {
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

	test('renders canonical slug requests with a slug-based canonical path', async () => {
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

	test('hydrates authenticated public dashboard pages with private cache headers', async () => {
		const context = createSsrContext('dashboard-1', 'auth-token')

		const result = await getServerSideProps(context)
		const props = await readServerSideProps(result)

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
		expect(props.initialDashboard).not.toHaveProperty('user')
		expect(props.initialDashboard).not.toHaveProperty('aiGenerated')
	})

	test('seeds authenticated private dashboard pages from the token-authorized config read', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: { ...publicDashboard, visibility: 'private' },
			status: 200
		})
		const context = createSsrContext('dashboard-1', 'auth-token')

		const result = await getServerSideProps(context)
		const props = await readServerSideProps(result)

		expect(context.res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(fetchDashboardConfigWithStatusMock).toHaveBeenCalledTimes(1)
		expect(fetchDashboardConfigWithStatusMock).toHaveBeenCalledWith('dashboard-1', 'auth-token')
		expect(result).toEqual({
			props: {
				dashboardId: 'dashboard-1',
				mode: 'view',
				initialDashboard: expect.objectContaining({
					id: 'dashboard-1',
					ownerId: 'user-1',
					visibility: 'private',
					data: expect.objectContaining({ items: publicDashboard.data.items })
				}),
				seo: null,
				ogImage: null,
				noIndex: true,
				status: 200
			}
		})
		expect(props.initialDashboard).not.toHaveProperty('user')
		expect(props.initialDashboard).not.toHaveProperty('aiGenerated')
		expect(props.initialDashboard).not.toHaveProperty('metrics')
	})

	test('keeps authenticated dashboard pages unseeded when the config read fails', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: null,
			status: 401
		})
		const context = createSsrContext('private-dashboard', 'auth-token')

		const result = await getServerSideProps(context)

		expect(context.res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(context.res.setHeader).toHaveBeenCalledWith('Vary', 'Cookie, Authorization')
		expect(fetchDashboardConfigWithStatusMock).toHaveBeenNthCalledWith(1, 'private-dashboard', 'auth-token')
		expect(fetchDashboardConfigWithStatusMock).toHaveBeenNthCalledWith(2, 'private-dashboard', null)
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

	test('uses private no-store cache headers for unauthenticated private-dashboard pages', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: null,
			status: 401
		})
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

	test('uses 404 and noindex props for missing dashboard pages', async () => {
		fetchDashboardConfigWithStatusMock.mockResolvedValue({
			dashboard: null,
			status: 404
		})
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

	test('keeps the public dashboard stream cache header unjittered', async () => {
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/x-ndjson')
		expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', PUBLIC_DASHBOARD_CACHE_CONTROL)
		expect(fetchDashboardConfigMock).toHaveBeenCalledWith('dashboard-1', null)
		const dashboardLine = JSON.parse(String(res.write.mock.calls[0]?.[0]))
		expect(dashboardLine.data).not.toHaveProperty('user')
		expect(dashboardLine.data).not.toHaveProperty('aiGenerated')
		expect(dashboardLine.data).not.toHaveProperty('collectionId')
		expect(dashboardLine.data).not.toHaveProperty('collectionName')
		expect(res.end).toHaveBeenCalled()
	})

	test('waits for response backpressure to clear before ending the stream', async () => {
		const events = new EventEmitter()
		const res = createMockNextApiResponse()
		Object.assign(res, {
			once: events.once.bind(events),
			off: events.off.bind(events)
		})
		res.write.mockReturnValueOnce(false)

		const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
		await vi.waitFor(() => expect(res.write).toHaveBeenCalledOnce())
		expect(res.end).not.toHaveBeenCalled()

		events.emit('drain')
		await streamPromise

		expect(res.write.mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
		expect(res.end).toHaveBeenCalledOnce()
	})

	test('finishes the stream when the shared protocols request fails', async () => {
		fetchProtocolsMock.mockRejectedValue(new Error('protocols unavailable'))
		fetchProtocolsAndChainsMock.mockImplementation(
			async (_sourcePromise: undefined, protocolsPromise: Promise<unknown>) => {
				await protocolsPromise
				return null
			}
		)
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(recordRuntimeError).toHaveBeenCalledWith(
			expect.any(Error),
			'outboundFetch',
			expect.objectContaining({ stream_source: 'protocols-and-chains' })
		)
		expect(fetchProtocolsMock).toHaveBeenCalledOnce()
		expect(res.write).toHaveBeenCalledWith('{"type":"done"}\n')
		expect(res.end).toHaveBeenCalled()
	})

	test('waits for app metadata before planning chart sources', async () => {
		let resolveAppMetadata: (value: null) => void = () => {}
		fetchAppMetadataMock.mockReturnValue(
			new Promise<null>((resolve) => {
				resolveAppMetadata = resolve
			})
		)
		const res = createMockNextApiResponse()

		const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
		await vi.waitFor(() => expect(fetchProtocolsAndChainsMock).toHaveBeenCalled())
		expect(fetchSingleChartDataMock).not.toHaveBeenCalled()
		resolveAppMetadata(null)
		await streamPromise

		expect(fetchSingleChartDataMock).toHaveBeenCalled()
		expect(res.end).toHaveBeenCalled()
	})

	test('does not fetch catalog, oracle, or chart metadata for a table without those columns', async () => {
		fetchDashboardConfigMock.mockResolvedValue({
			...publicDashboard,
			data: {
				...publicDashboard.data,
				items: [
					{
						id: 'table-1',
						kind: 'unified-table',
						configVersion: 3,
						strategy: 'protocols',
						rowHeaders: ['protocol']
					}
				]
			}
		})
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(fetchAppMetadataMock).not.toHaveBeenCalled()
		expect(fetchProtocolsMock).not.toHaveBeenCalled()
		expect(fetchProtocolsAndChainsMock).not.toHaveBeenCalled()
		expect(fetchOracleMetricsMock).not.toHaveBeenCalled()
		expect(fetchProtocolsTableMock).toHaveBeenCalledOnce()
		expect(res.end).toHaveBeenCalledOnce()
	})

	test('fetches oracle membership without starting the protocol catalog for an oracle table', async () => {
		fetchDashboardConfigMock.mockResolvedValue({
			...publicDashboard,
			data: {
				...publicDashboard.data,
				items: [
					{
						id: 'oracle-table',
						kind: 'unified-table',
						configVersion: 3,
						strategy: 'protocols',
						rowHeaders: ['protocol'],
						filters: { oracles: ['Chainlink'] }
					}
				]
			}
		})
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(fetchAppMetadataMock).not.toHaveBeenCalled()
		expect(fetchProtocolsMock).not.toHaveBeenCalled()
		expect(fetchProtocolsAndChainsMock).not.toHaveBeenCalled()
		expect(fetchOracleMetricsMock).toHaveBeenCalledOnce()
		expect(fetchProtocolsTableMock).toHaveBeenCalledWith(
			expect.objectContaining({ needsOracleMembership: true }),
			expect.objectContaining({ oracleMetricsPromise: expect.any(Promise) })
		)
		expect(res.end).toHaveBeenCalledOnce()
	})

	test('leaves catalog and chart sources beyond the initial stream window to client fallback', async () => {
		fetchDashboardConfigMock.mockResolvedValue({
			...publicDashboard,
			data: {
				...publicDashboard.data,
				items: [
					...Array.from({ length: INITIAL_DASHBOARD_STREAM_ITEM_COUNT }, (_, index) => ({
						id: `tvl-table-${index}`,
						kind: 'unified-table' as const,
						configVersion: 3 as const,
						strategy: 'protocols' as const,
						rowHeaders: ['protocol' as const],
						columnOrder: ['name', 'tvl'],
						columnVisibility: { name: true, tvl: true }
					})),
					{
						id: 'chart-9',
						kind: 'chart',
						subjectType: 'protocol',
						protocol: 'aave',
						type: 'fees'
					}
				]
			}
		})
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(fetchAppMetadataMock).not.toHaveBeenCalled()
		expect(fetchProtocolsMock).not.toHaveBeenCalled()
		expect(fetchProtocolsAndChainsMock).not.toHaveBeenCalled()
		expect(fetchSingleChartDataMock).not.toHaveBeenCalled()
		expect(res.write.mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('bounds source work even when one dashboard item expands into many requests', async () => {
		const chartCount = DASHBOARD_STREAM_SOURCE_CONCURRENCY + 4
		fetchProtocolsAndChainsMock.mockResolvedValue({
			protocols: Array.from({ length: chartCount }, (_, index) => catalogProtocol(`protocol-${index}`)),
			chains: []
		})
		fetchDashboardConfigMock.mockResolvedValue({
			...publicDashboard,
			data: {
				...publicDashboard.data,
				items: [
					{
						id: 'multi-chart',
						kind: 'multi',
						items: Array.from({ length: chartCount }, (_, index) => ({
							id: `chart-${index}`,
							kind: 'chart',
							subjectType: 'protocol',
							protocol: `protocol-${index}`,
							type: 'fees'
						}))
					}
				]
			}
		})
		let activeRequestCount = 0
		let maximumActiveRequestCount = 0
		const pendingResolutions: Array<(data: Array<[number, number]>) => void> = []
		fetchSingleChartDataMock.mockImplementation(
			() =>
				new Promise<Array<[number, number]>>((resolve) => {
					activeRequestCount += 1
					maximumActiveRequestCount = Math.max(maximumActiveRequestCount, activeRequestCount)
					pendingResolutions.push((data) => {
						activeRequestCount -= 1
						resolve(data)
					})
				})
		)
		const res = createMockNextApiResponse()

		const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
		await vi.waitFor(() => expect(fetchSingleChartDataMock).toHaveBeenCalledTimes(DASHBOARD_STREAM_SOURCE_CONCURRENCY))
		for (let startedCount = DASHBOARD_STREAM_SOURCE_CONCURRENCY + 1; startedCount <= chartCount; startedCount++) {
			const resolve = pendingResolutions.shift()
			if (!resolve) throw new Error('Expected an active chart request')
			resolve([[1_700_000_000, startedCount]])
			await vi.waitFor(() => expect(fetchSingleChartDataMock).toHaveBeenCalledTimes(startedCount))
		}
		for (const resolve of pendingResolutions) resolve([[1_700_000_000, 1]])
		await streamPromise

		expect(maximumActiveRequestCount).toBe(DASHBOARD_STREAM_SOURCE_CONCURRENCY)
		expect(res.write.mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
		expect(res.end).toHaveBeenCalledOnce()
	})

	test('caps expanded classic sources while preserving the first multi-chart', async () => {
		const multiCount = INITIAL_DASHBOARD_STREAM_ITEM_COUNT
		const chartCount = DASHBOARD_STREAM_CLASSIC_SOURCE_LIMIT
		fetchProtocolsAndChainsMock.mockResolvedValue({
			protocols: Array.from({ length: multiCount * chartCount }, (_protocol, index) =>
				catalogProtocol(`protocol-${index}`)
			),
			chains: []
		})
		fetchDashboardConfigMock.mockResolvedValue({
			...publicDashboard,
			data: {
				...publicDashboard.data,
				items: Array.from({ length: multiCount }, (_multi, multiIndex) => ({
					id: `multi-${multiIndex}`,
					kind: 'multi' as const,
					items: Array.from({ length: chartCount }, (_chart, chartIndex) => ({
						id: `chart-${multiIndex}-${chartIndex}`,
						kind: 'chart' as const,
						subjectType: 'protocol' as const,
						protocol: `protocol-${multiIndex * chartCount + chartIndex}`,
						type: 'fees' as const
					}))
				}))
			}
		})
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(fetchSingleChartDataMock).toHaveBeenCalledTimes(DASHBOARD_STREAM_CLASSIC_SOURCE_LIMIT)
		expect(fetchSingleChartDataMock.mock.calls.map(([request]) => request.protocol)).toEqual(
			Array.from({ length: chartCount }, (_, index) => `protocol-${index}`)
		)
		expect(res.write.mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('emits done after the initial window without fetching the offscreen remainder', async () => {
		fetchProtocolsAndChainsMock.mockResolvedValue({
			protocols: Array.from({ length: INITIAL_DASHBOARD_STREAM_ITEM_COUNT + 1 }, (_, index) =>
				catalogProtocol(`protocol-${index}`)
			),
			chains: []
		})
		fetchDashboardConfigMock.mockResolvedValue({
			...publicDashboard,
			data: {
				...publicDashboard.data,
				items: Array.from({ length: INITIAL_DASHBOARD_STREAM_ITEM_COUNT + 1 }, (_, index) => ({
					id: `chart-${index}`,
					kind: 'chart',
					subjectType: 'protocol',
					protocol: `protocol-${index}`,
					type: 'fees'
				}))
			}
		})
		const pendingResolutions: Array<(data: Array<[number, number]>) => void> = []
		fetchSingleChartDataMock.mockImplementation(
			() =>
				new Promise<Array<[number, number]>>((resolve) => {
					pendingResolutions.push(resolve)
				})
		)
		const res = createMockNextApiResponse()

		const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
		await vi.waitFor(() => expect(fetchSingleChartDataMock).toHaveBeenCalledTimes(INITIAL_DASHBOARD_STREAM_ITEM_COUNT))
		expect(res.write).not.toHaveBeenCalledWith('{"type":"done"}\n')
		for (const resolve of pendingResolutions) resolve([[1_700_000_000, 1]])
		await streamPromise

		expect(fetchSingleChartDataMock).toHaveBeenCalledTimes(INITIAL_DASHBOARD_STREAM_ITEM_COUNT)
		expect(res.write.mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
		expect(res.end).toHaveBeenCalledOnce()
	})

	test('does not let an offscreen table expand the initial table request', async () => {
		fetchDashboardConfigMock.mockResolvedValue({
			...publicDashboard,
			data: {
				...publicDashboard.data,
				items: [
					...Array.from({ length: INITIAL_DASHBOARD_STREAM_ITEM_COUNT }, (_, index) => ({
						id: `tvl-table-${index}`,
						kind: 'unified-table' as const,
						configVersion: 3 as const,
						strategy: 'protocols' as const,
						rowHeaders: ['protocol' as const],
						columnOrder: ['name', 'tvl'],
						columnVisibility: { name: true, tvl: true }
					})),
					{
						id: 'deferred-fees-table',
						kind: 'unified-table',
						configVersion: 3,
						strategy: 'protocols',
						rowHeaders: ['protocol'],
						columnOrder: ['name', 'fees24h'],
						columnVisibility: { name: true, fees24h: true }
					}
				]
			}
		})
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(fetchProtocolsTableMock).toHaveBeenCalledOnce()
		expect(fetchProtocolsTableMock.mock.calls[0]?.[0]).toMatchObject({
			baseMetricFamilies: ['tvl']
		})
	})

	test('does not seed chart-builder data for stream-skipped metrics', async () => {
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
							chainFilterMode: 'include',
							categoryFilterMode: 'include',
							chainCategoryFilterMode: 'include',
							protocolCategoryFilterMode: 'include'
						}
					}
				]
			}
		})
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		const chunks = res.write.mock.calls.map((call) => String(call[0]))
		expect(chunks.some((chunk) => chunk.includes('"type":"chartBuilderData"'))).toBe(false)
		expect(fetchChartBuilderServerDataMock).not.toHaveBeenCalled()
		expect(res.end).toHaveBeenCalled()
	})

	test('records failed chart-builder sources without failing the stream', async () => {
		fetchChartBuilderServerDataMock.mockRejectedValue(new Error('builder unavailable'))
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
							chains: [],
							limit: 10,
							categories: [],
							chainCategories: [],
							protocolCategories: [],
							hideOthers: false,
							groupBy: 'protocol',
							chartType: 'stackedBar',
							displayAs: 'timeSeries',
							chainFilterMode: 'include',
							categoryFilterMode: 'include',
							chainCategoryFilterMode: 'include',
							protocolCategoryFilterMode: 'include'
						}
					}
				]
			}
		})
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(recordRuntimeError).toHaveBeenCalledWith(
			expect.any(Error),
			'outboundFetch',
			expect.objectContaining({ stream_source: 'chart-builder' })
		)
		expect(recordRouteRuntimeError).not.toHaveBeenCalled()
		expect(res.write).toHaveBeenCalledWith('{"type":"done"}\n')
	})
	test('streams chart-builder data for metrics the stream owns', async () => {
		fetchChartBuilderServerDataMock.mockResolvedValue({
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
							chains: [],
							limit: 10,
							categories: [],
							chainCategories: [],
							protocolCategories: [],
							hideOthers: false,
							groupBy: 'protocol',
							chartType: 'stackedBar',
							displayAs: 'timeSeries',
							chainFilterMode: 'include',
							categoryFilterMode: 'include',
							chainCategoryFilterMode: 'include',
							protocolCategoryFilterMode: 'include'
						}
					}
				]
			}
		})
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		const chunks = res.write.mock.calls.map((call) => String(call[0]))
		expect(chunks.some((chunk) => chunk.includes('"type":"chartBuilderData"') && chunk.includes('Aave'))).toBe(true)
		expect(withTimeoutMock).toHaveBeenCalledWith(expect.any(Promise), 25_000)
		expect(res.end).toHaveBeenCalled()
	})

	test('uses private no-store cache headers for authenticated dashboard streams', async () => {
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1', 'auth-token'), res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(fetchDashboardConfigMock).toHaveBeenCalledWith('dashboard-1', 'auth-token')
		expect(res.end).toHaveBeenCalled()
	})

	test('uses private no-store cache headers for unauthenticated private-dashboard streams', async () => {
		fetchDashboardConfigMock.mockResolvedValue({
			visibility: 'private',
			data: { items: [] }
		})
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('private-dashboard'), res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(fetchDashboardConfigMock).toHaveBeenCalledWith('private-dashboard', null)
		expect(res.end).toHaveBeenCalled()
	})

	test('uses private no-store cache headers when dashboard is not found', async () => {
		fetchDashboardConfigMock.mockResolvedValue(null)
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('missing'), res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(res.end).toHaveBeenCalled()
	})

	test('omits Vary on edge-cacheable anonymous public streams', async () => {
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', PUBLIC_DASHBOARD_CACHE_CONTROL)
		expect(res.setHeader).not.toHaveBeenCalledWith('Vary', expect.anything())
	})

	test('varies private streams on cookie and authorization', async () => {
		const authenticatedRes = createMockNextApiResponse()
		await dashboardStreamHandler(createStreamRequest('dashboard-1', 'auth-token'), authenticatedRes)
		expect(authenticatedRes.setHeader).toHaveBeenCalledWith('Vary', 'Cookie, Authorization')

		fetchDashboardConfigMock.mockResolvedValue({
			...publicDashboard,
			visibility: 'private'
		})
		const privateRes = createMockNextApiResponse()
		await dashboardStreamHandler(createStreamRequest('dashboard-1'), privateRes)
		expect(privateRes.setHeader).toHaveBeenCalledWith('Vary', 'Cookie, Authorization')
	})

	test('ends the stream with done when the config read never resolves', async () => {
		vi.useFakeTimers()
		try {
			fetchDashboardConfigMock.mockReturnValue(new Promise(() => {}))
			withTimeoutMock.mockImplementationOnce(
				(promise: Promise<unknown>, ms: number) =>
					new Promise((resolve, reject) => {
						const timeout = setTimeout(() => reject(new Error('timeout')), ms)
						promise.then(resolve, reject).finally(() => clearTimeout(timeout))
					})
			)
			const res = createMockNextApiResponse()

			const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
			await vi.advanceTimersByTimeAsync(0)
			expect(withTimeoutMock).toHaveBeenCalledWith(expect.any(Promise), DASHBOARD_CONFIG_STREAM_TIMEOUT_MS)
			await vi.advanceTimersByTimeAsync(DASHBOARD_CONFIG_STREAM_TIMEOUT_MS)
			await streamPromise

			expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
			expect(streamChunks(res).map((chunk) => chunk.type)).toEqual(['dashboard', 'done'])
			expect(res.write.mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
			expect(res.end).toHaveBeenCalledOnce()
			expect(recordRouteRuntimeError).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})
})

describe('pro dashboard stream item readiness', () => {
	const publicDashboard = {
		id: 'dashboard-1',
		user: 'user-1',
		visibility: 'public',
		created: '2026-01-01T00:00:00.000Z',
		updated: '2026-01-02T00:00:00.000Z',
		editedAt: '2026-01-03T00:00:00.000Z',
		data: { dashboardName: 'Readiness', items: [] as Array<unknown> }
	}
	const withItems = (items: Array<unknown>, extra: Record<string, unknown> = {}) => ({
		...publicDashboard,
		data: { ...publicDashboard.data, items, ...extra }
	})
	const protocolChart = (id: string, protocol: string, type = 'fees') => ({
		id,
		kind: 'chart' as const,
		subjectType: 'protocol' as const,
		protocol,
		type
	})
	const builderConfig = {
		mode: 'chains',
		metric: 'fees',
		chains: [],
		limit: 10,
		categories: [],
		chainCategories: [],
		protocolCategories: [],
		hideOthers: false,
		groupBy: 'protocol',
		chartType: 'stackedBar',
		displayAs: 'timeSeries',
		chainFilterMode: 'include',
		categoryFilterMode: 'include',
		chainCategoryFilterMode: 'include',
		protocolCategoryFilterMode: 'include'
	}

	beforeEach(() => {
		vi.clearAllMocks()
		fetchDashboardConfigMock.mockResolvedValue(publicDashboard)
		fetchProtocolsMock.mockResolvedValue({
			protocols: [],
			chains: [],
			parentProtocols: []
		})
		fetchProtocolsAndChainsMock.mockResolvedValue({
			protocols: [catalogProtocol('aave'), catalogProtocol('lido')],
			chains: [catalogChain('Ethereum'), catalogChain('Solana')]
		})
		fetchAppMetadataMock.mockResolvedValue({})
		fetchSingleChartDataMock.mockResolvedValue([[1_700_000_000, 1]])
		streamProTokenUsageDataMock.mockResolvedValue(undefined)
		fetchChartBuilderServerDataMock.mockResolvedValue({ series: [] })
		fetchProtocolsTableMock.mockResolvedValue({ rows: [], parentMetrics: {} })
	})

	test('marks a builder card ready after its data chunk and before done', async () => {
		fetchDashboardConfigMock.mockResolvedValue(withItems([{ id: 'builder-2', kind: 'builder', config: builderConfig }]))
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		const chunks = streamChunks(res)
		expect(readyItemIds(chunks)).toEqual(['builder-2'])
		expect(readyIndex(chunks, 'builder-2')).toBeGreaterThan(chunkIndex(chunks, 'chartBuilderData'))
		expect(readyIndex(chunks, 'builder-2')).toBeLessThan(chunkIndex(chunks, 'done'))
		expect(res.write.mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('marks a multi-chart ready only after every one of its sources streamed', async () => {
		fetchDashboardConfigMock.mockResolvedValue(
			withItems([
				{
					id: 'multi-chart',
					kind: 'multi',
					items: [protocolChart('chart-a', 'aave'), protocolChart('chart-b', 'lido')]
				}
			])
		)
		const pendingResolutions: Array<(data: Array<[number, number]>) => void> = []
		fetchSingleChartDataMock.mockImplementation(
			() =>
				new Promise<Array<[number, number]>>((resolve) => {
					pendingResolutions.push(resolve)
				})
		)
		const res = createMockNextApiResponse()

		const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
		await vi.waitFor(() => expect(fetchSingleChartDataMock).toHaveBeenCalledTimes(2))
		expect(readyItemIds(streamChunks(res))).toEqual([])

		pendingResolutions[0]?.([[1_700_000_000, 1]])
		await vi.waitFor(() => expect(chunkIndex(streamChunks(res), 'chartData')).toBeGreaterThan(-1))
		expect(readyItemIds(streamChunks(res))).toEqual([])

		pendingResolutions[1]?.([[1_700_000_000, 2]])
		await streamPromise

		const chunks = streamChunks(res)
		const chartDataIndexes = chunks.flatMap((chunk, index) => (chunk.type === 'chartData' ? [index] : []))
		expect(chartDataIndexes).toHaveLength(2)
		expect(readyItemIds(chunks)).toEqual(['multi-chart'])
		expect(readyIndex(chunks, 'multi-chart')).toBeGreaterThan(Math.max(...chartDataIndexes))
		expect(res.write.mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('marks text and section cards ready without waiting for chart sources', async () => {
		fetchDashboardConfigMock.mockResolvedValue(
			withItems([
				{
					id: 'section-1',
					kind: 'section',
					title: 'Overview',
					displayAs: 'heading'
				},
				{ id: 'text-1', kind: 'text', content: 'Hello' },
				protocolChart('chart-1', 'aave')
			])
		)
		let resolveChart: (data: Array<[number, number]>) => void = () => {}
		fetchSingleChartDataMock.mockReturnValue(
			new Promise<Array<[number, number]>>((resolve) => {
				resolveChart = resolve
			})
		)
		const res = createMockNextApiResponse()

		const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
		await vi.waitFor(() => expect(fetchSingleChartDataMock).toHaveBeenCalledOnce())
		const earlyChunks = streamChunks(res)
		expect(earlyChunks[0]?.type).toBe('dashboard')
		expect(earlyChunks[1]).toEqual({
			type: 'itemReady',
			itemIds: ['section-1', 'text-1']
		})
		expect(readyItemIds(earlyChunks)).not.toContain('chart-1')

		resolveChart([[1_700_000_000, 1]])
		await streamPromise

		const chunks = streamChunks(res)
		expect(readyIndex(chunks, 'chart-1')).toBeGreaterThan(chunkIndex(chunks, 'chartData'))
		expect(res.write.mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('marks a chart ready immediately when its only source is skipped', async () => {
		fetchDashboardConfigMock.mockResolvedValue(withItems([protocolChart('chart-1', 'ghost-protocol')]))
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		const chunks = streamChunks(res)
		expect(fetchSingleChartDataMock).not.toHaveBeenCalled()
		expect(chunks.find((chunk) => chunk.type === 'chartData')).toMatchObject({
			data: []
		})
		expect(readyItemIds(chunks)).toEqual(['chart-1'])
		expect(res.write.mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('marks a chart ready when its only source fails', async () => {
		fetchSingleChartDataMock.mockRejectedValue(new Error('chart unavailable'))
		fetchDashboardConfigMock.mockResolvedValue(withItems([protocolChart('chart-1', 'aave')]))
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		const chunks = streamChunks(res)
		expect(recordRuntimeError).toHaveBeenCalledWith(
			expect.any(Error),
			'outboundFetch',
			expect.objectContaining({ stream_source: 'chart' })
		)
		expect(readyItemIds(chunks)).toEqual(['chart-1'])
		expect(res.write.mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('plans only the requested card when item is given', async () => {
		fetchDashboardConfigMock.mockResolvedValue(
			withItems([protocolChart('chart-1', 'aave'), protocolChart('chart-2', 'lido', 'tvl')])
		)
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1', undefined, { item: 'chart-2' }), res)

		const chunks = streamChunks(res)
		expect(fetchSingleChartDataMock).toHaveBeenCalledOnce()
		expect(fetchSingleChartDataMock.mock.calls[0]?.[0]).toMatchObject({
			protocol: 'lido',
			type: 'tvl'
		})
		expect(readyItemIds(chunks)).toEqual(['chart-2'])
		const dashboardChunk = chunks[0]
		expect(dashboardChunk?.type === 'dashboard' && dashboardChunk.data?.data.items.map((item) => item.id)).toEqual([
			'chart-1',
			'chart-2'
		])
		expect(res.write.mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('ignores an item parameter that does not match a card', async () => {
		fetchDashboardConfigMock.mockResolvedValue(withItems([protocolChart('chart-1', 'aave')]))
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(
			createStreamRequest('dashboard-1', undefined, {
				item: 'missing',
				v: '1'
			}),
			res
		)

		expect(fetchSingleChartDataMock).toHaveBeenCalledOnce()
		expect(readyItemIds(streamChunks(res))).toEqual(['chart-1'])
	})

	test('plans bound chart sources with variable overrides from the query', async () => {
		const boundChart = {
			id: 'chart-1',
			kind: 'chart' as const,
			subjectType: 'chain' as const,
			chain: 'Ethereum',
			type: 'fees' as const,
			bindings: { subject: 'chain' }
		}
		const variables: Array<DashboardVariable> = [{ id: 'chain', kind: 'chain', label: 'Chain', value: 'Ethereum' }]
		fetchDashboardConfigMock.mockResolvedValue(withItems([boundChart], { variables }))
		const catalog = {
			protocols: [catalogProtocol('aave')],
			chains: [catalogChain('Ethereum'), catalogChain('Solana')]
		}
		fetchProtocolsAndChainsMock.mockResolvedValue(catalog)
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1', undefined, { 'var-chain': 'Solana' }), res)

		const chunks = streamChunks(res)
		expect(fetchSingleChartDataMock).toHaveBeenCalledOnce()
		expect(fetchSingleChartDataMock.mock.calls[0]?.[0]).toMatchObject({
			subjectType: 'chain',
			chain: 'Solana',
			type: 'fees'
		})
		const chartDataChunk = chunks.find((chunk) => chunk.type === 'chartData')
		expect(chartDataChunk?.type === 'chartData' && chartDataChunk.queryKey).toEqual([
			'pro-dashboard',
			'chart-source',
			'fees',
			'chain',
			'Solana',
			null,
			null
		])
		const [resolvedChart] = resolveDashboardItems(
			[boundChart as ChartConfig],
			variables,
			{ chain: 'Solana' },
			createVariableCatalog(catalog)
		).items
		expect(chartDataChunk?.type === 'chartData' && JSON.stringify(chartDataChunk.queryKey)).toBe(
			JSON.stringify(getProDashboardChartSourceQueryKey(resolvedChart as ChartConfig))
		)
		const dashboardChunk = chunks[0]
		expect(dashboardChunk?.type === 'dashboard' && dashboardChunk.data?.data.items[0]).toMatchObject({
			chain: 'Ethereum'
		})
		expect(readyItemIds(chunks)).toEqual(['chart-1'])
	})

	test('falls back to the saved variable value when the override is not in the catalog', async () => {
		const boundChart = {
			id: 'chart-1',
			kind: 'chart',
			subjectType: 'chain',
			chain: 'Ethereum',
			type: 'fees',
			bindings: { subject: 'chain' }
		}
		fetchDashboardConfigMock.mockResolvedValue(
			withItems([boundChart], {
				variables: [{ id: 'chain', kind: 'chain', label: 'Chain', value: 'Ethereum' }]
			})
		)
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1', undefined, { 'var-chain': 'Nowhere' }), res)

		expect(fetchSingleChartDataMock.mock.calls[0]?.[0]).toMatchObject({
			chain: 'Ethereum'
		})
	})

	test('does not let sections consume the initial stream window', async () => {
		fetchDashboardConfigMock.mockResolvedValue(
			withItems([
				...Array.from({ length: INITIAL_DASHBOARD_STREAM_ITEM_COUNT }, (_, index) => ({
					id: `section-${index}`,
					kind: 'section' as const,
					title: `Section ${index}`,
					displayAs: 'heading' as const
				})),
				protocolChart('chart-9', 'aave')
			])
		)
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		const chunks = streamChunks(res)
		expect(fetchSingleChartDataMock).toHaveBeenCalledOnce()
		expect(readyItemIds(chunks)).toEqual([
			...Array.from({ length: INITIAL_DASHBOARD_STREAM_ITEM_COUNT }, (_, index) => `section-${index}`),
			'chart-9'
		])
		expect(res.write.mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('marks the cards sharing one unified table source ready together', async () => {
		const table = (id: string) => ({
			id,
			kind: 'unified-table' as const,
			configVersion: 3 as const,
			strategy: 'protocols' as const,
			rowHeaders: ['protocol' as const],
			columnOrder: ['name', 'tvl'],
			columnVisibility: { name: true, tvl: true }
		})
		fetchDashboardConfigMock.mockResolvedValue(withItems([table('table-1'), table('table-2')]))
		const res = createMockNextApiResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		const chunks = streamChunks(res)
		expect(fetchProtocolsTableMock).toHaveBeenCalledOnce()
		expect(chunks.filter((chunk) => chunk.type === 'itemReady')).toEqual([
			{ type: 'itemReady', itemIds: ['table-1', 'table-2'] }
		])
		expect(readyIndex(chunks, 'table-1')).toBeGreaterThan(chunkIndex(chunks, 'unifiedTableData'))
	})
})
