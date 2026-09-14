import { formatUsd } from '~/utils/numberFormat'
import type { RWAValueWithPrior } from '../table/change'

const USD_FORMAT = { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' } as const

/** Missing is a gap, never $0. */
export function formatRwaKpiUsd(value: number | null): string {
	return value == null ? 'N/A' : formatUsd(value, USD_FORMAT)
}

/** Share of the total that has a prior; the change covers that share. */
export function getRwaChangeCoverage(total: number | null, change: RWAValueWithPrior): number | null {
	if (total == null || total <= 0 || change.current == null) return null
	return Math.min(change.current / total, 1)
}
