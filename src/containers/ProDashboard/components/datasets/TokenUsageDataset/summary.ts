import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'

export type TokenUsageCategoryStats = { count: number; amount: number }

export type ProtocolOverlap = {
	exclusive: number
	shared: number
	exclusiveByToken: Record<string, number>
}

interface TokenUsageSummaryBase {
	totalAmount: number
	protocolCount: number
	categoryBreakdown: Record<string, TokenUsageCategoryStats>
	topCategories: Array<[string, TokenUsageCategoryStats]>
	multiTokenProtocolCount: number
}

export type TokenUsageSummary =
	| (TokenUsageSummaryBase & { kind: 'single'; tokenStats: null; protocolOverlap: null })
	| (TokenUsageSummaryBase & {
			kind: 'comparison'
			tokenStats: Record<string, { total: number; protocols: number }>
			protocolOverlap: ProtocolOverlap
	  })

export function buildTokenUsageSummary(
	rawData: ProtocolTokenUsageData[],
	selectedSymbols: string[]
): TokenUsageSummary {
	const isMultiToken = selectedSymbols.length > 1
	const tokenStats: Record<string, { total: number; protocols: number }> | null = isMultiToken ? {} : null
	const protocolOverlap: ProtocolOverlap | null = isMultiToken
		? { exclusive: 0, shared: 0, exclusiveByToken: {} }
		: null
	for (const symbol of selectedSymbols) {
		if (tokenStats) tokenStats[symbol] = { total: 0, protocols: 0 }
		if (protocolOverlap) protocolOverlap.exclusiveByToken[symbol] = 0
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

		let usedSelectedTokenCount = 0
		let soleUsedSelectedSymbol = ''
		for (const symbol of selectedSymbols) {
			const amount = row.tokens[symbol]
			if (tokenStats && amount !== undefined) {
				const stats = tokenStats[symbol]
				if (!stats) throw new Error(`Missing token-usage summary bucket for ${symbol}`)
				stats.total += amount
				if (amount > 0) stats.protocols++
			}
			if (protocolOverlap && amount !== undefined && amount > 0) {
				usedSelectedTokenCount++
				soleUsedSelectedSymbol = symbol
			}
		}
		if (usedSelectedTokenCount > 1) multiTokenProtocolCount++

		if (protocolOverlap) {
			if (usedSelectedTokenCount === 1) {
				const exclusiveCount = protocolOverlap.exclusiveByToken[soleUsedSelectedSymbol]
				if (exclusiveCount === undefined)
					throw new Error(`Missing token-usage overlap bucket for ${soleUsedSelectedSymbol}`)
				protocolOverlap.exclusiveByToken[soleUsedSelectedSymbol] = exclusiveCount + 1
				protocolOverlap.exclusive++
			} else if (usedSelectedTokenCount > 1) {
				protocolOverlap.shared++
			}
		}
	}

	const categoryEntries = Array.from(categoryStats.entries())
	const common = {
		totalAmount,
		protocolCount: rawData.length,
		categoryBreakdown: Object.fromEntries(categoryEntries),
		topCategories: [...categoryEntries].sort(([, a], [, b]) => b.amount - a.amount).slice(0, 3),
		multiTokenProtocolCount
	}
	return tokenStats && protocolOverlap
		? { ...common, kind: 'comparison', tokenStats, protocolOverlap }
		: { ...common, kind: 'single', tokenStats: null, protocolOverlap: null }
}
