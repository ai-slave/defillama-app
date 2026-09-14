import { isTrueQueryParam } from '~/utils/routerQuery'
import type { RWATableView } from './groupBy'

/** The Assets or Perps view of the overview. `perps=true` opens Perps; the old `includeRwaPerps` key still reads. */
export const RWA_VIEW_QUERY_KEY = 'perps'
export const RWA_LEGACY_VIEW_QUERY_KEY = 'includeRwaPerps'

type ViewQuery = Partial<Record<typeof RWA_VIEW_QUERY_KEY | typeof RWA_LEGACY_VIEW_QUERY_KEY, string | Array<string>>>

export function parseRwaTableView(query: ViewQuery, defaultPerps: boolean): RWATableView {
	const value = query[RWA_VIEW_QUERY_KEY] ?? query[RWA_LEGACY_VIEW_QUERY_KEY]
	const perps = value == null ? defaultPerps : isTrueQueryParam(Array.isArray(value) ? value[0] : value)
	return perps ? 'perps' : 'assets'
}

/** The query patch that selects a view: the new key when it differs from the default, the old key always cleared. */
export function getRwaTableViewQuery(
	view: RWATableView,
	defaultPerps: boolean
): Record<typeof RWA_VIEW_QUERY_KEY | typeof RWA_LEGACY_VIEW_QUERY_KEY, 'true' | 'false' | undefined> {
	const perps = view === 'perps'
	return {
		[RWA_VIEW_QUERY_KEY]: perps === defaultPerps ? undefined : perps ? 'true' : 'false',
		[RWA_LEGACY_VIEW_QUERY_KEY]: undefined
	}
}
