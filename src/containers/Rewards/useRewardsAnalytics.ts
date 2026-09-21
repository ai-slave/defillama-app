import type { Row } from '@tanstack/react-table'
import { useEffect, useRef } from 'react'
import { REWARDS_EXPERIMENT_ID, type ABGroup } from '~/utils/abTesting'
import { discardPendingRewardsEvents, REWARDS_EVENTS, trackRewardsEvent } from '~/utils/analytics/rewards'
import { trackUmamiEvent, UMAMI_READY_EVENT } from '~/utils/analytics/umami'
import type { tableFeaturesConfig } from './index'
import type { RewardProgram } from './types'

interface LinkExposure {
	data: Record<string, string | null>
	visible: boolean
	timer: ReturnType<typeof setTimeout> | null
}

interface RewardsAnalyticsState {
	seen: Set<string>
	pending: Array<{ name: string; data: LinkExposure['data']; impressionKey: string | null }>
}

function cancelDwell(exposure: LinkExposure) {
	if (exposure.timer !== null) clearTimeout(exposure.timer)
	exposure.timer = null
}

/** One observer tracks referral links: featured-card footers and table Open buttons. */
export function observeRewardsLinks(container: HTMLDivElement, state: RewardsAnalyticsState) {
	const prefix = 'rewards'
	const variant = container.dataset.rewardsVariant as ABGroup
	const experiment = { experiment: REWARDS_EXPERIMENT_ID, variant }
	const sessionKey = `${prefix}:${REWARDS_EXPERIMENT_ID}:${variant}`
	const targets = new Map<HTMLAnchorElement, LinkExposure>()
	for (const button of container.querySelectorAll<HTMLAnchorElement>('a[data-reward-program-id]')) {
		const programId = button.dataset.rewardProgramId
		if (!programId) continue
		targets.set(button, {
			data: {
				program_id: programId,
				project_path: button.dataset.rewardProjectPath ?? null,
				...experiment,
				placement: button.dataset.rewardPlacement!
			},
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
	function recordOnce(name: string, data: LinkExposure['data'], key: string) {
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
		state.pending.push({ name, data, impressionKey: key })
		flushEvents()
	}

	function impressionKey(exposure: LinkExposure) {
		return `${sessionKey}:impression:${exposure.data.placement}:${exposure.data.program_id}`
	}
	function recordImpression(exposure: LinkExposure) {
		recordOnce(`${prefix}-program-impression`, exposure.data, impressionKey(exposure))
	}
	function recordPageExposure() {
		if (document.visibilityState === 'visible') {
			recordOnce(`${prefix}-experiment-exposure`, experiment, `${sessionKey}:exposure`)
		}
	}

	function startDwell(exposure: LinkExposure) {
		cancelDwell(exposure)
		if (state.seen.has(impressionKey(exposure))) return
		if (!exposure.visible || document.visibilityState !== 'visible') return
		exposure.timer = setTimeout(() => {
			exposure.timer = null
			if (exposure.visible && document.visibilityState === 'visible') recordImpression(exposure)
		}, 1000)
	}
	function onVisibilityChange() {
		recordPageExposure()
		for (const exposure of targets.values()) startDwell(exposure)
	}
	function onClick(event: MouseEvent) {
		if (event.defaultPrevented || document.visibilityState !== 'visible') return
		if (event.type === 'click' ? event.button !== 0 : event.button !== 1) return
		if (!(event.target instanceof Element)) return
		const protocolLink = event.target.closest<HTMLAnchorElement>('a[data-reward-protocol-id]')
		if (protocolLink) {
			trackRewardsEvent(REWARDS_EVENTS.PROTOCOL_CLICK, {
				variant,
				program_id: protocolLink.dataset.rewardProtocolId!,
				project_path: protocolLink.dataset.rewardProjectPath ?? null
			})
			return
		}
		if (event.target.closest('a[data-reward-submit]')) {
			trackRewardsEvent(REWARDS_EVENTS.SUBMIT_CLICK, { variant })
			return
		}
		const button = event.target.closest<HTMLAnchorElement>('a[data-reward-program-id]')
		const exposure = button ? targets.get(button) : undefined
		if (!exposure) return
		cancelDwell(exposure)
		recordImpression(exposure)
		recordPageExposure()
		recordOnce(
			`${prefix}-experiment-conversion`,
			{ ...experiment, placement: exposure.data.placement },
			`${sessionKey}:conversion`
		)
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
	recordPageExposure()
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

export function useRewardsAnalytics(
	assignment: ABGroup | null,
	rows: Array<Row<typeof tableFeaturesConfig, RewardProgram>>,
	cards: Array<RewardProgram>
) {
	const containerRef = useRef<HTMLDivElement>(null)
	const analytics = useRef<RewardsAnalyticsState | null>(null)
	// Mount-scoped on purpose: the observer effect below re-runs on every filter change, which is exactly when
	// interaction events are queued, so its cleanup must not discard them.
	useEffect(() => discardPendingRewardsEvents, [])
	useEffect(() => {
		if (!containerRef.current || assignment === null) return
		if (!analytics.current) analytics.current = { seen: new Set<string>(), pending: [] }
		return observeRewardsLinks(containerRef.current, analytics.current)
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- rows is the trigger: new rows render new links, which have to be observed.
	}, [assignment, rows, cards])
	return containerRef
}
