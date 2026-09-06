import type { IYieldTableRow } from '~/containers/Yields/Tables/types'

export interface TokenYieldStats {
	noOfPoolsTracked: number
	averageAPY: number | null
}

export function getTokenYieldStats(rows: Array<IYieldTableRow>): TokenYieldStats {
	let totalApy = 0
	let poolsWithApy = 0

	for (const row of rows) {
		if (row.apy == null || row.apy === 0) continue
		totalApy += row.apy
		poolsWithApy += 1
	}

	return {
		noOfPoolsTracked: rows.length,
		averageAPY: poolsWithApy > 0 ? totalApy / poolsWithApy : null
	}
}
