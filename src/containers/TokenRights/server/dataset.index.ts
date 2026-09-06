import type { IRawTokenRightsEntry } from '~/containers/TokenRights/api.types'

export type TokenRightsIndexes = {
	byDefillamaId: Record<string, IRawTokenRightsEntry>
	byProtocolName: Record<string, IRawTokenRightsEntry>
}

export function normalizeTokenRightsProtocolName(name: string): string {
	return name.toLowerCase().replace(/ /g, '-').replace(/'/g, '')
}

export function buildTokenRightsIndexes(entries: Array<IRawTokenRightsEntry>): TokenRightsIndexes {
	const byDefillamaId: Record<string, IRawTokenRightsEntry> = {}
	const byProtocolName: Record<string, IRawTokenRightsEntry> = {}

	for (const entry of entries) {
		const defillamaId = entry['DefiLlama ID']
		if (defillamaId) {
			byDefillamaId[defillamaId] = entry
		}

		const protocolName = entry['Protocol Name']
		if (protocolName) {
			byProtocolName[normalizeTokenRightsProtocolName(protocolName)] = entry
		}
	}

	return { byDefillamaId, byProtocolName }
}

export function findTokenRightsByDefillamaId(
	index: TokenRightsIndexes['byDefillamaId'],
	defillamaId: string
): IRawTokenRightsEntry | null {
	if (!defillamaId) return null
	return index[defillamaId] ?? null
}

export function findTokenRightsByProtocolName(
	index: TokenRightsIndexes['byProtocolName'],
	protocolName: string
): IRawTokenRightsEntry | null {
	const normalizedName = normalizeTokenRightsProtocolName(protocolName)
	if (!normalizedName) return null
	return index[normalizedName] ?? null
}
