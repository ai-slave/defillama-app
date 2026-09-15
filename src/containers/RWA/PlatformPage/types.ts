import type { RWAPlatformMeta } from './api.types'

export type RWAPlatformMixRow = {
	name: string
	count: number
}

export type RWAPlatformPeerRow = {
	rank: number
	name: string
	slug: string
	logo: string | null
	aum: number
	// Pre-rename shape. /api/public/rwa/platform-peers is CDN-cached for up to 90min, so a body
	// published by the previous deploy still carries this key and no `aum`. Drop after one release.
	onchainAum?: number
	assetCount: number
	holderTotalFeeBps: number | null
	mintFeeBps: number | null
	redemptionFeeBps: number | null
}

export type RWAPlatformAssetSummary = {
	assetCount: number
	chainCount: number
	categoryMix: Array<RWAPlatformMixRow>
	assetClassMix: Array<RWAPlatformMixRow>
	chainMix: Array<RWAPlatformMixRow>
	dominantAccessModel: RWAPlatformMixRow | null
	attestedAssetCount: number
	defiActiveTvl: number
	bridgeTvl: number
}

export type RWAPlatformPageData = RWAPlatformAssetSummary & {
	meta: RWAPlatformMeta
	defiActiveTvlToAumPct: number | null
}
