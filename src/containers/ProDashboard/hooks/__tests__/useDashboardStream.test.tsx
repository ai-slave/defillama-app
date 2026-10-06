// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import type { DashboardStreamChunk } from '../../dashboardStreamContract'
import type { Dashboard } from '../../dashboardTypes'
import {
	buildStreamRequest,
	type DashboardStreamRequestOptions,
	type DashboardStreamState,
	type DashboardStreamViewer,
	useDashboardStream
} from '../useDashboardStream'

const http = installFixtureFetch()
const STREAM_ROUTE = 'http://localhost:3000/api/dynamic/pro-dashboard/'
let root: Root
let container: HTMLDivElement
let queryClient: QueryClient
let streamState: DashboardStreamState | undefined

const ANONYMOUS: DashboardStreamViewer = { authToken: null, isAuthenticated: false, userId: undefined }

function Harness({
	dashboardId = 'dashboard-1',
	viewer = ANONYMOUS,
	options
}: {
	dashboardId?: string
	viewer?: DashboardStreamViewer
	options?: DashboardStreamRequestOptions
}) {
	streamState = useDashboardStream(dashboardId, viewer, true, options)
	return null
}

function createStreamBody() {
	let controller: ReadableStreamDefaultController<Uint8Array> | undefined
	const body = new ReadableStream<Uint8Array>({
		start(streamController) {
			controller = streamController
		}
	})
	const encoder = new TextEncoder()
	return {
		response: new Response(body),
		push: (chunk: DashboardStreamChunk) => controller?.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`)),
		close: () => controller?.close()
	}
}

async function mount(
	options?: DashboardStreamRequestOptions,
	route?: { dashboardId: string; viewer: DashboardStreamViewer }
) {
	await act(async () => {
		root.render(
			<QueryClientProvider client={queryClient}>
				<Harness {...(options ? { options } : {})} {...route} />
			</QueryClientProvider>
		)
	})
}

async function deliver(send: () => void) {
	await act(async () => {
		send()
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}

function searchParams(url: string) {
	return new URL(url, 'http://localhost').searchParams
}

beforeEach(() => {
	queryClient = new QueryClient()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	streamState = undefined
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

describe('buildStreamRequest', () => {
	test('anonymous requests carry the document version, the card and sorted variable overrides', () => {
		const { url, init } = buildStreamRequest('dashboard-1', null, new AbortController().signal, {
			version: '2026-01-03T00:00:00.000Z',
			itemId: 'chart-1',
			variableOverrides: { protocol: 'aave', chain: 'Solana' }
		})

		expect(url.startsWith('/api/dynamic/pro-dashboard/dashboard-1/stream?')).toBe(true)
		const params = searchParams(url)
		expect(Array.from(params.keys())).toEqual(['v', 'item', 'var-chain', 'var-protocol'])
		expect(params.get('v')).toBe('2026-01-03T00:00:00.000Z')
		expect(params.get('item')).toBe('chart-1')
		expect(params.get('var-chain')).toBe('Solana')
		expect(params.get('var-protocol')).toBe('aave')
		expect(init.credentials).toBe('include')
		expect(init.headers).toBeUndefined()
	})

	test('authorized requests use a cache buster instead of the version and send the bearer token', () => {
		const { url, init } = buildStreamRequest('dashboard-1', 'token', new AbortController().signal, {
			version: '2026-01-03T00:00:00.000Z',
			variableOverrides: { chain: 'Solana' }
		})

		const params = searchParams(url)
		expect(params.has('_')).toBe(true)
		expect(params.has('v')).toBe(false)
		expect(params.get('var-chain')).toBe('Solana')
		expect(init.headers).toEqual({ Authorization: 'Bearer token' })
	})
})

describe('useDashboardStream', () => {
	test('requests the stream with the card and variable overrides', async () => {
		const stream = createStreamBody()
		http.serve({ [STREAM_ROUTE]: () => stream.response })

		await mount({ itemId: 'chart-1', variableOverrides: { chain: 'Solana' }, version: 'v1' })

		expect(http.requests).toHaveLength(1)
		const params = http.requests[0]!.url.searchParams
		expect(params.get('item')).toBe('chart-1')
		expect(params.get('var-chain')).toBe('Solana')
		expect(params.get('v')).toBe('v1')
		expect(streamState?.isStreaming).toBe(true)
		await deliver(() => stream.close())
	})

	test('accumulates ready item ids across itemReady chunks into fresh sets', async () => {
		const stream = createStreamBody()
		http.serve({ [STREAM_ROUTE]: () => stream.response })
		await mount()
		expect(streamState?.readyItemIds.size).toBe(0)

		await deliver(() => stream.push({ type: 'itemReady', itemIds: ['text-1', 'section-1'] }))
		const firstReady = streamState?.readyItemIds
		expect(firstReady && Array.from(firstReady)).toEqual(['text-1', 'section-1'])
		expect(streamState?.isDone).toBe(false)

		await deliver(() => stream.push({ type: 'itemReady', itemIds: ['chart-1'] }))
		expect(streamState?.readyItemIds).not.toBe(firstReady)
		expect(firstReady?.has('chart-1')).toBe(false)
		expect(streamState && Array.from(streamState.readyItemIds)).toEqual(['text-1', 'section-1', 'chart-1'])

		await deliver(() => {
			stream.push({ type: 'done' })
			stream.close()
		})
		expect(streamState?.isDone).toBe(true)
		expect(streamState?.isStreaming).toBe(false)
		expect(streamState && Array.from(streamState.readyItemIds)).toEqual(['text-1', 'section-1', 'chart-1'])
	})

	test('seeds streamed chart data into the query cache and keeps the dashboard chunk', async () => {
		const stream = createStreamBody()
		http.serve({ [STREAM_ROUTE]: () => stream.response })
		await mount()
		const queryKey = ['pro-dashboard', 'chart-source', 'fees', 'chain', 'Solana', null, null]

		await deliver(() => {
			stream.push({ type: 'dashboard', data: null })
			stream.push({ type: 'chartData', queryKey, data: [[1_700_000_000, 1]] })
		})

		expect(streamState?.dashboard).toBeNull()
		expect(queryClient.getQueryData(queryKey)).toEqual([[1_700_000_000, 1]])
		await deliver(() => stream.close())
		expect(streamState?.isDone).toBe(true)
	})

	describe('a dashboard opened by its slug', () => {
		const owner: DashboardStreamViewer = { authToken: 'token', isAuthenticated: true, userId: 'u1' }
		const dashboard: Dashboard = {
			id: 'dash-1',
			slug: 'lending-watch',
			data: { items: [], dashboardName: 'Lending watch' },
			created: '2026-09-01',
			updated: '2026-09-02'
		}

		test('caches the streamed dashboard for its viewer under both the slug and the id', async () => {
			const stream = createStreamBody()
			http.serve({ [STREAM_ROUTE]: () => stream.response })
			await mount(undefined, { dashboardId: 'lending-watch', viewer: owner })

			await deliver(() => stream.push({ type: 'dashboard', data: dashboard }))

			expect(queryClient.getQueryData(['pro-dashboard', 'dashboard', 'lending-watch', true, 'u1'])).toEqual(dashboard)
			expect(queryClient.getQueryData(['pro-dashboard', 'dashboard', 'dash-1', true, 'u1'])).toEqual(dashboard)
			await deliver(() => stream.close())
		})

		test('does not cache a dashboard the viewer deleted while it streamed', async () => {
			const stream = createStreamBody()
			http.serve({ [STREAM_ROUTE]: () => stream.response })
			await mount(undefined, { dashboardId: 'lending-watch', viewer: owner })
			queryClient.setQueryData(['pro-dashboard-deleted', 'dash-1', 'u1'], true)

			await deliver(() => stream.push({ type: 'dashboard', data: dashboard }))

			expect(streamState?.dashboard).toEqual(dashboard)
			expect(queryClient.getQueryData(['pro-dashboard', 'dashboard', 'lending-watch', true, 'u1'])).toBeUndefined()
			expect(queryClient.getQueryData(['pro-dashboard', 'dashboard', 'dash-1', true, 'u1'])).toBeUndefined()
			await deliver(() => stream.close())
		})
	})
})
