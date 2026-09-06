import type { ApiQuery } from '~/server/api/types'
import type { YieldPoolTableRow } from '../Tables/types'
import { activeSplit, apyHeaders, apyValues, windowSuffix } from './csvApy'

function selectedColumns(query: ApiQuery): Set<string> {
	const raw = query.column
	const values = Array.isArray(raw) ? raw : raw ? [raw] : []
	return new Set(values)
}

// Mirrors the earn table: the fixed visible columns, the APY block following the active
// window/composition, and the optional Columns-dropdown columns only when selected.
export function prepareYieldPoolsCsv(rows: Array<YieldPoolTableRow>, query: ApiQuery = {}) {
	const suffix = windowSuffix(query)
	const split = activeSplit(query)
	const columns = selectedColumns(query)

	const headers = [
		'Pool',
		'Reference',
		'Protocol',
		...(columns.has('category') ? ['Category'] : []),
		'Chain',
		...apyHeaders('APY', suffix, split, true),
		'30d Stability Rating',
		'30d Stability Score',
		'TVL',
		'Holders',
		...(columns.has('apyMean30d') ? ['30d Avg APY'] : []),
		...(columns.has('volumeUsd1d') ? ['1d Volume'] : []),
		...(columns.has('pricePerShare') ? ['Price per Share'] : []),
		...(columns.has('top10Pct') ? ['Holders: Top 10 %'] : []),
		...(columns.has('avgPositionUsd') ? ['Holders: Avg Position'] : []),
		'Pool Meta'
	]

	const csvRows: Array<Array<string | number | null | undefined>> = [headers]
	for (const row of rows) {
		const resolved = row.resolvedApy
		csvRows.push([
			row.pool,
			row.referenceAsset ?? null,
			row.project,
			...(columns.has('category') ? [row.category ?? null] : []),
			row.chains?.[0] ?? null,
			...apyValues(row.apy, row.apyBase, row.apyReward, resolved?.intrinsic ?? null, split, true),
			row.stabilityRating,
			row.stabilityScore,
			row.tvl,
			row.holderCount ?? null,
			...(columns.has('apyMean30d') ? [row.apyMean30d ?? null] : []),
			...(columns.has('volumeUsd1d') ? [row.volumeUsd1d ?? null] : []),
			...(columns.has('pricePerShare') ? [row.pricePerShare] : []),
			...(columns.has('top10Pct') ? [row.top10Pct ?? null] : []),
			...(columns.has('avgPositionUsd') ? [row.avgPositionUsd ?? null] : []),
			row.poolMeta ?? null
		])
	}
	return { filename: 'yield-pools.csv', rows: csvRows }
}
