import type { ChartTimeGrouping } from '~/components/ECharts/MultiSeriesChart/types'

/** Period fields are omitted when the producer cannot calculate that window. */
export interface AdapterMetricPeriods {
	total24h?: number | null
	total48hto24h?: number | null
	total7d?: number | null
	total14dto7d?: number | null
	total60dto30d?: number | null
	total30d?: number | null
	total1y?: number | null
	annualized1y?: number | null
	change_1d?: number | null
	change_7d?: number | null
	change_1m?: number | null
	change_7dover7d?: number | null
	change_30dover30d?: number | null
	total7DaysAgo?: number | null
	total30DaysAgo?: number | null
	totalAllTime?: number | null
}

export type AdapterMethodology = Record<string, string> | string | null
export type AdapterBreakdown = Record<string, Record<string, number>>
export type AdapterBreakdownMethodology = Record<string, string | Record<string, string>>

export interface AdapterChainProtocol extends AdapterMetricPeriods {
	average1y?: number | null
	monthlyAverage1y?: number | null
	breakdown24h: AdapterBreakdown | null
	breakdown30d: AdapterBreakdown | null
	defillamaId: string
	name: string
	displayName: string
	module: string | null
	category: string | null
	logo: string
	chains: Array<string>
	protocolType: string
	methodologyURL: string | null
	methodology: AdapterMethodology
	breakdownMethodology?: AdapterBreakdownMethodology | null
	hasLabelBreakdown?: boolean | null
	latestFetchIsOk?: boolean
	parentProtocol?: string
	slug: string
	linkedProtocols?: Array<string> | null
	id: string
	doublecounted?: boolean | null
}

export interface IAdapterChainMetrics extends AdapterMetricPeriods {
	breakdown24h?: AdapterBreakdown | null
	breakdown30d?: AdapterBreakdown | null
	chain?: string | null
	category?: string
	allCategories?: Array<string>
	allChains: Array<string>
	protocols: Array<AdapterChainProtocol>
}

export interface AdapterChainProtocolTotals {
	defillamaId: string
	displayName: string
	total24h: number | null
	total7d: number | null
	total30d: number | null
}

export interface AdapterChainProtocolTotalsResponse {
	protocols: Array<AdapterChainProtocolTotals>
}

export interface AdapterProtocolChild {
	name: string
	defillamaId: string
	displayName: string
	methodologyURL: string | null
	methodology: AdapterMethodology
	breakdownMethodology?: AdapterBreakdownMethodology | null
	defaultChartView?: ChartTimeGrouping | null
}

export interface AdapterChainBreakdown extends AdapterMetricPeriods {
	average1y?: number | null
	monthlyAverage1y?: number | null
}

export interface IAdapterProtocolMetrics extends AdapterMetricPeriods {
	chain?: string | null
	defillamaId: string
	name: string
	displayName: string
	module: string | null
	category: string | null
	logo: string
	chains: Array<string>
	protocolType: string
	methodologyURL: string | null
	methodology: AdapterMethodology
	breakdownMethodology?: AdapterBreakdownMethodology | null
	parentProtocol?: string | null
	slug: string
	linkedProtocols?: Array<string> | null
	id: string
	doublecounted?: boolean | null
	disabled?: boolean | null
	gecko_id?: string | null
	description?: string | null
	url?: string | null
	github?: Array<string> | null
	treasury?: string | null
	cmcId?: string | null
	defaultChartView?: ChartTimeGrouping | null
	hasLabelBreakdown?: boolean | null
	twitter?: string | null
	stablecoins?: Array<string> | null
	symbol?: string | null
	address?: string | null
	hallmarks?: Array<[number, string]> | null
	wrongLiquidity?: boolean
	forkedFrom?: Array<string> | null
	audits?: string | null
	audit_links?: Array<string> | null
	childProtocols?: Array<AdapterProtocolChild> | null
	chainBreakdown?: Record<string, AdapterChainBreakdown> | null
}

export type IAdapterChart = Array<[number, number]>

export type IAdapterBreakdownChartData = Array<[number, Record<string, number>]>
