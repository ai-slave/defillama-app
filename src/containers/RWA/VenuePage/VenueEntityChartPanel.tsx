import { useMemo } from 'react'
import { mergeFailedReads } from '~/utils/query'
import { RWAEntityChartPanel, useRwaEntityChartSelection } from '../platformChart/EntityChartPanel'
import type { RWAPlatformMeta } from '../PlatformPage/api.types'
import { useRwaPerpsTotal } from './usePerpsTotal'
import { buildRwaVenueEntityChart, RWA_VENUE_CHART } from './venueChart'

/**
 * The venue's Information chart: one series per metric, Open Interest first; there is no funding series until the
 * server folds it per venue.
 */
export function RWAVenueEntityChartPanel({
	venue,
	venueSlug,
	milestones
}: {
	venue: string
	venueSlug: string
	milestones: RWAPlatformMeta['milestones']
}) {
	const { selected, period } = useRwaEntityChartSelection(RWA_VENUE_CHART)
	const wantsVolume = selected.includes('volume') || selected.includes('cumulativeVolume')
	const wantsShare = selected.includes('oiShare')
	const scope = { kind: 'venue', slug: venue } as const
	const openInterest = useRwaPerpsTotal(scope, 'openInterest', selected.includes('openInterest') || wantsShare)
	const volume = useRwaPerpsTotal(scope, 'volume', wantsVolume)
	const markets = useRwaPerpsTotal(scope, 'markets', selected.includes('markets'))
	// All RWA perps open interest, the total /rwa/perps draws, for Share of RWA Perps OI.
	const totalOpenInterest = useRwaPerpsTotal({ kind: 'all' }, 'openInterest', wantsShare)

	const chart = useMemo(
		() => ({
			...buildRwaVenueEntityChart(selected, {
				openInterest: openInterest.points,
				volume: volume.points,
				markets: markets.points,
				totalOpenInterest: totalOpenInterest.points,
				milestones,
				period
			}),
			period
		}),
		[selected, openInterest.points, volume.points, markets.points, totalOpenInterest.points, milestones, period]
	)

	return (
		<RWAEntityChartPanel
			catalog={RWA_VENUE_CHART}
			selected={selected}
			chart={chart}
			isLoading={openInterest.isLoading || volume.isLoading || markets.isLoading || totalOpenInterest.isLoading}
			failedRead={mergeFailedReads([
				openInterest.failedRead,
				volume.failedRead,
				markets.failedRead,
				totalOpenInterest.failedRead
			])}
			filename={`rwa-perps-venue-${venueSlug}-chart`}
			title={venue}
		/>
	)
}
