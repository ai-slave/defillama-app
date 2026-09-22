import type { IHackApiItem } from '../Hacks/api.types'
import type { Hack } from '../Hacks/model'
import type { RaisesApiItem } from '../Raises/api.types'
import type { Raise } from '../Raises/model'

export interface IProtocolWarningBanner {
	message: string
	until?: number | string
	level: 'low' | 'alert' | 'rug'
}

interface IProtocolMetricsV2Common {
	id: string
	name: string
	hasInviteCodes?: boolean
	address?: string | null
	url: string
	referralUrl?: string
	audits?: string | null
	gecko_id: string | null
	cmcId: string | null
	chains: Array<string>
	audit_links?: Array<string>
	openSource?: boolean
	forkedFrom?: Array<string>
	oraclesByChain?: Record<string, Array<string>>
	github?: Array<string>
	currentChainTvls: Record<string, number>
	mcap: number | null
	methodology?: string
	raises: Array<Raise>
	hacks: Array<Hack>
	otherProtocols?: Array<string>
	hallmarks?: Array<[number, string]> | Array<[[number, number], string]>
	dimensions?: Record<string, { genuineSpikes?: Array<[string, string]>; adapter?: string }> | null
	stablecoins?: Array<string>
	misrepresentedTokens?: boolean
	deprecated?: boolean
	rugged?: boolean
	deadUrl?: boolean
	warningBanners?: Array<IProtocolWarningBanner>
	wrongLiquidity?: boolean
	tvlCodePath?: string
	treasuryCodePath?: string
}

type IProtocolCategoryAndTags = { category: string; tags?: Array<string> }

export type IProtocolParentMetricsV2 = IProtocolMetricsV2Common & {
	isParentProtocol: true
	symbol: string | null
	description: string
	logo: string
	twitter: string | null
	treasury: string | null
	categories?: Array<string>
	category?: never
	tags?: never
	chain?: never
	module?: never
	parentProtocol?: never
	parentProtocolSlug?: never
	otherProtocols: Array<string>
}

export type IProtocolChildMetricsV2 = IProtocolMetricsV2Common &
	IProtocolCategoryAndTags & {
		isParentProtocol?: never
		symbol: string
		description: string | null
		logo: string | null
		twitter?: string | null
		treasury?: string | null
		chain: string
		module: string
		parentProtocol: string
		parentProtocolSlug?: string
		categories?: never
	}

export type IProtocolStandaloneMetricsV2 = IProtocolMetricsV2Common &
	IProtocolCategoryAndTags & {
		isParentProtocol?: never
		symbol: string
		description: string | null
		logo: string | null
		twitter?: string | null
		treasury?: string | null
		chain: string
		module: string
		parentProtocol?: never
		parentProtocolSlug?: never
		categories?: never
	}

export type IProtocolMetricsV2 = IProtocolParentMetricsV2 | IProtocolChildMetricsV2 | IProtocolStandaloneMetricsV2

export type IProtocolMetricsV2Api = IProtocolMetricsV2 extends infer Metrics
	? Metrics extends IProtocolMetricsV2
		? Omit<Metrics, 'hacks' | 'raises'> & {
				hacks: Array<IHackApiItem>
				raises: Array<RaisesApiItem>
			}
		: never
	: never

export type ProtocolChartBreakdownType = 'chain-breakdown' | 'token-breakdown'
export type ProtocolTvlKey = 'tvl' | 'staking' | 'borrowed' | 'pool2' | 'vesting' | 'all'
export type ProtocolTreasuryKey = 'tvl' | 'OwnTokens' | 'all'
export type ProtocolChartCurrency = 'token' | 'raw' | 'usd'

type IProtocolValueChartRawPoint = [number, number]
export type IProtocolValueChartRaw = Array<IProtocolValueChartRawPoint>
type IProtocolValueChartPoint = [number, number]
export type IProtocolValueChart = Array<IProtocolValueChartPoint>

export type IProtocolChainBreakdownValue = Record<string, number>
type IProtocolChainBreakdownChartRawPoint = [number, IProtocolChainBreakdownValue]
export type IProtocolChainBreakdownChartRaw = Array<IProtocolChainBreakdownChartRawPoint>
type IProtocolChainBreakdownChartPoint = [number, IProtocolChainBreakdownValue]
export type IProtocolChainBreakdownChart = Array<IProtocolChainBreakdownChartPoint>

export type IProtocolTokenBreakdownValue = Record<string, number>
type IProtocolTokenBreakdownChartRawPoint = [number, IProtocolTokenBreakdownValue]
export type IProtocolTokenBreakdownChartRaw = Array<IProtocolTokenBreakdownChartRawPoint>
type IProtocolTokenBreakdownChartPoint = [number, IProtocolTokenBreakdownValue]
export type IProtocolTokenBreakdownChart = Array<IProtocolTokenBreakdownChartPoint>

interface IProtocolMedianApyChartPoint {
	date: number
	medianAPY: number
}

export type IProtocolMedianApyChart = Array<IProtocolMedianApyChartPoint>

interface IProtocolChartParamsBase {
	protocol: string
	timeout?: number
}

export type ProtocolChartSelector =
	| { breakdownType?: never; currency?: never }
	| { breakdownType: 'chain-breakdown'; currency?: never }
	| { breakdownType: 'token-breakdown'; currency?: ProtocolChartCurrency }

export type IProtocolTvlChartParams = IProtocolChartParamsBase & {
	key?: ProtocolTvlKey
	tokensToExclude?: Array<string>
} & ProtocolChartSelector

export type IProtocolTreasuryChartParams = IProtocolChartParamsBase & {
	key?: ProtocolTreasuryKey
} & ProtocolChartSelector

export type IProtocolTvlTokenBreakdownChartParams = IProtocolChartParamsBase & {
	key?: ProtocolTvlKey
	tokensToExclude?: Array<string>
	currency?: ProtocolChartCurrency
}

export type IncomeStatementMetric = {
	value: number
	'by-label'?: Record<string, number>
}

export type IncomeStatementPeriod = Record<string, IncomeStatementMetric>
export type IncomeStatementPeriods = Record<string, IncomeStatementPeriod>

export interface IIncomeStatementApiResponse {
	aggregates: {
		monthly: IncomeStatementPeriods
		quarterly: IncomeStatementPeriods
		yearly: IncomeStatementPeriods
	}
	methodology?: Record<string, string> | null
	breakdownMethodology?: Record<string, string | Record<string, string>> | null
	childProtocols?: Array<{
		displayName: string
		methodology?: Record<string, string> | null
		breakdownMethodology?: Record<string, string | Record<string, string>> | null
	}> | null
	components?: Array<{
		name: string
		id: string
		protocolType: string
		module: string | null
	}> | null
}

export interface IProtocolExpenses {
	protocolId: string
	headcount?: number
	annualUsdCost: Record<string, number>
	sources: Array<string> | null
	notes?: Array<string> | null
	lastUpdate: string
}
