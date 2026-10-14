import { formatDate } from '~/utils/dateFormat'
import { formatPercent } from '~/utils/numberFormat'
import { YIELD_PERCENT_OPTIONS } from './poolDetail/format'

export const YIELD_FARMING_DEFINITION = 'Yield farming is depositing crypto to earn rewards.'

type YieldLeadRow = {
	pool: string
	poolMeta: string | null
	stablecoin: boolean | null
	apy: number | null
	verified?: unknown
	verifiedApy?: number | null
	verifiedLocked?: boolean
}

function isVerifiedStablecoin(row: YieldLeadRow): boolean {
	return row.stablecoin === true && (row.verified != null || row.verifiedApy != null || row.verifiedLocked === true)
}

/**
 * The dated clause uses the highest APY among verified stablecoin rows already loaded for the table.
 * A locked measurement still counts: the row is verified, and `apy` is the figure the table shows.
 */
export function yieldFarmingIntro(input: { generatedAtMs: number; rows: ReadonlyArray<YieldLeadRow> }): string {
	const date = formatDate(input.generatedAtMs, { input: 'milliseconds' })
	let best: { apy: number; label: string } | null = null
	for (const row of input.rows) {
		if (!isVerifiedStablecoin(row) || row.apy == null) continue
		if (best != null && row.apy <= best.apy) continue
		best = { apy: row.apy, label: row.poolMeta ? `${row.pool} (${row.poolMeta})` : row.pool }
	}
	const apy = best ? formatPercent(best.apy, YIELD_PERCENT_OPTIONS) : null
	if (!date || !best || !apy) return YIELD_FARMING_DEFINITION
	return `${YIELD_FARMING_DEFINITION} On ${date}, the highest verified stablecoin APY in this table is ${apy} on ${best.label}.`
}
