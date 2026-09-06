import type { IProtocol } from '~/containers/ProtocolRankings/types'

interface ForkLink {
	label: string
	to: string
}

export interface ForkTableDataRow {
	name: string
	logo?: string | null
	deprecated?: boolean
	tvl: number
	forkedProtocols: number
	parentTvl: number | null
	ftot: number | null
}

// Chart data types
export type ForkProtocolChartData = Array<[number, number]> // [timestamp, value] tuples
export type ForkBreakdownChartData = Array<{ timestamp: number } & Record<string, number>>

// - /forks page data
export interface ForkOverviewPageData {
	forks: Array<string>
	forkLinks: Array<ForkLink>
	forkColors: Record<string, string>
	tableData: Array<ForkTableDataRow>
	chartData: ForkBreakdownChartData
}

// - /forks/:fork page data
export interface ForkByProtocolPageData {
	fork: string
	forkLinks: Array<ForkLink>
	protocolTableData: Array<IProtocol>
	chartData: ForkProtocolChartData
}

export type ForkByProtocolPageResult =
	| { status: 'success'; data: ForkByProtocolPageData }
	| { status: 'not-found' }
	| { status: 'unavailable' }
