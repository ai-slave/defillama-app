import type { RuntimePieChartData } from '~/components/ECharts/PieChart/data'

export interface ILSTPeg {
	deviation: number
	marketRate: number
	expectedRate: number
}

/** A processed LST token row for the table */
export interface ILSTTokenRow {
	name: string
	protocolSlug: string
	logo: string | null
	deprecated: boolean
	mcap: number | null
	stakedEth: number
	stakedEthInUsd: number | null
	stakedEthPctChange7d: number | null
	stakedEthPctChange30d: number | null
	marketShare: number
	lsdSymbol: string | null
	ethPeg: ILSTPeg | null
	pegInfo: string | null
	mcapOverTvl: number | null
	apy: number | null
	fee: number | null
}

/** Inflows chart data: timestamp -> { [protocol]: delta } */
export type InflowsChartData = Record<number, Record<string, number>>

export type LSTHistoryRow = { date: number } & Record<string, number>

/** Props for the LSTOverview component */
export interface LSTOverviewProps {
	areaChartData: LSTHistoryRow[]
	pieSeries: RuntimePieChartData
	tokensList: ILSTTokenRow[]
	tokens: string[]
	stakedEthSum: number
	stakedEthInUsdSum: number | null
	lsdColors: Record<string, string>
	inflowsChartData: InflowsChartData
	barChartStacks: Record<string, string>
	ratesAvailable: boolean
	apyAvailable: boolean
}
