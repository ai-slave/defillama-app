import type { RWAPageKind } from '../layout/pageLayout'

const PAGE_KIND_FILE_WORDS: Record<RWAPageKind, { perps: boolean; scope: string | null }> = {
	overview: { perps: false, scope: null },
	chain: { perps: false, scope: 'chain' },
	category: { perps: false, scope: 'category' },
	assetGroup: { perps: false, scope: 'asset-group' },
	platform: { perps: false, scope: 'platform' },
	perpsOverview: { perps: true, scope: null },
	perpsAssetGroup: { perps: true, scope: 'asset-group' },
	perpsAsset: { perps: true, scope: 'asset' },
	venue: { perps: true, scope: 'venue' }
}

/** One csv name per page and part, so downloads from two pages never collide: rwa-perps-venue-binance-table.csv. */
export function getRwaCsvFileName(
	pageKind: RWAPageKind,
	slug: string | null | undefined,
	part: 'table' | 'compliance' | 'key-metrics' | 'chart'
): string {
	const { perps, scope } = PAGE_KIND_FILE_WORDS[pageKind]
	const words = ['rwa']
	if (perps) words.push('perps')
	if (scope && slug) words.push(scope, slug)
	words.push(part)
	return `${words.join('-')}.csv`
}
