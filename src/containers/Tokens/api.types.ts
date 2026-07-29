import type { ProtocolEmission } from '~/containers/Unlocks/api.types'

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
