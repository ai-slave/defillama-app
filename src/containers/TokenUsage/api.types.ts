export interface RawProtocolTokenUsageEntry {
	name: string
	category: string
	amountUsd: Record<string, number>
	logo?: string
	misrepresentedTokens?: boolean
	[key: string]: unknown
}

export interface ProtocolTokenUsageData {
	name: string
	category: string
	amountUsd: number
	logo?: string
	tokens: Record<string, number>
}
