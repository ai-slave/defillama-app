import type { MultiSeriesTimeSeriesDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { IAdapterChainMetrics, IAdapterChart, IAdapterProtocolMetrics } from './api.types'
import type { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from './constants'

// Chain-level adapter data with chart. Metric periods retain the producer's
// exact optionality; page read models decide where a missing period is shown as null.
export interface IAdapterChainOverview extends IAdapterChainMetrics {
	totalDataChart: IAdapterChart
}

// Single protocol adapter data with chart
export interface IAdapterProtocolOverview extends IAdapterProtocolMetrics {
	totalDataChart: IAdapterChart
}

type ApiProtocol = IAdapterChainMetrics['protocols'][0]

// Extract base fields from API protocol type
// String fields remain non-nullable (they always exist in API response)
// Numeric fields are nullable for UI layer (can be missing in aggregated data)
export type IProtocol = Pick<ApiProtocol, 'name' | 'slug' | 'logo' | 'chains'> & {
	category: ApiProtocol['category'] | null
	total24h: number | null
	total48hto24h?: number | null
	total7d: number | null
	total14dto7d?: number | null
	total30d: number | null
	total60dto30d?: number | null
	total7DaysAgo?: number | null
	total30DaysAgo?: number | null
	total1y: number | null
	annualized1y?: number | null
	totalAllTime: number | null
	change_1d?: number | null
	change_7d?: number | null
	change_1m?: number | null
	change_7dover7d?: number | null
	change_30dover30d?: number | null
	mcap: number | null
	openInterest?: number | null
	activeLiquidity?: number | null
	normalizedVolume24h?: number | null
	pfOrPs?: number | null
	methodology?: string | null
	doublecounted?: boolean
	zeroFeePerp?: boolean
	warning?: string
	breakdownAliases?: Array<string>
	childProtocols?: Array<IProtocol>
}

export interface IAdapterByChainPageData {
	chain: string
	chains: Array<{ label: string; to: string }>
	protocols: Array<IProtocol>
	categories: Array<string>
	adapterType: `${ADAPTER_TYPES}`
	dataType: `${ADAPTER_DATA_TYPES}` | null
	chartData: MultiSeriesTimeSeriesDataset
	total24h: number | null
	total7d: number | null
	total30d: number | null
	change_1d: number | null
	change_7d: number | null
	change_1m: number | null
	change_7dover7d: number | null
	openInterest: number | null
	entityQuestions?: Array<string>
	activeLiquidity: number | null
	deprecated?: boolean
}

export interface IChainsByAdapterPageData {
	adapterType: `${ADAPTER_TYPES}`
	dataType: `${ADAPTER_DATA_TYPES}` | null
	chartData: MultiSeriesTimeSeriesDataset
	chains: Array<{
		name: string
		logo: string
		total24h: number | null
		total7d: number | null
		total30d: number | null
		openInterest?: number | null
		activeLiquidity?: number | null
		warning?: string
		deprecated?: boolean
	}>
	allChains: Array<string>
}

export interface IChainsByREVPageData {
	chains: Array<{
		name: string
		slug: string
		logo: string
		total24h: number | null
		total30d: number | null
		deprecated?: boolean
	}>
}
