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

/**
 * Cliffs at the same timestamp are one lump sum. A linear event's amount is tokens per week,
 * so it is not described as released that day. An unknown amount stays out of both totals.
 */
export function nextUnlockIntro(input: { symbol: string | null; events: ReadonlyArray<EmissionEvent> }): string | null {
	const { symbol, events } = input
	if (!symbol || events.length === 0) return null
	const date = formatDate(events[0].timestamp, { input: 'seconds' })
	if (!date) return null

	let cliffTotal = 0
	let cliffKnown = false
	let weeklyTotal = 0
	let linearKnown = false
	let unknown = false
	for (const event of events) {
		const amount = getEmissionEventAmount(event)
		if (amount == null) {
			unknown = true
			continue
		}
		if (event.unlockType === 'cliff') {
			cliffTotal += amount
			cliffKnown = true
		} else {
			weeklyTotal += amount
			linearKnown = true
		}
	}
	if (!cliffKnown && !linearKnown) return null

	const cliff = cliffKnown ? formatCompactNumber(cliffTotal, { compactSuffix: 'lowercase' }) : null
	const weekly = linearKnown ? formatCompactNumber(weeklyTotal, { compactSuffix: 'lowercase' }) : null
	if (cliffKnown && !cliff) return null
	if (linearKnown && !weekly) return null

	const release =
		cliff && weekly
			? `releasing ${cliff} ${symbol} on that date and ${weekly} ${symbol} per week`
			: cliff
				? `releasing ${cliff} ${symbol}`
				: `releasing ${weekly} ${symbol} per week`
	const caveat = unknown ? ' Some of the amount is not published.' : ''
	return `The next ${symbol} unlock is ${date}, ${release}.${caveat}`
}
