import type { ChainAsset } from './api.types'

export interface IBridgedRow extends ChainAsset {
	name: string
	deprecated?: boolean
	change_24h?: number
}
