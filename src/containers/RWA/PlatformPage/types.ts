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
	onchainAum: number
	assetCount: number
	holderTotalFeeBps: number | null
	mintFeeBps: number | null
	redemptionFeeBps: number | null
}

export type RWAPlatformAssetSummary = {
	assetCount: number
	chainCount: number
	categoryMix: RWAPlatformMixRow[]
	assetClassMix: RWAPlatformMixRow[]
	chainMix: RWAPlatformMixRow[]
	dominantAccessModel: RWAPlatformMixRow | null
	attestedAssetCount: number
	defiActiveTvl: number
	bridgeTvl: number
}

export type RWAPlatformPageData = RWAPlatformAssetSummary & {
	meta: RWAPlatformMeta
	defiActiveTvlToAumPct: number | null
}
