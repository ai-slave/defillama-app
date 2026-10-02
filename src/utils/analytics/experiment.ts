import { trackUmamiEvent, UMAMI_READY_EVENT } from './umami'

/**
 * Deterministic A/B variant assignment using FNV-1a hash.
 * Same (experimentId, userId) always produces the same variant.
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

export const EXPERIMENTS = {
	'free-limit-cta-v1': 'user',
	'llamaai-free-label-v1': 'visitor',
	'home-brief-default-v1': 'visitor',
	'llamaai-signin-offer-v1': 'visitor'
} as const satisfies Record<string, 'visitor' | 'user'>

export type ExperimentId = keyof typeof EXPERIMENTS
export type ExperimentVariant = 'a' | 'b'

export const VISITOR_EXPERIMENT_IDS = (Object.keys(EXPERIMENTS) as Array<ExperimentId>).filter(
	(id) => EXPERIMENTS[id] === 'visitor'
)

export function getVariant(experimentId: ExperimentId, unitId: string): ExperimentVariant {
	return getExperimentVariant(experimentId, unitId) === 'A' ? 'a' : 'b'
}

export function getExperimentAttribute(experimentId: ExperimentId): string {
	return `data-ab-${experimentId}`
}

/** The visitor's arm as the head script set it before paint, or null when no A/B seed was set. */
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

export function trackExperimentExposure(experimentId: ExperimentId, variant: ExperimentVariant): void {
	whenUmamiReady(() => {
		const key = `experiment-exposure:${experimentId}`
		try {
			if (sessionStorage.getItem(key)) return
			sessionStorage.setItem(key, variant)
		} catch {
			return
		}
		trackUmamiEvent('experiment-exposure', { experiment: experimentId, variant })
	})
}

export function trackExperimentAction(experimentId: ExperimentId, variant: ExperimentVariant, metric: string): void {
	whenUmamiReady(() => trackUmamiEvent('experiment-action', { experiment: experimentId, variant, metric }))
}
