import { formatDate } from '~/utils/dateFormat'
import { formatCompactNumber, formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import type { EmissionEvent } from './api.types'
import { getEmissionEventAmount } from './eventAmount'

export const UNLOCK_DEFINITION = 'Token unlocks are the scheduled release of vested tokens.'

export function unlockIndexIntro(dateSec: number, amountUsd: number): string {
	const date = formatDate(dateSec, { input: 'seconds' })
	const amount = formatUsd(amountUsd, USD_LOWERCASE_MILLIONS_OPTIONS)
	if (!date || !amount) return UNLOCK_DEFINITION
	return `${UNLOCK_DEFINITION} On ${date} upcoming unlocks over the next 7 days total ${amount}.`
}

/** Null when the next event has no known amount, so the sentence does not invent a release. */
export function nextUnlockIntro(input: { symbol: string | null; event: EmissionEvent | undefined }): string | null {
	if (!input.symbol || !input.event) return null
	const amount = getEmissionEventAmount(input.event)
	const date = formatDate(input.event.timestamp, { input: 'seconds' })
	const formatted = amount == null ? null : formatCompactNumber(amount, { compactSuffix: 'lowercase' })
	if (!date || !formatted) return null
	return `The next ${input.symbol} unlock is ${date}, releasing ${formatted} ${input.symbol}.`
}
