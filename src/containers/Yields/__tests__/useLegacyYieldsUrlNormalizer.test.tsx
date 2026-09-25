// @vitest-environment happy-dom

import { Storage } from 'happy-dom'
import { act, StrictMode } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { APY_WINDOW_PREF } from '../stickyQueryPrefs'

type Query = Record<string, string | Array<string> | undefined>

const routeStarts = vi.hoisted(() => new Set<(url: string) => void>())
const routerMock = vi.hoisted(() => ({
	events: {
		on: vi.fn((_event: string, listener: (url: string) => void) => routeStarts.add(listener)),
		off: vi.fn((_event: string, listener: (url: string) => void) => routeStarts.delete(listener)),
		emit: (_event: string, url: string) => {
			for (const listener of routeStarts) listener(url)
		}
	},
	isReady: true,
	pathname: '/yields',
	query: {} as Record<string, string | Array<string> | undefined>,
	replace: vi.fn().mockResolvedValue(true)
}))
vi.mock('next/router', () => ({ useRouter: () => routerMock }))

import { useLegacyYieldsUrlNormalizer } from '../useLegacyYieldsUrlNormalizer'

beforeEach(() => {
	vi.stubGlobal('localStorage', new Storage())
	routerMock.pathname = '/yields'
	window.history.replaceState({}, '', '/yields')
	routerMock.replace.mockReset().mockResolvedValue(true)
})
afterEach(() => vi.unstubAllGlobals())

const REPLACE_OPTIONS = { shallow: true, scroll: false }

function Harness({ onRender }: { onRender: (settled: boolean) => void }) {
	onRender(useLegacyYieldsUrlNormalizer({ page: 'earn', tokens: [] }))
	return null
}

describe('useLegacyYieldsUrlNormalizer sticky view preferences', () => {
	let container: HTMLDivElement
	let root: Root
	let settled: boolean

	// A new query object stands in for the router hydrating a changed URL.
	const render = async (query: Query) => {
		routerMock.query = query
		await act(async () => {
			root.render(
				<StrictMode>
					<Harness onRender={(value) => (settled = value)} />
				</StrictMode>
			)
		})
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		routerMock.replace.mockClear()
		window.localStorage.clear()
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		window.localStorage.clear()
	})

	test('seeds a stored window into a URL that lacks it and gates until the replace lands', async () => {
		window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
		await render({})
		expect(settled).toBe(false)
		expect(routerMock.replace).toHaveBeenCalledTimes(1)
		expect(routerMock.replace).toHaveBeenCalledWith(
			{ pathname: '/yields', hash: '', query: { apyWindow: 'avg_30d' } },
			undefined,
			REPLACE_OPTIONS
		)

		await render({ apyWindow: 'avg_30d' })
		expect(settled).toBe(true)
		expect(routerMock.replace).toHaveBeenCalledTimes(1)
	})

	test('re-applies whenever the param is dropped again, but not once the default was chosen', async () => {
		window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
		await render({})
		await render({ apyWindow: 'avg_30d' })
		// A later navigation drops the param: the same restore target must run again.
		await render({})
		expect(routerMock.replace).toHaveBeenCalledTimes(2)
		expect(settled).toBe(false)

		// Clicking "Now" clears storage before its push lands; the bare URL is then final.
		window.localStorage.clear()
		await render({})
		expect(routerMock.replace).toHaveBeenCalledTimes(2)
		expect(settled).toBe(true)
	})

	test('retries a cancelled replace instead of leaving pool fetching disabled', async () => {
		window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
		routerMock.replace.mockResolvedValueOnce(false)
		await render({})
		expect(routerMock.replace).toHaveBeenCalledTimes(2)
		expect(settled).toBe(false)
		await render({ apyWindow: 'avg_30d' })
		expect(settled).toBe(true)
	})

	test.each(['cancelled', 'rejected'])('releases the fetch gate after repeated %s replaces', async (outcome) => {
		window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		if (outcome === 'cancelled') routerMock.replace.mockResolvedValue(false)
		else routerMock.replace.mockRejectedValue(new Error('Navigation failed'))
		try {
			await render({})
			expect(routerMock.replace).toHaveBeenCalledTimes(2)
			expect(settled).toBe(true)
			expect(warn).toHaveBeenCalledTimes(1)
			await render({})
			expect(routerMock.replace).toHaveBeenCalledTimes(2)
		} finally {
			warn.mockRestore()
		}
	})

	test('a navigation that has only started supersedes the pending restore', async () => {
		window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
		let cancel: (completed: boolean) => void = () => {}
		routerMock.replace.mockImplementationOnce(
			() =>
				new Promise<boolean>((resolve) => {
					cancel = resolve
				})
		)
		await render({})
		await act(async () => {
			routerMock.events.emit('routeChangeStart', '/yields?apyWindow=avg_30d')
			routerMock.events.emit('routeChangeStart', '/yields/borrow')
			cancel(false)
		})
		expect(routerMock.replace).toHaveBeenCalledTimes(1)
		// If the user's navigation also fails, this page must remain usable.
		expect(settled).toBe(true)
		await render({})
		expect(routerMock.replace).toHaveBeenCalledTimes(1)
	})

	test('a new navigation arriving before the restore start also takes priority', async () => {
		window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
		let cancel: (completed: boolean) => void = () => {}
		routerMock.replace.mockImplementationOnce(
			() =>
				new Promise<boolean>((resolve) => {
					cancel = resolve
				})
		)
		await render({})
		await act(async () => {
			routerMock.events.emit('routeChangeStart', '/yields/borrow')
			routerMock.events.emit('routeChangeStart', '/yields?apyWindow=avg_30d')
			cancel(false)
		})
		expect(routerMock.replace).toHaveBeenCalledTimes(1)
		expect(settled).toBe(true)
	})

	test('recognizes its own start on dynamic routes with reordered query parameters', async () => {
		window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
		routerMock.pathname = '/yields/pool/[pool]'
		window.history.replaceState({}, '', '/yields/pool/pool-1#chart')
		routerMock.replace.mockImplementationOnce(async () => {
			routerMock.events.emit(
				'routeChangeStart',
				'/yields/pool/pool-1?apyWindow=avg_30d&chain=Ethereum&chain=Base#chart'
			)
			return false
		})
		await render({ pool: 'pool-1', chain: ['Ethereum', 'Base'] })
		expect(routerMock.replace).toHaveBeenCalledTimes(2)
		expect(settled).toBe(false)
	})

	test('removes its listener and cannot retry after unmounting', async () => {
		window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
		let cancel: (completed: boolean) => void = () => {}
		routerMock.replace.mockImplementationOnce(
			() =>
				new Promise<boolean>((resolve) => {
					cancel = resolve
				})
		)
		await render({})
		expect(routeStarts.size).toBe(1)
		await act(async () => root.unmount())
		expect(routeStarts.size).toBe(0)
		await act(async () => cancel(false))
		expect(routerMock.replace).toHaveBeenCalledTimes(1)
		root = createRoot(container)
	})

	test('preserves a URL fragment during preference restoration', async () => {
		window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
		window.location.hash = '#pools'
		try {
			await render({})
			expect(routerMock.replace).toHaveBeenCalledWith(
				{ pathname: '/yields', hash: '#pools', query: { apyWindow: 'avg_30d' } },
				undefined,
				REPLACE_OPTIONS
			)
		} finally {
			window.location.hash = ''
		}
	})

	test('the URL wins over storage, and legacy params are canonicalised in the same replace', async () => {
		window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
		await render({ apyWindow: 'avg_7d' })
		expect(settled).toBe(true)
		expect(routerMock.replace).not.toHaveBeenCalled()

		await render({ project: 'Lido' })
		expect(routerMock.replace).toHaveBeenCalledWith(
			{ pathname: '/yields', hash: '', query: { protocol: 'Lido', apyWindow: 'avg_30d' } },
			undefined,
			REPLACE_OPTIONS
		)
	})
})

function HydrationHarness() {
	return <span>{String(useLegacyYieldsUrlNormalizer({ page: 'earn', tokens: [] }))}</span>
}

describe('useLegacyYieldsUrlNormalizer hydration', () => {
	afterEach(() => window.localStorage.clear())

	test('the hydration render ignores storage so it matches the server, then applies it', async () => {
		routerMock.query = {}
		routerMock.replace.mockClear()
		// Server pass: storage is unknown, so dependent UI stays in its placeholder.
		const html = renderToString(<HydrationHarness />)
		expect(html).toContain('false')

		// The browser has a stored window the server could not know about. On a static page with
		// a bare URL the router is already ready during hydration, so the first client render
		// must still match the server HTML; storage is applied on the next render.
		window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
		const container = document.createElement('div')
		document.body.appendChild(container)
		container.innerHTML = html
		const onRecoverableError = vi.fn()
		let hydrated: Root | null = null
		await act(async () => {
			hydrated = hydrateRoot(container, <HydrationHarness />, { onRecoverableError })
		})

		expect(onRecoverableError).not.toHaveBeenCalled()
		expect(container.textContent).toBe('false')
		expect(routerMock.replace).toHaveBeenCalledTimes(1)
		expect(routerMock.replace).toHaveBeenCalledWith(
			{ pathname: '/yields', hash: '', query: { apyWindow: 'avg_30d' } },
			undefined,
			{ shallow: true, scroll: false }
		)

		await act(async () => hydrated?.unmount())
		container.remove()
	})
})
