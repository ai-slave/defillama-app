import type { ProtocolLiquidityTokensResponse } from '~/api/types'

export function findLiquidityEntryByProtocolId(
	entries: ProtocolLiquidityTokensResponse,
	protocolId: string
): ProtocolLiquidityTokensResponse[number] | null {
	for (const entry of entries) {
		if (entry.id === protocolId) return entry
	}
	return null
}
