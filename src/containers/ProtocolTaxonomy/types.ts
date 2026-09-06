import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { ProtocolListAdditiveTvlKey } from '~/containers/ProtocolLists/api.types'

export type ProtocolTaxonomyChartRow = [timestampMs: number, ...values: Array<number | null>]

export type ProtocolTaxonomyChartSeries = Omit<MultiSeriesChartSeriesConfig, 'data' | 'encode'> & {
	encode: { x: number; y: number }
	data?: never
}

export type ProtocolTaxonomyBreakdownKey = 'protocol' | 'chain' | 'network' | 'custody'

export interface ProtocolTaxonomyCharts {
	dataset: {
		source: Array<ProtocolTaxonomyChartRow>
		dimensions: [timestamp: 'timestamp', ...series: Array<string>]
	}
	charts: Array<ProtocolTaxonomyChartSeries>
}

interface IProtocolMetricTotals {
	total24h: number | null
	total7d: number | null
	total30d: number | null
}

interface IProtocolPerpMetricTotals extends IProtocolMetricTotals {
	doublecounted?: boolean
	zeroFeePerp?: boolean
}

interface IProtocolOpenInterestTotals {
	total24h: number | null
}

interface IProtocolByCategory {
	name: string
	slug: string
	logo: string | null
	chains: Array<string>
	deprecated?: boolean
	tvl: number | null
	extraTvls: Partial<Record<ProtocolListAdditiveTvlKey | 'excludeParent', number | null>>
	mcap: number | null
	fees?: IProtocolMetricTotals | null
	revenue?: IProtocolMetricTotals | null
	dexVolume?: IProtocolMetricTotals | null
	perpVolume?: IProtocolPerpMetricTotals | null
	openInterest?: IProtocolOpenInterestTotals | null
	optionsPremium?: IProtocolMetricTotals | null
	optionsNotional?: IProtocolMetricTotals | null
	tags: Array<string>
	borrowed?: number | null
	supplied?: number | null
	suppliedTvl?: number | null
}

interface IProtocolByCategoryWithSubRows extends IProtocolByCategory {
	subRows?: Array<IProtocolByCategory>
}

export interface IProtocolTaxonomyPageData {
	protocols: Array<IProtocolByCategoryWithSubRows>
	category: string | null
	tag: string | null
	effectiveCategory: string | null
	chains: Array<{ label: string; to: string }>
	chain: string
	charts: ProtocolTaxonomyCharts
	/** Stacked volume breakdowns keyed by dimension. Only populated for categories that opt in. */
	breakdownCharts: Partial<Record<ProtocolTaxonomyBreakdownKey, ProtocolTaxonomyCharts>>
	fees7d: number | null
	revenue7d: number | null
	dexVolume7d: number | null
	perpVolume7d: number | null
	openInterest: number | null
	optionsPremium7d: number | null
	optionsNotional7d: number | null
	extraTvlCharts: Partial<Record<ProtocolListAdditiveTvlKey, Record<number, number | null>>>
}

export interface IProtocolsCategoriesExtraTvlPoint {
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
}

export interface IProtocolsCategoriesTableRow {
	name: string
	protocols: number
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
	revenue: number | null
	extraTvls: Record<string, IProtocolsCategoriesExtraTvlPoint>
	change_1d: number | null
	change_7d: number | null
	change_1m: number | null
	description: string
	subRows?: Array<IProtocolsCategoriesTableRow>
}

export type IProtocolsCategoriesChartRow = Record<string, number | null> & { timestamp: number }

export interface IProtocolsCategoriesChartData {
	chartSource: Array<IProtocolsCategoriesChartRow>
	extraTvlCharts: Record<string, Partial<Record<ProtocolListAdditiveTvlKey, Record<number, number | null>>>>
}

export interface IProtocolsCategoriesPageData extends IProtocolsCategoriesChartData {
	categories: Array<string>
	tableData: Array<IProtocolsCategoriesTableRow>
	categoryColors: Record<string, string>
}
