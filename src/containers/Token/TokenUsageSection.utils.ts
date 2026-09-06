import type { RawProtocolTokenUsageEntry } from '~/containers/TokenUsage/api.types'

export type TokenUsageSectionRow = {
	name: string
	amountUsd: number
	category?: string
	logo?: string
	slug?: string
	misrepresentedTokens?: boolean
}

export function buildTokenUsageRows(data: Array<RawProtocolTokenUsageEntry>): Array<TokenUsageSectionRow> {
	return data.map((entry) => {
		let amountUsd = 0
		const amountUsdByChain = entry.amountUsd ?? {}

		for (const chain in amountUsdByChain) {
			const amount = amountUsdByChain[chain]
			if (typeof amount === 'number') {
				amountUsd += amount
			}
		}

		return {
			name: entry.name,
			category: entry.category,
			...(entry.logo !== undefined ? { logo: entry.logo } : {}),
			...(typeof entry.slug === 'string' ? { slug: entry.slug } : {}),
			...(entry.misrepresentedTokens !== undefined ? { misrepresentedTokens: entry.misrepresentedTokens } : {}),
			amountUsd
		}
	})
}

export function filterTokenUsageRows(
	rows: Array<TokenUsageSectionRow>,
	includeCentralizedExchanges: boolean
): Array<TokenUsageSectionRow> {
	return rows.filter((row) => {
		if (row.misrepresentedTokens) return false
		if (row.category?.toLowerCase() === 'cex' && !includeCentralizedExchanges) return false
		return true
	})
}
