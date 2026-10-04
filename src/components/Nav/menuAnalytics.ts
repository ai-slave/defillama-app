import type { MouseEvent as ReactMouseEvent } from 'react'
import { readExperimentVariant, trackExperimentAction, trackExperimentExposure } from '~/utils/analytics/experiment'
import { MENU_EXPERIMENT_ID } from './menuVariant'

type Layout = 'desktop' | 'mobile'

function recordExposure(layout: Layout) {
	// Read the same pre-paint attribute that selects the visible menu in CSS; A shows when it is missing.
	const variant = readExperimentVariant(MENU_EXPERIMENT_ID) ?? 'a'
	trackExperimentExposure(MENU_EXPERIMENT_ID, variant, { layout })
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
	trackExperimentAction(MENU_EXPERIMENT_ID, variant, metric, { layout })
}
