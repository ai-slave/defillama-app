// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	DEFAULT_PROTOCOL_RANKING_QUERY,
	type ProtocolRankingInitialPage,
	type ProtocolRankingPage,
	type ProtocolRankingQuery
} from '../query'
import type { IProtocol } from '../types'
import { useProtocolRankingPages } from '../useProtocolRankingPages'

const row = (id: string) => ({ id, name: id, slug: id }) as IProtocol
const initialPage = {
	nextCursor: 'next',
	snapshot: 'abcdefghijklmnopqrst',
	total: 2,
	hasMore: true,
	availableActivityMetrics: []
} satisfies ProtocolRankingInitialPage

type HookResult = ReturnType<typeof useProtocolRankingPages>

function Harness({ query, onRender }: { query: ProtocolRankingQuery; onRender: (result: HookResult) => void }) {
	onRender(
		useProtocolRankingPages({
			chain: 'All',
			initialRows: [row('ssr')],
			initialPage,
			query
		})
	)
	return null
}

type PendingRequest = {
	signal: AbortSignal
	resolve: (response: Response) => void
}

function page(id: string): ProtocolRankingPage<IProtocol> {
	return {
		rows: [row(id)],
		nextCursor: null,
		snapshot: 'abcdefghijklmnopqrst',
		total: 1,
		hasMore: false,
		availableActivityMetrics: []
	}
}

function response(body: ProtocolRankingPage<IProtocol>, status = 200): Response {
	return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

describe('useProtocolRankingPages request lifecycle', () => {
	let container: HTMLDivElement
	let root: Root
	let latest: HookResult
	let pending: PendingRequest[]

	const render = async (query: ProtocolRankingQuery) => {
		await act(async () => {
			root.render(<Harness query={query} onRender={(result) => (latest = result)} />)
		})
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		pending = []
		vi.stubGlobal(
			'fetch',
			vi.fn(
				(_url: string | URL | Request, init?: RequestInit) =>
					new Promise<Response>((resolve) => {
						if (!init?.signal) throw new Error('Expected an abort signal')
						pending.push({ signal: init.signal, resolve })
					})
			)
		)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	it('does not refetch the default SSR page', async () => {
		await render(DEFAULT_PROTOCOL_RANKING_QUERY)

		expect(fetch).not.toHaveBeenCalled()
		expect(latest.rows.map((item) => item.id)).toEqual(['ssr'])
	})

	it('aborts a stale replacement and accepts only the latest response', async () => {
		await render({ ...DEFAULT_PROTOCOL_RANKING_QUERY, search: 'first' })
		expect(pending).toHaveLength(1)
		await render({ ...DEFAULT_PROTOCOL_RANKING_QUERY, search: 'second' })
		expect(pending).toHaveLength(2)
		expect(pending[0]?.signal.aborted).toBe(true)

		await act(async () => pending[1]?.resolve(response(page('latest'))))
		await act(async () => pending[0]?.resolve(response(page('stale'))))

		expect(latest.rows.map((item) => item.id)).toEqual(['latest'])
		expect(latest.isReplacing).toBe(false)
	})

	it('does not restart an in-flight request for an equivalent query object', async () => {
		await render({ ...DEFAULT_PROTOCOL_RANKING_QUERY, search: 'same' })
		expect(pending).toHaveLength(1)

		await render({ ...DEFAULT_PROTOCOL_RANKING_QUERY, search: 'same' })

		expect(pending).toHaveLength(1)
		expect(pending[0]?.signal.aborted).toBe(false)
	})

	it('exposes a failed append for explicit retry without starting another request', async () => {
		await render(DEFAULT_PROTOCOL_RANKING_QUERY)
		act(() => void latest.loadMore())
		expect(pending).toHaveLength(1)

		await act(async () => pending[0]?.resolve(response(page('unused'), 503)))
		await act(async () => Promise.resolve())

		expect(latest.error).toBe('append')
		expect(latest.rows.map((item) => item.id)).toEqual(['ssr'])
		expect(pending).toHaveLength(1)

		act(() => void latest.retry?.())
		expect(pending).toHaveLength(2)
	})
})
