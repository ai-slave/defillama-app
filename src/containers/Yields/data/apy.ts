// Pure, window/component-aware APY-composition helpers used by server enrichment. They
// compute the base/reward/intrinsic APY parts, plus the composition-variant fallback used
// for stability and route net_apy.

import { isVerifiedCurrent } from '../domain/verifiedFreshness'
import type {
	ApyComponent,
	ApyTriple,
	ApyWindow,
	ApyWindows,
	CompositionValues,
	IntrinsicApy,
	ResolvedApy,
	Trend,
	VerifiedBlock
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

// 0 is a real measurement and negatives are real losses: never clamp, never treat 0 as absent.
export function resolveVerifiedApy(verified: VerifiedBlock | null | undefined, window: ApyWindow): number | null {
	if (!verified) return null
	if (window === 'avg_7d') return verified.apy.avg_7d
	if (window === 'avg_30d') return verified.apy.avg_30d
	return verified.apy.avg_1d
}

/** A resolved composition after the measured base has been folded in, or refused. */
export interface MeasuredApy extends ResolvedApy {
	/** The measured base now in `base`/`total`, or null when nothing was substituted. */
	measured: number | null
	/** The reported figure for the slot the measurement replaced, kept for disclosure. */
	reported: number | null
	/** The intrinsic source pool's measured base now standing as the intrinsic leg; null when nothing was substituted. */
	intrinsicMeasured: number | null
	/** The reported intrinsic figure that measurement replaced. */
	intrinsicReported: number | null
	/** The reported total before any substitution, for the side-by-side card. */
	reportedTotal: number | null
}

/**
 * Replace the reported base with the measured one and recompose the total. Reward and intrinsic are
 * untouched: `verified.apy` is base yield only, so emissions still ride on top.
 *
 * Substituting rather than showing a second figure keeps the headline, the sort and the APY filters
 * on one number. Refused when there is no measurement for the window, when the reading is no longer
 * current (see `isVerifiedCurrent` — a days-old figure is history, and must not rank the pool), or
 * when an UNSPLIT reported total belongs to a pool that pays rewards — that total may already
 * contain emissions we cannot separate, so dropping a base-only figure in would delete them.
 */
export function applyMeasuredBase(
	resolved: ResolvedApy,
	triple: ApyTriple,
	verified: VerifiedBlock | null | undefined,
	window: ApyWindow,
	hasRewardTokens: boolean,
	now: number
): MeasuredApy {
	const measured = resolveVerifiedApy(verified, window)
	// No base slot in the reported composition — the protocol served one unattributable number.
	const unsplit = resolved.base == null
	if (
		measured == null ||
		!isVerifiedCurrent(verified?.apy_as_of, now) ||
		(unsplit && (hasRewardTokens || triple.reward != null))
	) {
		return {
			...resolved,
			measured: null,
			reported: null,
			intrinsicMeasured: null,
			intrinsicReported: null,
			reportedTotal: resolved.total
		}
	}
	return {
		base: measured,
		reward: resolved.reward,
		intrinsic: resolved.intrinsic,
		total: measured + (resolved.reward ?? 0) + (resolved.intrinsic ?? 0),
		measured,
		reported: unsplit ? resolved.total : resolved.base,
		intrinsicMeasured: null,
		intrinsicReported: null,
		reportedTotal: resolved.total
	}
}

/**
 * The intrinsic leg is another pool's yield: the asset this pool holds. Where that source pool is
 * measured and its reading is current, the measurement stands in for the reported leg, exactly
 * as the base does for the pool's own figure. The leg is additive in every composition, so there
 * is nothing to refuse: the total is recomposed around the swapped part.
 */
export function applyMeasuredIntrinsic(
	resolved: MeasuredApy,
	sourceVerified: VerifiedBlock | null | undefined,
	window: ApyWindow,
	now: number
): MeasuredApy {
	const measured = resolveVerifiedApy(sourceVerified, window)
	// No leg in view (toggle off, or none reported) leaves nothing to substitute into.
	if (resolved.intrinsic == null || measured == null || !isVerifiedCurrent(sourceVerified?.apy_as_of, now)) {
		return resolved
	}
	return {
		...resolved,
		intrinsic: measured,
		total: resolved.total == null ? null : resolved.total - resolved.intrinsic + measured,
		intrinsicMeasured: measured,
		intrinsicReported: resolved.intrinsic
	}
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
