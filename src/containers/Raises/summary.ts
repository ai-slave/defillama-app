import type { Raise } from './model'

export interface RaisesSummary {
	totalUsd: number | null
	undisclosedCount: number
}

export function summarizeRaises(raises: ReadonlyArray<Pick<Raise, 'amountUsd'>>): RaisesSummary {
	let totalUsd = 0
	let undisclosedCount = 0
	for (const raise of raises) {
		if (raise.amountUsd === null) undisclosedCount++
		else totalUsd += raise.amountUsd
	}
	return {
		totalUsd: raises.length > 0 && undisclosedCount === raises.length ? null : totalUsd,
		undisclosedCount
	}
}
