import type { ApiQuery } from '~/server/api/types'
import type { MarketTableRow, RouteTableRow } from '../data/types'
import { activeSplit, apyHeaders, apyValues, windowSuffix } from './csvApy'

// CSV columns mirror the on-screen view: filters/sort come from the fetched rows, the APY
// columns follow the active window (header suffix) and composition (split columns before
// each total when reward/intrinsic are enabled).

export function prepareBorrowMarketsCsv(rows: Array<MarketTableRow>, query: ApiQuery = {}) {
	const suffix = windowSuffix(query)
	const split = activeSplit(query)
	const headers = [
		'Market',
		'Protocol',
		'Chain',
		...apyHeaders('Supply APY', suffix, split, true),
		...apyHeaders('Borrow APY', suffix, split, true),
		'Available',
		'Borrowed',
		'LTV'
	]
	const csvRows = rows.map((r) => [
		r.pool,
		r.project,
		r.chain,
		...apyValues(r.supplyApy, r.supplyApyBase, r.supplyApyReward, r.supplyApyIntrinsic, split, true),
		...apyValues(r.borrowApy, r.borrowApyBase, r.borrowApyReward, r.borrowApyIntrinsic, split, true),
		r.availableBorrowUsd,
		r.totalBorrowUsd,
		r.ltv
	])
	return { filename: 'yields-borrow-markets.csv', rows: [headers, ...csvRows] }
}

export function prepareBorrowRoutesCsv(rows: Array<RouteTableRow>, query: ApiQuery = {}) {
	const suffix = windowSuffix(query)
	const split = activeSplit(query)
	const headers = [
		'Collateral / Borrow',
		'Protocol',
		'Chain',
		`Net APY${suffix}`,
		...apyHeaders('Supply APY', suffix, split, true),
		...apyHeaders('Borrow APY', suffix, split, true),
		'Available',
		'LTV'
	]
	const csvRows = rows.map((r) => [
		r.pool,
		r.project,
		r.chain,
		r.netApy,
		...apyValues(r.supplyApy, r.supplyApyBase, r.supplyApyReward, r.supplyApyIntrinsic, split, true),
		...apyValues(r.borrowApy, r.borrowApyBase, r.borrowApyReward, r.borrowApyIntrinsic, split, true),
		r.availableBorrowUsd,
		r.ltv
	])
	return { filename: 'yields-borrow-routes.csv', rows: [headers, ...csvRows] }
}
