import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

interface PaginationState {
	hasMore: boolean
	isLoadingMore: boolean
	hasNewer?: boolean
	isLoadingNewer?: boolean
}

interface UseChatScrollParams {
	scrollContainerRef: RefObject<HTMLDivElement | null>
	/** The element whose height is the conversation; following happens when it grows. */
	scrollContentRef: RefObject<HTMLElement | null>
	isStreaming: boolean
	items: ReadonlyArray<unknown>
	hasMessages: boolean
	paginationState: PaginationState
	onLoadMoreMessages: () => void
	onLoadNewerMessages?: () => void
	keyboardOpen?: boolean
	startDetached?: boolean
}

type ScrollMode = 'attached' | 'detached' | 'reattaching'

const bottomDistance = (container: HTMLDivElement) =>
	container.scrollHeight - container.clientHeight - container.scrollTop

const ATTACHED_THRESHOLD_PX = 48
const USER_SCROLL_TOLERANCE_PX = 4
// While attached, an upward move that leaves the viewport within this distance of the bottom is
// layout, not intent. Text that types in per frame turns a partial `---` or `#` line into a heading
// and back, and each such shrink clamps scrollTop by a line or a block; the browser's clamp and a
// scrollbar nudge are indistinguishable in a scroll event, so the distance decides. Wheel, touch and
// keyboard intent are read from their own events and need no distance.
const LAYOUT_SHIFT_TOLERANCE_PX = 120
// A downward gesture (wheel, touch, key, scrollbar) counts as intent to return for this long, which
// covers trackpad inertia and touch momentum after the fingers have left.
const DOWN_INTENT_WINDOW_MS = 2000
// A press this close to the right edge (or beyond the content, on a classic scrollbar) is a grab of
// the scrollbar; while it lasts, every movement is intent, however small.
const SCROLLBAR_ZONE_PX = 20
const TOP_PAGINATION_THRESHOLD_PX = 50
const BOTTOM_PAGINATION_THRESHOLD_PX = 50

// State machine for chat scroll behavior. Three modes control who owns scrollTop:
//
//   attached ──(user scrolls up)──► detached ──(user scrolls down to bottom)──► attached
//      │                               ▲
//      └──(button click)──► reattaching ┘ (user interrupts smooth scroll)
//                               │
//                               └──(scrollend / 800ms timeout)──► attached
//
// Only 'attached' mode auto-follows new content (content resize observer + items effect).
// 'reattaching' is a transient mode for the smooth scroll animation — nothing writes
// scrollTop during it so the browser animation isn't cancelled.
// 'detached' is fully passive — the user has full scroll control.
//
// External callers (session restore, new prompt) use attach() which force-sets
// 'attached' and cancels any pending reattach animation.
export function useChatScroll({
	scrollContainerRef,
	scrollContentRef,
	isStreaming,
	items,
	hasMessages,
	paginationState,
	onLoadMoreMessages,
	onLoadNewerMessages,
	keyboardOpen,
	startDetached = false
}: UseChatScrollParams) {
	const modeRef = useRef<ScrollMode>(startDetached ? 'detached' : 'attached')
	const paginationRef = useRef(paginationState)
	const paginationLoadInFlightRef = useRef(false)
	const newerPaginationLoadInFlightRef = useRef(false)
	const lastScrollTopRef = useRef(0)
	const [isAttached, setIsAttached] = useState(() => !startDetached)
	const [showScrollToBottom, setShowScrollToBottom] = useState(false)
	const reattachCleanupRef = useRef<(() => void) | null>(null)
	const lastAutoScrollTopRef = useRef<number | null>(null)
	// Gesture evidence the scroll handler cannot read from a scroll event alone.
	// downAt starts at -Infinity: a fresh page's clock reads near zero, which must not count as a gesture.
	const intentRef = useRef({ downAt: Number.NEGATIVE_INFINITY, scrollbar: false })

	const syncScrollToBottomVisibility = useCallback((container: HTMLDivElement | null) => {
		if (!container) {
			setShowScrollToBottom(false)
			return
		}

		const distanceFromBottom = container.scrollHeight - container.clientHeight - container.scrollTop
		setShowScrollToBottom(modeRef.current !== 'attached' && distanceFromBottom > ATTACHED_THRESHOLD_PX)
	}, [])

	const setMode = useCallback(
		// Container passed in rather than defaulted from the ref: every caller already has it, and a member
		// expression in a default parameter is one the compiler cannot reorder.
		(mode: ScrollMode, container: HTMLDivElement | null) => {
			modeRef.current = mode
			if (mode === 'attached') lastAutoScrollTopRef.current = null
			setIsAttached(mode === 'attached')
			syncScrollToBottomVisibility(container)
		},
		[syncScrollToBottomVisibility]
	)

	const cancelPendingReattach = useCallback(() => {
		reattachCleanupRef.current?.()
		reattachCleanupRef.current = null
	}, [])

	const attach = useCallback(() => {
		cancelPendingReattach()
		setMode('attached', scrollContainerRef.current)
	}, [cancelPendingReattach, scrollContainerRef, setMode])

	const pinBottom = useCallback((container: HTMLDivElement) => {
		container.scrollTop = container.scrollHeight
		lastAutoScrollTopRef.current = container.scrollTop
		// Its delayed scroll event must not treat this application move as user intent.
		lastScrollTopRef.current = container.scrollTop
	}, [])

	// Opportunistic follow checks preserve unsignaled scrollbar and keyboard intent.
	// Known application layout changes use syncAfterLayout because browser clamping
	// can otherwise look exactly like an upward user scroll.
	const followBottom = useCallback(
		(container: HTMLDivElement) => {
			const lastAutoScrollTop = lastAutoScrollTopRef.current
			if (
				lastAutoScrollTop != null &&
				container.scrollTop < lastAutoScrollTop - USER_SCROLL_TOLERANCE_PX &&
				bottomDistance(container) > LAYOUT_SHIFT_TOLERANCE_PX
			) {
				lastAutoScrollTopRef.current = null
				setMode('detached', container)
				return
			}
			pinBottom(container)
		},
		[pinBottom, setMode]
	)

	const syncAfterLayout = useCallback(() => {
		const container = scrollContainerRef.current
		if (container && modeRef.current === 'attached') pinBottom(container)
	}, [pinBottom, scrollContainerRef])

	const scrollToBottom = useCallback(() => {
		const container = scrollContainerRef.current
		if (!container) return

		cancelPendingReattach()

		setMode('reattaching', container)
		container.scrollTo({
			top: container.scrollHeight,
			behavior: 'smooth'
		})

		let fallbackTimer: ReturnType<typeof setTimeout>
		const settle = () => {
			clearTimeout(fallbackTimer)
			container.removeEventListener('scrollend', settle)
			reattachCleanupRef.current = null
			if (modeRef.current === 'reattaching') {
				setMode('attached', container)
			}
		}

		container.addEventListener('scrollend', settle, { once: true })
		fallbackTimer = setTimeout(settle, 800)
		reattachCleanupRef.current = settle
	}, [cancelPendingReattach, scrollContainerRef, setMode])

	// Cancel any in-flight scrollend listener + timeout on unmount.
	useEffect(() => cancelPendingReattach, [cancelPendingReattach])

	useEffect(() => {
		paginationRef.current = paginationState
		if (!paginationState.isLoadingMore) {
			paginationLoadInFlightRef.current = false
		}
		if (!paginationState.isLoadingNewer) {
			newerPaginationLoadInFlightRef.current = false
		}
	}, [paginationState])

	// When streaming ends, a one-shot check re-attaches if still near the bottom.
	useEffect(() => {
		if (isStreaming) return
		const timer = setTimeout(() => {
			requestAnimationFrame(() => {
				const container = scrollContainerRef.current
				if (!container) return

				const isAtBottom =
					Math.ceil(container.scrollTop + container.clientHeight) >= container.scrollHeight - ATTACHED_THRESHOLD_PX
				if (isAtBottom && modeRef.current !== 'reattaching') {
					setMode('attached', container)
				} else {
					syncScrollToBottomVisibility(container)
				}
			})
		}, 100)
		return () => clearTimeout(timer)
	}, [isStreaming, scrollContainerRef, setMode, syncScrollToBottomVisibility])

	// Content follow: pin the viewport to the bottom in the same frame the conversation changes size,
	// but ONLY in 'attached' mode — 'reattaching' and 'detached' are left alone so smooth-scroll
	// animations and user reading aren't interrupted. A resize observer runs after layout and before
	// paint, so text that types in a few characters per frame carries the viewport with it; a timer
	// here (this used to be a 200ms interval) let the content move first and the viewport catch up
	// as a visible hop.
	// Re-subscribes when streaming starts: the conversation view can mount after this hook's first run.
	useEffect(() => {
		const content = scrollContentRef.current
		if (!content) return
		const resizeObserver = new ResizeObserver(() => {
			const container = scrollContainerRef.current
			if (container && modeRef.current === 'attached') followBottom(container)
		})
		resizeObserver.observe(content)
		return () => resizeObserver.disconnect()
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- isStreaming is a trigger, not an input: the conversation view mounts with the first answer, after this effect first ran against an empty ref.
	}, [followBottom, isStreaming, scrollContainerRef, scrollContentRef])

	// Items effect: when the message list changes (new message added, content updated),
	// snap to bottom in the next frame — but only if already attached. This handles
	// the gap between item renders and the next streaming interval tick.
	useEffect(() => {
		const container = scrollContainerRef.current
		if (modeRef.current === 'attached' && container) {
			requestAnimationFrame(() => {
				const currentContainer = scrollContainerRef.current
				if (currentContainer && modeRef.current === 'attached') {
					followBottom(currentContainer)
				}
			})
		}
	}, [followBottom, items, scrollContainerRef])

	useEffect(() => {
		const container = scrollContainerRef.current
		if (!container) return

		const resizeObserver = new ResizeObserver(() => {
			syncAfterLayout()
			syncScrollToBottomVisibility(container)
			lastScrollTopRef.current = container.scrollTop
		})
		resizeObserver.observe(container)
		return () => resizeObserver.disconnect()
	}, [scrollContainerRef, syncAfterLayout, syncScrollToBottomVisibility])

	// Keyboard open: when the soft keyboard appears and we're attached, snap to bottom
	// so the latest content stays visible above the input.
	useLayoutEffect(() => {
		if (keyboardOpen) syncAfterLayout()
	}, [keyboardOpen, syncAfterLayout])

	// Gesture intent: while content streams, the resize observer rewrites scrollTop (and
	// lastScrollTopRef) between a user's scroll and the scroll event, which erases the upward
	// delta the scroll handler detaches on — the viewport then snaps back and the user cannot
	// scroll up at all. And a scroll event alone cannot tell a small user move from a layout
	// clamp, nor a return to the bottom from browser scroll anchoring. These listeners read the
	// gesture itself: upward intent detaches at once, downward intent is remembered so the scroll
	// handler may re-attach, and a scrollbar grab makes every move intent for as long as it lasts.
	useEffect(() => {
		const container = scrollContainerRef.current
		if (!container) return

		const detachOnUpwardIntent = () => {
			if (modeRef.current === 'attached') setMode('detached', container)
			else if (modeRef.current === 'reattaching') {
				cancelPendingReattach()
				setMode('detached', container)
			}
		}
		const noteDownwardIntent = () => {
			intentRef.current.downAt = performance.now()
		}

		const onWheel = (event: WheelEvent) => {
			if (event.deltaY < 0) detachOnUpwardIntent()
			else if (event.deltaY > 0) noteDownwardIntent()
		}

		// Keys scroll by less than the layout tolerance, so the scroll handler cannot tell them apart
		// from a clamp; read the key itself. Typing in the composer is outside the container.
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target as Node | null
			if (target !== document.body && !container.contains(target)) return
			if (event.key === 'ArrowUp' || event.key === 'PageUp' || event.key === 'Home') detachOnUpwardIntent()
			else if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === 'End' || event.key === ' ') {
				noteDownwardIntent()
			}
		}

		const onPointerDown = (event: PointerEvent) => {
			const rect = container.getBoundingClientRect()
			if (event.clientX - rect.left >= container.clientWidth - SCROLLBAR_ZONE_PX) intentRef.current.scrollbar = true
		}
		// Not on pointercancel: the browser fires it when it takes the pointer over for the scrollbar
		// drag itself, which is the very gesture being tracked. The release ends the grab.
		const onPointerUp = () => {
			intentRef.current.scrollbar = false
		}

		let touchStartY: number | null = null
		const onTouchStart = (event: TouchEvent) => {
			touchStartY = event.touches[0]?.clientY ?? null
		}
		const onTouchMove = (event: TouchEvent) => {
			const currentY = event.touches[0]?.clientY
			if (touchStartY == null || currentY == null) return
			// Dragging the finger downward scrolls the content up.
			if (currentY - touchStartY > 8) detachOnUpwardIntent()
			else if (touchStartY - currentY > 8) noteDownwardIntent()
		}

		container.addEventListener('wheel', onWheel, { passive: true })
		container.addEventListener('touchstart', onTouchStart, { passive: true })
		container.addEventListener('touchmove', onTouchMove, { passive: true })
		container.addEventListener('pointerdown', onPointerDown)
		document.addEventListener('pointerup', onPointerUp)
		document.addEventListener('mouseup', onPointerUp)
		document.addEventListener('keydown', onKeyDown)
		return () => {
			container.removeEventListener('wheel', onWheel)
			container.removeEventListener('touchstart', onTouchStart)
			container.removeEventListener('touchmove', onTouchMove)
			container.removeEventListener('pointerdown', onPointerDown)
			document.removeEventListener('pointerup', onPointerUp)
			document.removeEventListener('mouseup', onPointerUp)
			document.removeEventListener('keydown', onKeyDown)
		}
	}, [cancelPendingReattach, scrollContainerRef, setMode])

	// Scroll event handler: interprets user scroll intent and manages mode transitions.
	//
	// Immediate (pre-rAF) check: detects upward scroll while attached and detaches
	// instantly — no frame delay so the user never feels the viewport fight them. An
	// upward move that stays within the layout tolerance is a clamp from shrinking
	// content and is pinned straight back.
	//
	// rAF-throttled checks handle all other transitions:
	//   reattaching + scrolling up + away from bottom → user interrupted, cancel & detach
	//   attached + moved away from bottom → detach
	//   detached + at bottom + scrolling down → re-attach
	//
	// Also triggers top-of-thread pagination when scrolled near the top. Uses a
	// synchronous in-flight ref to prevent duplicate loads before React state updates.
	useEffect(() => {
		const container = scrollContainerRef.current
		if (!container) return
		lastScrollTopRef.current = container.scrollTop

		let ticking = false
		const onScroll = () => {
			const immediateScrollTop = container.scrollTop
			const immediatePreviousScrollTop = lastScrollTopRef.current
			const isImmediateScrollUp = immediateScrollTop < immediatePreviousScrollTop

			if (isImmediateScrollUp && modeRef.current === 'attached') {
				if (intentRef.current.scrollbar || bottomDistance(container) > LAYOUT_SHIFT_TOLERANCE_PX) {
					setMode('detached', container)
				} else {
					pinBottom(container)
				}
			}

			if (ticking) return
			ticking = true

			requestAnimationFrame(() => {
				const { scrollTop, scrollHeight, clientHeight } = container
				const previousScrollTop = lastScrollTopRef.current
				const isAtBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight - ATTACHED_THRESHOLD_PX
				const isScrollingUp = scrollTop < previousScrollTop
				const hasMoved = scrollTop !== previousScrollTop
				const currentMode = modeRef.current

				const currentPagination = paginationRef.current

				if (currentMode === 'reattaching' && isScrollingUp && !isAtBottom) {
					cancelPendingReattach()
					setMode('detached', container)
				} else if (
					currentMode === 'attached' &&
					hasMoved &&
					(intentRef.current.scrollbar || bottomDistance(container) > LAYOUT_SHIFT_TOLERANCE_PX)
				) {
					setMode('detached', container)
				} else if (
					currentMode === 'detached' &&
					isAtBottom &&
					hasMoved &&
					!isScrollingUp &&
					!currentPagination.hasNewer &&
					// Reaching the bottom re-attaches only when the user moved there. Browser scroll
					// anchoring also moves scrollTop down as content changes, and after one ArrowUp the
					// viewport is still within the threshold, so without this the key was undone.
					(intentRef.current.scrollbar || performance.now() - intentRef.current.downAt < DOWN_INTENT_WINDOW_MS)
				) {
					setMode('attached', container)
				} else {
					syncScrollToBottomVisibility(container)
				}

				lastScrollTopRef.current = scrollTop

				if (
					currentMode === 'detached' &&
					isScrollingUp &&
					scrollTop <= TOP_PAGINATION_THRESHOLD_PX &&
					!isStreaming &&
					currentPagination.hasMore &&
					!currentPagination.isLoadingMore &&
					!paginationLoadInFlightRef.current
				) {
					paginationLoadInFlightRef.current = true
					onLoadMoreMessages()
				}

				const distanceFromBottom = scrollHeight - scrollTop - clientHeight
				if (
					currentMode === 'detached' &&
					!isScrollingUp &&
					distanceFromBottom <= BOTTOM_PAGINATION_THRESHOLD_PX &&
					!isStreaming &&
					currentPagination.hasNewer &&
					!currentPagination.isLoadingNewer &&
					!newerPaginationLoadInFlightRef.current &&
					onLoadNewerMessages
				) {
					newerPaginationLoadInFlightRef.current = true
					onLoadNewerMessages()
				}

				ticking = false
			})
		}

		container.addEventListener('scroll', onScroll, { passive: true })
		return () => {
			container.removeEventListener('scroll', onScroll)
		}
	}, [
		cancelPendingReattach,
		hasMessages,
		isStreaming,
		onLoadMoreMessages,
		onLoadNewerMessages,
		pinBottom,
		scrollContainerRef,
		setMode,
		syncScrollToBottomVisibility
	])

	return {
		attach,
		scrollToBottom,
		syncAfterLayout,
		isAttached,
		showScrollToBottom
	}
}
