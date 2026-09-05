import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'

export type CompareTokenProtocol = {
	geckoId: string | null
	name: string
	tvl: number | null
	fees: number | null
	revenue: number | null
}

export type CompareTokensPageData = {
	coinsData: Array<IResponseCGTokenRankingsDatasetItem & { label: string; value: string }>
	protocols: CompareTokenProtocol[]
}
