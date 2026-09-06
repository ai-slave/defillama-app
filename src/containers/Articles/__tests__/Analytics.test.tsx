// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useResearchSectionEngagement } from '~/containers/Articles/landing/Analytics'

const mocks = vi.hoisted(() => ({
	trackUmamiEvent: vi.fn(),
	routerHandlers: new Map<string, Set<() => void>>()
}))

vi.mock('~/utils/analytics/umami', () => ({
	trackUmamiEvent: mocks.trackUmamiEvent
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
		mocks.trackUmamiEvent.mockReset()
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

		expect(mocks.trackUmamiEvent).toHaveBeenCalledOnce()
		expect(mocks.trackUmamiEvent).toHaveBeenCalledWith('research-section-engagement', {
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
		expect(mocks.trackUmamiEvent).not.toHaveBeenCalled()

		now = 5000
		const cachedPageShow = new Event('pageshow')
		Object.defineProperty(cachedPageShow, 'persisted', { value: true })
		await act(async () => window.dispatchEvent(cachedPageShow))

		now = 8000
		await act(async () => window.dispatchEvent(new Event('pagehide')))
		expect(mocks.trackUmamiEvent).toHaveBeenCalledWith('research-section-engagement', {
			page_type: 'research',
			section: 'report',
			max_scroll_percent: 0,
			active_seconds: 5
		})
	})

	test('subscribes only to the committed history change, not to routeChangeStart', () => {
		expect([...mocks.routerHandlers.keys()]).toEqual(['beforeHistoryChange'])

		now = 5000
		for (const handler of mocks.routerHandlers.get('beforeHistoryChange') ?? []) handler()
		expect(mocks.trackUmamiEvent).toHaveBeenCalledOnce()
		expect(mocks.trackUmamiEvent).toHaveBeenCalledWith('research-section-engagement', {
			page_type: 'research',
			section: 'report',
			max_scroll_percent: 0,
			active_seconds: 4
		})
	})

	test('does not track engagement for other research sections', async () => {
		section = 'interview'
		await act(async () => root.render(<Harness />))
		await act(async () => window.dispatchEvent(new Event('pagehide')))

		expect(mocks.trackUmamiEvent).not.toHaveBeenCalled()
	})
})
