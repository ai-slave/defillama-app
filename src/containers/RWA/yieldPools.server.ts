import { getEarnPage } from '~/containers/Yields/data/earn.server'
import { resolveTokenOptionKeys } from '~/containers/Yields/data/server/tokenPage'
import type { YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import type { EarnPageRow } from '~/containers/Yields/data/types'
import type { IFetchedRWAProject } from './api.types'

export interface RWAYieldResult {
	// DeFi opportunities: earn pools INVOLVING this asset (excludes the issuer's own
	// native-yield pool, which is split out below). Rows are the shared earn-table shape.
	yieldPools: EarnPageRow[] | null
	yieldPoolsTotal: number | null
	// The asset's own tokenized-yield pool (issued by its DeFiLlama protocol): id feeds the
	// native-yield history chart, current base APY feeds the "Native Yield" stat.
	nativeYieldPoolId: string | null
	nativeYieldCurrent: number | null
}

export const emptyRWAYieldResult = (): RWAYieldResult => ({
	yieldPools: null,
	yieldPoolsTotal: null,
	nativeYieldPoolId: null,
	nativeYieldCurrent: null
})

// Resolve the asset's issuer DeFiLlama protocol SLUG(s) from its projectId(s). Used only to
// separate the asset's OWN (native-yield) pool from third-party DeFi opportunities. Note the
// `protocolMetadata[id].name` field actually carries the protocol SLUG (a metadata
// quirk), so these match the earn row's `projectslug`.
async function resolveIssuerProtocolSlugs(asset: IFetchedRWAProject): Promise<Set<string>> {
	const slugs = new Set<string>()
	const ids = Array.isArray(asset.projectId) ? asset.projectId : asset.projectId != null ? [asset.projectId] : []
	const metadataCache = await import('~/utils/metadata').then((module) => module.default)
	for (const id of ids) {
		const meta = metadataCache.protocolMetadata[id]
		if (meta?.name) slugs.add(meta.name)
	}
	return slugs
}

// v2 RWA yield integration. The RWA page's meaning is "pools INVOLVING this asset" (presence,
// not purity — e.g. a Balancer basket holding the asset must keep matching), so resolve the
// asset's ticker to v2 ASSET option keys and query the earn dataset with CONTAINS semantics
// on BOTH the reference asset and the pool tokens. This replaces the old three-tier
// address/issuer/ticker cascade: address-identity matches survive via the option keys'
// canonical/bridged fanout; the loose symbol tiers (and their false positives) are gone.
//
// The asset's own issuer pool (highest-TVL match on the issuer's protocol) is split out as
// the native-yield source; every other match is a DeFi opportunity.
export async function getRWAYieldPools(snapshot: YieldsSnapshot, asset: IFetchedRWAProject): Promise<RWAYieldResult> {
	const ticker = asset.ticker?.trim()
	if (!ticker) return emptyRWAYieldResult()

	const tokenKeys = await resolveTokenOptionKeys(snapshot, ticker)
	if (tokenKeys.length === 0) return emptyRWAYieldResult()

	const page = await getEarnPage(snapshot, {
		token: tokenKeys,
		tokenMatch: 'contains',
		tokenOn: 'both',
		// The asset's token selection already scopes the noise; hiding a token's own pools
		// on its own asset page serves nobody (mirrors the token page).
		includeMemeTokens: 'true',
		pageSize: 'all'
	})
	const rows = page.rows
	if (rows.length === 0) return emptyRWAYieldResult()

	const issuerSlugs = await resolveIssuerProtocolSlugs(asset)

	// Rows arrive TVL-desc (getEarnPage default), so the first issuer-protocol match is the
	// highest-TVL one. All issuer pools are kept out of the DeFi opportunities list; only the
	// primary one drives the native-yield chart/stat.
	let nativePool: EarnPageRow | null = null
	const defiPools: EarnPageRow[] = []
	for (const row of rows) {
		if (issuerSlugs.size > 0 && row.projectslug != null && issuerSlugs.has(row.projectslug)) {
			if (nativePool == null) nativePool = row
			continue
		}
		defiPools.push(row)
	}

	return {
		yieldPools: defiPools.length > 0 ? defiPools : null,
		yieldPoolsTotal: defiPools.length > 0 ? defiPools.length : null,
		nativeYieldPoolId: nativePool?.id ?? null,
		nativeYieldCurrent: nativePool?.apyBase ?? null
	}
}
