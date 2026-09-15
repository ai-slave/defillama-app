import type { IFetchedRWAProject, IRWAStatsResponse } from '../api.types'
import { getPrimaryRwaCategory } from '../grouping'
import { rwaSlug } from '../rwaSlug'
import type { RWAPlatformsIndex, RWAPlatformMeta } from './api.types'
import type { RWAPlatformAssetSummary, RWAPlatformMixRow, RWAPlatformPageData, RWAPlatformPeerRow } from './types'

// The AUM every platform surface headlines. Falls back to raw on-chain supply for artifacts
// published before the server split the two, so a stale metadata pull renders the old number
// rather than NaN.
export function rwaPlatformAum(meta: Pick<RWAPlatformMeta, 'onchainAum' | 'activeAum'>): number {
	return meta.activeAum ?? meta.onchainAum
}

function increment(counts: Map<string, number>, value: string): void {
	counts.set(value, (counts.get(value) ?? 0) + 1)
}

function toSortedMix(counts: Map<string, number>): Array<RWAPlatformMixRow> {
	const rows: Array<RWAPlatformMixRow> = []
	for (const [name, count] of counts) rows.push({ name, count })
	rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
	return rows
}

export type RWAPlatformCurrentAsset = Pick<
	IFetchedRWAProject,
	| 'parentPlatform'
	| 'governance'
	| 'attestations'
	| 'defiActiveTvl'
	| 'bridgeTvl'
	| 'category'
	| 'assetClass'
	| 'chain'
	| 'accessModel'
>

type RWAPlatformStats = Pick<IRWAStatsResponse, 'byPlatform'>

export function buildRWAPlatformPeerRows(
	platformsIndex: RWAPlatformsIndex,
	stats: RWAPlatformStats
): Array<RWAPlatformPeerRow> {
	const assetCountsBySlug = new Map<string, number>()
	for (const name in stats.byPlatform) {
		const slices = stats.byPlatform[name]
		if (!slices) continue
		assetCountsBySlug.set(rwaSlug(name), slices.base.assetCount + slices.stablecoinsOnly.assetCount)
	}
	const metas: Array<RWAPlatformMeta> = []
	for (const slug in platformsIndex.platforms) {
		const meta = platformsIndex.platforms[slug]
		if (meta && rwaPlatformAum(meta) > 0) metas.push(meta)
	}
	metas.sort((a, b) => rwaPlatformAum(b) - rwaPlatformAum(a) || a.name.localeCompare(b.name))

	const peers: Array<RWAPlatformPeerRow> = []
	for (let index = 0; index < metas.length; index++) {
		const meta = metas[index]
		if (!meta) continue
		peers.push({
			rank: index + 1,
			name: meta.name,
			slug: meta.slug,
			logo: meta.logo,
			aum: rwaPlatformAum(meta),
			assetCount: assetCountsBySlug.get(meta.slug) ?? 0,
			holderTotalFeeBps: meta.holderTotalFeeBps,
			mintFeeBps: meta.mintFeeBps,
			redemptionFeeBps: meta.redemptionFeeBps
		})
	}
	return peers
}

export function buildRWAPlatformPageData({
	meta,
	assetSummary
}: {
	meta: RWAPlatformMeta
	assetSummary: RWAPlatformAssetSummary
}): RWAPlatformPageData {
	const aum = rwaPlatformAum(meta)
	return {
		meta,
		...assetSummary,
		defiActiveTvlToAumPct: aum > 0 ? (assetSummary.defiActiveTvl / aum) * 100 : null
	}
}

export function buildRWAPlatformAssetSummary(
	assets: Array<RWAPlatformCurrentAsset>,
	platformSlug: string
): RWAPlatformAssetSummary {
	const categoryCounts = new Map<string, number>()
	const assetClassCounts = new Map<string, number>()
	const chainCounts = new Map<string, number>()
	const accessModelCounts = new Map<string, number>()
	let assetCount = 0
	let attestedAssetCount = 0
	let defiActiveTvl = 0
	let bridgeTvl = 0

	// Current contains spot assets only; use it before the legacy overview category filter.
	for (const asset of assets) {
		if (rwaSlug(asset.parentPlatform ?? '') !== platformSlug || asset.governance) continue
		assetCount++
		if (asset.attestations === true) attestedAssetCount++
		for (const chain in asset.defiActiveTvl) {
			const protocols = asset.defiActiveTvl[chain]
			if (!protocols) continue
			for (const protocol in protocols) defiActiveTvl += protocols[protocol] ?? 0
		}
		if (asset.bridgeTvl) {
			for (const chain in asset.bridgeTvl) bridgeTvl += asset.bridgeTvl[chain] ?? 0
		}

		const category = getPrimaryRwaCategory(asset.category)
		if (category) increment(categoryCounts, category)
		if (asset.assetClass) {
			for (const assetClass of new Set(asset.assetClass)) increment(assetClassCounts, assetClass)
		}
		if (asset.chain) {
			for (const chain of new Set(asset.chain)) increment(chainCounts, chain)
		}
		if (asset.accessModel) increment(accessModelCounts, asset.accessModel)
	}

	const accessModels = toSortedMix(accessModelCounts)
	return {
		assetCount,
		chainCount: chainCounts.size,
		categoryMix: toSortedMix(categoryCounts),
		assetClassMix: toSortedMix(assetClassCounts),
		chainMix: toSortedMix(chainCounts),
		dominantAccessModel: accessModels[0] ?? null,
		attestedAssetCount,
		defiActiveTvl,
		bridgeTvl
	}
}
