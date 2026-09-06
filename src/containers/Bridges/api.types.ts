export interface RawBridgeInfo {
	id: number
	defillamaId?: string
	name: string
	displayName: string
	icon: string
	volumePrevDay: number
	volumePrev2Day: number
	lastHourlyVolume: number
	last24hVolume: number
	lastDailyVolume: number
	dayBeforeLastVolume: number
	weeklyVolume: number
	monthlyVolume: number
	chains: Array<string>
	destinationChain: string
	url?: string
	slug?: string
}

export interface RawBridgeChainInfo {
	gecko_id?: string | null
	volumePrevDay: number
	tokenSymbol: string | null
	name: string
}

export interface RawBridgesResponse {
	bridges: Array<RawBridgeInfo>
	dataUpdatedAt: string | null
}

export interface RawBridgesWithChainsResponse extends RawBridgesResponse {
	chains: Array<RawBridgeChainInfo>
}

export interface RawBridgeVolumePoint {
	date: string
	depositUSD: number | null
	withdrawUSD: number | null
	depositTxs: number
	withdrawTxs: number
}

export type RawBridgeVolumeResponse = Array<RawBridgeVolumePoint>

export interface BridgeVolumePoint {
	date: number
	depositUSD: number | null
	withdrawUSD: number | null
	depositTxs: number
	withdrawTxs: number
}

export type BridgeVolumeResponse = Array<BridgeVolumePoint>

export interface RawBridgeVolumeBySlugBridge {
	id: number
	displayName: string
	slug: string
	bridgeDbName: string
}

export interface RawBridgeVolumeBySlugResponse {
	bridge: RawBridgeVolumeBySlugBridge
	dailyVolumes: Array<RawBridgeVolumePoint>
}

export interface BridgeVolumeBySlugResponse {
	bridge: RawBridgeVolumeBySlugBridge
	dailyVolumes: Array<BridgeVolumePoint>
}

export interface RawBridgeTokenStats {
	usdValue: number | null
	amount: string
	symbol: string
	decimals: number
}

export interface RawBridgeAddressStats {
	usdValue: number | null
	txs: number
}

export interface RawBridgeDayStats {
	date: number
	totalDepositedUSD: number | null
	totalWithdrawnUSD: number | null
	totalDepositTxs: number
	totalWithdrawalTxs: number
	totalTokensDeposited: Record<string, RawBridgeTokenStats>
	totalTokensWithdrawn: Record<string, RawBridgeTokenStats>
	totalAddressDeposited: Record<string, RawBridgeAddressStats>
	totalAddressWithdrawn: Record<string, RawBridgeAddressStats>
}

export interface BridgeDayTokenStats {
	usdValue: number | null
	symbol: string
}

export interface BridgeDayAddressStats {
	usdValue: number | null
	txs: number
}

export interface BridgeDayStats {
	date: number
	totalDepositedUSD: number | null
	totalWithdrawnUSD: number | null
	totalDepositTxs: number
	totalWithdrawalTxs: number
	totalTokensDeposited: Record<string, BridgeDayTokenStats>
	totalTokensWithdrawn: Record<string, BridgeDayTokenStats>
	totalAddressDeposited: Record<string, BridgeDayAddressStats>
	totalAddressWithdrawn: Record<string, BridgeDayAddressStats>
}

export interface RawBridgeLargeTransaction {
	date: number
	txHash: string
	from: string
	to: string
	token: string
	symbol: string
	amount: string
	isDeposit: boolean
	bridge: string
	chain: string
	usdValue: string
}

export type RawBridgeLargeTransactionsResponse = Array<RawBridgeLargeTransaction>

export interface RawBridgeTransaction {
	tx_hash: string
	ts: string
	tx_block: number
	tx_from: string
	tx_to: string
	token: string
	amount: string
	is_deposit: boolean
	is_usd_volume: boolean
	chain: string
	bridge_name: string
	usd_value: string | null
}

export type RawBridgeTransactionsResponse = Array<RawBridgeTransaction>

export interface RawBridgeTransactionsPage {
	rows: RawBridgeTransactionsResponse
	hasMore: boolean
	nextCursor?: string
}

export interface RawBridgeNetflowEntry {
	chain: string
	net_flow: string
	deposited_usd: string
	withdrawn_usd: string
}

export type RawBridgeNetflowsResponse = Array<RawBridgeNetflowEntry>
export interface BridgeNetflowEntry {
	chain: string
	netFlow: number
	depositedUsd: number
	withdrawnUsd: number
}
export type BridgeNetflowsResponse = Array<BridgeNetflowEntry>
export type BridgeNetflowPeriod = 'day' | 'week' | 'month'

export interface RawBridgeTxCountInfo {
	id: number
	displayName: string
	slug?: string
	txsPrevDay: number
	depositTxs24h: number
	withdrawTxs24h: number
}

export interface RawBridgeTxCountsResponse {
	bridges: Array<RawBridgeTxCountInfo>
}
