import type { MouseEvent as ReactMouseEvent } from 'react'
import { AB_GROUP_ATTRIBUTE, type ABGroup } from '~/utils/abTesting'
import { trackUmamiEvent, UMAMI_READY_EVENT } from '~/utils/analytics/umami'
import { MENU_EXPERIMENT_ID } from './menuVariant'

type Layout = 'desktop' | 'mobile'
type MenuEvent = {
	name: 'experiment-exposure' | 'experiment-action'
	data: { experiment: string; variant: ABGroup; layout: Layout; metric?: string }
	exposureKey?: string
}

const seen = new Set<string>()
const pending: Array<MenuEvent> = []

// Read the same pre-paint attribute that selects the visible menu in CSS.
function visibleVariant(): ABGroup {
	return document.documentElement.getAttribute(AB_GROUP_ATTRIBUTE) === 'b' ? 'b' : 'a'
}

function flushPending() {
	if (!window.umami) return
	for (const event of pending.splice(0)) {
		trackUmamiEvent(event.name, event.data)
		if (event.exposureKey) {
			try {
				sessionStorage.setItem(event.exposureKey, '1')
			} catch {
				// The in-memory set still deduplicates when storage is unavailable.
			}
		}
	}
	window.removeEventListener(UMAMI_READY_EVENT, flushPending)
}

function enqueue(event: MenuEvent) {
	pending.push(event)
	if (window.umami) flushPending()
	else window.addEventListener(UMAMI_READY_EVENT, flushPending)
}

function recordExposure(layout: Layout) {
	const variant = visibleVariant()
	const key = `experiment:${MENU_EXPERIMENT_ID}:${variant}:exposure`
	let exposed = seen.has(key)
	try {
		exposed ||= sessionStorage.getItem(key) === '1'
	} catch {
		// Storage is optional; do not block navigation or analytics.
	}
	if (!exposed) {
		seen.add(key)
		enqueue({
			name: 'experiment-exposure',
			data: { experiment: MENU_EXPERIMENT_ID, variant, layout },
			exposureKey: key
		})
	}
	return variant
}

/** A ref owns the observer: hidden desktop nav and a closed mobile drawer do not count as exposures. */
export function observeMenu(node: HTMLElement) {
	if (typeof IntersectionObserver === 'undefined') return
	let visible = false
	const layout = node.dataset.menuLayout as Layout
	const record = () => {
		if (visible && document.visibilityState === 'visible') recordExposure(layout)
	}
	const observer = new IntersectionObserver((entries) => {
		visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0)
		record()
	})
	observer.observe(node)
	document.addEventListener('visibilitychange', record)
	return () => {
		observer.disconnect()
		document.removeEventListener('visibilitychange', record)
	}
}

/** Capture before a mobile link closes its drawer; keyboard clicks and middle-click links count too. */
export function trackMenuClick(event: ReactMouseEvent<HTMLElement>) {
	if (document.visibilityState !== 'visible' || !(event.target instanceof Element)) return
	const item = event.target.closest('a, button, summary')
	if (!item || !event.currentTarget.contains(item) || item.closest('nav') !== event.currentTarget) return
	if (item.matches(':disabled, [aria-disabled="true"]')) return
	if (event.button !== 0 && !(event.button === 1 && item.tagName === 'A')) return
	let metric: string
	if (item.tagName === 'A') {
		const href = item.getAttribute('href')
		if (!href) return
		const url = new URL(href, window.location.origin)
		// Keep shared destinations comparable between variants; omit queries and private dashboard identifiers.
		const destination =
			url.origin === window.location.origin
				? url.pathname.replace(/^\/pro\/.+/, '/pro/:dashboard')
				: `${url.hostname}${url.pathname.replace(/\/$/, '')}`
		metric = `navigate:${destination}`
	} else {
		const name = item.getAttribute('data-menu-name') ?? item.getAttribute('aria-label') ?? item.textContent?.trim()
		if (!name) return
		const slug = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
		metric =
			item.tagName === 'SUMMARY'
				? `group-${item.parentElement?.hasAttribute('open') ? 'close' : 'open'}:${slug}`
				: `action:${slug}`
	}
	const layout = event.currentTarget.dataset.menuLayout as Layout
	const variant = recordExposure(layout)
	enqueue({ name: 'experiment-action', data: { experiment: MENU_EXPERIMENT_ID, variant, metric, layout } })
}

/** Reset the module runtime between tests; production retains it through route changes. */
export function resetMenuAnalytics() {
	seen.clear()
	pending.length = 0
	window.removeEventListener(UMAMI_READY_EVENT, flushPending)
}
