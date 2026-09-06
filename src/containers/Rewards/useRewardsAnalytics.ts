import type { Row } from '@tanstack/react-table'
import { useEffect, useRef } from 'react'
import { trackUmamiEvent, UMAMI_READY_EVENT } from '~/utils/analytics/umami'
import type { RewardProgram, RewardsAnalyticsMode } from './types'

interface LinkExposure {
	data: { program_id: string; project_path: string | null }
	visible: boolean
	timer: ReturnType<typeof setTimeout> | null
}

interface RewardsAnalyticsState {
	seen: Set<string>
	pending: Array<{ name: string; data: LinkExposure['data']; impressionKey: string | null }>
}

/** One observer per table page. The Open button, not an off-screen part of its row, owns exposure. */
export function observeRewardsLinks(
	container: HTMLDivElement,
	mode: RewardsAnalyticsMode,
	state: RewardsAnalyticsState
) {
	if (
		mode === 'off' ||
		(mode === 'production' &&
			window.location.hostname !== 'defillama.com' &&
			window.location.hostname !== 'www.defillama.com')
	) {
		return () => {}
	}
	const prefix = mode === 'test' ? 'rewards-test' : 'rewards'
	const targets = new Map<HTMLAnchorElement, LinkExposure>()
	for (const button of container.querySelectorAll<HTMLAnchorElement>('a[data-reward-program-id]')) {
		const programId = button.dataset.rewardProgramId
		if (!programId) continue
		targets.set(button, {
			data: { program_id: programId, project_path: button.dataset.rewardProjectPath ?? null },
			visible: false,
			timer: null
		})
	}

	function flushEvents() {
		if (!window.umami) return
		for (const event of state.pending) {
			trackUmamiEvent(event.name, event.data)
			if (event.impressionKey !== null) {
				try {
					window.sessionStorage.setItem(event.impressionKey, '1')
				} catch {
					// Storage can be unavailable or full; the feature degrades silently.
				}
			}
		}
		state.pending.length = 0
	}
	function recordImpression(exposure: LinkExposure) {
		const key = `${prefix}:impression:${exposure.data.program_id}`
		if (state.seen.has(key)) return
		// Storage can be disabled by the browser. The in-memory set still deduplicates this page visit.
		try {
			if (window.sessionStorage.getItem(key)) {
				state.seen.add(key)
				return
			}
		} catch {
			// See above: storage can be disabled.
		}
		state.seen.add(key)
		state.pending.push({ name: `${prefix}-program-impression`, data: exposure.data, impressionKey: key })
		flushEvents()
	}

	function cancelDwell(exposure: LinkExposure) {
		if (exposure.timer !== null) clearTimeout(exposure.timer)
		exposure.timer = null
	}
	function startDwell(exposure: LinkExposure) {
		cancelDwell(exposure)
		if (state.seen.has(`${prefix}:impression:${exposure.data.program_id}`)) return
		if (!exposure.visible || document.visibilityState !== 'visible') return
		exposure.timer = setTimeout(() => {
			exposure.timer = null
			if (exposure.visible && document.visibilityState === 'visible') recordImpression(exposure)
		}, 1000)
	}
	function onVisibilityChange() {
		for (const exposure of targets.values()) startDwell(exposure)
	}
	function onClick(event: MouseEvent) {
		if (event.defaultPrevented || document.visibilityState !== 'visible') return
		if (event.type === 'click' ? event.button !== 0 : event.button !== 1) return
		if (!(event.target instanceof Element)) return
		const button = event.target.closest<HTMLAnchorElement>('a[data-reward-program-id]')
		const exposure = button ? targets.get(button) : undefined
		if (!exposure) return
		cancelDwell(exposure)
		recordImpression(exposure)
		// Retain raw repeat clicks. A later ranking must compute compatible unique-click/exposure metrics.
		state.pending.push({ name: `${prefix}-outbound-click`, data: exposure.data, impressionKey: null })
		flushEvents()
	}

	let observer: IntersectionObserver | null = null
	if (typeof IntersectionObserver !== 'undefined') {
		observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!(entry.target instanceof HTMLAnchorElement)) continue
					const exposure = targets.get(entry.target)
					if (!exposure) continue
					exposure.visible = entry.isIntersecting && entry.intersectionRatio >= 0.5
					startDwell(exposure)
				}
			},
			{ threshold: 0.5 }
		)
		for (const button of targets.keys()) observer.observe(button)
	}
	// Observe before the lazy script loads; readiness flushes events without a polling deadline.
	window.addEventListener(UMAMI_READY_EVENT, flushEvents)
	flushEvents()
	container.addEventListener('click', onClick)
	container.addEventListener('auxclick', onClick)
	document.addEventListener('visibilitychange', onVisibilityChange)
	return () => {
		observer?.disconnect()
		window.removeEventListener(UMAMI_READY_EVENT, flushEvents)
		for (const exposure of targets.values()) cancelDwell(exposure)
		container.removeEventListener('click', onClick)
		container.removeEventListener('auxclick', onClick)
		document.removeEventListener('visibilitychange', onVisibilityChange)
	}
}

export function useRewardsAnalytics(mode: RewardsAnalyticsMode, rows: Array<Row<RewardProgram>>) {
	const containerRef = useRef<HTMLDivElement>(null)
	const analytics = useRef<RewardsAnalyticsState | null>(null)
	useEffect(() => {
		if (!containerRef.current) return
		analytics.current ??= { seen: new Set<string>(), pending: [] }
		return observeRewardsLinks(containerRef.current, mode, analytics.current)
	}, [mode, rows])
	return containerRef
}
