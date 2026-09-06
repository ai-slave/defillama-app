// Oracle metrics response
export interface IOracleMetrics {
	oracles: Record<string, Array<string>>
	chainsByOracle: Record<string, Array<string>>
	protocolsByOracleChain: Record<string, Record<string, Array<string>>>
	oraclesTVS: Record<string, Record<string, Record<string, number>>>
}

// Protocol breakdown chart item with timestamp and dynamic oracle keys
type IOracleProtocolBreakdownChartItem = {
	timestamp: number
} & Record<string, number>

export type IOracleProtocolBreakdownChart = Array<IOracleProtocolBreakdownChartItem>

// Chain breakdown chart item with timestamp and dynamic chain keys
type IOracleChainBreakdownChartItem = {
	timestamp: number
} & Record<string, number>

export type IOracleChainBreakdownChart = Array<IOracleChainBreakdownChartItem>

// Protocol chart data as tuple of [timestamp, value]
export type IOracleProtocolChart = Array<[number, number]>

// Oracle total chart data as tuple of [timestamp, value]
export type IOracleChart = Array<[number, number]>

// Chain chart data as tuple of [timestamp, value]
export type IOracleChainChart = Array<[number, number]>

// Protocol chain breakdown chart item with timestamp and dynamic chain keys
type IOracleProtocolChainBreakdownChartItem = {
	timestamp: number
} & Record<string, number>

export type IOracleProtocolChainBreakdownChart = Array<IOracleProtocolChainBreakdownChartItem>

// Chain protocol breakdown chart item with timestamp and dynamic protocol keys
type IOracleChainProtocolBreakdownChartItem = {
	timestamp: number
} & Record<string, number>

export type IOracleChainProtocolBreakdownChart = Array<IOracleChainProtocolBreakdownChartItem>
