// Badge count for the collapsed "Filters" trigger. Grouped, so an include/exclude or min/max
// pair counts once; sort, column and page change the view, not which rows qualify.
const FILTER_PARAM_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
	['token', 'excludeToken'],
	['collateralToken'],
	['borrowToken'],
	['chain', 'excludeChain'],
	['protocol', 'excludeProtocol', 'project', 'excludeProject'],
	['category', 'excludeCategory'],
	['attribute', 'excludeAttribute'],
	['minTvl', 'maxTvl'],
	['minApy', 'maxApy'],
	['minAvailable', 'maxAvailable']
]

type QueryRecord = Record<string, string | Array<string> | undefined>

/** Route params ([protocol]) share a name with filter params but are the page's subject. */
export function countActiveYieldFilters(query: QueryRecord, routeParams: ReadonlySet<string>): number {
	let count = 0
	for (const group of FILTER_PARAM_GROUPS) {
		for (const key of group) {
			if (routeParams.has(key)) continue
			const value = query[key]
			// An empty value and `All` select the default, so they filter nothing.
			if (value === undefined || value === '' || value === 'All' || (Array.isArray(value) && value.length === 0))
				continue
			count += 1
			break
		}
	}
	return count
}

export function yieldsRouteParams(pathname: string): Set<string> {
	return new Set(Array.from(pathname.matchAll(/\[(?:\.\.\.)?(\w+)\]/g), (match) => match[1] as string))
}
