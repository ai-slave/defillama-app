import type { TeamSubscription } from './types'

function parseBackendDate(raw: string): Date | null {
	// Backend returns "2026-05-17 08:24:42.000Z" with a space; normalize to ISO.
	const isoLike = raw.includes('T') ? raw : raw.replace(' ', 'T')
	const date = new Date(isoLike)
	return isNaN(date.getTime()) ? null : date
}

export function getCancelAtDate(sub: TeamSubscription): Date | null {
	if (sub.cancelsAt) {
		const parsed = parseBackendDate(sub.cancelsAt)
		if (parsed) return parsed
	}
	if (sub.canceledAtPeriodEnd && typeof sub.effectiveAt === 'number') {
		const fromSeconds = new Date(sub.effectiveAt * 1000)
		if (!isNaN(fromSeconds.getTime())) return fromSeconds
	}
	return null
}

export function isCancelingSub(sub: TeamSubscription): boolean {
	return sub.canceledAtPeriodEnd === true || Boolean(sub.cancelsAt)
}
