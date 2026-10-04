/** One pathname for active links, group expansion, and route-change comparisons. */
export function navPath(asPath: string) {
	return asPath.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
}
