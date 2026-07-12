import type { TokenRiskBorrowCapacityResponse, TokenRiskBorrowCapacityTokenEntry } from '~/containers/Token/api.types'
import { indexBorrowCapacityByAssetKey } from '~/containers/Token/tokenRisk.utils'

export type IndexedTokenRiskBorrowCapacity = {
	data: TokenRiskBorrowCapacityResponse
	indexedTokens: Map<string, TokenRiskBorrowCapacityTokenEntry[]>
}

export type IndexedBorrowCapacitySnapshot = {
	data: TokenRiskBorrowCapacityResponse
	indexedTokens: Record<string, TokenRiskBorrowCapacityTokenEntry[]>
}

export function buildIndexedBorrowCapacitySnapshot(
	data: TokenRiskBorrowCapacityResponse
): IndexedBorrowCapacitySnapshot {
	const indexedTokens: Record<string, TokenRiskBorrowCapacityTokenEntry[]> = {}
	for (const [assetKey, tokens] of indexBorrowCapacityByAssetKey(data.tokens)) {
		indexedTokens[assetKey] = tokens
	}
	return { data, indexedTokens }
}

export function hydrateIndexedBorrowCapacitySnapshot(
	snapshot: IndexedBorrowCapacitySnapshot
): IndexedTokenRiskBorrowCapacity {
	return {
		data: snapshot.data,
		indexedTokens: new Map(Object.entries(snapshot.indexedTokens))
	}
}
