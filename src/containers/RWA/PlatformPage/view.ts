import { RWA_TABLE_COLUMN_SET_QUERY_KEY } from '../table/columnSetQuery'

/**
 * The two views of an entity page, a platform or a venue: Information swaps the chart and the content, the list shows
 * the table (a platform's assets, a venue's markets). `?view=` names Information; the list is the default and stays out
 * of the URL. Compliance is a column set of the table (`?table=`), not a view; an old `?view=compliance` link opens the
 * list, and the table reads it as Compliance.
 */
const RWA_ENTITY_VIEWS = ['information', 'list'] as const
export type RWAEntityView = (typeof RWA_ENTITY_VIEWS)[number]
export const RWA_ENTITY_VIEW_QUERY_KEY = 'view'
const RWA_ENTITY_DEFAULT_VIEW: RWAEntityView = 'list'
const LEGACY_COMPLIANCE_VIEW = 'compliance'

/** Tab order, as on a protocol page: what the entity is, then what it holds or lists. */
export function getRwaEntityViewOptions(
	entity: 'platform' | 'venue'
): ReadonlyArray<{ value: RWAEntityView; label: string }> {
	return [
		{ value: 'information', label: 'Information' },
		{ value: 'list', label: entity === 'venue' ? 'Markets' : 'Assets' }
	]
}

const first = (value: string | Array<string> | undefined) => (Array.isArray(value) ? value[0] : value)

export function parseRwaEntityView(value: string | Array<string> | undefined): RWAEntityView {
	return first(value) === 'information' ? 'information' : RWA_ENTITY_DEFAULT_VIEW
}

/**
 * The query patch for a view pick. A pick overwrites `?view=`, so an old `?view=compliance` link hands its column set
 * to `?table=` first; otherwise a trip through Information would drop the reader back on Metrics.
 */
export function getRwaEntityViewQueryPatch(
	view: RWAEntityView,
	query: Partial<Record<string, string | Array<string> | undefined>>
): Record<string, string | undefined> {
	const patch: Record<string, string | undefined> = {
		[RWA_ENTITY_VIEW_QUERY_KEY]: view === RWA_ENTITY_DEFAULT_VIEW ? undefined : view
	}
	if (
		first(query[RWA_ENTITY_VIEW_QUERY_KEY]) === LEGACY_COMPLIANCE_VIEW &&
		first(query[RWA_TABLE_COLUMN_SET_QUERY_KEY]) === undefined
	) {
		patch[RWA_TABLE_COLUMN_SET_QUERY_KEY] = LEGACY_COMPLIANCE_VIEW
	}
	return patch
}
