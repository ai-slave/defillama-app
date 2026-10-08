import { formatCompactNumber, formatRatio, formatUsd } from '~/utils/numberFormat'
import type { RWAValueWithPrior } from '../table/change'

const USD_FORMAT = { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' } as const
const COUNT_FORMAT = { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' } as const

/** Missing is a gap, never $0. */
export function formatRwaKpiUsd(value: number | null): string {
	return value == null ? 'N/A' : formatUsd(value, USD_FORMAT)
}

export function formatRwaKpiCount(value: number): string {
	return formatCompactNumber(value, COUNT_FORMAT)
}

/**
 * A multiple, "2x": how many times the open book turned over (one decimal), or a leverage cap (two, since some venues
 * send a ratio like 3.0003000300030003).
 */
export function formatRwaMultiple(value: number | null | undefined, maximumFractionDigits: 1 | 2): string | null {
	const formatted = formatRatio(value, { maximumFractionDigits })
	return formatted == null ? null : `${formatted}x`
}

/** Share of the total that has a prior; the change covers that share. */
export function getRwaChangeCoverage(total: number | null, change: RWAValueWithPrior): number | null {
	if (total == null || total <= 0 || change.current == null) return null
	return Math.min(change.current / total, 1)
}
