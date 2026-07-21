import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'

// Raw API request/response types for emissions/unlocks API endpoints

export interface EmissionEvent {
	timestamp: number
	noOfTokens: number[]
	description?: string
	category?: string
	unlockType?: string
	rateDurationDays?: number
}

interface TokenPriceSnapshot {
	symbol?: string | null
	price?: number | null
}

export interface TokenAllocationSplit {
	current: Record<string, number>
	final: Record<string, number>
	progress?: Record<string, number>
	bySection?: Record<string, unknown>
}

export type TokenAllocationPayload = TokenAllocationSplit | Record<string, number>

export interface ProtocolEmission {
	name: string
	token: string
	gecko_id?: string | null
	events?: EmissionEvent[] | null
	tokenPrice?: TokenPriceSnapshot[] | null
	unlockEvents?: unknown
	tPrice?: number | null
	tSymbol?: string | null
	circSupply?: number | null
	maxSupply?: number | null
	totalLocked?: number | null
	mcap?: number | null
	unlocksPerDay?: number | null
}

export interface InsiderAllocation {
	category: string
	allocationSection?: string
	received: number
}

export interface Insider {
	address: string
	label?: string
	allocations: InsiderAllocation[]
	received: number
	balance: number
	staked: number
	transferredOut: number
}

export interface InsidersPayload {
	methodology: string
	addresses: Insider[]
}

export interface ProtocolEmissionDetail {
	name: string
	gecko_id?: string | null
	metadata?: {
		token?: string | null
		notes?: string[] | null
		events?: EmissionEvent[] | null
	} | null
	documentedData?: {
		data?: Array<{
			label?: string
			data?: Array<{
				timestamp: number
				unlocked?: number | null
				rawEmission?: number | null
				burned?: number | null
				isTBD?: boolean
				isForecast?: boolean
			}>
		}> | null
		tokenAllocation?: TokenAllocationPayload | null
	} | null
	realTimeData?: {
		data?: Array<{
			label?: string
			data?: Array<{
				timestamp: number
				unlocked?: number | null
				rawEmission?: number | null
				burned?: number | null
				isTBD?: boolean
				isForecast?: boolean
			}>
		}> | null
		tokenAllocation?: TokenAllocationPayload | null
	} | null
	unlockUsdChart?: unknown[] | null
	futures?: Record<string, unknown> | null
	categories?: Record<string, string[]> | null
	componentData?: {
		sections?: Record<string, EmissionSectionMetadata>
	} | null
	insiders?: InsidersPayload | null
}

export interface EmissionSectionMetadata {
	isTBD?: boolean
	isForecast?: boolean
	colorFrom?: string
	[key: string]: unknown
}

export interface EmissionSupplyMetrics {
	maxSupply: number
	adjustedSupply: number
	tbdAmount: number
	incentiveAmount: number
	nonIncentiveAmount: number
}

export interface ProtocolEmissionSupplyMetricsEntry {
	name: string
	supplyMetrics: EmissionSupplyMetrics
}

export type ProtocolEmissionSupplyMetricsMap = Record<string, ProtocolEmissionSupplyMetricsEntry>

// Chart data is kept object-shaped while categories are still dynamic. Renderer
// datasets are materialized as positional rows once the dimension order is known.
export interface EmissionsDataset {
	source: MultiSeriesChartDataset['source']
	dimensions: string[]
}

export interface EmissionsChartRow {
	timestamp: number
	[label: string]: number | null
}

interface EmissionsChartConfigItem {
	type: 'line'
	name: string
	encode: { x: 0; y: number }
	color: string | undefined
	stack: string
}

export type EmissionsChartConfig = EmissionsChartConfigItem[]
