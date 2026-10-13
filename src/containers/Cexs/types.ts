import type { CexExchangeSlugIndexEntry } from '~/containers/Markets/server/dataset.index'

export interface ICex {
	name: string
	cexProtocolSlug?: string
	tokensToExclude: Array<string>
	coin?: string
	coinSymbol?: string
	walletsLink?: string
	cgId?: string
	cgDeriv?: string
	lastAuditDate?: number
	auditor?: string | null
	auditLink?: string
	currentTvl: number | null
	cleanAssetsTvl: number | null
	inflows_24h: number | null
	inflows_1w: number | null
	inflows_1m: number | null
	/** The mapped exchange venue: profile slug, REAL tier and market figures. Null when no venue maps to this CEX. */
	exchange: CexExchangeSlugIndexEntry | null
	/** USD perp OI / clean assets. */
	leverage: number | null
}

export type CexReservesRow = Omit<ICex, 'exchange' | 'leverage'>

export interface CexInflowsRequest {
	cexProtocolSlug: string
	tokensToExclude: Array<string>
}
