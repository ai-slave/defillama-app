import type { IRWAList } from '~/utils/metadata/types'

export type RWAAssetRoute = {
	assetId: string
	canonicalMarketId: string
}

/** Matches an asset URL param to its canonical market id case-insensitively; null when unknown or missing a detail id. */
export function resolveRWAAssetRoute(
	assetParam: string,
	rwaList: Pick<IRWAList, 'canonicalMarketIds' | 'idMap'>
): RWAAssetRoute | null {
	const normalizedAssetParam = assetParam.toLowerCase()

	for (const canonicalMarketId of rwaList.canonicalMarketIds) {
		if (canonicalMarketId.toLowerCase() === normalizedAssetParam) {
			const assetId = getRWAAssetId(canonicalMarketId, rwaList.idMap)
			return assetId ? { assetId, canonicalMarketId } : null
		}
	}

	return null
}

function getRWAAssetId(canonicalMarketId: string, idMap: Record<string, string>): string | null {
	const exactAssetId = idMap[canonicalMarketId]
	if (exactAssetId) return exactAssetId

	const normalizedMarketId = canonicalMarketId.toLowerCase()
	for (const marketId in idMap) {
		if (marketId.toLowerCase() === normalizedMarketId) return idMap[marketId] ?? null
	}

	return null
}
