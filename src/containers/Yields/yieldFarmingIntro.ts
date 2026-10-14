import { formatDate } from '~/utils/dateFormat'
import { formatPercent } from '~/utils/numberFormat'
import { YIELD_PERCENT_OPTIONS } from './poolDetail/format'

export const YIELD_FARMING_DEFINITION = 'Yield farming is depositing crypto to earn a high yield.'

type YieldLeadRow = {
	pool: string
	poolMeta: string | null
	stablecoin: boolean | null
	verifiedApy?: number | null
	verifiedLocked?: boolean
}

/** A locked row keeps the reported APY and withholds the measurement, so only `verifiedApy` counts. */
function measuredStablecoinApy(row: YieldLeadRow): number | null {
	if (row.stablecoin !== true || row.verifiedLocked === true) return null
	return typeof row.verifiedApy === 'number' ? row.verifiedApy : null
}

/**
 * Names the highest measured stablecoin APY among the rows on screen.
 * `generatedAtMs` is null while those rows are a placeholder with no fetch time of their own.
 */
export function yieldFarmingIntro(input: { generatedAtMs: number | null; rows: ReadonlyArray<YieldLeadRow> }): string {
	let best: { apy: number; label: string } | null = null
	for (const row of input.rows) {
		const apy = measuredStablecoinApy(row)
		if (apy == null) continue
		if (best != null && apy <= best.apy) continue
		best = { apy, label: row.poolMeta ? `${row.pool} (${row.poolMeta})` : row.pool }
	}
	const apy = best ? formatPercent(best.apy, YIELD_PERCENT_OPTIONS) : null
	if (!best || !apy) return YIELD_FARMING_DEFINITION
	const date = input.generatedAtMs == null ? null : formatDate(input.generatedAtMs, { input: 'milliseconds' })
	const dated = date ? `On ${date}, the` : 'The'
	return `${YIELD_FARMING_DEFINITION} ${dated} highest verified stablecoin APY in this table is ${apy} on ${best.label}.`
}
