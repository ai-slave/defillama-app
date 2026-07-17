import type { EarnPageRow } from './types'

export function redactEarnStability(rows: EarnPageRow[]): EarnPageRow[] {
	return rows.map((row) => ({
		...row,
		stabilityScore: null,
		stabilityRating: null,
		stabilityAvg30d: null
	}))
}
