import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '~/hooks/usePrefersReducedMotion'
import { useStableCallback } from '~/hooks/useStableCallback'
import { type DashboardLayout, findTabForItem } from '../dashboardLayout/buildDashboardLayout'

export const DASHBOARD_ITEM_HASH_PREFIX = '#item='
export const DASHBOARD_ITEM_REVEAL_EVENT = 'pro-dashboard:reveal-item'
const HIGHLIGHT_RING_CLASSES = ['ring-2', 'ring-brand']
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
	// Set by the first reveal of this mount, so a reveal missed before it mounted never overrides one it handled.
	const hasRevealedRef = useRef(false)
	const frameRef = useRef(0)
	// A lookup checks this each frame instead of being canceled on unmount: Strict Mode's rehearsal unmount is
	// followed by a remount that must still finish the reveal, and a real unmount must stop it.
	const mountedRef = useRef(false)
	const handledHashRef = useRef<string | null>(null)
	const highlightedRef = useRef<HTMLElement | null>(null)
	const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const followObserverRef = useRef<ResizeObserver | null>(null)
	const followTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// Called from the hash and reveal-event listeners. The lookup polls frames until the item mounts, so the
	// tab switch needs no commit before it starts; a newer reveal cancels the lookup still in flight.
	const reveal = useStableCallback((itemId: string, options: DashboardItemRevealOptions) => {
		hasRevealedRef.current = true
		const block = options.scroll ?? 'center'
		const tab = findTabForItem(layout, itemId)
		if (tab) setActiveTab(tab.id)
		revealItem?.(itemId)
		onRevealRequest?.(itemId, options)

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
		const lookup = (attempt: number) => {
			if (!mountedRef.current) return
			const element = attempt >= MOUNT_SETTLE_FRAMES ? document.getElementById(dashboardItemElementId(itemId)) : null
			if (!element || element.closest('[hidden]')) {
				if (attempt < MAX_LOOKUP_FRAMES) frameRef.current = requestAnimationFrame(() => lookup(attempt + 1))
				return
			}
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
		cancelAnimationFrame(frameRef.current)
		frameRef.current = requestAnimationFrame(() => lookup(1))
	})

	useEffect(() => {
		if (!enabled) return
		const readHash = () => {
			const hash = window.location.hash
			if (hash === handledHashRef.current) return
			handledHashRef.current = hash
			const itemId = readDashboardItemIdFromHash(hash)
			if (itemId) reveal(itemId, {})
		}
		readHash()
		window.addEventListener('hashchange', readHash)
		return () => window.removeEventListener('hashchange', readHash)
	}, [enabled, reveal])

	useEffect(() => {
		if (!enabled) return
		const readRevealEvent = (event: Event) => {
			const detail = (event as CustomEvent<{ itemId?: string } & DashboardItemRevealOptions>).detail
			if (!detail?.itemId) return
			event.preventDefault()
			reveal(detail.itemId, {
				...(detail.focusTitle === undefined ? {} : { focusTitle: detail.focusTitle }),
				...(detail.scroll === undefined ? {} : { scroll: detail.scroll })
			})
		}
		window.addEventListener(DASHBOARD_ITEM_REVEAL_EVENT, readRevealEvent)
		const missed = takePendingReveal()
		const missedIsFresh = missed !== null && Date.now() - missed.requestedAt < PENDING_REVEAL_TTL_MS
		if (missed && missedIsFresh && !hasRevealedRef.current) reveal(missed.itemId, missed.options)
		return () => window.removeEventListener(DASHBOARD_ITEM_REVEAL_EVENT, readRevealEvent)
	}, [enabled, reveal])

	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
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
