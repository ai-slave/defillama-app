import type { IChainMetadata } from './types'

export function getChainDenominations(
	metadata: IChainMetadata | undefined
): Array<{ symbol: string; geckoId: string | null }> {
	const denominations: Array<{ symbol: string; geckoId: string | null }> = [{ symbol: 'USD', geckoId: null }]
	if (metadata?.gasTokenGeckoId && metadata.gasTokenSymbol) {
		denominations.push({ symbol: metadata.gasTokenSymbol, geckoId: metadata.gasTokenGeckoId })
	}
	return denominations
}
