export interface ICex {
	name: string
	defillamaCexSlug?: string
	exchangeSlug?: string
	/** Canonical profile destination: /exchange/:slug?section=reserves when the venue has a markets profile, else the legacy /cex page. */
	profileUrl?: string
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
	spotVolume: number | null
	oi: number | null
	derivVolume: number | null
	leverage: number | null
}
