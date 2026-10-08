/** The switch /rwa had between Assets and Perps, under its two names; nothing reads it now. */
const PERPS_FLAGS = new Set(['perps', 'includeRwaPerps'])

/** A link that appended a key with a second "?" reads as one value (groupBy = "assetGroup?perps=true"): split it. */
function splitAppendedKeys([key, value]: [string, string]): Array<[string, string]> {
	const [head, ...appended] = value.split('?')
	return [[key, head], ...new URLSearchParams(appended.join('&'))]
}

/** An old /rwa address with the Perps switch on opens the Perps overview with the rest of its query, the flag dropped. */
export function legacyRwaPerpsRedirect(pathname: string, searchParams: URLSearchParams): string | null {
	if (pathname !== '/rwa' && !pathname.startsWith('/rwa/')) return null
	if (pathname === '/rwa/perps' || pathname.startsWith('/rwa/perps/')) return null
	const entries = [...searchParams].flatMap(splitAppendedKeys)
	if (!entries.some(([key, value]) => PERPS_FLAGS.has(key) && value === 'true')) return null
	const kept = new URLSearchParams(entries.filter(([key]) => !PERPS_FLAGS.has(key))).toString()
	return kept ? `/rwa/perps?${kept}` : '/rwa/perps'
}
