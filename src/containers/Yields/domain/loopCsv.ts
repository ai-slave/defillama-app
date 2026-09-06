import type { ApiQuery } from '~/server/api/types'
import type { LoopTableRow } from '../data/types'
import { activeSplit, apyHeaders, apyValues, windowSuffix } from './csvApy'

export function prepareLoopsCsv(rows: Array<LoopTableRow>, query: ApiQuery = {}) {
	const suffix = windowSuffix(query)
	const split = activeSplit(query)
	const headers = [
		'Token',
		'Protocol',
		'Chain',
		`Looped APY${suffix}`,
		'Leverage',
		// Loop borrow legs never carry intrinsic; the supply leg can.
		...apyHeaders('Supply APY', suffix, split, true),
		...apyHeaders('Borrow APY', suffix, split, false),
		'Available',
		'LTV'
	]
	const csvRows = rows.map((r) => [
		r.pool,
		r.project,
		r.chain,
		r.loopApy,
		r.leverage,
		...apyValues(r.supplyApy, r.supplyApyBase, r.supplyApyReward, r.supplyApyIntrinsic, split, true),
		...apyValues(r.borrowApy, r.borrowApyBase, r.borrowApyReward, null, split, false),
		r.availableBorrowUsd,
		r.ltv
	])
	return { filename: 'yields-looping.csv', rows: [headers, ...csvRows] }
}
