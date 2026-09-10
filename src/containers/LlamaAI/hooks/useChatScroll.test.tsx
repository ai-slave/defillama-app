// @vitest-environment happy-dom

import { act, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useChatScroll } from './useChatScroll'

const BOTTOM = 5000
const VIEWPORT = 800
const items: ReadonlyArray<unknown> = []
const paginationState = { hasMore: false, isLoadingMore: false }
function onLoadMoreMessages() {}

const resizeCallbacks = new Map<Element, ResizeObserverCallback>()
let rafQueue: Array<FrameRequestCallback> = []

function flushFrames() {
	const queued = rafQueue
	rafQueue = []
	for (const cb of queued) cb(0)
}

function Harness({
	isStreaming,
	onReady,
	mounted = true
}: {
	isStreaming: boolean
	onReady: (api: any) => void
	mounted?: boolean
}) {
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const scrollContentRef = useRef<HTMLDivElement>(null)
	const [keyboardOpen, setKeyboardOpen] = useState(false)
	const api = useChatScroll({
		scrollContainerRef,
		scrollContentRef,
		isStreaming,
		items,
		hasMessages: true,
		paginationState,
		onLoadMoreMessages,
		keyboardOpen
	})
	onReady({ ...api, setKeyboardOpen })
	if (!mounted) return null
	return (
		<div ref={api.attachScrollContainer}>
			<div ref={api.attachScrollContent} />
		</div>
	)
}

describe('useChatScroll lets the user scroll up while content streams in', () => {
	let host: HTMLDivElement
	let root: Root
	let container: HTMLDivElement
	let content: HTMLDivElement
	let api: any

	// The conversation grew to scrollHeight `to`; the observer fires after layout, before paint.
	function growContent(to: number) {
		Object.defineProperty(container, 'scrollHeight', { value: to, configurable: true })
		content.getBoundingClientRect = () => ({ height: to }) as DOMRect
		resizeCallbacks.get(content)?.([], {} as ResizeObserver)
	}
	function resizeContainer() {
		resizeCallbacks.get(container)?.([], {} as ResizeObserver)
	}

	beforeEach(async () => {
		resizeCallbacks.clear()
		rafQueue = []
		vi.stubGlobal(
			'ResizeObserver',
			class {
				cb: ResizeObserverCallback
				constructor(cb: ResizeObserverCallback) {
					this.cb = cb
				}
				observe(target: Element) {
					resizeCallbacks.set(target, this.cb)
				}
				disconnect() {}
				unobserve() {}
			}
		)
		vi.useFakeTimers()
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			rafQueue.push(cb)
			return rafQueue.length
		})

		host = document.createElement('div')
		document.body.appendChild(host)
		root = createRoot(host)
		await act(async () => {
			root.render(<Harness isStreaming onReady={(next) => (api = next)} />)
		})

		container = host.querySelector('div') as HTMLDivElement
		content = container.firstElementChild as HTMLDivElement
		Object.defineProperty(container, 'scrollHeight', { value: BOTTOM, configurable: true })
		Object.defineProperty(container, 'clientHeight', { value: VIEWPORT, configurable: true })
		container.scrollTop = BOTTOM - VIEWPORT
		await act(async () => flushFrames())
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		host.remove()
		vi.useRealTimers()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	// The failure users hit: the ResizeObserver fires between the physical scroll and the
	// browser's scroll event, re-pinning scrollTop to the bottom. By the time the scroll
	// handler runs there is no upward delta left to detect, so the viewport never detaches
	// and the user is dragged back down on every attempt.
	// The case gesture-sniffing cannot catch: dragging the scrollbar, PageUp, or momentum
	// scrolling emit no wheel or touch event, so the only evidence the user moved is that
	// scrollTop sits below where auto-follow last put it.
	test('reduced-motion scroll reattaches immediately and keeps following new content', async () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
		const scroll = vi.spyOn(container, 'scrollTo').mockImplementation(() => {})
		container.scrollTop = 1200
		await act(async () => growContent(BOTTOM + 100))
		expect(api.isAttached).toBe(false)
		await act(async () => api.scrollToBottom())
		expect(container.scrollTop).toBe(BOTTOM + 100)
		expect(api.isAttached).toBe(true)
		expect(scroll).not.toHaveBeenCalled()
		await act(async () => growContent(BOTTOM + 200))
		expect(container.scrollTop).toBe(BOTTOM + 200)
	})
	test('normal scroll still waits for smooth scrolling to finish before following', async () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
		const scroll = vi.spyOn(container, 'scrollTo').mockImplementation(() => {})
		container.scrollTop = 1200
		await act(async () => growContent(BOTTOM + 100))
		expect(api.isAttached).toBe(false)
		await act(async () => api.scrollToBottom())
		expect(scroll).toHaveBeenCalledWith({ top: BOTTOM + 100, behavior: 'smooth' })
		expect(api.isAttached).toBe(false)
		await act(async () => growContent(BOTTOM + 200))
		expect(container.scrollTop).toBe(1200)
		await act(async () => container.dispatchEvent(new Event('scrollend')))
		expect(api.isAttached).toBe(true)
		await act(async () => growContent(BOTTOM + 300))
		expect(container.scrollTop).toBe(BOTTOM + 300)
	})

	test.each([false, true])(
		'preserves upward intent after scroll to bottom and completion (reduced motion: %s)',
		async (reducedMotion) => {
			vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: reducedMotion } as MediaQueryList)
			vi.spyOn(container, 'scrollTo').mockImplementation(() => {})
			await act(async () => api.scrollToBottom())
			await act(async () => {
				container.dispatchEvent(new WheelEvent('wheel', { deltaY: -20 }))
				container.scrollTop = BOTTOM - VIEWPORT - 20
				container.dispatchEvent(new Event('scroll'))
				flushFrames()
			})
			await act(async () => root.render(<Harness isStreaming={false} onReady={(next) => (api = next)} />))
			await act(async () => {
				container.dispatchEvent(new Event('scrollend'))
				vi.advanceTimersByTime(900)
				flushFrames()
			})
			expect(api.isAttached).toBe(false)
			await act(async () => growContent(BOTTOM + 200))
			expect(container.scrollTop).toBe(BOTTOM - VIEWPORT - 20)
		}
	)

	test('smooth scroll still reattaches when the browser omits scrollend', async () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
		vi.spyOn(container, 'scrollTo').mockImplementation(() => {})
		await act(async () => api.scrollToBottom())
		await act(async () => vi.advanceTimersByTime(799))
		expect(api.isAttached).toBe(false)
		await act(async () => vi.advanceTimersByTime(1))
		expect(api.isAttached).toBe(true)
		await act(async () => growContent(BOTTOM + 200))
		expect(container.scrollTop).toBe(BOTTOM + 200)
	})

	test('stops following when the user scrolls up with no wheel or touch event at all', async () => {
		await act(async () => growContent(BOTTOM + 100))
		expect(container.scrollTop).toBe(BOTTOM + 100)

		const scrolledUpTo = 1200
		container.scrollTop = scrolledUpTo
		await act(async () => growContent(BOTTOM + 200))

		expect(api.isAttached).toBe(false)
		expect(container.scrollTop).toBe(scrolledUpTo)
	})

	test('keeps wheel-up detachment through later layout updates', async () => {
		expect(api.isAttached).toBe(true)

		const scrolledUpTo = 1200
		await act(async () => {
			container.scrollTop = scrolledUpTo
			const wheel = new Event('wheel') as any
			wheel.deltaY = -120
			container.dispatchEvent(wheel)
		})
		// Application layout updates remain passive after explicit user intent.
		await act(async () => {
			container.scrollTop = BOTTOM - VIEWPORT
			resizeContainer()
			growContent(BOTTOM + 100)
			flushFrames()
		})
		await act(async () => {
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})

		expect(api.isAttached).toBe(false)

		// Once detached, nothing may write scrollTop again.
		container.scrollTop = scrolledUpTo
		await act(async () => {
			vi.advanceTimersByTime(1000)
			resizeContainer()
			growContent(BOTTOM + 200)
			flushFrames()
		})

		expect(container.scrollTop).toBe(scrolledUpTo)
	})

	test('follows the bottom in the frame the content grows, before any timer or scroll event', async () => {
		await act(async () => growContent(6000))

		expect(api.isAttached).toBe(true)
		expect(container.scrollTop).toBe(6000)
	})

	test('pins without detaching when shrinking content clamps the viewport', async () => {
		await act(async () => growContent(6000))
		// The browser clamps scrollTop when the content gets shorter; that is not a user scroll.
		container.scrollTop = 3200
		await act(async () => growContent(4000))

		expect(api.isAttached).toBe(true)
		expect(container.scrollTop).toBe(4000)
	})

	// The regression the browser check caught: a partial `---` line turned a paragraph into a heading
	// and back while text typed in. The shrink clamped scrollTop by one block, the scroll event read
	// as an upward user scroll, and following switched off for the rest of the answer.
	test('stays attached through a small clamp that no observer saw', async () => {
		await act(async () => growContent(6000))
		expect(container.scrollTop).toBe(6000)

		// Content shrank and regrew within one frame: no resize callback, but the clamp already moved
		// scrollTop up by a block and queued a scroll event.
		container.scrollTop = 6000 - VIEWPORT - 40
		await act(async () => {
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})
		expect(api.isAttached).toBe(true)
		expect(container.scrollTop).toBe(6000)

		// The next frame's growth keeps following.
		await act(async () => growContent(6100))
		expect(api.isAttached).toBe(true)
		expect(container.scrollTop).toBe(6100)
	})

	test('detaches on a scrollbar drag larger than a layout shift', async () => {
		await act(async () => growContent(6000))
		container.scrollTop = 6000 - VIEWPORT - 400
		await act(async () => {
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})
		expect(api.isAttached).toBe(false)
		expect(container.scrollTop).toBe(6000 - VIEWPORT - 400)
	})

	test('detaches on an upward key even though the key scrolls less than a layout shift', async () => {
		await act(async () => growContent(6000))
		await act(async () => {
			const key = new Event('keydown', { bubbles: true }) as any
			key.key = 'ArrowUp'
			container.dispatchEvent(key)
		})
		expect(api.isAttached).toBe(false)
	})

	test('stays attached when a known layout change clamps the viewport', async () => {
		await act(async () => growContent(BOTTOM + 100))
		await act(async () => {
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})
		Object.defineProperty(container, 'scrollHeight', { value: 4000, configurable: true })
		container.scrollTop = 3200
		await act(async () => api.syncAfterLayout())
		await act(async () => {
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})

		expect(api.isAttached).toBe(true)
		expect(container.scrollTop).toBe(4000)
	})

	test('keeps following when content grows before the automatic scroll event arrives', async () => {
		await act(async () => growContent(BOTTOM + 100))
		Object.defineProperty(container, 'scrollHeight', { value: 7000, configurable: true })
		await act(async () => {
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})
		expect(api.isAttached).toBe(true)
		await act(async () => growContent(7000))
		expect(container.scrollTop).toBe(7000)
	})

	test('keeps the container resize observer attached after a layout clamp', async () => {
		await act(async () => growContent(BOTTOM + 100))
		Object.defineProperty(container, 'scrollHeight', { value: 4000, configurable: true })
		container.scrollTop = 3200
		await act(async () => resizeContainer())

		expect(api.isAttached).toBe(true)
		expect(container.scrollTop).toBe(4000)
	})

	test('does not follow a layout change after the user detaches', async () => {
		await act(async () => {
			const wheel = new Event('wheel') as any
			wheel.deltaY = -120
			container.dispatchEvent(wheel)
		})
		container.scrollTop = 1200
		await act(async () => api.syncAfterLayout())

		expect(api.isAttached).toBe(false)
		expect(container.scrollTop).toBe(1200)
	})

	test('only offers scroll to bottom when content remains below the viewport', async () => {
		container.scrollTop = BOTTOM - VIEWPORT
		await act(async () => {
			const wheel = new Event('wheel') as any
			wheel.deltaY = -120
			container.dispatchEvent(wheel)
		})
		expect(api.isAttached).toBe(false)
		expect(api.showScrollToBottom).toBe(false)

		container.scrollTop -= 200
		await act(async () => {
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})
		expect(api.showScrollToBottom).toBe(true)

		container.scrollTop = BOTTOM - VIEWPORT
		await act(async () => {
			const wheel = new Event('wheel') as any
			wheel.deltaY = 120
			container.dispatchEvent(wheel)
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})
		expect(api.isAttached).toBe(true)
		expect(api.showScrollToBottom).toBe(false)
	})

	// After one ArrowUp the viewport is still within the attach threshold. Browser scroll anchoring
	// then nudged scrollTop down as content changed, and that read as "the user came back".
	test('does not re-attach when scroll anchoring moves a detached viewport down', async () => {
		await act(async () => growContent(6000))
		await act(async () => {
			const key = new Event('keydown', { bubbles: true }) as any
			key.key = 'ArrowUp'
			container.dispatchEvent(key)
		})
		container.scrollTop = 6000 - VIEWPORT - 40
		await act(async () => {
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})
		expect(api.isAttached).toBe(false)

		container.scrollTop = 6000 - VIEWPORT - 20
		await act(async () => {
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})
		expect(api.isAttached).toBe(false)

		// A downward key is intent, and the same movement re-attaches.
		await act(async () => {
			const key = new Event('keydown', { bubbles: true }) as any
			key.key = 'ArrowDown'
			container.dispatchEvent(key)
		})
		container.scrollTop = 6000 - VIEWPORT
		await act(async () => {
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})
		expect(api.isAttached).toBe(true)
	})

	test('a small scrollbar drag detaches because the grab itself is intent', async () => {
		await act(async () => growContent(6000))
		container.getBoundingClientRect = () => ({ left: 0 }) as DOMRect
		Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true })
		await act(async () => {
			const press = new Event('pointerdown') as any
			press.clientX = 595
			container.dispatchEvent(press)
		})
		container.scrollTop = 6000 - VIEWPORT - 30
		await act(async () => {
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})
		expect(api.isAttached).toBe(false)
		expect(container.scrollTop).toBe(6000 - VIEWPORT - 30)

		// Dragging back down while still holding the thumb re-attaches.
		container.scrollTop = 6000 - VIEWPORT
		await act(async () => {
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})
		expect(api.isAttached).toBe(true)
		await act(async () => document.dispatchEvent(new Event('pointerup')))
	})

	test('stays attached when the keyboard opens after a layout clamp', async () => {
		await act(async () => growContent(BOTTOM + 100))
		Object.defineProperty(container, 'scrollHeight', { value: 4000, configurable: true })
		container.scrollTop = 3200
		await act(async () => api.setKeyboardOpen(true))

		expect(api.isAttached).toBe(true)
		expect(container.scrollTop).toBe(4000)
	})

	test('does not move the viewport when the keyboard opens while detached', async () => {
		await act(async () => {
			const wheel = new Event('wheel') as any
			wheel.deltaY = -120
			container.dispatchEvent(wheel)
		})
		container.scrollTop = 1200
		await act(async () => api.setKeyboardOpen(true))

		expect(api.isAttached).toBe(false)
		expect(container.scrollTop).toBe(1200)
	})

	// The landing page has no scroll container; the conversation mounts on the first answer. Listeners
	// bound only on the hook's first run never saw it, so small upward scrolls read as layout clamps
	// and snapped back.
	test('binds its gesture listeners to a container that mounts later', async () => {
		await act(async () => root.unmount())
		host.remove()
		host = document.createElement('div')
		document.body.appendChild(host)
		root = createRoot(host)
		let lateApi: any
		await act(async () => {
			root.render(<Harness isStreaming mounted={false} onReady={(next) => (lateApi = next)} />)
		})
		expect(host.querySelector('div')).toBeNull()

		await act(async () => {
			root.render(<Harness isStreaming mounted onReady={(next) => (lateApi = next)} />)
		})
		const late = host.querySelector('div') as HTMLDivElement
		Object.defineProperty(late, 'scrollHeight', { value: BOTTOM, configurable: true })
		Object.defineProperty(late, 'clientHeight', { value: VIEWPORT, configurable: true })
		late.scrollTop = BOTTOM - VIEWPORT
		await act(async () => flushFrames())
		expect(lateApi.isAttached).toBe(true)

		// A small wheel-up: with listeners bound this is intent; without them it was a clamp to undo.
		late.scrollTop -= 30
		await act(async () => {
			const wheel = new Event('wheel') as any
			wheel.deltaY = -30
			late.dispatchEvent(wheel)
			late.dispatchEvent(new Event('scroll'))
			flushFrames()
		})
		expect(lateApi.isAttached).toBe(false)
		expect(late.scrollTop).toBe(BOTTOM - VIEWPORT - 30)
	})

	test('detaches on a downward touch drag, which scrolls content up', async () => {
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
	test('keeps explicit detachment when streaming finishes near the bottom', async () => {
		await act(async () => {
			container.dispatchEvent(new WheelEvent('wheel', { deltaY: -20 }))
			container.scrollTop = BOTTOM - VIEWPORT - 20
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})
		expect(api.isAttached).toBe(false)
		await act(async () => root.render(<Harness isStreaming={false} onReady={(next) => (api = next)} />))
		await act(async () => {
			vi.advanceTimersByTime(100)
			flushFrames()
		})
		expect(api.isAttached).toBe(false)
		await act(async () => growContent(BOTTOM + 200))
		expect(container.scrollTop).toBe(BOTTOM - VIEWPORT - 20)
	})

	test('keeps following final layout changes when completion was attached', async () => {
		await act(async () => root.render(<Harness isStreaming={false} onReady={(next) => (api = next)} />))
		await act(async () => {
			vi.advanceTimersByTime(100)
			flushFrames()
		})
		expect(api.isAttached).toBe(true)
		await act(async () => growContent(BOTTOM + 200))
		expect(container.scrollTop).toBe(BOTTOM + 200)
	})

	test('detaches when a touch reverses before crossing its starting point', async () => {
		await act(async () => {
			const start = new Event('touchstart') as any
			start.touches = [{ clientY: 200 }]
			container.dispatchEvent(start)
			for (const y of [100, 140]) {
				const move = new Event('touchmove') as any
				move.touches = [{ clientY: y }]
				container.dispatchEvent(move)
			}
		})
		expect(api.isAttached).toBe(false)
	})

	test('accumulates slow touch movement without detaching on a downward scroll', async () => {
		await act(async () => {
			const start = new Event('touchstart') as any
			start.touches = [{ clientY: 200 }]
			container.dispatchEvent(start)
			for (const y of [196, 192, 188]) {
				const move = new Event('touchmove') as any
				move.touches = [{ clientY: y }]
				container.dispatchEvent(move)
			}
		})
		expect(api.isAttached).toBe(true)
		await act(async () => {
			for (const y of [192, 196, 200]) {
				const move = new Event('touchmove') as any
				move.touches = [{ clientY: y }]
				container.dispatchEvent(move)
			}
		})
		expect(api.isAttached).toBe(false)
	})
	test('upward intent cancels earlier downward intent before a layout shift', async () => {
		await act(async () => {
			container.dispatchEvent(new WheelEvent('wheel', { deltaY: 30 }))
			container.dispatchEvent(new WheelEvent('wheel', { deltaY: -20 }))
			container.scrollTop = BOTTOM - VIEWPORT - 20
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})
		await act(async () => {
			container.scrollTop += 10
			container.dispatchEvent(new Event('scroll'))
			flushFrames()
		})
		expect(api.isAttached).toBe(false)
	})
})
