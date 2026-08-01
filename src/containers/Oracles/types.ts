import type { ProtocolLite } from '~/containers/ProtocolLists/api.types'

export type OracleBreakdownItem = { timestamp: number } & Record<string, number>
export type OracleChartData = Array<OracleBreakdownItem>

export type OracleProtocolWithBreakdown = ProtocolLite & {
	tvl: number | null
	extraTvl: Record<string, number>
	strikeTvl: boolean
}

interface OracleLink {
	label: string
	to: string
}

export interface OracleTableDataRow {
	name: string
	tvl: number | null
	extraTvl: Record<string, number>
	protocolsSecured: number
	chains: Array<string>
}

export interface OracleOverviewPageData {
	chain: string | null
	chainLinks: Array<OracleLink>
	oracle: string | null
	tvl: number | null
	extraTvl: Record<string, number>
	protocolTableData: Array<OracleProtocolWithBreakdown>
	chartData: OracleChartData
}

export interface OraclesByChainPageData {
	chain: string | null
	oracles: Array<string>
	chainLinks: Array<OracleLink>
	tableData: Array<OracleTableDataRow>
	chartData: OracleChartData
	oraclesColors: Record<string, string>
}
