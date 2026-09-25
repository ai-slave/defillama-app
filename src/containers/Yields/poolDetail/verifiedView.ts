import type { VerifiedBlock } from '../data/types'
import { stripVerifiedSeries } from './poolCharts'
import type { PoolVerifiedProps } from './verifiedProps'

/** Whether the page must treat its measured sections as withheld and look to the paid fetch. */
export function isPoolVerifiedLocked(
	verifiedLocked: boolean | null | undefined,
	isDenied: boolean,
	verifiedFromProps: VerifiedBlock | null
): boolean {
	return verifiedLocked === null || verifiedLocked === true || (isDenied && verifiedFromProps != null)
}

export type PoolVerifiedNotice = 'offer' | 'unavailable' | null

/**
 * Chooses the measured sections a reader sees: the page's seeded props while they are still
 * entitled, otherwise the paid fetch, and which notice stands in when neither has a measurement.
 */
export function resolvePoolVerifiedView({
	access,
	verifiedLocked,
	locked,
	paid,
	paidLoading,
	fromProps
}: {
	access: { hasAccess: boolean; isDenied: boolean }
	verifiedLocked: boolean | null | undefined
	locked: boolean
	paid: PoolVerifiedProps
	paidLoading: boolean
	fromProps: PoolVerifiedProps
}): PoolVerifiedProps & { notice: PoolVerifiedNotice } {
	// A subscriber's page carries its measured props; they stand only while the reader is still
	// entitled, as the table's seed does, so a lapsed or ended session drops them without a reload.
	const seeded = !access.isDenied
	const verified = (seeded ? fromProps.verified : null) ?? paid.verified

	// The measured rebuild defaults its TVL label, which depends on protocol meta only the page
	// resolves. The page's own chart holds the right one, so it is carried across.
	let supplyChart = fromProps.supplyChart
	if (paid.supplyChart) {
		const label = fromProps.supplyChart?.lines.find((line) => line.unit === 'usd')?.label
		supplyChart =
			label == null
				? paid.supplyChart
				: {
						...paid.supplyChart,
						lines: paid.supplyChart.lines.map((line) => (line.unit === 'usd' ? { ...line, label } : line))
					}
	} else if (!seeded && fromProps.supplyChart) {
		// Once access has ended (a logout in another tab), the chart shows what the public build
		// would: the reported bars without the verified base.
		supplyChart = stripVerifiedSeries(fromProps.supplyChart)
	}

	// Anonymous SSR keeps its offer; an unavailable server check must wait for a client verdict.
	let notice: PoolVerifiedNotice = null
	if (verified == null && !paidLoading) {
		if (locked && !access.hasAccess && (verifiedLocked !== null || access.isDenied)) notice = 'offer'
		else if (verifiedLocked === null && !access.isDenied) notice = 'unavailable'
	}

	return {
		verified,
		verifiedWindows: seeded && fromProps.verifiedWindows.length > 0 ? fromProps.verifiedWindows : paid.verifiedWindows,
		growthChart: (seeded ? fromProps.growthChart : null) ?? paid.growthChart,
		intrinsicSeries: (seeded ? fromProps.intrinsicSeries : null) ?? paid.intrinsicSeries,
		liquidityChart: (seeded ? fromProps.liquidityChart : null) ?? paid.liquidityChart,
		liquidityDecimals: (seeded ? fromProps.liquidityDecimals : null) ?? paid.liquidityDecimals,
		exitReliability: (seeded ? fromProps.exitReliability : null) ?? paid.exitReliability,
		apy: (seeded ? fromProps.apy : null) ?? paid.apy,
		supplyChart,
		notice
	}
}
