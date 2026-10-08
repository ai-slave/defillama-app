import {
	getRwaEntityViewOptions,
	getRwaEntityViewQueryPatch,
	parseRwaEntityView,
	RWA_ENTITY_VIEW_QUERY_KEY
} from '../PlatformPage/view'
import { getRwaPageLayout, RWA_SECTION_TABS, type RWAPageKind } from './pageLayout'

/**
 * The top tab row of a /rwa page. A tree page shows the Assets and Perps section tabs; an entity
 * page shows its own views instead, as the protocol page does (Information first): a platform page Information and
 * Assets, a venue page Information and Markets. The view tabs are links to the same page with `?view=` patched, so the
 * rest of the URL (filters, Group by, column set) survives the switch. A page embedded in a protocol's RWA tab has no
 * row of its own: the protocol's row is on top there.
 */

type RWAPageTab = {
	key: string
	label: string
	href: string
	current: boolean
}
type RWAPageTabRow = { label: string; tabs: Array<RWAPageTab> }

type Query = Record<string, string | Array<string> | undefined>

function splitPath(asPath: string): { path: string; params: URLSearchParams } {
	const [withoutHash] = asPath.split('#')
	const [path, search = ''] = withoutHash.split('?')
	return { path, params: new URLSearchParams(search) }
}

function toQuery(params: URLSearchParams): Query {
	const query: Query = {}
	for (const key of new Set(params.keys())) {
		const values = params.getAll(key)
		query[key] = values.length > 1 ? values : values[0]
	}
	return query
}

function patchHref(asPath: string, patch: Record<string, string | undefined>): string {
	const { path, params } = splitPath(asPath)
	for (const [key, value] of Object.entries(patch)) {
		if (value === undefined) params.delete(key)
		else params.set(key, value)
	}
	const search = params.toString()
	return search ? `${path}?${search}` : path
}

export function getRwaPageTabRow(
	kind: RWAPageKind,
	asPath: string,
	{ embedded }: { embedded: boolean }
): RWAPageTabRow | null {
	if (embedded) return null
	const query = toQuery(splitPath(asPath).params)

	if (kind === 'platform' || kind === 'venue') {
		const active = parseRwaEntityView(query[RWA_ENTITY_VIEW_QUERY_KEY])
		return {
			label: kind === 'venue' ? 'Venue views' : 'Platform views',
			tabs: getRwaEntityViewOptions(kind).map(({ value, label }) => ({
				key: value,
				label,
				href: patchHref(asPath, getRwaEntityViewQueryPatch(value, query)),
				current: value === active
			}))
		}
	}

	const { section } = getRwaPageLayout(kind)
	return {
		label: 'RWA sections',
		tabs: RWA_SECTION_TABS.map((tab) => ({
			key: tab.section,
			label: tab.label,
			href: tab.href,
			current: tab.section === section
		}))
	}
}
