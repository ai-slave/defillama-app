// @vitest-environment happy-dom

import { act, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatScroll } from './useChatScroll'

const BOTTOM = 5000
const VIEWPORT = 800

let resizeCallback: ResizeObserverCallback | null = null
let rafQueue: FrameRequestCallback[] = []

function flushFrames() {
	const queued = rafQueue
	rafQueue = []
	for (const cb of queued) cb(0)
}

function Harness({ isStreaming, onReady }: { isStreaming: boolean; onReady: (api: any) => void }) {
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const api = useChatScroll({
		scrollContainerRef,
		isStreaming,
		items: [],
		hasMessages: true,
		paginationState: { hasMore: false, isLoadingMore: false },
		onLoadMoreMessages: () => {}
	})
	onReady(api)
	return <div ref={scrollContainerRef} />
}

describe('useChatScroll lets the user scroll up while content streams in', () => {
	let host: HTMLDivElement
	let root: Root
	let container: HTMLDivElement
	let api: any

	beforeEach(async () => {
		resizeCallback = null
		rafQueue = []
		vi.stubGlobal(
			'ResizeObserver',
			class {
				constructor(cb: ResizeObserverCallback) {
					resizeCallback = cb
				}
				observe() {}
				disconnect() {}
				unobserve() {}
			}
		)
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			rafQueue.push(cb)
			return rafQueue.length
		})
		vi.useFakeTimers()

		host = document.createElement('div')
		document.body.appendChild(host)
		root = createRoot(host)
		await act(async () => {
			root.render(<Harness isStreaming onReady={(next) => (api = next)} />)
		})

		container = host.querySelector('div') as HTMLDivElement
		Object.defineProperty(container, 'scrollHeight', { value: BOTTOM, configurable: true })
		Object.defineProperty(container, 'clientHeight', { value: VIEWPORT, configurable: true })
		container.scrollTop = BOTTOM - VIEWPORT
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		host.remove()
		vi.useRealTimers()
		vi.unstubAllGlobals()
	})

	// The failure users hit: the ResizeObserver fires between the physical scroll and the
	// browser's scroll event, re-pinning scrollTop to the bottom. By the time the scroll
	// handler runs there is no upward delta left to detect, so the viewport never detaches
	// and the user is dragged back down on every attempt.
	// The case gesture-sniffing cannot catch: dragging the scrollbar, PageUp, or momentum
	// scrolling emit no wheel or touch event, so the only evidence the user moved is that
	// scrollTop sits below where auto-follow last put it.
	it('stops following when the user scrolls up with no wheel or touch event at all', async () => {
		await act(async () => {
			vi.advanceTimersByTime(200)
		})
		expect(container.scrollTop).toBe(BOTTOM)

		const scrolledUpTo = 1200
		container.scrollTop = scrolledUpTo
		await act(async () => {
			vi.advanceTimersByTime(200)
		})

		expect(api.isAttached).toBe(false)
		expect(container.scrollTop).toBe(scrolledUpTo)
	})

	it('detaches on wheel-up even when a resize re-pins scrollTop before the scroll event', async () => {
		expect(api.isAttached).toBe(true)

		const scrolledUpTo = 1200
		await act(async () => {
			container.scrollTop = scrolledUpTo
			const wheel = new Event('wheel') as any
			wheel.deltaY = -120
			container.dispatchEvent(wheel)
		})
		// Streaming growth re-pins the viewport and rewrites the reference point.
		await act(async () => {
			container.scrollTop = BOTTOM - VIEWPORT
			resizeCallback?.([], {} as ResizeObserver)
			flushFrames()
		})
		// The scroll event now reports no upward movement at all.
		await act(async () => {
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})

		expect(api.isAttached).toBe(false)

		// Once detached, nothing may write scrollTop again.
		container.scrollTop = scrolledUpTo
		await act(async () => {
			vi.advanceTimersByTime(1000)
			resizeCallback?.([], {} as ResizeObserver)
			flushFrames()
		})

		expect(container.scrollTop).toBe(scrolledUpTo)
	})

	it('keeps following the bottom while the user has not scrolled', async () => {
		container.scrollTop = 0
		await act(async () => {
			vi.advanceTimersByTime(200)
		})

		expect(api.isAttached).toBe(true)
		expect(container.scrollTop).toBe(BOTTOM)
	})

	it('detaches on a downward touch drag, which scrolls content up', async () => {
		await act(async () => {
			const start = new Event('touchstart') as any
			start.touches = [{ clientY: 100 }]
			container.dispatchEvent(start)
			const move = new Event('touchmove') as any
			move.touches = [{ clientY: 160 }]
			container.dispatchEvent(move)
		})

		expect(api.isAttached).toBe(false)
	})
})
