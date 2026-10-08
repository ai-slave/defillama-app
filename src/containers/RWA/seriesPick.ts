import { getQueryUpdatesFromSelected, readSelectionFromQuery } from '~/components/Select/query'
import { RWA_MAX_CHART_SERIES } from './chartFold'

/* The series picker of a perps breakdown chart, the /dexs chain chart's Protocols picker: it lists the members of the
   current Group by, largest first, the ten largest picked by default. Every picked member draws its own series and
   the rest, an upstream Others included, fold into one Others. The selection lives in the URL so a link shares it.
   Pure: the panels read the query and render the picker. */

export const RWA_SERIES_PICK_INCLUDE_KEY = 'chartSeries'
export const RWA_SERIES_PICK_EXCLUDE_KEY = 'excludeChartSeries'
/** The query patch that drops a pick: a new Group by or metric has other members. */
export const RWA_SERIES_PICK_CLEARED = {
	[RWA_SERIES_PICK_INCLUDE_KEY]: undefined,
	[RWA_SERIES_PICK_EXCLUDE_KEY]: undefined
} as const

/**
 * The picked members in option order. No keys means the ten largest. A link whose picks name no member of this
 * split in either form, such as one made under another Group by, also reads as the ten largest rather than an empty
 * chart or every member.
 */
export function readRwaSeriesPick(
	query: Readonly<Record<string, string | Array<string> | undefined>>,
	options: ReadonlyArray<string>
): Array<string> {
	const defaults = options.slice(0, RWA_MAX_CHART_SERIES)
	const included = toList(query[RWA_SERIES_PICK_INCLUDE_KEY])
	if (included.includes('None')) return []
	const members = new Set(options)
	const names = [...included, ...toList(query[RWA_SERIES_PICK_EXCLUDE_KEY])]
	if (!names.some((name) => members.has(name))) return defaults
	const picked = readSelectionFromQuery(
		query,
		RWA_SERIES_PICK_INCLUDE_KEY,
		RWA_SERIES_PICK_EXCLUDE_KEY,
		options,
		defaults
	)
	return picked.length > 0 ? picked : defaults
}

function toList(value: string | Array<string> | undefined): Array<string> {
	return value == null ? [] : Array.isArray(value) ? value : [value]
}

/** The URL update for a new pick; the ten largest leave the URL clean. */
export function getRwaSeriesPickQuery(
	options: Array<string>,
	picked: Array<string>
): Record<string, string | Array<string> | undefined> {
	return getQueryUpdatesFromSelected(
		RWA_SERIES_PICK_INCLUDE_KEY,
		RWA_SERIES_PICK_EXCLUDE_KEY,
		options,
		picked,
		options.slice(0, RWA_MAX_CHART_SERIES)
	)
}
