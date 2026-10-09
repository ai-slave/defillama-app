import type { ChainAssetTotals } from '~/containers/BridgedTVL/api.types'
import type { ChainsByCategoryChain } from '~/containers/Chains/api.types'

export interface IChain extends Omit<ChainsByCategoryChain, 'protocols'> {
	protocols: number | null
	dexVolume24h: number | null
	dexVolume7d: number | null
	dexVolume30d: number | null
	fees24h: number | null
	fees7d: number | null
	fees30d: number | null
	revenue24h: number | null
	revenue7d: number | null
	revenue30d: number | null
	appRevenue24h: number | null
	appRevenue7d: number | null
	appRevenue30d: number | null
	stablesMcap: number | null
	activeUsers24h: number | null
	activeUsers7d: number | null
	activeUsers30d: number | null
	chainAssets: ChainAssetTotals | null
	bridgedTvl?: number | null
	childGroups: Record<string, Array<string>> | null
}

export interface IChainsByCategoryData {
	category: string
	categoryName: string
	allCategories: Array<{
		label: string
		to: string
	}>
	chains: Array<IChain>
	totalTvlByDate: Record<string, Record<number, number>>
	tvlChartsByChain: Record<string, Record<string, Record<number, number>>>
	description: string
}

export type IFormattedDataWithExtraTvlBase = {
	chainAssets?: ChainAssetTotals | null
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
	change_1d: number | null
	change_7d: number | null
	change_1m: number | null
	mcap: number | null
	mcaptvl: number | null
	name: string
	protocols: IChain['protocols'] | null
	deprecated?: boolean
	stablesMcap: IChain['stablesMcap']
	dexVolume24h: IChain['dexVolume24h']
	dexVolume7d: IChain['dexVolume7d']
	dexVolume30d: IChain['dexVolume30d']
	fees24h: IChain['fees24h']
	fees7d: IChain['fees7d']
	fees30d: IChain['fees30d']
	revenue24h: IChain['revenue24h']
	revenue7d: IChain['revenue7d']
	revenue30d: IChain['revenue30d']
	appRevenue24h: IChain['appRevenue24h']
	appRevenue7d: IChain['appRevenue7d']
	appRevenue30d: IChain['appRevenue30d']
	activeUsers24h: IChain['activeUsers24h']
	activeUsers7d: IChain['activeUsers7d']
	activeUsers30d: IChain['activeUsers30d']
}

export interface IFormattedDataWithExtraTvl extends IFormattedDataWithExtraTvlBase {
	subRows?: Array<IFormattedDataWithExtraTvlBase>
}

export interface ChainsDatasetRow {
	name: string
	icon: string
	protocols: number
	deprecated: boolean
	users: number | null
	change_1d: number | null
	change_7d: number | null
	change_1m: number | null
	tvl: number | null
	stablesMcap: number | null
	totalVolume24h: number | null
	totalVolume7d: number | null
	totalVolume30d: number | null
	totalFees24h: number | null
	totalFees7d: number | null
	totalFees30d: number | null
	totalRevenue24h: number | null
	totalRevenue7d: number | null
	totalRevenue30d: number | null
	totalAppRevenue24h: number | null
	totalAppRevenue7d: number | null
	totalAppRevenue30d: number | null
	bridgedTvl: number | null
	mcaptvl: number | null
	mcap: number | null
	symbol: string | null
	extraTvl: IChain['extraTvl'] | null
}
