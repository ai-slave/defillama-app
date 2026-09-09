import { EventEmitter } from 'node:events'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import type { GetServerSidePropsContext, GetServerSidePropsResult, NextApiRequest } from 'next'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { INITIAL_DASHBOARD_STREAM_ITEM_COUNT } from '~/containers/ProDashboard/dashboardStreamContract'
import { recordRouteRuntimeError, recordRuntimeError } from '~/utils/telemetry'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

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
	withTimeoutMock: vi.fn((promise: Promise<unknown>) => promise),
	streamProTokenUsageDataMock: vi.fn(),
	fetchChartBuilderServerDataMock: vi.fn(),
	fetchProtocolsTableMock: vi.fn(),
	fetchAuthenticatedUserIdMock: vi.fn(),
	providerPropsMock: vi.fn(),
	proDashboardLoaderMock: vi.fn()
}))

vi.mock('~/utils/telemetry', () => ({
	recordRuntimeError: vi.fn(),
	recordRouteRuntimeError: vi.fn(),
	withApiRouteTelemetry: (_route: string, handler: unknown) => handler,
	withServerSidePropsTelemetry: (_route: string, handler: unknown) => handler
}))

vi.mock('next/router', () => ({
	useRouter: () => ({
		asPath: '/pro/dashboard-1',
		query: { dashboardId: 'dashboard-1' },
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
	DASHBOARD_STREAM_CLASSIC_SOURCE_LIMIT,
	DASHBOARD_STREAM_SOURCE_CONCURRENCY
} from '~/containers/ProDashboard/server/stream'
import dashboardStreamHandler from '~/pages/api/dynamic/pro-dashboard/[dashboardId]/stream'
import DashboardPage, { getServerSideProps } from '~/pages/pro/[dashboardId]'
import { getServerSideProps as getEditServerSideProps } from '~/pages/pro/[dashboardId]/edit'

const PUBLIC_DASHBOARD_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=60'
const PRIVATE_DASHBOARD_CACHE_CONTROL = 'private, no-cache, no-store, must-revalidate'

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

function createStreamRequest(dashboardId: string, authToken?: string): NextApiRequest {
	const req = Object.assign(new IncomingMessage(new Socket()), {
		query: { dashboardId },
		cookies: authToken ? { pb_auth_token: authToken } : {},
		body: null,
		env: {}
	})
	req.method = 'GET'
	req.url = `/api/dynamic/pro-dashboard/${dashboardId}/stream`
	return req
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
				initialDashboard: expect.objectContaining({
					id: 'dashboard-1',
					user: '',
					data: expect.objectContaining({ items: publicDashboard.data.items })
				})
			})
		)
		expect(proDashboardLoaderMock).not.toHaveBeenCalled()
	})

	test('seeds authenticated edit config only for the verified owner', async () => {
		const context = createSsrContext('dashboard-1', 'auth-token')

		const result = await getEditServerSideProps(context)
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

		const result = await getEditServerSideProps(createSsrContext('dashboard-1', 'auth-token'))

		expect(result).toEqual({
			props: { dashboardId: 'dashboard-1', initialDashboard: null }
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
				initialDashboard: null,
				seo: null,
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
						id: `text-${index}`,
						kind: 'text' as const,
						content: `Text ${index}`
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
		expect(fetchProtocolsTableMock.mock.calls[0]?.[0]).toMatchObject({ baseMetricFamilies: ['tvl'] })
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
})
