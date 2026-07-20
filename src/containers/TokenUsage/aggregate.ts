import type { ProtocolTokenUsageData, RawProtocolTokenUsageEntry } from './api.types'

interface TokenUsageResponse {
	symbol: string
	data: readonly RawProtocolTokenUsageEntry[]
}

/**
 * Collapse one response per token into one row per protocol. The API contract
 * guarantees numeric chain amounts, so the hot loop deliberately avoids
 * Number coercion and Object.values allocations.
 */
export function aggregateProtocolTokenUsage(
	responses: readonly TokenUsageResponse[],
	includeCex: boolean
): ProtocolTokenUsageData[] {
	const protocols = new Map<string, ProtocolTokenUsageData>()

	for (const { symbol, data } of responses) {
		for (const protocol of data) {
			if (protocol.misrepresentedTokens) continue
			if (!includeCex && protocol.category.toLowerCase() === 'cex') continue

			let tokenAmount = 0
			for (const chain in protocol.amountUsd) tokenAmount += protocol.amountUsd[chain]

			const existing = protocols.get(protocol.name)
			if (existing) {
				existing.tokens[symbol] = (existing.tokens[symbol] ?? 0) + tokenAmount
				existing.amountUsd += tokenAmount
				continue
			}

			protocols.set(protocol.name, {
				name: protocol.name,
				category: protocol.category,
				amountUsd: tokenAmount,
				logo: protocol.logo,
				tokens: { [symbol]: tokenAmount }
			})
		}
	}

	return Array.from(protocols.values())
}
