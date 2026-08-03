import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'
import type { DashboardItemConfig } from './dashboardItemConfig'
import { getProTokenUsageQueryKey, normalizeProTokenSymbols } from './tableQueryKeys'

export interface TokenUsageSource {
	tokenSymbols: string[]
	includeCex: boolean
	cacheKey: string
}

export type TokenUsageStreamData = {
	key: string
	data: ProtocolTokenUsageData[]
}

export function buildTokenUsageSourcePlan(items: DashboardItemConfig[]): TokenUsageSource[] {
	const sources = new Map<string, TokenUsageSource>()
	for (const item of items) {
		if (item.kind !== 'dataset-table' || item.datasetType !== 'token-usage' || !item.tokenSymbols.length) continue
		const config = {
			tokenSymbols: normalizeProTokenSymbols(item.tokenSymbols),
			includeCex: item.includeCex
		}
		const cacheKey = JSON.stringify(getProTokenUsageQueryKey(config.tokenSymbols, config.includeCex))
		if (!sources.has(cacheKey)) sources.set(cacheKey, { ...config, cacheKey })
	}
	return Array.from(sources.values())
}
