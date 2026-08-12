// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CursorTablePage } from '~/server/tablePages/types'
import { useTablePages } from '../useTablePages'

type Row = { id: string }
type Page = CursorTablePage<Row>

const row = (id: string): Row => ({ id })
const initialPage: Omit<Page, 'rows'> = { nextCursor: 'next', version: 'v-initial', total: 2, hasMore: true }
const DEFAULT_SIGNATURE = 'sig:default'

function buildPageUrl({ version, cursor }: { version?: string | null; cursor?: string | null }) {
	const params = new URLSearchParams()
	if (version) params.set('version', version)
	if (cursor) params.set('cursor', cursor)
	return `/api/test-rows?${params.toString()}`
}

type HookResult = ReturnType<typeof useTablePages<Row, Page>>

function Harness({ signature, onRender }: { signature: string; onRender: (result: HookResult) => void }) {
	onRender(
		useTablePages<Row, Page>({
			mode: 'cursor',
			sourceKey: `all:${initialPage.version}`,
			initialRows: [row('ssr')],
			initialPage,
			querySignature: signature,
			defaultQuerySignature: DEFAULT_SIGNATURE,
			getRowKey: (item) => item.id,
			buildPageUrl
		})
	)
	return null
}

type PendingRequest = { url: string; signal: AbortSignal; resolve: (response: Response) => void }

function page(id: string, overrides: Partial<Page> = {}): Page {
	return { rows: [row(id)], nextCursor: null, version: 'v-initial', total: 1, hasMore: false, ...overrides }
}

function response(body: Page | { error: string }, status = 200): Response {
	return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

describe('useTablePages cursor mode', () => {
	let container: HTMLDivElement
	let root: Root
	let latest: HookResult
	let pending: PendingRequest[]

	const render = async (signature: string) => {
		await act(async () => {
			root.render(<Harness signature={signature} onRender={(result) => (latest = result)} />)
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
				(url: string | URL | Request, init?: RequestInit) =>
					new Promise<Response>((resolve) => {
						if (!init?.signal) throw new Error('Expected an abort signal')
						pending.push({ url: String(url), signal: init.signal, resolve })
					})
			)
		)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	it('does not refetch the server-rendered default page', async () => {
		await render(DEFAULT_SIGNATURE)

		expect(fetch).not.toHaveBeenCalled()
		expect(latest.rows.map((item) => item.id)).toEqual(['ssr'])
	})

	it('aborts a stale replacement and accepts only the latest response', async () => {
		await render('sig:first')
		expect(pending).toHaveLength(1)
		await render('sig:second')
		expect(pending).toHaveLength(2)
		expect(pending[0]?.signal.aborted).toBe(true)

		await act(async () => pending[1]?.resolve(response(page('latest'))))
		await act(async () => pending[0]?.resolve(response(page('stale'))))

		expect(latest.rows.map((item) => item.id)).toEqual(['latest'])
		expect(latest.isReplacing).toBe(false)
	})

	it('replaces against the pinned version, then retries at latest on 409', async () => {
		await render('sig:changed')
		expect(pending[0]?.url).toContain('version=v-initial')

		await act(async () => pending[0]?.resolve(response({ error: 'snapshot_mismatch' }, 409)))
		expect(pending).toHaveLength(2)
		expect(pending[1]?.url).not.toContain('version=')

		await act(async () => pending[1]?.resolve(response(page('fresh', { version: 'v-rotated' }))))
		expect(latest.rows.map((item) => item.id)).toEqual(['fresh'])
		expect(latest.version).toBe('v-rotated')
	})

	it('appends via the cursor and dedupes rows already on screen', async () => {
		await render(DEFAULT_SIGNATURE)
		act(() => void latest.loadMore())
		expect(pending).toHaveLength(1)
		expect(pending[0]?.url).toContain('cursor=next')

		await act(async () => pending[0]?.resolve(response(page('ssr', { rows: [row('ssr'), row('added')], total: 2 }))))

		expect(latest.rows.map((item) => item.id)).toEqual(['ssr', 'added'])
		expect(latest.isLoadingMore).toBe(false)
	})

	it('recovers from an append 409 by replacing at the latest version', async () => {
		await render(DEFAULT_SIGNATURE)
		act(() => void latest.loadMore())
		expect(pending[0]?.url).toContain('cursor=next')

		await act(async () => pending[0]?.resolve(response({ error: 'snapshot_mismatch' }, 409)))
		expect(pending).toHaveLength(2)
		expect(pending[1]?.url).toContain('version=v-initial')
		expect(pending[1]?.url).not.toContain('cursor=')

		await act(async () => pending[1]?.resolve(response({ error: 'snapshot_mismatch' }, 409)))
		expect(pending).toHaveLength(3)
		expect(pending[2]?.url).not.toContain('version=')

		await act(async () => pending[2]?.resolve(response(page('restarted', { version: 'v-rotated' }))))
		expect(latest.rows.map((item) => item.id)).toEqual(['restarted'])
		expect(latest.version).toBe('v-rotated')
	})

	it('keeps a failed append recovery classified as an append failure', async () => {
		await render(DEFAULT_SIGNATURE)
		act(() => void latest.loadMore())

		await act(async () => pending[0]?.resolve(response({ error: 'snapshot_mismatch' }, 409)))
		await act(async () => pending[1]?.resolve(response({ error: 'snapshot_mismatch' }, 409)))
		await act(async () => pending[2]?.resolve(response(page('unused'), 403)))

		expect(latest.error).toBe('append')
		expect(latest.rows.map((item) => item.id)).toEqual(['ssr'])
	})

	it('exposes a failed append for explicit retry without starting another request', async () => {
		await render(DEFAULT_SIGNATURE)
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

	it('ignores loadMore while the query signature is ahead of the loaded rows', async () => {
		await render('sig:diverged')
		expect(pending).toHaveLength(1)

		act(() => void latest.loadMore())
		expect(pending).toHaveLength(1)
	})
})
