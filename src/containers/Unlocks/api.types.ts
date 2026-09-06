type NumericString = `${number}`

interface EmissionEventFields {
	description: string
	category: string
}

export type RawEmissionEvent =
	| (EmissionEventFields & {
			unlockType: 'cliff'
			timestamp: number | NumericString
			noOfTokens: readonly [number | null]
	  })
	| (EmissionEventFields & {
			unlockType: 'linear'
			timestamp: number | NumericString
			noOfTokens: readonly [number | null, number | null]
			rateDurationDays: number
	  })

export type KnownCliffEmissionEvent = EmissionEventFields & {
	unlockType: 'cliff'
	timestamp: number
	noOfTokens: readonly [number]
	hasUnknownTokenAmount?: never
}

export type KnownLinearEmissionEvent = EmissionEventFields & {
	unlockType: 'linear'
	timestamp: number
	noOfTokens: readonly [number | null, number]
	rateDurationDays: number
	hasUnknownTokenAmount?: never
}

export type UnknownCliffEmissionEvent = EmissionEventFields & {
	unlockType: 'cliff'
	timestamp: number
	noOfTokens: readonly []
	hasUnknownTokenAmount: true
}

export type UnknownLinearEmissionEvent = EmissionEventFields & {
	unlockType: 'linear'
	timestamp: number
	noOfTokens: readonly []
	rateDurationDays: number
	hasUnknownTokenAmount: true
}

export type KnownEmissionEvent = KnownCliffEmissionEvent | KnownLinearEmissionEvent
export type UnknownEmissionEvent = UnknownCliffEmissionEvent | UnknownLinearEmissionEvent
export type EmissionEvent = KnownEmissionEvent | UnknownEmissionEvent

export interface EmissionCliffAllocation {
	recipient: string
	category: string
	unlockType: 'cliff'
	amount: number
}

interface EmissionLinearAllocationFields {
	recipient: string
	category: string
	unlockType: 'linear_start' | 'linear_rate_change'
	previousRatePerWeek: number
	newRatePerWeek: number | null
}

export interface RawEmissionLinearAllocation extends EmissionLinearAllocationFields {
	endTimestamp: number | NumericString
}

export interface EmissionLinearAllocation extends EmissionLinearAllocationFields {
	endTimestamp: number
}

interface StructuredEmissionEventFields {
	timestamp: number
	cliffAllocations: Array<EmissionCliffAllocation>
	summary: {
		totalTokensCliff?: number
		netChangeInWeeklyRate?: number | null
		totalNewWeeklyRate?: number | null
	}
}

export interface RawStructuredEmissionEvent extends StructuredEmissionEventFields {
	linearAllocations: Array<RawEmissionLinearAllocation>
}

export interface StructuredEmissionEvent extends StructuredEmissionEventFields {
	linearAllocations: Array<EmissionLinearAllocation>
}

export interface TokenPriceSnapshot {
	symbol: string
	price: number
	timestamp: number
	confidence: number
	decimals?: number
}

export interface ProtocolEmissionNextEvent {
	date: number
	toUnlock: number
	proportion?: number
}

export interface ProtocolEmissionNext24h {
	cliff: number
	linear: number
	total: number
	unknownEventCount: number
}

interface ProtocolEmissionDtoBase<UnlockEvent> {
	name: string
	token: string
	sources: Array<string>
	protocolId: string | null
	protocolSlug?: string
	gecko_id?: string | null
	circSupply: number
	circSupply30d: number
	supplyGeneratedAtSec?: number
	mcapUpdatedAtSec?: number
	totalLocked: number
	maxSupply: number
	mcap?: number
	unlocksPerDay: number | null
	nextEvent?: ProtocolEmissionNextEvent
	tokenPrice?: Array<TokenPriceSnapshot>
	unlockEvents: Array<UnlockEvent>
	next24h?: ProtocolEmissionNext24h
}

export interface RawProtocolEmission extends ProtocolEmissionDtoBase<RawStructuredEmissionEvent> {
	events: Array<RawEmissionEvent>
}

export interface ProtocolEmission extends ProtocolEmissionDtoBase<StructuredEmissionEvent> {
	events: Array<EmissionEvent>
}

export interface InsiderAllocation {
	category: string
	allocationSection?: string
	received: number
}

export interface Insider {
	address: string
	label?: string
	allocations: Array<InsiderAllocation>
	received: number
	balance: number
	staked: number
	transferredOut: number
}

export interface InsidersPayload {
	methodology: string
	addresses: Array<Insider>
}

export interface EmissionSeriesPoint {
	timestamp: number
	unlocked: number
	rawEmission: number
	burned: number
	isTBD?: boolean
	isForecast?: boolean
}

export interface EmissionSeries {
	label: string
	data: Array<EmissionSeriesPoint>
}

export interface TokenAllocationValues {
	current: Record<string, number>
	final: Record<string, number>
	progress: Record<string, number>
}

export interface TokenAllocationSplit extends TokenAllocationValues {
	bySection: TokenAllocationValues
}

export interface ProtocolEmissionChartData {
	data: Array<EmissionSeries>
	tokenAllocation: TokenAllocationSplit
}

export interface ProtocolEmissionMetadata<Event, UnlockEvent> {
	token: string
	protocolIds: Array<string>
	events: Array<Event>
	unlockEvents: Array<UnlockEvent>
	total?: number
	notes?: Array<string>
	chain?: string
	overrideMaxSupply?: boolean
	version?: 2
}

export interface ProtocolEmissionComponentMetadata {
	chain?: string
	chainId?: string
	contract?: string
	contracts?: Array<string>
	eventSignature?: string
	hedgeyContract?: string
	siloToken?: string
}

export interface ProtocolEmissionComponent {
	name: string
	methodology?: string
	isIncentive: boolean
	isTBD: boolean
	isForecast?: boolean
	protocols?: Array<string>
	emission24h: number
	emission7d: number
	emission30d: number
	metadata?: ProtocolEmissionComponentMetadata
	unlockUsdChart: Array<TokenIncentiveChartPoint>
}

export interface ProtocolEmissionComponentSection {
	displayName: string
	methodology?: string
	isIncentive?: boolean
	isTBD?: boolean
	isForecast?: boolean
	colorFrom?: string
	protocols?: Array<string>
	emission24h: number
	emission7d: number
	emission30d: number
	components: Record<string, ProtocolEmissionComponent>
}

export interface ProtocolEmissionComponentData {
	sections: Record<string, ProtocolEmissionComponentSection>
}

export interface EmissionSupplyMetrics {
	maxSupply: number
	adjustedSupply: number
	tbdAmount: number
	incentiveAmount: number
	nonIncentiveAmount: number
}

interface ProtocolEmissionDetailDtoBase<Event, UnlockEvent> {
	name: string
	gecko_id: string | null
	pId: string | null
	defillamaIds: Array<string>
	chainName: string
	protocolCategory?: string
	metadata: ProtocolEmissionMetadata<Event, UnlockEvent>
	documentedData: ProtocolEmissionChartData
	realTimeData?: ProtocolEmissionChartData
	unlockUsdChart: Array<TokenIncentiveChartPoint>
	futures?: { openInterest: number; fundingRate: number }
	categories: Record<string, Array<string>>
	supplyMetrics?: EmissionSupplyMetrics
	insiders?: InsidersPayload
}

type ProtocolEmissionDetailVersion =
	| { version?: never; componentData?: never }
	| { version: 2; componentData: ProtocolEmissionComponentData }

export type RawProtocolEmissionDetail = ProtocolEmissionDetailDtoBase<RawEmissionEvent, RawStructuredEmissionEvent> &
	ProtocolEmissionDetailVersion
export type ProtocolEmissionDetail = ProtocolEmissionDetailDtoBase<EmissionEvent, StructuredEmissionEvent> &
	ProtocolEmissionDetailVersion

export type TokenIncentiveChartPoint = [timestamp: number, value: number]

export interface ProtocolEmissionSupplyMetricsEntry {
	name: string
	supplyMetrics: EmissionSupplyMetrics
}

export type ProtocolEmissionSupplyMetricsMap = Record<string, ProtocolEmissionSupplyMetricsEntry>

// Chart data is kept object-shaped while categories are still dynamic. Renderer
// datasets are materialized as positional rows once the dimension order is known.
export interface EmissionsDataset {
	source: Array<[timestamp: number, ...values: Array<number | null>]>
	dimensions: [timestamp: 'timestamp', ...series: Array<string>]
}

export interface EmissionsChartRow {
	timestamp: number
	[label: string]: number | null
}

interface EmissionsChartConfigItem {
	type: 'line'
	name: string
	encode: { x: 0; y: number }
	color?: string
	stack: string
}

export type EmissionsChartConfig = Array<EmissionsChartConfigItem>
