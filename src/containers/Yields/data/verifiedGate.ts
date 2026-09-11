import type { PoolDetail, PoolHistory } from '../poolDetail/types'
import type { EarnPageRow } from './types'

// Strip measured data on the way out to a reader without a subscription. `verifiedLocked` is the
// only thing that crosses: enough to render the padlock, not enough to infer a figure.

/**
 * `exitStatus` goes too — it is derived from `verified.exit`, so keeping it would let a locked
 * reader rank pools by a measurement they cannot see. The APY fields need no repair: `getEarnPage`
 * skips `applyMeasuredBase` entirely for a locked request.
 */
export function lockEarnRow(row: EarnPageRow): EarnPageRow {
	// Nulls, not deletions: getStaticProps cannot serialize `undefined`.
	const locked: EarnPageRow = {
		...row,
		verified: null,
		verifiedApy: null,
		reportedApyBase: null,
		verifiedIntrinsicApy: null,
		reportedIntrinsicApy: null,
		verifiedUnsubstitutedApy: null,
		exitStatus: null
	}
	if (row.verified != null) locked.verifiedLocked = true
	return locked
}

export function lockEarnRows(rows: Array<EarnPageRow>): Array<EarnPageRow> {
	return rows.map(lockEarnRow)
}

/** Detail is the only response that serves `verified.methods` — the exact on-chain calls. */
export function lockPoolDetail(detail: PoolDetail, measured = detail.verified != null): PoolDetail {
	return { ...detail, verified: null, verified_locked: measured }
}

export function lockPoolHistory(history: PoolHistory): PoolHistory {
	return history.map((point) => (point.verified == null ? point : { ...point, verified: null }))
}
