import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'

export type TokenUsageCategoryStats = { count: number; amount: number }

export interface TokenUsageSummary {
	totalAmount: number
	protocolCount: number
	tokenStats: Record<string, { total: number; protocols: number }> | null
	categoryBreakdown: Record<string, TokenUsageCategoryStats>
	topCategories: Array<[string, TokenUsageCategoryStats]>
	protocolOverlap: Record<string, number> | null
	multiTokenProtocolCount: number
}

export function buildTokenUsageSummary(
	rawData: ProtocolTokenUsageData[],
	selectedSymbols: string[]
): TokenUsageSummary {
	const isMultiToken = selectedSymbols.length > 1
	const tokenStats: Record<string, { total: number; protocols: number }> | null = isMultiToken ? {} : null
	const protocolOverlap: Record<string, number> | null = isMultiToken ? { exclusive: 0, shared: 0 } : null
	for (const symbol of selectedSymbols) {
		if (tokenStats) tokenStats[symbol] = { total: 0, protocols: 0 }
		if (protocolOverlap) protocolOverlap[`${symbol}_only`] = 0
	}

	let totalAmount = 0
	let multiTokenProtocolCount = 0
	const categoryStats = new Map<string, TokenUsageCategoryStats>()

	for (const row of rawData) {
		totalAmount += row.amountUsd
		const category = row.category || 'Unknown'
		const existingCategory = categoryStats.get(category)
		if (existingCategory) {
			existingCategory.count++
			existingCategory.amount += row.amountUsd
		} else {
			categoryStats.set(category, { count: 1, amount: row.amountUsd })
		}

		// The card counts every token key, while overlap counts only positive selected-token amounts.
		let tokenKeyCount = 0
		for (const _symbol in row.tokens) tokenKeyCount++
		if (tokenKeyCount > 1) multiTokenProtocolCount++

		let usedSelectedTokenCount = 0
		let soleUsedSelectedSymbol = ''
		for (const symbol of selectedSymbols) {
			const amount = row.tokens[symbol]
			if (tokenStats && amount !== undefined) {
				tokenStats[symbol].total += amount
				tokenStats[symbol].protocols++
			}
			if (protocolOverlap && amount !== undefined && amount > 0) {
				usedSelectedTokenCount++
				soleUsedSelectedSymbol = symbol
			}
		}

		if (protocolOverlap) {
			if (usedSelectedTokenCount === 1) {
				protocolOverlap[`${soleUsedSelectedSymbol}_only`]++
				protocolOverlap.exclusive++
			} else if (usedSelectedTokenCount > 1) {
				protocolOverlap.shared++
			}
		}
	}

	const categoryEntries = Array.from(categoryStats.entries())
	return {
		totalAmount,
		protocolCount: rawData.length,
		tokenStats,
		categoryBreakdown: Object.fromEntries(categoryEntries),
		topCategories: [...categoryEntries].sort(([, a], [, b]) => b.amount - a.amount).slice(0, 3),
		protocolOverlap,
		multiTokenProtocolCount
	}
}
