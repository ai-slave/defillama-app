import type { RawAllLiquidationsResponse } from '~/containers/LiquidationsV2/api.types'

export function normalizeLiquidationsTokenSymbol(symbol: string | null | undefined): string | null {
	const normalizedSymbol = symbol?.trim().toUpperCase()
	return normalizedSymbol ? normalizedSymbol : null
}

export function extractLiquidationsTokenSymbols(liquidationsResponse: RawAllLiquidationsResponse): string[] {
	const symbols = new Set<string>()

	for (const protocolData of Object.values(liquidationsResponse.data)) {
		for (const [chainId, positions] of Object.entries(protocolData)) {
			const chainTokens = liquidationsResponse.tokens[chainId]
			if (!chainTokens) {
				continue
			}

			for (const position of positions) {
				const token = chainTokens[position.collateral]
				const normalizedSymbol = normalizeLiquidationsTokenSymbol(token?.symbol)
				if (normalizedSymbol) {
					symbols.add(normalizedSymbol)
				}
			}
		}
	}

	return Array.from(symbols).sort((a, b) => a.localeCompare(b))
}
