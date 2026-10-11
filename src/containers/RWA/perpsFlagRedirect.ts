/** The switch /rwa had between Assets and Perps, under its two names; nothing reads it now. */
const PERPS_FLAGS = new Set(['perps', 'includeRwaPerps'])

/** The old Perps dashboard pages read their volume period from `groupBy` and their chart pick from `stacks`; their
    chart now reads them from `flowMode` and `chartSeries`, and `groupBy` is the table's grouping. The contract page
    still reads its period from `groupBy`. */
const PERPS_DASHBOARD_PATH = /^\/rwa\/perps(\/(venue|asset-group|asset)\/[^/]+)?$/
const OLD_VOLUME_PERIODS = new Set(['weekly', 'monthly'])
const OLD_CHART_PICK_KEYS: Record<string, string> = { stacks: 'chartSeries', excludeStacks: 'excludeChartSeries' }

/** The key an old dashboard query entry moved to, or null when it keeps its key. */
function getMovedDashboardKey([key, value]: [string, string]): string | null {
	if (key === 'groupBy' && OLD_VOLUME_PERIODS.has(value)) return 'flowMode'
	return OLD_CHART_PICK_KEYS[key] ?? null
}

/** A link that appended a key with a second "?" reads as one value (groupBy = "assetGroup?perps=true"): split it. */
function splitAppendedKeys([key, value]: [string, string]): Array<[string, string]> {
	const [head, ...appended] = value.split('?')
	return [[key, head], ...new URLSearchParams(appended.join('&'))]
}

function withQuery(pathname: string, entries: Array<Array<string>>): string {
	const query = new URLSearchParams(entries).toString()
	return query ? `${pathname}?${query}` : pathname
}

/**
 * An old /rwa address with the Perps switch on opens its Perps twin with the rest of its query, the flag dropped: an
 * asset group its Perps asset group page, a platform its own page (which sends a perps-only platform to its venue
 * page), every other page the Perps overview. An old Perps dashboard link moves its volume period and chart pick to
 * the keys the chart reads now.
 */
export function legacyRwaPerpsRedirect(pathname: string, searchParams: URLSearchParams): string | null {
	if (pathname !== '/rwa' && !pathname.startsWith('/rwa/')) return null
	const entries = [...searchParams].flatMap(splitAppendedKeys)
	if (pathname === '/rwa/perps' || pathname.startsWith('/rwa/perps/')) {
		if (!PERPS_DASHBOARD_PATH.test(pathname) || !entries.some(getMovedDashboardKey)) return null
		return withQuery(
			pathname,
			entries.map((entry) => [getMovedDashboardKey(entry) ?? entry[0], entry[1]])
		)
	}
	if (!entries.some(([key, value]) => PERPS_FLAGS.has(key) && value === 'true')) return null
	const kept = entries.filter(([key]) => !PERPS_FLAGS.has(key))
	const [, section, slug, ...rest] = pathname.slice(1).split('/')
	if (rest.length === 0 && slug) {
		if (section === 'asset-group') return withQuery(`/rwa/perps/asset-group/${slug}`, kept)
		// A platform's venue page shares its slug but 404s for a platform without a venue; the platform page knows.
		if (section === 'platform') return withQuery(pathname, kept)
	}
	return withQuery('/rwa/perps', kept)
}
