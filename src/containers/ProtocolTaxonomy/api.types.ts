export type CategoryOrTagChartMetrics = Record<string, number>

export type CategoryOrTagChartSection =
	| 'tvl'
	| 'staking'
	| 'pool2'
	| 'offers'
	| 'borrowed'
	| 'treasury'
	| 'vesting'
	| 'doublecounted'
	| 'liquidstaking'
	| 'dcAndLsOverlap'

export type CategoryOrTagChartResponse = Partial<Record<CategoryOrTagChartSection, CategoryOrTagChartMetrics>>

export type CategoriesSummaryResponse = {
	chart: Record<string, Record<string, CategoryOrTagChartMetrics>>
	categories: Record<string, string[]>
}

/** Ascending `[unixSeconds, valueBySeriesName]` rows, as served by the card issuer breakdown charts. */
export type CardBreakdownChartResponse = Array<[number, Record<string, number>]>
