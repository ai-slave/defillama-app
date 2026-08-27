/**
 * Manually curated notes on our own data collection, marked on the charts they affect.
 *
 * Some of the biggest moves in these series are ours, not the market's. When we start
 * collecting a metric, or widen what we capture, the line steps up on that day and
 * reads exactly like a surge in real activity. A reader has no way to tell the two
 * apart, so we say which is which on the chart itself.
 *
 * Curated by hand on purpose: the backend publishes observations, not an account of how
 * its own coverage changed. Every date below was read off the published series, and the
 * label says what changed on our side without claiming a market cause we cannot know.
 *
 * To add one: find the day the step appears in `exchanges/series/all.json`, add an entry
 * naming the metrics it affects, and keep the label short enough to sit on an axis.
 */

/** Which family of series an event explains. */
export type HallmarkMetric = 'volume' | 'oi' | 'liquidity' | 'depth'

interface CollectionEvent {
	/** UTC day, YYYY-MM-DD. */
	date: string
	/** Short enough to render beside a gridline. */
	label: string
	metrics: readonly HallmarkMetric[]
}

const COLLECTION_EVENTS: readonly CollectionEvent[] = [
	{
		// total_linear_perp_oi steps 49.5b -> 76.6b as our own per-pair collection replaces
		// a third-party backfill that reached far fewer venues. The line moves because more
		// venues are counted from this day, not because open positions grew by half.
		//
		// "Coverage widened" rather than "collection starts": there WAS open interest
		// before this, on the venues the backfill reached. Saying it began here would
		// write off that history as nothing.
		date: '2026-04-24',
		label: 'OI coverage widened',
		metrics: ['oi']
	},
	{
		// Both active-liquidity series step several times over on this day (spot 5.3x,
		// USD perps 2.9x) from a change in what we capture, not in resting liquidity.
		date: '2026-07-10',
		label: 'Depth coverage widened',
		metrics: ['liquidity', 'depth']
	}
]

const toUnixSeconds = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000)

/** `[unix seconds, label]` pairs for the metrics a chart is showing, oldest first. */
export function collectionHallmarks(metrics: readonly HallmarkMetric[]): Array<[number, string]> {
	if (metrics.length === 0) return []
	return COLLECTION_EVENTS.filter((event) => event.metrics.some((metric) => metrics.includes(metric)))
		.map((event) => [toUnixSeconds(event.date), event.label] as [number, string])
		.sort((a, b) => a[0] - b[0])
}

/**
 * Which metric families a set of series keys belongs to, so a chart does not have to
 * restate it. Keys look like `total_linear_perp_oi` or `cex_spot_active_liquidity`.
 */
export function hallmarkMetricsForKeys(keys: readonly string[]): HallmarkMetric[] {
	const metrics = new Set<HallmarkMetric>()
	for (const key of keys) {
		if (key.includes('active_liquidity')) metrics.add('liquidity')
		else if (key.includes('depth')) metrics.add('depth')
		else if (key.endsWith('_oi')) metrics.add('oi')
		else if (key.includes('volume')) metrics.add('volume')
	}
	return [...metrics]
}
