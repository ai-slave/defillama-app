// When a verified reading stops being "current". The pipeline measures once a day, so a reading
// that landed today or yesterday (UTC) is current and one missed day is tolerated. Anything older is
// history: it is shown with its age and never substituted into a headline, a sort key or a median.
// Calendar days, not a rolling 48h: a rolling cut-off would flip yesterday's reading to stale at an
// hour that depends on when the probe happened to run.

import { parseDateTimestamp } from '~/utils/dateFormat'

const DAY_MS = 86_400_000

/** Whole UTC days between the reading and `now`; null when the stamp is missing or unreadable. */
export function verifiedAgeDays(asOf: string | null | undefined, now: number): number | null {
	if (!asOf) return null
	const stamp = parseDateTimestamp(asOf)
	if (stamp == null) return null
	return Math.floor(now / DAY_MS) - Math.floor(stamp / DAY_MS)
}

export function isVerifiedCurrent(asOf: string | null | undefined, now: number = Date.now()): boolean {
	const age = verifiedAgeDays(asOf, now)
	return age != null && age <= 1
}
