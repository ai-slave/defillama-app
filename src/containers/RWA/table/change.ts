export type RWAValueWithPrior = { current: number | null; prior: number | null }

export const RWA_CHANGE_PERIODS = ['1d', '7d', '1m'] as const
export type RWAChangePeriod = (typeof RWA_CHANGE_PERIODS)[number]
export const RWA_DEFAULT_CHANGE_PERIOD: RWAChangePeriod = '7d'
export const RWA_CHANGE_PERIOD_QUERY_KEY = 'period'
export const RWA_CHANGE_PERIOD_DAYS: Record<RWAChangePeriod, number> = { '1d': 1, '7d': 7, '1m': 30 }

export function parseRwaChangePeriod(query: string | Array<string> | undefined): RWAChangePeriod {
	const value = Array.isArray(query) ? query[0] : query
	return RWA_CHANGE_PERIODS.find((period) => period === value) ?? RWA_DEFAULT_CHANGE_PERIOD
}

export function getRwaChangePeriodQueryValue(period: RWAChangePeriod): string | undefined {
	return period === RWA_DEFAULT_CHANGE_PERIOD ? undefined : period
}

/** Percent change; null without a positive prior. */
export function percentChange(current: number | null | undefined, prior: number | null | undefined): number | null {
	if (current == null || prior == null || prior <= 0) return null
	return ((current - prior) / prior) * 100
}

/** Like for like: a row counts on both sides only when it has a current value and a prior. */
export function sumValuesWithPrior(items: Iterable<RWAValueWithPrior>): RWAValueWithPrior {
	let current: number | null = null
	let prior: number | null = null

	for (const item of items) {
		if (item.current == null || item.prior == null) continue
		current = (current ?? 0) + item.current
		prior = (prior ?? 0) + item.prior
	}

	return { current, prior }
}

/** Both sides or neither. */
export function toValueWithPrior(
	current: number | null | undefined,
	prior: number | null | undefined
): RWAValueWithPrior {
	return current == null || prior == null ? { current: null, prior: null } : { current, prior }
}

export function sumValues(items: Iterable<number | null | undefined>): number | null {
	let total: number | null = null
	for (const item of items) {
		if (item == null) continue
		total = (total ?? 0) + item
	}
	return total
}
