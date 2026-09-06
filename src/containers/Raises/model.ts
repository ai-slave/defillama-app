import type { RaisesApiItem, RaisesApiResponse } from './api.types'

const USD_PER_MILLION = 1_000_000

/** App-level raise record. Monetary values are always whole USD. */
export type Raise = Omit<RaisesApiItem, 'amount' | 'valuation'> & {
	amountUsd: number | null
	valuationUsd: number | null
}

export interface RaisesResponse {
	raises: Array<Raise>
}

function valuationToUsd(value: string | null): number | null {
	if (value === null || value.trim() === '') return null
	const millions = Number(value)
	return Number.isFinite(millions) ? millions * USD_PER_MILLION : null
}

/** Convert the Raises API's million-USD transport fields at the data boundary. */
export function normalizeRaisesApiItem(raise: RaisesApiItem): Raise {
	const { amount, valuation, ...record } = raise
	return {
		...record,
		amountUsd: amount === null ? null : amount * USD_PER_MILLION,
		valuationUsd: valuationToUsd(valuation)
	}
}

export function normalizeRaisesApiResponse(response: RaisesApiResponse): RaisesResponse {
	return { raises: response.raises.map(normalizeRaisesApiItem) }
}
