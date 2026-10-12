import { resolveVerifiedApy } from '../data/apy'
import type { ApyWindow, VerifiedBlock } from '../data/types'
import { isVerifiedCurrent } from '../domain/verifiedFreshness'

const WINDOW_LABEL: Record<ApyWindow, string> = { current: 'latest', avg_7d: '7d', avg_30d: '30d' }

export interface MeasuredCardHeader {
	title: 'Verified APY · not included in total' | 'Verified APY' | 'Verified exit'
	/** The stamp of the leg the card reports, with the words that precede it. */
	stamp: string | null
	stampPrefix: string
	stale: boolean
	/** Why the headline carries the protocol's figure instead of a measurement, when it does. */
	reportedNote: string | null
}

/**
 * What the APY cell's card says above its breakdown for a measured pool. `now` is the reader's clock: the card
 * dates its stamp as a live "x ago", and the stale warning ages with that label rather than with the rows.
 */
export function getMeasuredCardHeader({
	verified,
	measured,
	unsubstitutedMeasured,
	window,
	now
}: {
	verified: VerifiedBlock
	measured: boolean
	unsubstitutedMeasured: boolean
	window: ApyWindow
	now: number
}): MeasuredCardHeader {
	const hasReading = verified.apy.avg_1d != null || verified.apy.avg_7d != null || verified.apy.avg_30d != null
	// A reading too old to be the headline still belongs to the APY leg: the card says "Verified APY"
	// and dates THAT reading, so a fresher exit probe can never make a stale APY look current.
	const apyStale = hasReading && !isVerifiedCurrent(verified.apy_as_of, now)
	const reportsApy = measured || unsubstitutedMeasured || hasReading
	// APY and exit are probed separately; date whichever leg the card is reporting.
	const stamp = reportsApy ? verified.apy_as_of : (verified.exit?.as_of ?? verified.apy_as_of)
	const stale = reportsApy ? apyStale : !isVerifiedCurrent(stamp, now)
	const measuredLabel = verified.step_accrual ? 'rate last changed' : 'measured'
	// The headline is the protocol's figure in two cases; each says which reading is missing and why.
	const windowLabel = WINDOW_LABEL[window]
	const pendingWindow =
		!measured && !unsubstitutedMeasured && !apyStale && hasReading && resolveVerifiedApy(verified, window) == null
	const reportedNote = pendingWindow
		? `No ${windowLabel} measurement yet. Showing the protocol's reported ${windowLabel} rate.`
		: hasReading
			? null
			: "Exits are measured, yield is not. Showing the protocol's reported rate."

	return {
		title: unsubstitutedMeasured
			? 'Verified APY · not included in total'
			: hasReading
				? 'Verified APY'
				: 'Verified exit',
		stamp,
		stampPrefix: reportsApy ? (stale ? 'last measured' : measuredLabel) : 'exit measured',
		stale,
		reportedNote
	}
}
