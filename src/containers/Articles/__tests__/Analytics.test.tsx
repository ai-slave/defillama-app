// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useResearchSectionEngagement } from '~/containers/Articles/landing/Analytics'
import { installUmamiSink } from '~/utils/testing/umamiSink'

const track = installUmamiSink()

const mocks = vi.hoisted(() => ({
	routerHandlers: new Map<string, Set<() => void>>()
}))

vi.mock('next/router', () => ({
	useRouter: () => ({
		events: {
			on: (event: string, handler: () => void) => {
				const handlers = mocks.routerHandlers.get(event) ?? new Set()
				handlers.add(handler)
				mocks.routerHandlers.set(event, handlers)
			},
			off: (event: string, handler: () => void) => {
				mocks.routerHandlers.get(event)?.delete(handler)
			}
		}
	})
}))

describe('research section engagement', () => {
	let container: HTMLDivElement
	let root: Root
	let now = 1000
	let section: 'report' | 'interview' = 'report'

	function Harness() {
		useResearchSectionEngagement(section)
		return null
	}

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		track.mockReset()
		mocks.routerHandlers.clear()
		section = 'report'
		now = 1000
		vi.spyOn(performance, 'now').mockImplementation(() => now)
		Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
		Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 })
		Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })
		Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await act(async () => root.render(<Harness />))
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.restoreAllMocks()
	})

	test('sends maximum scroll depth and active time once when the page is left', async () => {
		Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 })
		now = 6500

		await act(async () => window.dispatchEvent(new Event('pagehide')))
		for (const handler of mocks.routerHandlers.get('beforeHistoryChange') ?? []) handler()

		expect(track).toHaveBeenCalledOnce()
		expect(track).toHaveBeenCalledWith('research-section-engagement', {
			page_type: 'research',
			section: 'report',
			max_scroll_percent: 50,
			active_seconds: 6
		})
	})

	test('pauses in the back-forward cache and resumes when restored', async () => {
		now = 3000
		const cachedPageHide = new Event('pagehide')
		Object.defineProperty(cachedPageHide, 'persisted', { value: true })
		await act(async () => window.dispatchEvent(cachedPageHide))
		expect(track).not.toHaveBeenCalled()

		now = 5000
		const cachedPageShow = new Event('pageshow')
		Object.defineProperty(cachedPageShow, 'persisted', { value: true })
		await act(async () => window.dispatchEvent(cachedPageShow))

		now = 8000
		await act(async () => window.dispatchEvent(new Event('pagehide')))
		expect(track).toHaveBeenCalledWith('research-section-engagement', {
			page_type: 'research',
			section: 'report',
			max_scroll_percent: 0,
			active_seconds: 5
		})
	})

	test('sends engagement when the router commits a navigation, not when one merely starts', () => {
		now = 5000
		// A started navigation can still be cancelled, so it must not end the visit.
		for (const handler of mocks.routerHandlers.get('routeChangeStart') ?? []) handler()
		expect(track).not.toHaveBeenCalled()
		for (const handler of mocks.routerHandlers.get('beforeHistoryChange') ?? []) handler()
		expect(track).toHaveBeenCalledOnce()
		expect(track).toHaveBeenCalledWith('research-section-engagement', {
			page_type: 'research',
			section: 'report',
			max_scroll_percent: 0,
			active_seconds: 4
		})
	})

	test('tracks engagement for the report section only', async () => {
		await act(async () => window.dispatchEvent(new Event('pagehide')))
		expect(track).toHaveBeenCalledOnce()

		section = 'interview'
		await act(async () => root.render(<Harness />))
		await act(async () => window.dispatchEvent(new Event('pagehide')))

		expect(track.mock.calls.map(([, data]) => data?.section)).toEqual(['report'])
	})
})
