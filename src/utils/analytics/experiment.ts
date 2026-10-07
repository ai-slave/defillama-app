import { AB_GROUP_ATTRIBUTE } from '~/utils/abTesting'
import { trackUmamiEvent, UMAMI_READY_EVENT } from './umami'

/**
 * Deterministic A/B variant assignment using FNV-1a hash.
 * Same (experimentId, userId) always produces the same variant.
 * getHeadBootstrapScript inlines this function with toString() into the pre-paint script, so keep it
 * self-contained: no imports, closures or TypeScript-only runtime helpers.
 */
export function getExperimentVariant(experimentId: string, userId: string): 'A' | 'B' {
	let hash = 2_166_136_261
	const str = `${experimentId}:${userId}`
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i)
		hash = Math.imul(hash, 16_777_619)
	}
	return (hash >>> 0) / 4_294_967_296 < 0.5 ? 'A' : 'B'
}

/** `visitor` and `user` split on their own hash; `site` reuses the global `defillama-ab-group` cohort.
    Ids are part of the analytics contract (experiment.test.ts checks their pattern); never rename a running experiment. */
export const EXPERIMENTS = {
	'free-limit-cta-v1': 'user',
	'llamaai-free-label-v1': 'visitor',
	'home-brief-default-v1': 'visitor',
	'llamaai-signin-offer-v1': 'visitor',
	'menu-layout-v1': 'site',
	'pricing-coverage-v1': 'visitor'
} as const satisfies Record<string, 'visitor' | 'user' | 'site'>

export type ExperimentId = keyof typeof EXPERIMENTS
export type ExperimentVariant = 'a' | 'b'

export const VISITOR_EXPERIMENT_IDS = (Object.keys(EXPERIMENTS) as Array<ExperimentId>).filter(
	(id) => EXPERIMENTS[id] === 'visitor'
)

export function getVariant(experimentId: ExperimentId, unitId: string): ExperimentVariant {
	return getExperimentVariant(experimentId, unitId) === 'A' ? 'a' : 'b'
}

export function getExperimentAttribute(experimentId: ExperimentId): string {
	return EXPERIMENTS[experimentId] === 'site' ? AB_GROUP_ATTRIBUTE : `data-ab-${experimentId}`
}

/** The visitor's arm as the page set it before paint, or null when no assignment was set. */
export function readExperimentVariant(experimentId: ExperimentId): ExperimentVariant | null {
	const variant = document.documentElement.getAttribute(getExperimentAttribute(experimentId))
	return variant === 'a' || variant === 'b' ? variant : null
}

function whenUmamiReady(send: () => void) {
	if (typeof window === 'undefined') return
	if (window.umami) {
		send()
		return
	}
	window.addEventListener(UMAMI_READY_EVENT, send, { once: true })
}

// Stands in for session storage when the browser blocks it, so those sessions still count one exposure.
const exposedWithoutStorage = new Set<ExperimentId>()

/** `context` adds experiment-specific fields, such as the menu's layout, to the event. */
export function trackExperimentExposure(
	experimentId: ExperimentId,
	variant: ExperimentVariant,
	context?: Record<string, string>
): void {
	whenUmamiReady(() => {
		const key = `experiment-exposure:${experimentId}`
		try {
			if (sessionStorage.getItem(key)) return
			sessionStorage.setItem(key, variant)
		} catch {
			if (exposedWithoutStorage.has(experimentId)) return
			exposedWithoutStorage.add(experimentId)
		}
		trackUmamiEvent('experiment-exposure', { experiment: experimentId, variant, ...context })
	})
}

export function trackExperimentAction(
	experimentId: ExperimentId,
	variant: ExperimentVariant,
	metric: string,
	context?: Record<string, string>
): void {
	whenUmamiReady(() => trackUmamiEvent('experiment-action', { experiment: experimentId, variant, metric, ...context }))
}

/** Start each test from a fresh page runtime; production keeps this across route changes. */
export function resetExperimentTracking() {
	exposedWithoutStorage.clear()
}
