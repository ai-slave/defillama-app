import type { RuntimePieChartData } from '~/components/ECharts/PieChart/data'
import type { BridgeNetflowPeriod, RawBridgeInfo } from './api.types'

export interface BridgeNetflowChartPoint {
	chain: string
	value: number
}

export type BridgeNetflowChartData = Record<BridgeNetflowPeriod, BridgeNetflowChartPoint[]>

export interface BridgeVolumeChartPoint {
	date: number
	Deposited: number | null
	Withdrawn: number | null
}

export interface BridgeOverviewVolumeChartPoint {
	date: number
	Deposits: number | null
	Withdrawals: number | null
}

export type BridgeOverviewVolumeChartTuple = [date: number, deposits: number | null, withdrawals: number | null]

export interface BridgeTokenTableRow {
	symbol: string
	token: string
	deposited: number | null
	withdrawn: number | null
	volume: number | null
}

export interface BridgeAddressTableRow {
	address: string
	deposited: number | null
	withdrawn: number | null
	txs: number
}

export interface BridgePieChartSlice {
	name: string
	value: number
}

export interface BridgeTableData {
	tokensTableData: BridgeTokenTableRow[]
	addressesTableData: BridgeAddressTableRow[]
	tokenDeposits: RuntimePieChartData | null
	tokenWithdrawals: RuntimePieChartData | null
	totalDepositedUSD: number | null
	totalWithdrawnUSD: number | null
	totalDepositTxs: number
	totalWithdrawalTxs: number
	dataTimestamp: number
}

export interface BridgePageData {
	displayName: string
	logo: string
	chains: string[]
	defaultChain: string
	volumeDataByChain: Record<string, BridgeVolumeChartPoint[]>
	tableDataByChain: Record<string, BridgeTableData>
	config: RawBridgeInfo
}
