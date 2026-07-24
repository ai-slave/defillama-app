import type { IHackApiItem } from './api.types'

/**
 * App-level hack record. Both `/hacks` and protocol-metrics responses return
 * whole USD amounts, unlike the raises API's million-USD values.
 */
export type Hack = Omit<IHackApiItem, 'amount' | 'returnedFunds'> & {
	amountUsd: number | null
	returnedFundsUsd: number | null
}

/** Keep upstream field names and unit semantics contained at API boundaries. */
export function normalizeHack(hack: IHackApiItem): Hack {
	const { amount, returnedFunds, ...record } = hack
	return { ...record, amountUsd: amount, returnedFundsUsd: returnedFunds }
}
