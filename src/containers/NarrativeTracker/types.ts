import type { TimeSeriesEntry } from './api.types'

/** A row in the pctChanges table (category or coin) */
export interface IPctChangeRow {
	id: string
	name: string
	mcap: number | null
	volume1D: number | null
	nbCoins?: number
	categoryName?: string
	change1W: number | null
	change1M: number | null
	change1Y: number | null
	changeYtd: number | null
	change?: number | null
	returnField?: number | null
}

/** Performance time series keyed by period string */
export type PerformanceTimeSeries = Record<string, Array<TimeSeriesEntry>>

/** Props for the CategoryPerformanceContainer */
export interface CategoryPerformanceProps {
	pctChanges: Array<IPctChangeRow>
	performanceTimeSeries: PerformanceTimeSeries
	areaChartLegend: Array<string>
	isCoinPage: boolean
	categoryName?: string
}
