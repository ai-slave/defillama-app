import type { ChainAssetTotals } from './api.types'

export interface IBridgedRow extends ChainAssetTotals {
	name: string
	deprecated: boolean
	change_24h?: number
}
