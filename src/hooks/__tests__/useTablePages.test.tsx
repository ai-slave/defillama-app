// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
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
	const result = useTablePages<Row, Page>({
		mode: 'cursor',
		sourceKey: `all:${initialPage.version}`,
		initialRows: [row('ssr')],
		initialPage,
		querySignature: signature,
		defaultQuerySignature: DEFAULT_SIGNATURE,
		getRowKey: (item) => item.id,
		buildPageUrl
	})
	onRender(result)
	return <div ref={result.sentinelRef} />
}

type PendingRequest = { url: string; signal: AbortSignal; resolve: (response: Response) => void }

function page(id: string, overrides: Partial<Page> = {}): Page {
	return { rows: [row(id)], nextCursor: null, version: 'v-initial', total: 1, hasMore: false, ...overrides }
}

function response(body: Page | { error: string; snapshot?: string }, status = 200): Response {
	return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

describe('useTablePages cursor mode', () => {
	let container: HTMLDivElement
	let root: Root
	let latest: HookResult
	let pending: Array<PendingRequest>
	let intersect: (() => void) | null

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
		intersect = null
		vi.stubGlobal(
			'fetch',
			vi.fn(
				(url: string | URL | Request, init?: RequestInit) =>
					new Promise<Response>((resolve, reject) => {
						const signal = init?.signal
						if (!signal) throw new Error('Expected an abort signal')
						// Like the real fetch, an abort rejects the request.
						signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
						pending.push({ url: String(url), signal, resolve })
					})
			)
		)
		// Holds the observer callback so a test can scroll the sentinel into view; null while disconnected.
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				constructor(private callback: IntersectionObserverCallback) {}
				observe() {
					intersect = () => this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never)
				}
				disconnect() {
					intersect = null
				}
			}
		)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	test('does not refetch the server-rendered default page', async () => {
		await render(DEFAULT_SIGNATURE)

		expect(fetch).not.toHaveBeenCalled()
		expect(latest.rows.map((item) => item.id)).toEqual(['ssr'])
	})

	test('replaces against the pinned version, then re-pins to the version a 409 names', async () => {
		await render('sig:changed')
		expect(pending[0]?.url).toContain('version=v-initial')

		await act(async () => pending[0]?.resolve(response({ error: 'snapshot_mismatch', snapshot: 'v-rotated' }, 409)))
		expect(pending).toHaveLength(2)
		expect(pending[1]?.url).toContain('version=v-rotated')

		await act(async () => pending[1]?.resolve(response(page('fresh', { version: 'v-rotated' }))))
		expect(latest.rows.map((item) => item.id)).toEqual(['fresh'])
		expect(latest.version).toBe('v-rotated')
	})

	test('replaces against the pinned version, then retries at latest on 409', async () => {
		await render('sig:changed')
		expect(pending[0]?.url).toContain('version=v-initial')

		await act(async () => pending[0]?.resolve(response({ error: 'snapshot_mismatch' }, 409)))
		expect(pending).toHaveLength(2)
		expect(pending[1]?.url).not.toContain('version=')

		await act(async () => pending[1]?.resolve(response(page('fresh', { version: 'v-rotated' }))))
		expect(latest.rows.map((item) => item.id)).toEqual(['fresh'])
		expect(latest.version).toBe('v-rotated')
	})

	test('appends via the cursor and dedupes rows already on screen', async () => {
		await render(DEFAULT_SIGNATURE)
		act(() => void latest.loadMore())
		expect(pending).toHaveLength(1)
		expect(pending[0]?.url).toContain('cursor=next')

		await act(async () => pending[0]?.resolve(response(page('ssr', { rows: [row('ssr'), row('added')], total: 2 }))))

		expect(latest.rows.map((item) => item.id)).toEqual(['ssr', 'added'])
		expect(latest.isLoadingMore).toBe(false)
	})

	test('recovers from an append 409 by replacing at the version the 409 names', async () => {
		await render(DEFAULT_SIGNATURE)
		act(() => void latest.loadMore())
		expect(pending[0]?.url).toContain('cursor=next')

		await act(async () => pending[0]?.resolve(response({ error: 'snapshot_mismatch', snapshot: 'v-rotated' }, 409)))
		expect(pending).toHaveLength(2)
		expect(pending[1]?.url).toContain('version=v-rotated')
		expect(pending[1]?.url).not.toContain('cursor=')

		await act(async () => pending[1]?.resolve(response(page('restarted', { version: 'v-rotated' }))))
		expect(latest.rows.map((item) => item.id)).toEqual(['restarted'])
		expect(latest.version).toBe('v-rotated')
	})

	test('falls back to an unpinned replacement when the append 409 names no version', async () => {
		await render(DEFAULT_SIGNATURE)
		act(() => void latest.loadMore())

		await act(async () => pending[0]?.resolve(response({ error: 'snapshot_mismatch' }, 409)))
		expect(pending).toHaveLength(2)
		expect(pending[1]?.url).not.toContain('version=')
		expect(pending[1]?.url).not.toContain('cursor=')

		await act(async () => pending[1]?.resolve(response(page('restarted', { version: 'v-rotated' }))))
		expect(latest.rows.map((item) => item.id)).toEqual(['restarted'])
		expect(latest.version).toBe('v-rotated')
	})

	test('fails instead of adopting a heal that returns the mismatched version', async () => {
		await render(DEFAULT_SIGNATURE)
		act(() => void latest.loadMore())

		await act(async () => pending[0]?.resolve(response({ error: 'snapshot_mismatch' }, 409)))
		// A stale CDN-cached "latest" still naming the mismatched version would
		// re-409 the next append forever; the hook must stop, not loop.
		await act(async () =>
			pending[1]?.resolve(response(page('stale', { version: 'v-initial', hasMore: true, nextCursor: 'next' })))
		)

		expect(latest.error).toBe('append')
		expect(latest.rows.map((item) => item.id)).toEqual(['ssr'])
		expect(pending).toHaveLength(2)
	})

	test('keeps a failed append recovery classified as an append failure', async () => {
		await render(DEFAULT_SIGNATURE)
		act(() => void latest.loadMore())

		await act(async () => pending[0]?.resolve(response({ error: 'snapshot_mismatch', snapshot: 'v-rotated' }, 409)))
		await act(async () => pending[1]?.resolve(response(page('unused'), 403)))

		expect(latest.error).toBe('append')
		expect(latest.rows.map((item) => item.id)).toEqual(['ssr'])
	})

	test('keeps rows after a failed append and exposes retry for it', async () => {
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

	test('settles when the query returns to the loaded one before the replacement answers', async () => {
		await render(DEFAULT_SIGNATURE)
		await render('sig:search')
		expect(latest.isReplacing).toBe(true)
		expect(pending).toHaveLength(1)

		await render(DEFAULT_SIGNATURE)

		expect(latest.isReplacing).toBe(false)
		expect(latest.error).toBe(null)
		expect(latest.rows.map((item) => item.id)).toEqual(['ssr'])
		await act(async () => intersect?.())
		expect(pending).toHaveLength(2)
		expect(pending[1]?.url).toBe('/api/test-rows?version=v-initial&cursor=next')
	})

	test('drops a superseded replacement that answers after a newer one started', async () => {
		await render('sig:first')
		let answerFirst: (body: Page) => void = () => {}
		const firstBody = new Promise<Page>((resolve) => (answerFirst = resolve))
		// The first response arrives but its body is still streaming when the query changes again.
		await act(async () => pending[0]?.resolve({ ok: true, status: 200, json: () => firstBody } as Response))

		await render('sig:second')
		expect(pending).toHaveLength(2)
		await act(async () => answerFirst(page('first')))

		expect(latest.isReplacing).toBe(true)
		expect(latest.rows.map((item) => item.id)).toEqual(['ssr'])

		await act(async () => pending[1]?.resolve(response(page('second'))))
		expect(latest.isReplacing).toBe(false)
		expect(latest.rows.map((item) => item.id)).toEqual(['second'])
	})
})
