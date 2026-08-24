import type { EmissionEvent, KnownEmissionEvent, UnknownEmissionEvent } from './api.types'

const SECONDS_PER_WEEK = 7 * 24 * 60 * 60

export function isUnknownEmissionEvent(event: EmissionEvent): event is UnknownEmissionEvent {
	return 'hasUnknownTokenAmount' in event
}

export function isKnownEmissionEvent(event: EmissionEvent): event is KnownEmissionEvent {
	return !isUnknownEmissionEvent(event)
}

/**
 * Cliff events carry a one-time token amount. Linear events carry the previous
 * and new weekly rates, so their display amount is the new weekly rate.
 */
export function getEmissionEventAmount(event: EmissionEvent): number | null {
	if (isUnknownEmissionEvent(event)) return null
	return event.unlockType === 'cliff' ? event.noOfTokens[0] : event.noOfTokens[1]
}

export function getCliffEmissionAmount(event: EmissionEvent): number | null {
	if (isUnknownEmissionEvent(event) || event.unlockType !== 'cliff') return null
	return event.noOfTokens[0]
}

export function getLinearEmissionWeeklyRate(event: EmissionEvent): number | null {
	if (isUnknownEmissionEvent(event) || event.unlockType !== 'linear') return null
	return event.noOfTokens[1]
}

export function getLinearEmissionRateDelta(event: EmissionEvent): number | null {
	if (isUnknownEmissionEvent(event) || event.unlockType !== 'linear') return null
	return event.noOfTokens[1] - event.noOfTokens[0]
}

/** Return the tokens released by one event during a half-open time interval. */
export function getEmissionAmountOverInterval(
	event: EmissionEvent,
	startTimestampSec: number,
	endTimestampSec: number
): number | null {
	if (endTimestampSec <= startTimestampSec) return 0

	if (event.unlockType === 'cliff') {
		if (event.timestamp < startTimestampSec || event.timestamp >= endTimestampSec) return 0
		return isUnknownEmissionEvent(event) ? null : event.noOfTokens[0]
	}

	const eventEndTimestampSec = event.timestamp + event.rateDurationDays * 24 * 60 * 60
	const overlapStartTimestampSec = Math.max(event.timestamp, startTimestampSec)
	const overlapEndTimestampSec = Math.min(eventEndTimestampSec, endTimestampSec)
	if (overlapEndTimestampSec <= overlapStartTimestampSec) return 0
	if (isUnknownEmissionEvent(event)) return null

	return (event.noOfTokens[1] * (overlapEndTimestampSec - overlapStartTimestampSec)) / SECONDS_PER_WEEK
}
