import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '~/hooks/usePrefersReducedMotion'
import { type DashboardLayout, findTabForItem } from '../dashboardLayout/buildDashboardLayout'

export const DASHBOARD_ITEM_HASH_PREFIX = '#item='
export const DASHBOARD_ITEM_REVEAL_EVENT = 'pro-dashboard:reveal-item'
const HIGHLIGHT_RING_CLASSES = ['ring-2', 'ring-pro-accent']
const HIGHLIGHT_TRANSITION_CLASSES = ['transition-shadow', 'duration-260', 'ease-out-quart']
const HIGHLIGHT_DURATION_MS = 2000
const HIGHLIGHT_FADE_MS = 300
const FOLLOW_LAYOUT_SHIFT_MS = 6000
const MOUNT_SETTLE_FRAMES = 2
const MAX_LOOKUP_FRAMES = 30
const PENDING_REVEAL_TTL_MS = 5000

export function dashboardItemHash(itemId: string): string {
	return `${DASHBOARD_ITEM_HASH_PREFIX}${itemId}`
}

export function dashboardItemElementId(itemId: string): string {
	return `item-${itemId}`
}

export function readDashboardItemIdFromHash(hash: string): string | null {
	if (!hash.startsWith(DASHBOARD_ITEM_HASH_PREFIX)) return null
	const encoded = hash.slice(DASHBOARD_ITEM_HASH_PREFIX.length)
	if (encoded.length === 0) return null
	try {
		return decodeURIComponent(encoded)
	} catch {
		return encoded
	}
}

export interface DashboardItemRevealOptions {
	focusTitle?: boolean
	scroll?: 'center' | 'nearest'
}

let pendingReveal: { itemId: string; options: DashboardItemRevealOptions; requestedAt: number } | null = null

function takePendingReveal() {
	const request = pendingReveal
	pendingReveal = null
	return request
}

export function requestDashboardItemReveal(itemId: string, options: DashboardItemRevealOptions = {}) {
	if (typeof window === 'undefined') return
	const event = new CustomEvent(DASHBOARD_ITEM_REVEAL_EVENT, { detail: { itemId, ...options }, cancelable: true })
	const unhandled = window.dispatchEvent(event)
	pendingReveal = unhandled ? { itemId, options, requestedAt: Date.now() } : null
}

interface UseDashboardItemDeepLinkOptions {
	layout: DashboardLayout
	setActiveTab: (tabId: string) => void
	enabled: boolean
	revealItem?: (itemId: string) => void
	onRevealRequest?: (itemId: string, options: DashboardItemRevealOptions) => void
}

export function useDashboardItemDeepLink({
	layout,
	setActiveTab,
	enabled,
	revealItem,
	onRevealRequest
}: UseDashboardItemDeepLinkOptions) {
	const requestCounterRef = useRef(0)
	const revealItemRef = useRef(revealItem)
	const onRevealRequestRef = useRef(onRevealRequest)
	const layoutRef = useRef(layout)
	const setActiveTabRef = useRef(setActiveTab)
	const consumedRequestRef = useRef(0)
	const handledHashRef = useRef<string | null>(null)
	const highlightedRef = useRef<HTMLElement | null>(null)
	const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const followObserverRef = useRef<ResizeObserver | null>(null)
	const followTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [pendingRequest, setPendingRequest] = useState<{
		itemId: string
		token: number
		options: DashboardItemRevealOptions
	} | null>(null)

	useEffect(() => {
		revealItemRef.current = revealItem
		onRevealRequestRef.current = onRevealRequest
		layoutRef.current = layout
		setActiveTabRef.current = setActiveTab
	})

	useEffect(() => {
		if (!enabled) return
		const readHash = () => {
			const hash = window.location.hash
			if (hash === handledHashRef.current) return
			handledHashRef.current = hash
			const itemId = readDashboardItemIdFromHash(hash)
			if (!itemId) return
			requestCounterRef.current += 1
			setPendingRequest({ itemId, token: requestCounterRef.current, options: {} })
		}
		readHash()
		window.addEventListener('hashchange', readHash)
		return () => window.removeEventListener('hashchange', readHash)
	}, [enabled])

	useEffect(() => {
		if (!enabled) return
		const queueReveal = (itemId: string, options: DashboardItemRevealOptions) => {
			requestCounterRef.current += 1
			setPendingRequest({ itemId, token: requestCounterRef.current, options })
		}
		const readRevealEvent = (event: Event) => {
			const detail = (event as CustomEvent<{ itemId?: string } & DashboardItemRevealOptions>).detail
			if (!detail?.itemId) return
			event.preventDefault()
			queueReveal(detail.itemId, {
				...(detail.focusTitle === undefined ? {} : { focusTitle: detail.focusTitle }),
				...(detail.scroll === undefined ? {} : { scroll: detail.scroll })
			})
		}
		window.addEventListener(DASHBOARD_ITEM_REVEAL_EVENT, readRevealEvent)
		const missed = takePendingReveal()
		const missedIsFresh = missed !== null && Date.now() - missed.requestedAt < PENDING_REVEAL_TTL_MS
		if (missed && missedIsFresh && requestCounterRef.current === 0) queueReveal(missed.itemId, missed.options)
		return () => window.removeEventListener(DASHBOARD_ITEM_REVEAL_EVENT, readRevealEvent)
	}, [enabled])

	useEffect(() => {
		if (!enabled || !pendingRequest || consumedRequestRef.current === pendingRequest.token) return
		const { itemId, token, options } = pendingRequest
		const block = options.scroll ?? 'center'
		const tab = findTabForItem(layoutRef.current, itemId)
		if (tab) setActiveTabRef.current(tab.id)
		revealItemRef.current?.(itemId)
		onRevealRequestRef.current?.(itemId, options)

		const releaseHighlighted = () => {
			const element = highlightedRef.current
			highlightedRef.current = null
			if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
			highlightTimeoutRef.current = null
			return element
		}
		const fadeOutHighlight = () => {
			const element = releaseHighlighted()
			if (!element) return
			element.classList.remove(...HIGHLIGHT_RING_CLASSES)
			delete element.dataset.arrived
			if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
			fadeTimeoutRef.current = setTimeout(() => {
				element.classList.remove(...HIGHLIGHT_TRANSITION_CLASSES)
				fadeTimeoutRef.current = null
			}, HIGHLIGHT_FADE_MS)
		}
		const stopFollowing = () => {
			followObserverRef.current?.disconnect()
			followObserverRef.current = null
			if (followTimeoutRef.current) clearTimeout(followTimeoutRef.current)
			followTimeoutRef.current = null
		}
		const followLayoutShifts = (element: HTMLElement) => {
			stopFollowing()
			if (typeof ResizeObserver === 'undefined') return
			const observer = new ResizeObserver(() => {
				const rect = element.getBoundingClientRect()
				if (rect.top < 0 || rect.bottom > window.innerHeight) element.scrollIntoView({ block })
			})
			observer.observe(document.body)
			followObserverRef.current = observer
			followTimeoutRef.current = setTimeout(stopFollowing, FOLLOW_LAYOUT_SHIFT_MS)
		}
		let frame = 0
		const lookup = (attempt: number) => {
			const element = attempt >= MOUNT_SETTLE_FRAMES ? document.getElementById(dashboardItemElementId(itemId)) : null
			if (!element || element.closest('[hidden]')) {
				if (attempt < MAX_LOOKUP_FRAMES) frame = requestAnimationFrame(() => lookup(attempt + 1))
				return
			}
			consumedRequestRef.current = token
			element.scrollIntoView({ block, ...(prefersReducedMotion() ? {} : { behavior: 'smooth' }) })
			followLayoutShifts(element)
			const previous = releaseHighlighted()
			if (previous && previous !== element) {
				previous.classList.remove(...HIGHLIGHT_RING_CLASSES, ...HIGHLIGHT_TRANSITION_CLASSES)
				delete previous.dataset.arrived
			}
			if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
			fadeTimeoutRef.current = null
			element.classList.add(...HIGHLIGHT_TRANSITION_CLASSES, ...HIGHLIGHT_RING_CLASSES)
			element.dataset.arrived = 'true'
			highlightedRef.current = element
			highlightTimeoutRef.current = setTimeout(fadeOutHighlight, HIGHLIGHT_DURATION_MS)
		}
		frame = requestAnimationFrame(() => lookup(1))
		return () => cancelAnimationFrame(frame)
	}, [enabled, pendingRequest])

	useEffect(() => {
		return () => {
			const element = highlightedRef.current
			if (element) {
				element.classList.remove(...HIGHLIGHT_RING_CLASSES, ...HIGHLIGHT_TRANSITION_CLASSES)
				delete element.dataset.arrived
			}
			highlightedRef.current = null
			if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
			if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
			followObserverRef.current?.disconnect()
			if (followTimeoutRef.current) clearTimeout(followTimeoutRef.current)
		}
	}, [])
}
