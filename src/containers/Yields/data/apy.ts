// Pure, window/component-aware APY-composition helpers used by server enrichment. They
// compute the base/reward/intrinsic APY parts, plus the composition-variant fallback used
// for stability and route net_apy.

import type {
	ApyComponent,
	ApyTriple,
	ApyWindow,
	ApyWindows,
	CompositionValues,
	IntrinsicApy,
	ResolvedApy,
	Trend
} from './types'

// Treat literal 0 / floating-point dust as absent so a zero reward/intrinsic
// contribution does not read as a present part.
function presentPart(value: number | null): number | null {
	return value != null && value !== 0 ? value : null
}

export function resolveApy(
	apyWindows: ApyWindows,
	intrinsic: IntrinsicApy | null,
	window: ApyWindow,
	components: Array<ApyComponent>
): ResolvedApy {
	const triple: ApyTriple = apyWindows[window]
	const base = triple.base
	const includeReward = components.includes('reward')
	const reward = includeReward ? presentPart(triple.reward) : null
	const intrinsicPart = components.includes('intrinsic') ? presentPart(intrinsic?.apy[window].base ?? null) : null

	// Prefer the served base+reward total over summing floats ourselves. An unsplit
	// window (no component reported) shows its unattributable total under every toggle.
	const unsplit = triple.base == null && triple.reward == null && triple.total != null
	let total: number | null = null
	if (triple.total != null && (includeReward || unsplit)) {
		total = triple.total
	} else if (base != null) {
		total = base
	}
	if (intrinsicPart != null) {
		total = (total ?? 0) + intrinsicPart
	}

	return { base, reward, intrinsic: intrinsicPart, total }
}

// Composition key shared by every composition-keyed object (stability, route
// net_apy): the parts included in the active view — `base`, `base_reward`,
// `base_intrinsic`, or `base_reward_intrinsic`.
function compositionKey(components: Array<ApyComponent>): keyof CompositionValues {
	const rewardPart = components.includes('reward') ? 'base_reward' : 'base'
	return components.includes('intrinsic') ? `${rewardPart}_intrinsic` : rewardPart
}

// Variant map resolver for stability and route net_apy: the server always emits
// all four composition sets, so this is a direct index by the active composition.
export function resolveVariant<T>(variantMap: Record<keyof CompositionValues, T>, components: Array<ApyComponent>): T {
	return variantMap[compositionKey(components)]
}

// Element-wise collapse of a trend into a single sparkline series: the spine —
// `total` for unsplit pools, else `base` — plus the reward and intrinsic series
// when toggled (an absent series contributes 0). A null in the spine marks a gap
// and stays null.
export function collapseTrend(trend: Trend | null, components: Array<ApyComponent>): Array<number | null> | null {
	if (!trend) return null
	const spine = 'total' in trend ? trend.total : trend.base
	const reward = components.includes('reward') && 'reward' in trend ? (trend.reward ?? null) : null
	const intrinsic = components.includes('intrinsic') ? (trend.intrinsic ?? null) : null

	// A point exists when ANY toggled series reports a value that day (unreported
	// components contribute 0); it is a gap only when every toggled series is null —
	// so a reward-only pool draws its reward line, and its base-only view draws nothing.
	const out: Array<number | null> = new Array(spine.length)
	for (let i = 0; i < spine.length; i++) {
		const primary = spine[i] ?? null
		const rewardPart = reward?.[i] ?? null
		const intrinsicPart = intrinsic?.[i] ?? null
		out[i] =
			primary === null && rewardPart === null && intrinsicPart === null
				? null
				: (primary ?? 0) + (rewardPart ?? 0) + (intrinsicPart ?? 0)
	}
	return out
}

export interface LoopApyInputs {
	loan_to_value: number | null
	supply_apy: ApyWindows
	borrow_cost_apy: ApyWindows
	intrinsic: IntrinsicApy | null
	loop_apy: { loop_count: number | null; total: number | null }
}

// Geometric leverage recompute for the SELECTED APY view (window + components) and an
// arbitrary loop count. The legs are resolved for that view first — the supply leg
// includes intrinsic yield when toggled, the borrow leg never does. The API-precomputed
// `loop_apy.total` is only served for its exact canonical view (current window,
// base+reward components, served loop count); every other view is computed so the number
// tracks the toggles.
export function computeLoopApy(
	row: LoopApyInputs,
	loopCount: number,
	window: ApyWindow,
	components: Array<ApyComponent>
): number | null {
	const isCanonicalView = window === 'current' && components.includes('reward') && !components.includes('intrinsic')
	if (isCanonicalView && loopCount === row.loop_apy.loop_count) {
		return row.loop_apy.total
	}

	const ltv = row.loan_to_value
	if (ltv == null || !(ltv > 0 && ltv < 1)) return null

	const supplyTotal = resolveApy(row.supply_apy, row.intrinsic, window, components).total
	const borrowTotal = resolveApy(row.borrow_cost_apy, null, window, components).total
	if (supplyTotal == null || borrowTotal == null) return null

	const m = (1 - ltv ** (loopCount + 1)) / (1 - ltv)
	return supplyTotal * m - borrowTotal * (m - 1)
}

// Display bucketing for the 0..1 stability score (score = 1 / (1 + cv)): the cut
// points mirror the CV thresholds 0.5 and 2, applied to the rounded 0–100 integer
// the cells display so label and shown score can never contradict.
export function stabilityRatingFromScore(score: number | null): 'stable' | 'mixed' | 'volatile' | null {
	if (score == null) return null
	const displayed = Math.round(score * 100)
	if (displayed >= 67) return 'stable'
	if (displayed >= 33) return 'mixed'
	return 'volatile'
}
