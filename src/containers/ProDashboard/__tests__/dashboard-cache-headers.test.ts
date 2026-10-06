import { EventEmitter } from 'node:events'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import type { NextApiRequest } from 'next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { AUTH_SERVER, CONFIG_API, FEATURES_SERVER, POCKETBASE_URL, SERVER_URL, V2_SERVER_URL } from '~/constants'
import { getChartBuilderQueryKey } from '~/containers/ProDashboard/chartBuilderQueryKey'
import { getProDashboardChartSourceQueryKey } from '~/containers/ProDashboard/chartSource'
import {
	INITIAL_DASHBOARD_STREAM_ITEM_COUNT,
	type DashboardStreamChunk
} from '~/containers/ProDashboard/dashboardStreamContract'
import type { DashboardVariable } from '~/containers/ProDashboard/dashboardTypes'
import { createVariableCatalog, resolveDashboardItems } from '~/containers/ProDashboard/dashboardVariables/resolve'
import type { ChartBuilderConfig, ChartConfig } from '~/containers/ProDashboard/types'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { createMockNextApiResponse, type MockNextApiResponse } from '~/utils/testing/nextApiMocks'
import { installTelemetrySink } from '~/utils/testing/telemetry'
import { waitForUi } from '~/utils/testing/waitForUi'

/** Upstream state the stream reads: catalog rows from the database, and a chart answer per request. */
const upstream = vi.hoisted(() => ({
	catalogRows: [] as Array<Record<string, unknown>>,
	chart: (_url: URL): unknown => [[1_700_000_000, 1]]
}))

// The protocol catalog, P/F availability and unified table rows come from the database; everything else runs down to fetch.
vi.mock('~/server/db/llama', () => ({
	llamaDb: { query: async () => upstream.catalogRows, any: async () => [], one: async () => ({}) }
}))
// Authorized reads go through the pooled server client; route them to the same fetch fixtures.
vi.mock('~/utils/http-client', () => ({
	fetchWithPoolingOnServer: (url: string, init?: RequestInit) => fetch(url, init)
}))

const catalogRow = (slug: string) => ({
	slug,
	name: slug,
	protocol: slug,
	category: null,
	tvl_base: 1,
	symbol: slug.toUpperCase(),
	token_nk: null,
	has_misrepresented_tokens: false,
	exclude_tvl_from_parent: false
})

const catalogChain = (name: string) => ({
	name,
	gecko_id: null,
	tvl: 1,
	tokenSymbol: null,
	chainId: null,
	cmcId: null
})

const PROTOCOLS_URL = `${SERVER_URL}/lite/protocols2`
const CHAINS_URL = `${SERVER_URL}/chains`
const ORACLES_URL = `${V2_SERVER_URL}/metrics/oracle`
const APP_METADATA_URL = `${CONFIG_API}/smol/appMetadata-`
const CHART_URL = `${V2_SERVER_URL}/chart/`

/** Answers every upstream a dashboard stream can read, before a test overrides one. */
function serveUpstreams(chains: Array<ReturnType<typeof catalogChain>> = []) {
	telemetry.serve({
		[PROTOCOLS_URL]: { protocols: [], chains: [], parentProtocols: [] },
		[CHAINS_URL]: chains,
		[ORACLES_URL]: { oracles: {}, chainsByOracle: {}, oraclesTVS: {} },
		[`${APP_METADATA_URL}protocols.json`]: {},
		[`${APP_METADATA_URL}chains.json`]: {},
		[CHART_URL]: (url: URL) => upstream.chart(url)
	})
}

/** Which shared upstreams the stream read, in order, without repeats. */
function upstreamReads() {
	const reads: Array<string> = []
	for (const { url } of telemetry.requests) {
		const read = url.href.startsWith(PROTOCOLS_URL)
			? 'protocols'
			: url.href === CHAINS_URL
				? 'chains'
				: url.href.startsWith(ORACLES_URL)
					? 'oracles'
					: url.href.startsWith(APP_METADATA_URL)
						? 'app-metadata'
						: null
		if (read && !reads.includes(read)) reads.push(read)
	}
	return reads
}

/** Chart series requests, as the path under /chart/, in request order. */
function chartReads() {
	return telemetry.requests.flatMap(({ url }) =>
		url.href.startsWith(CHART_URL) ? [url.href.slice(CHART_URL.length)] : []
	)
}

/** Holds every chart request until the test answers it, counting how many are in flight at once. */
function holdCharts() {
	const held = { pending: [] as Array<(series: Array<[number, number]>) => void>, active: 0, maxActive: 0 }
	upstream.chart = () =>
		new Promise<Response>((resolve) => {
			held.active += 1
			held.maxActive = Math.max(held.maxActive, held.active)
			held.pending.push((series) => {
				held.active -= 1
				resolve(Response.json(series))
			})
		})
	return held
}

const feesChart = (protocol: string) => `fees/protocol/${protocol}?dataType=dailyFees`

import {
	DASHBOARD_CONFIG_STREAM_TIMEOUT_MS,
	DASHBOARD_STREAM_CLASSIC_SOURCE_LIMIT,
	DASHBOARD_STREAM_SOURCE_CONCURRENCY
} from '~/containers/ProDashboard/server/stream'
import dashboardStreamHandler from '~/pages/api/dynamic/pro-dashboard/[dashboardId]/stream'

const telemetry = installTelemetrySink()
/** The saved dashboard the features server answers with; null answers 404, a pending promise never answers. */
let dashboardConfig: unknown = null

beforeEach(() => {
	dashboardConfig = null
	upstream.catalogRows = [catalogRow('aave')]
	upstream.chart = () => [[1_700_000_000, 1]]
	serveUpstreams()
	telemetry.serve({
		[`${FEATURES_SERVER}/dashboards/`]: () => (dashboardConfig === null ? fixtureStatus(404)() : dashboardConfig),
		// Signed-in streams resolve the subscription; these sessions are not subscribed.
		[`${AUTH_SERVER}/subscription/status`]: fixtureStatus(401),
		[`${POCKETBASE_URL}/api/collections/users/auth-refresh`]: fixtureStatus(401)
	})
})

/** Dashboard config reads in order, with the session token each one carried. */
function dashboardReads() {
	return telemetry.requests
		.filter((request) => request.url.pathname.startsWith('/dashboards/'))
		.map(
			(request) => `${request.url.pathname} ${new Headers(request.init?.headers).get('Authorization') ?? 'anonymous'}`
		)
}

/** Runtime errors the stream reported, by phase and the failed stream source or upstream URL. */
async function runtimeErrors() {
	return (await telemetry.events()).flatMap((event) =>
		event.type === 'runtime_error'
			? [{ phase: event.phase, source: event.attributes?.stream_source ?? event.attributes?.url }]
			: []
	)
}

function setDashboardConfig(dashboard: unknown) {
	dashboardConfig = dashboard
}

const PUBLIC_DASHBOARD_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=60'
const PRIVATE_DASHBOARD_CACHE_CONTROL = 'private, no-cache, no-store, must-revalidate'

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

// Route telemetry wraps `res.write` and `res.end` while the stream is open, so reads go through the original spies.
const responseSpies = new WeakMap<
	MockNextApiResponse,
	{ write: MockNextApiResponse['write']; end: MockNextApiResponse['end'] }
>()

function streamResponse(): MockNextApiResponse {
	const res = createMockNextApiResponse()
	responseSpies.set(res, { write: res.write, end: res.end })
	return res
}

function spiesOf(res: MockNextApiResponse) {
	const spies = responseSpies.get(res)
	if (!spies) throw new Error('Expected a stream response')
	return spies
}

const written = (res: MockNextApiResponse) => spiesOf(res).write
const ended = (res: MockNextApiResponse) => spiesOf(res).end

function streamChunks(res: MockNextApiResponse): Array<DashboardStreamChunk> {
	return written(res).mock.calls.map((call) => JSON.parse(String(call[0])) as DashboardStreamChunk)
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
		setDashboardConfig(publicDashboard)
	})

	afterEach(() => {
		vi.unstubAllEnvs()
	})

	test('keeps the public dashboard stream cache header unjittered', async () => {
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/x-ndjson')
		expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', PUBLIC_DASHBOARD_CACHE_CONTROL)
		// Vary would fragment the shared CDN entry for an anonymous public stream.
		expect(res.setHeader).not.toHaveBeenCalledWith('Vary', expect.anything())
		expect(dashboardReads()).toEqual(['/dashboards/dashboard-1 anonymous'])
		const dashboardLine = JSON.parse(String(written(res).mock.calls[0]?.[0]))
		expect(dashboardLine.data).not.toHaveProperty('user')
		expect(dashboardLine.data).not.toHaveProperty('aiGenerated')
		expect(dashboardLine.data).not.toHaveProperty('collectionId')
		expect(dashboardLine.data).not.toHaveProperty('collectionName')
		expect(ended(res)).toHaveBeenCalled()
	})

	test('waits for response backpressure to clear before ending the stream', async () => {
		const events = new EventEmitter()
		const res = streamResponse()
		Object.assign(res, {
			once: events.once.bind(events),
			off: events.off.bind(events)
		})
		res.write.mockReturnValueOnce(false)

		const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
		await waitForUi(() => expect(written(res)).toHaveBeenCalledOnce())
		expect(ended(res)).not.toHaveBeenCalled()

		events.emit('drain')
		await streamPromise

		expect(written(res).mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
		expect(ended(res)).toHaveBeenCalledOnce()
	})

	test('finishes the stream when the shared protocols request fails', async () => {
		telemetry.serve({ [PROTOCOLS_URL]: fixtureStatus(404, { message: 'protocols unavailable' }) })
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(await runtimeErrors()).toEqual([
			{ phase: 'outboundFetch', source: expect.stringContaining('/lite/protocols2') }
		])
		expect(telemetry.requests.filter(({ url }) => url.href.startsWith(PROTOCOLS_URL))).toHaveLength(1)
		expect(written(res)).toHaveBeenCalledWith('{"type":"done"}\n')
		expect(ended(res)).toHaveBeenCalled()
	})

	test('plans chart sources with app metadata that answers after the catalog', async () => {
		let answerAppMetadata: (response: Response) => void = () => {}
		telemetry.serve({
			[`${APP_METADATA_URL}protocols.json`]: () =>
				new Promise<Response>((resolve) => {
					answerAppMetadata = resolve
				})
		})
		const res = streamResponse()

		const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
		await waitForUi(() => expect(upstreamReads()).toEqual(expect.arrayContaining(['app-metadata', 'protocols'])))
		// Aave's metadata advertises no fees adapter, so the fees card must be skipped rather than fetched.
		answerAppMetadata(Response.json({ '1': { name: 'aave', displayName: 'Aave' } }))
		await streamPromise

		expect(chartReads()).toEqual([])
		const chunks = streamChunks(res)
		expect(chunks.find((chunk) => chunk.type === 'chartData')).toMatchObject({ data: [] })
		expect(readyItemIds(chunks)).toEqual(['chart-1'])
	})

	test('leaves catalog and chart sources beyond the initial stream window to client fallback', async () => {
		setDashboardConfig({
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
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		const chunks = streamChunks(res)
		expect(chunks.filter((chunk) => chunk.type === 'unifiedTableData')).toHaveLength(1)
		expect(readyItemIds(chunks)).not.toContain('chart-9')
		expect(chunkIndex(chunks, 'chartData')).toBe(-1)
		expect(chartReads()).toEqual([])
		expect(chunks.at(-1)).toEqual({ type: 'done' })
	})

	test('bounds source work even when one dashboard item expands into many requests', async () => {
		const chartCount = DASHBOARD_STREAM_SOURCE_CONCURRENCY + 4
		upstream.catalogRows = Array.from({ length: chartCount }, (_, index) => catalogRow(`protocol-${index}`))
		setDashboardConfig({
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
		const held = holdCharts()
		const res = streamResponse()

		const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
		await waitForUi(() => expect(chartReads()).toHaveLength(DASHBOARD_STREAM_SOURCE_CONCURRENCY))
		for (let startedCount = DASHBOARD_STREAM_SOURCE_CONCURRENCY + 1; startedCount <= chartCount; startedCount++) {
			const answer = held.pending.shift()
			if (!answer) throw new Error('Expected an active chart request')
			answer([[1_700_000_000, startedCount]])
			await waitForUi(() => expect(chartReads()).toHaveLength(startedCount))
		}
		for (const answer of held.pending) answer([[1_700_000_000, 1]])
		await streamPromise

		expect(held.maxActive).toBe(DASHBOARD_STREAM_SOURCE_CONCURRENCY)
		expect(written(res).mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
		expect(ended(res)).toHaveBeenCalledOnce()
	})

	test('caps expanded classic sources while preserving the first multi-chart', async () => {
		const multiCount = INITIAL_DASHBOARD_STREAM_ITEM_COUNT
		const chartCount = DASHBOARD_STREAM_CLASSIC_SOURCE_LIMIT
		upstream.catalogRows = Array.from({ length: multiCount * chartCount }, (_protocol, index) =>
			catalogRow(`protocol-${index}`)
		)
		setDashboardConfig({
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
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(chartReads()).toEqual(Array.from({ length: chartCount }, (_, index) => feesChart(`protocol-${index}`)))
		expect(written(res).mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('emits done after the initial window without fetching the offscreen remainder', async () => {
		upstream.catalogRows = Array.from({ length: INITIAL_DASHBOARD_STREAM_ITEM_COUNT + 1 }, (_, index) =>
			catalogRow(`protocol-${index}`)
		)
		setDashboardConfig({
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
		const held = holdCharts()
		const res = streamResponse()

		const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
		await waitForUi(() => expect(chartReads()).toHaveLength(INITIAL_DASHBOARD_STREAM_ITEM_COUNT))
		expect(written(res)).not.toHaveBeenCalledWith('{"type":"done"}\n')
		for (const answer of held.pending) answer([[1_700_000_000, 1]])
		await streamPromise

		expect(chartReads()).toHaveLength(INITIAL_DASHBOARD_STREAM_ITEM_COUNT)
		expect(written(res).mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
		expect(ended(res)).toHaveBeenCalledOnce()
	})

	test('records failed chart-builder sources without failing the stream', async () => {
		// The builder's protocol breakdown upstream is down; other chart reads still answer.
		upstream.chart = (url) =>
			url.pathname.endsWith('/protocol-breakdown')
				? fixtureStatus(404, { message: 'builder unavailable' })()
				: [[1_700_000_000, 1]]
		setDashboardConfig({
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
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		// The stream records the failed source once, beside the upstream read that failed, and the route itself succeeds.
		const errors = await runtimeErrors()
		expect(errors.filter((error) => error.source === 'chart-builder')).toEqual([
			{ phase: 'outboundFetch', source: 'chart-builder' }
		])
		expect(errors).toContainEqual({ phase: 'outboundFetch', source: '/v2/chart/fees/protocol-breakdown' })
		expect(written(res)).toHaveBeenCalledWith('{"type":"done"}\n')
		expect((await telemetry.events()).filter((event) => event.type === 'route_execution')).toEqual([
			expect.objectContaining({ status: 'success', http_status: 200 })
		])
	})
	test('streams chart-builder data under the client query key only for metrics the stream owns', async () => {
		const builderConfig = (metric: string) => ({
			mode: 'chains' as const,
			metric,
			chains: [],
			limit: 10,
			categories: [],
			chainCategories: [],
			protocolCategories: [],
			hideOthers: false,
			groupBy: 'protocol' as const,
			chartType: 'stackedBar' as const,
			displayAs: 'timeSeries' as const,
			chainFilterMode: 'include' as const,
			categoryFilterMode: 'include' as const,
			chainCategoryFilterMode: 'include' as const,
			protocolCategoryFilterMode: 'include' as const
		})
		const feesConfig = builderConfig('fees') as ChartBuilderConfig['config']
		setDashboardConfig({
			...publicDashboard,
			data: {
				...publicDashboard.data,
				items: [
					// Chain-mode TVL series are left to the client.
					{ id: 'builder-tvl', kind: 'builder', config: builderConfig('tvl') },
					{ id: 'builder-fees', kind: 'builder', config: feesConfig }
				]
			}
		})
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		expect(streamChunks(res).flatMap((chunk) => (chunk.type === 'chartBuilderData' ? [chunk.key] : []))).toEqual([
			JSON.stringify(getChartBuilderQueryKey(feesConfig))
		])
	})

	test('uses private no-store cache headers for authenticated dashboard streams', async () => {
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1', 'auth-token'), res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(dashboardReads()).toEqual(['/dashboards/dashboard-1 Bearer auth-token'])
		expect(ended(res)).toHaveBeenCalled()
	})

	test('uses private no-store cache headers for unauthenticated private-dashboard streams', async () => {
		setDashboardConfig({
			visibility: 'private',
			data: { items: [] }
		})
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('private-dashboard'), res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(dashboardReads()).toEqual(['/dashboards/private-dashboard anonymous'])
		expect(ended(res)).toHaveBeenCalled()
	})

	test('uses private no-store cache headers when dashboard is not found', async () => {
		setDashboardConfig(null)
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('missing'), res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
		expect(ended(res)).toHaveBeenCalled()
	})

	test('varies private streams on cookie and authorization', async () => {
		const authenticatedRes = streamResponse()
		await dashboardStreamHandler(createStreamRequest('dashboard-1', 'auth-token'), authenticatedRes)
		expect(authenticatedRes.setHeader).toHaveBeenCalledWith('Vary', 'Cookie, Authorization')

		setDashboardConfig({
			...publicDashboard,
			visibility: 'private'
		})
		const privateRes = streamResponse()
		await dashboardStreamHandler(createStreamRequest('dashboard-1'), privateRes)
		expect(privateRes.setHeader).toHaveBeenCalledWith('Vary', 'Cookie, Authorization')
	})

	test('ends the stream with done when the config read never resolves', async () => {
		vi.useFakeTimers()
		try {
			dashboardConfig = new Promise(() => {})
			const res = streamResponse()

			const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
			await vi.advanceTimersByTimeAsync(DASHBOARD_CONFIG_STREAM_TIMEOUT_MS - 1)
			expect(written(res)).not.toHaveBeenCalled()
			await vi.advanceTimersByTimeAsync(1)
			await streamPromise

			expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', PRIVATE_DASHBOARD_CACHE_CONTROL)
			expect(streamChunks(res).map((chunk) => chunk.type)).toEqual(['dashboard', 'done'])
			expect(written(res).mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
			expect(ended(res)).toHaveBeenCalledOnce()
		} finally {
			vi.useRealTimers()
		}
		// A config read that timed out is answered with an empty dashboard, not a route failure.
		expect((await telemetry.events()).filter((event) => event.type === 'route_execution')).toEqual([
			expect.objectContaining({ status: 'success', http_status: 200 })
		])
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
		setDashboardConfig(publicDashboard)
		upstream.catalogRows = [catalogRow('aave'), catalogRow('lido')]
		serveUpstreams([catalogChain('Ethereum'), catalogChain('Solana')])
	})

	test('marks a builder card ready after its data chunk and before done', async () => {
		setDashboardConfig(withItems([{ id: 'builder-2', kind: 'builder', config: builderConfig }]))
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		const chunks = streamChunks(res)
		expect(readyItemIds(chunks)).toEqual(['builder-2'])
		expect(readyIndex(chunks, 'builder-2')).toBeGreaterThan(chunkIndex(chunks, 'chartBuilderData'))
		expect(readyIndex(chunks, 'builder-2')).toBeLessThan(chunkIndex(chunks, 'done'))
		expect(written(res).mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('marks a multi-chart ready only after every one of its sources streamed', async () => {
		setDashboardConfig(
			withItems([
				{
					id: 'multi-chart',
					kind: 'multi',
					items: [protocolChart('chart-a', 'aave'), protocolChart('chart-b', 'lido')]
				}
			])
		)
		const held = holdCharts()
		const res = streamResponse()

		const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
		await waitForUi(() => expect(chartReads()).toHaveLength(2))
		expect(readyItemIds(streamChunks(res))).toEqual([])

		held.pending[0]?.([[1_700_000_000, 1]])
		await waitForUi(() => expect(chunkIndex(streamChunks(res), 'chartData')).toBeGreaterThan(-1))
		expect(readyItemIds(streamChunks(res))).toEqual([])

		held.pending[1]?.([[1_700_000_000, 2]])
		await streamPromise

		const chunks = streamChunks(res)
		const chartDataIndexes = chunks.flatMap((chunk, index) => (chunk.type === 'chartData' ? [index] : []))
		expect(chartDataIndexes).toHaveLength(2)
		expect(readyItemIds(chunks)).toEqual(['multi-chart'])
		expect(readyIndex(chunks, 'multi-chart')).toBeGreaterThan(Math.max(...chartDataIndexes))
		expect(written(res).mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('marks text and section cards ready without waiting for chart sources', async () => {
		setDashboardConfig(
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
		const held = holdCharts()
		const res = streamResponse()

		const streamPromise = dashboardStreamHandler(createStreamRequest('dashboard-1'), res)
		await waitForUi(() => expect(chartReads()).toHaveLength(1))
		const earlyChunks = streamChunks(res)
		expect(earlyChunks[0]?.type).toBe('dashboard')
		expect(earlyChunks[1]).toEqual({
			type: 'itemReady',
			itemIds: ['section-1', 'text-1']
		})
		expect(readyItemIds(earlyChunks)).not.toContain('chart-1')

		held.pending[0]?.([[1_700_000_000, 1]])
		await streamPromise

		const chunks = streamChunks(res)
		expect(readyIndex(chunks, 'chart-1')).toBeGreaterThan(chunkIndex(chunks, 'chartData'))
		expect(written(res).mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('marks a chart ready immediately when its only source is skipped', async () => {
		setDashboardConfig(withItems([protocolChart('chart-1', 'ghost-protocol')]))
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		const chunks = streamChunks(res)
		expect(chartReads()).toEqual([])
		expect(chunks.find((chunk) => chunk.type === 'chartData')).toMatchObject({
			data: []
		})
		expect(readyItemIds(chunks)).toEqual(['chart-1'])
		expect(written(res).mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('marks a chart ready when its only source fails', async () => {
		upstream.chart = fixtureStatus(404, { message: 'chart unavailable' })
		setDashboardConfig(withItems([protocolChart('chart-1', 'aave')]))
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		const chunks = streamChunks(res)
		expect(await runtimeErrors()).toEqual([
			{ phase: 'outboundFetch', source: expect.stringContaining('/chart/fees/protocol/aave') },
			{ phase: 'outboundFetch', source: 'chart' }
		])
		expect(readyItemIds(chunks)).toEqual(['chart-1'])
		expect(written(res).mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('plans only the requested card when item is given', async () => {
		setDashboardConfig(withItems([protocolChart('chart-1', 'aave'), protocolChart('chart-2', 'lido', 'tvl')]))
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1', undefined, { item: 'chart-2' }), res)

		const chunks = streamChunks(res)
		expect(chartReads()).toEqual(['tvl/protocol/lido'])
		expect(readyItemIds(chunks)).toEqual(['chart-2'])
		const dashboardChunk = chunks[0]
		expect(dashboardChunk?.type === 'dashboard' && dashboardChunk.data?.data.items.map((item) => item.id)).toEqual([
			'chart-1',
			'chart-2'
		])
		expect(written(res).mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
	})

	test('ignores an item parameter that does not match a card', async () => {
		setDashboardConfig(withItems([protocolChart('chart-1', 'aave')]))
		const res = streamResponse()

		await dashboardStreamHandler(
			createStreamRequest('dashboard-1', undefined, {
				item: 'missing',
				v: '1'
			}),
			res
		)

		expect(chartReads()).toEqual([feesChart('aave')])
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
		setDashboardConfig(withItems([boundChart], { variables }))
		const catalog = { protocols: [], chains: [catalogChain('Ethereum'), catalogChain('Solana')] }
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1', undefined, { 'var-chain': 'Solana' }), res)

		const chunks = streamChunks(res)
		expect(chartReads()).toEqual(['fees/chain/solana?dataType=dailyAppFees'])
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
		setDashboardConfig(
			withItems([boundChart], {
				variables: [{ id: 'chain', kind: 'chain', label: 'Chain', value: 'Ethereum' }]
			})
		)
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1', undefined, { 'var-chain': 'Nowhere' }), res)

		expect(chartReads()).toEqual(['fees/chain/ethereum?dataType=dailyAppFees'])
	})

	test('does not let sections consume the initial stream window', async () => {
		setDashboardConfig(
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
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		const chunks = streamChunks(res)
		expect(chartReads()).toEqual([feesChart('aave')])
		expect(readyItemIds(chunks)).toEqual([
			...Array.from({ length: INITIAL_DASHBOARD_STREAM_ITEM_COUNT }, (_, index) => `section-${index}`),
			'chart-9'
		])
		expect(written(res).mock.calls.at(-1)?.[0]).toBe('{"type":"done"}\n')
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
		setDashboardConfig(withItems([table('table-1'), table('table-2')]))
		const res = streamResponse()

		await dashboardStreamHandler(createStreamRequest('dashboard-1'), res)

		const chunks = streamChunks(res)
		expect(chunks.filter((chunk) => chunk.type === 'unifiedTableData')).toHaveLength(1)
		expect(chunks.filter((chunk) => chunk.type === 'itemReady')).toEqual([
			{ type: 'itemReady', itemIds: ['table-1', 'table-2'] }
		])
		expect(readyIndex(chunks, 'table-1')).toBeGreaterThan(chunkIndex(chunks, 'unifiedTableData'))
	})
})
