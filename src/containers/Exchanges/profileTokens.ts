/**
 * One venue's markets rolled up per token, across every segment it trades.
 *
 * The per-segment tables answer "what does this venue's spot book look like"; this
 * answers "what can I do with SOL here", which is the question someone lands on an
 * exchange page with. A token's spot and perp markets are different instruments, so
 * they stay in separate columns rather than being summed into one liquidity figure.
 */
import type {
	ExchangeMarketExecution,
	ExchangePairModel,
	ExchangeProfileModel,
	ExchangeSegment,
	ExchangeSegmentExecution
} from './models'

/** Segments carrying a normalized-volume band. COIN perps have neither, by design. */
const NVOL_SEGMENTS: ReadonlyArray<ExchangeSegment> = ['spot', 'linear_perp']
const PERP_SEGMENTS: ReadonlyArray<ExchangeSegment> = ['linear_perp', 'inverse_perp']

export interface ExchangeTokenRow {
	token: string
	geckoId: string | null
	/** Segments this venue trades the token in, for the row's segment chips. */
	segments: Array<ExchangeSegment>
	marketCount: number
	/** Highest leverage offered on any of the token's perp markets here. Null for a
	 *  spot-only token: leverage is a property of the perp, not of the asset. */
	maxLeverage: number | null
	spotActiveLiquidity: number | null
	perpActiveLiquidity: number | null
	spotNormalizedVolume: number | null
	perpNormalizedVolume: number | null
	/** True when any market in the group had no book and contributed reported volume. */
	spotVolumeIsReported: boolean
	perpVolumeIsReported: boolean
	perpOpenInterestUsd: number | null
	/** Measured fills for this token per segment, its markets there merged into one. */
	executionBySegment: Partial<Record<ExchangeSegment, ExchangeSegmentExecution>>
}

/**
 * A token's markets in one segment as one (BTC/USDT with BTC/USDC): each figure is the
 * mean of the markets that have it, weighted by the notional measured on each, so a
 * market counts for what trades there; the intra-spread share is pooled over the notional
 * it was measured on instead. Mirrors upstream mergeMarketExecution. Null when none of
 * them is measured.
 */
export function mergeMarketExecution(token: string, pairs: Array<ExchangePairModel>): ExchangeSegmentExecution | null {
	const measured = pairs.flatMap((pair) => (pair.execution && pair.execution.notionalUsd > 0 ? [pair.execution] : []))
	if (measured.length === 0) return null
	const mean = (
		pick: (execution: ExchangeMarketExecution) => number | null,
		weigh: (execution: ExchangeMarketExecution) => number = (execution) => execution.notionalUsd
	) => {
		let weight = 0
		let total = 0
		for (const execution of measured) {
			const value = pick(execution)
			if (value == null || !(weigh(execution) > 0)) continue
			weight += weigh(execution)
			total += value * weigh(execution)
		}
		return weight > 0 ? total / weight : null
	}
	return {
		assets: [token],
		hoursCovered: Math.max(...measured.map((execution) => execution.hoursCovered)),
		costToTradeBps: mean((execution) => execution.costToTradeBps),
		effectiveSpreadBps: mean((execution) => execution.effectiveSpreadBps),
		realizedSlippage10kBps: mean((execution) => execution.realizedSlippage10kBps),
		predictedSlippage10kBps: mean((execution) => execution.predictedSlippage10kBps),
		realizedSlippage100kBps: mean((execution) => execution.realizedSlippage100kBps),
		predictedSlippage100kBps: mean((execution) => execution.predictedSlippage100kBps),
		markout1mBps: mean((execution) => execution.markout1mBps),
		markout5mBps: mean((execution) => execution.markout5mBps),
		insideSpreadPct: mean(
			(execution) => execution.insideSpreadPct,
			(execution) => execution.insideMeasuredUsd
		)
	}
}

function sum(values: Array<number | null | undefined>): number | null {
	let total = 0
	let seen = false
	for (const value of values) {
		if (value == null) continue
		total += value
		seen = true
	}
	return seen ? total : null
}

/**
 * Normalized volume across a group of markets, falling back per market to reported
 * volume where that market has no book to normalize against.
 *
 * Per market rather than per group: summing only the markets that have a normalized
 * figure would understate the token, and dropping to reported for the whole group when
 * one market lacks depth would overstate it. The flag says whether any market fell
 * back, which is what the reader needs to know about the number.
 */
function normalizedVolume(pairs: Array<ExchangePairModel>): { value: number | null; reported: boolean } {
	let reported = false
	const values = pairs.map((pair) => {
		const normalized = pair.normalizedVolume?.normalized
		if (normalized != null) return normalized
		reported = true
		return pair.volume24h
	})
	return { value: sum(values), reported }
}

/** Uppercase ticker; markets are keyed by base asset, which is how a reader thinks of
 *  a token regardless of what it is quoted in. */
const tokenKey = (pair: ExchangePairModel) => pair.base.toUpperCase()

export function exchangeTokenRows(profile: ExchangeProfileModel): Array<ExchangeTokenRow> {
	const bySegment = new Map<ExchangeSegment, Map<string, Array<ExchangePairModel>>>()
	const order: Array<string> = []
	const seen = new Set<string>()
	const geckoIds = new Map<string, string>()

	for (const segment of Object.keys(profile.segments) as Array<ExchangeSegment>) {
		const pairs = profile.segments[segment]?.pairs ?? []
		const grouped = new Map<string, Array<ExchangePairModel>>()
		for (const pair of pairs) {
			const token = tokenKey(pair)
			if (!token) continue
			const bucket = grouped.get(token)
			if (bucket) bucket.push(pair)
			else grouped.set(token, [pair])
			if (!seen.has(token)) {
				seen.add(token)
				order.push(token)
			}
			if (pair.baseGeckoId && !geckoIds.has(token)) geckoIds.set(token, pair.baseGeckoId)
		}
		bySegment.set(segment, grouped)
	}

	const rows = order.map((token) => {
		const inSegment = (segments: ReadonlyArray<ExchangeSegment>) =>
			segments.flatMap((segment) => bySegment.get(segment)?.get(token) ?? [])
		const spotPairs = inSegment(['spot'])
		const linearPairs = inSegment(['linear_perp'])
		const perpPairs = inSegment(PERP_SEGMENTS)
		const spotVolume = normalizedVolume(spotPairs)
		const perpVolume = normalizedVolume(linearPairs)
		const spotExecution = mergeMarketExecution(token, spotPairs)
		const perpExecution = mergeMarketExecution(token, linearPairs)
		let maxLeverage: number | null = null
		for (const pair of perpPairs) {
			if (pair.maxLeverage != null) maxLeverage = Math.max(maxLeverage ?? 0, pair.maxLeverage)
		}

		return {
			token,
			geckoId: geckoIds.get(token) ?? null,
			segments: (Object.keys(profile.segments) as Array<ExchangeSegment>).filter(
				(segment) => (bySegment.get(segment)?.get(token)?.length ?? 0) > 0
			),
			marketCount: inSegment(NVOL_SEGMENTS).length + inSegment(['inverse_perp']).length,
			maxLeverage,
			// Active liquidity needs a band, which exists for spot and USD perps only.
			spotActiveLiquidity: sum(spotPairs.map((pair) => pair.normalizedVolume?.activeLiquidity)),
			perpActiveLiquidity: sum(linearPairs.map((pair) => pair.normalizedVolume?.activeLiquidity)),
			spotNormalizedVolume: spotVolume.value,
			perpNormalizedVolume: perpVolume.value,
			spotVolumeIsReported: spotPairs.length > 0 && spotVolume.reported,
			perpVolumeIsReported: linearPairs.length > 0 && perpVolume.reported,
			// Both perpetual classes are USD-denominated, so their open interest adds up.
			perpOpenInterestUsd: sum(perpPairs.map((pair) => pair.openInterestUsd)),
			executionBySegment: {
				...(spotExecution ? { spot: spotExecution } : null),
				...(perpExecution ? { linear_perp: perpExecution } : null)
			}
		}
	})

	// Busiest token first: the venue's own ranking of what it is used for.
	return rows.sort(
		(a, b) =>
			(b.spotNormalizedVolume ?? 0) +
			(b.perpNormalizedVolume ?? 0) -
			((a.spotNormalizedVolume ?? 0) + (a.perpNormalizedVolume ?? 0))
	)
}
