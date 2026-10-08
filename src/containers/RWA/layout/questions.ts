import type { RWAOverviewDisplayRow, RWAPerpsContractOverlayRow } from '../api.types'
import type { RWAOverviewInclusionDefaults } from '../constants'
import { rwaSlug } from '../rwaSlug'
import { sumValues } from '../table/change'
import { RWA_WRAPPER_TYPE } from '../wrappers'
import { getRwaPageLayout, type RWAPageKind } from './pageLayout'

/**
 * The Ask strip of every /rwa page: each page is its own entity, asked as a page the way /stablecoins asks,
 * with a context built from the page kind, its scope and the rows the page counts. The server picks the questions and
 * caches them by entity, so one shared entity gave every /rwa page the same questions.
 */
const ENTITY_PREFIX: Record<RWAPageKind, string> = {
	overview: 'rwa',
	chain: 'rwa-chain',
	category: 'rwa-category',
	assetGroup: 'rwa-asset-group',
	platform: 'rwa-platform',
	perpsOverview: 'rwa-perps',
	perpsAssetGroup: 'rwa-perps-asset-group',
	perpsAsset: 'rwa-perps-asset',
	venue: 'rwa-venue'
}

export function getRwaQuestionsEntitySlug(kind: RWAPageKind, scopeName: string | null): string {
	const scope = scopeName ? rwaSlug(scopeName) : ''
	return scope ? `${ENTITY_PREFIX[kind]}-${scope}` : ENTITY_PREFIX[kind]
}

const TOP_ROWS = 15

const PAGE_DESCRIPTION: Record<RWAPageKind, string> = {
	overview: 'RWA assets across every chain',
	chain: 'RWA assets on one chain',
	category: 'RWA assets in one category',
	assetGroup: 'RWA assets in one asset group',
	platform: 'RWA assets of one platform',
	perpsOverview: 'RWA perpetual markets across venues',
	perpsAssetGroup: 'RWA perpetual markets in one asset group',
	perpsAsset: 'RWA perpetual markets on one underlying asset',
	venue: 'RWA perpetual markets on one venue'
}

/** What the strip says it asks about: "Ask about RWA on Ethereum". */
export function getRwaQuestionsEntityName(kind: RWAPageKind, scopeName: string | null): string {
	switch (kind) {
		case 'overview':
			return 'RWA'
		case 'chain':
			return `RWA on ${scopeName}`
		case 'category':
		case 'assetGroup':
			return `${scopeName} RWA`
		case 'platform':
			return scopeName ?? 'RWA'
		case 'perpsOverview':
			return 'RWA Perps'
		case 'perpsAssetGroup':
		case 'venue':
			return `${scopeName} RWA Perps`
		case 'perpsAsset':
			return `${scopeName} Perps`
	}
}

/**
 * The page's context: its totals and largest rows under the page rules (no suspicious rows, stablecoins, governance
 * and wrapper tokens only when the page includes them by default). Spot pages rank by Active AUM, perps by open interest.
 */
export function buildRwaQuestionsContext({
	kind,
	scopeName,
	rows,
	defaultInclusion
}: {
	kind: RWAPageKind
	scopeName: string | null
	rows: ReadonlyArray<RWAOverviewDisplayRow>
	defaultInclusion?: Pick<RWAOverviewInclusionDefaults, 'includeStablecoins' | 'includeGovernance' | 'includeWrappers'>
}): Record<string, unknown> {
	const head = { page: PAGE_DESCRIPTION[kind], ...(scopeName ? { scope: scopeName } : {}) }

	if (getRwaPageLayout(kind).section === 'perps') {
		const markets = rows.filter((row): row is RWAPerpsContractOverlayRow => row.kind === 'perps' && !row.suspicious)
		return {
			...head,
			marketCount: markets.length,
			totalOpenInterest: sumValues(markets.map((market) => market.openInterest)),
			totalVolume24h: sumValues(markets.map((market) => market.volume24h)),
			topMarkets: markets
				.toSorted((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0))
				.slice(0, TOP_ROWS)
				.map((market) => ({
					market: market.contract,
					venue: market.parentPlatform,
					assetGroup: market.assetGroup,
					openInterest: market.openInterest ?? null,
					volume24h: market.volume24h ?? null
				}))
		}
	}

	const assets = rows.filter(
		(row) =>
			row.kind === 'spot' &&
			!row.suspicious &&
			(defaultInclusion?.includeStablecoins || !row.stablecoin) &&
			(defaultInclusion?.includeGovernance || !row.governance) &&
			(defaultInclusion?.includeWrappers || row.type !== RWA_WRAPPER_TYPE)
	)
	return {
		...head,
		assetCount: assets.length,
		totalActiveAum: sumValues(assets.map((asset) => asset.activeMcap?.total)),
		totalOnchainAum: sumValues(assets.map((asset) => asset.onChainMcap?.total)),
		topAssets: assets
			.toSorted((a, b) => (b.activeMcap?.total ?? 0) - (a.activeMcap?.total ?? 0))
			.slice(0, TOP_ROWS)
			.map((asset) => ({
				name: asset.assetName,
				ticker: asset.ticker,
				platform: asset.parentPlatform,
				category: asset.category,
				activeAum: asset.activeMcap?.total ?? null,
				onchainAum: asset.onChainMcap?.total ?? null
			}))
	}
}
