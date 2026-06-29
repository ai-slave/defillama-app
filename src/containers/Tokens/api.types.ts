import type { IResponseCGMarketsAPI } from '~/api/coingecko.types'
import type { IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import type { TokenMarketsListResponse } from '~/containers/Markets/api.types'
import type { IRawTokenRightsEntry } from '~/containers/TokenRights/api.types'
import type { ProtocolEmission } from '~/containers/Unlocks/api.types'

export type TokensRawCoinGeckoMarket = IResponseCGMarketsAPI
export type TokensRawAdapterChainMetrics = IAdapterChainMetrics
export type TokensRawMarketsList = TokenMarketsListResponse
export type TokensRawTokenRightsEntry = IRawTokenRightsEntry

export interface TokensRawProtocolEmission extends ProtocolEmission {
	upcomingEvent?: Array<{
		timestamp: number | null
		noOfTokens: number[]
		description?: string
		category?: string
		unlockType?: string
		rateDurationDays?: number
	}>
	events?: Array<{
		timestamp: number
		noOfTokens: number[]
		description?: string
		category?: string
		unlockType?: string
		rateDurationDays?: number
	}>
	tPrice?: number | null
	tSymbol?: string | null
}
