import type { DatasetSnapshotDomain } from './contract'

/** Pure build configuration: routes receive only the snapshot domains they can read at runtime. */
export const DATASET_SNAPSHOT_ROUTE_DOMAINS = {
	'/yields': ['yields'],
	'/yields/borrow': ['yields'],
	'/yields/loop': ['yields'],
	'/yields/pool/*': ['yields'],
	'/about': ['yields'],
	'/lst': ['yields'],
	'/rwa/asset/*': ['yields'],
	'/protocol/*': ['yields', 'markets', 'token-rights'],
	'/protocol/yields/*': ['yields'],
	'/chart/protocol/*': ['yields'],
	'/api/public/yields': ['yields'],
	'/api/public/yields/**': ['yields'],
	'/api/private/downloads/*': ['yields'],
	'/api/dynamic/pro-dashboard/*/stream': ['yields'],
	'/cex/**': ['markets'],
	'/cex/*': ['markets', 'yields'],
	'/cexs': ['markets'],
	'/api/public/markets/**': ['markets'],
	'/tokens': ['markets', 'token-rights'],
	'/watchlist': ['markets', 'token-rights'],
	'/api/public/tokens': ['markets', 'token-rights'],
	'/token/*': ['markets', 'liquidations', 'raises', 'treasuries', 'yields', 'liquidity', 'token-rights', 'risk'],
	'/token-rights': ['token-rights'],
	'/protocol/token-rights/*': ['token-rights'],
	'/liquidations': ['liquidations'],
	'/liquidations/**': ['liquidations'],
	'/api/private/liquidations': ['liquidations'],
	'/api/private/liquidations/**': ['liquidations'],
	'/api/private/token-liquidations/*': ['liquidations'],
	'/sitemap.xml': ['markets', 'liquidations', 'raises'],
	'/sitemap/*': ['markets', 'liquidations', 'raises']
} as const satisfies Record<string, readonly DatasetSnapshotDomain[]>

function getDomainTraceIncludes(domain: DatasetSnapshotDomain): string[] {
	const domainRoot = `./.cache/dataset-snapshots/${domain}`
	return [`${domainRoot}/current.json`, `${domainRoot}/versions/**/*`]
}

export function getDatasetSnapshotTraceIncludes(): Record<string, string[]> {
	const includes: Record<string, string[]> = {}
	for (const [route, domains] of Object.entries(DATASET_SNAPSHOT_ROUTE_DOMAINS) as Array<
		[string, readonly DatasetSnapshotDomain[]]
	>) {
		includes[route] = domains.flatMap(getDomainTraceIncludes)
	}
	return includes
}
