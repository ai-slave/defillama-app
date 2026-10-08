import type { RWASection } from '../layout/pageLayout'

/** The table's column set: Metrics for the numbers that move daily, or Compliance on asset rows. Perps rows have one set. */
export type RWATableColumnSet = 'metrics' | 'compliance'

export const RWA_TABLE_COLUMN_SET_QUERY_KEY = 'table'
/** The platform page's old view key; `?view=compliance` links predate the table switch. */
const LEGACY_VIEW_QUERY_KEY = 'view'
const DEFAULT_COLUMN_SET: RWATableColumnSet = 'metrics'

type ColumnSetOption = { value: RWATableColumnSet; label: string; tooltip: string }

const COLUMN_SET_OPTIONS: Record<RWASection, ReadonlyArray<ColumnSetOption>> = {
	assets: [
		{ value: 'metrics', label: 'Metrics', tooltip: 'AUM, DeFi and flows, the numbers that move daily.' },
		{ value: 'compliance', label: 'Compliance', tooltip: 'Who issues each asset and how it is gated.' }
	],
	perps: [{ value: 'metrics', label: 'Metrics', tooltip: 'Open interest, volume, price, funding and fees.' }]
}

export function getRwaTableColumnSetOptions(section: RWASection): ReadonlyArray<ColumnSetOption> {
	return COLUMN_SET_OPTIONS[section]
}

type ColumnSetQuery = Partial<Record<string, string | Array<string> | undefined>>

const first = (value: string | Array<string> | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * `?table=` names the set; a set the row kind lacks opens Metrics. Without it an old `?view=compliance` link still
 * opens Compliance.
 */
export function parseRwaTableColumnSet(query: ColumnSetQuery, section: RWASection): RWATableColumnSet {
	const value =
		first(query[RWA_TABLE_COLUMN_SET_QUERY_KEY]) ??
		(first(query[LEGACY_VIEW_QUERY_KEY]) === 'compliance' ? 'compliance' : undefined)
	return COLUMN_SET_OPTIONS[section].find((option) => option.value === value)?.value ?? DEFAULT_COLUMN_SET
}

/** The query patch for a pick: Metrics leaves the URL clean, and an old `view=compliance` is cleared so it cannot win back. */
export function getRwaTableColumnSetQuery(
	columnSet: RWATableColumnSet,
	query: ColumnSetQuery
): Record<string, string | undefined> {
	return {
		[RWA_TABLE_COLUMN_SET_QUERY_KEY]: columnSet === DEFAULT_COLUMN_SET ? undefined : columnSet,
		...(first(query[LEGACY_VIEW_QUERY_KEY]) === 'compliance' ? { [LEGACY_VIEW_QUERY_KEY]: undefined } : {})
	}
}
