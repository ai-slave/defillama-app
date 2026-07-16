const TETHER_SYMBOL_PATTERN = /₮0?/gu

export function normalizeYieldToken(token: string): string {
	const normalizedToken = token.normalize('NFKC').trim().toLowerCase().replaceAll(TETHER_SYMBOL_PATTERN, 't')

	return normalizedToken === 't' ? 'usdt' : normalizedToken
}
