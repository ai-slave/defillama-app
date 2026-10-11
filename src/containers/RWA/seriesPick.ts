import { getQueryUpdatesFromSelected, readSelectionFromQuery } from '~/components/Select/query'
import { toNonEmptyArrayParam } from '~/utils/routerQuery'

/* The series picker of a perps breakdown chart, the /dexs chain chart's Protocols picker: it lists the members of the
   current Group by, largest first, every member picked by default. The chart draws the ten largest picks and folds
   the other picks into Others (chartSeries.ts). The selection lives in the URL so a link shares it. Pure: the panels
   read the query and render the picker. */

export const RWA_SERIES_PICK_INCLUDE_KEY = 'chartSeries'
export const RWA_SERIES_PICK_EXCLUDE_KEY = 'excludeChartSeries'
/** The query patch that drops a pick: a new Group by or metric has other members. */
export const RWA_SERIES_PICK_CLEARED = {
	[RWA_SERIES_PICK_INCLUDE_KEY]: undefined,
	[RWA_SERIES_PICK_EXCLUDE_KEY]: undefined
} as const

/**
 * The picked members in option order; no keys means every member. A link whose picks name no member of this split,
 * such as one made under another Group by, reads as every member rather than an empty chart.
 */
export function readRwaSeriesPick(
	query: Readonly<Record<string, string | Array<string> | undefined>>,
	options: Array<string>
): Array<string> {
	const picked = readSelectionFromQuery(query, RWA_SERIES_PICK_INCLUDE_KEY, RWA_SERIES_PICK_EXCLUDE_KEY, options)
	if (picked.length > 0 || toNonEmptyArrayParam(query[RWA_SERIES_PICK_INCLUDE_KEY]).includes('None')) return picked
	return options
}

/** The URL update for a new pick; every member leaves the URL clean and nothing writes `None`. */
export function getRwaSeriesPickQuery(
	options: Array<string>,
	picked: Array<string>
): Record<string, string | Array<string> | undefined> {
	return getQueryUpdatesFromSelected(RWA_SERIES_PICK_INCLUDE_KEY, RWA_SERIES_PICK_EXCLUDE_KEY, options, picked)
}
