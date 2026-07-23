import type { IHackApiItem } from '../Hacks/api.types'

export interface IProtocolRaise {
	round: string
	amount: number
	valuation: string
	date: number
	defillamaId: string
	source?: string
	leadInvestors?: Array<string>
	otherInvestors?: Array<string>
	investors?: Array<string>
}

export interface IProtocolWarningBanner {
	message: string
	until?: number | string
	level: 'low' | 'alert' | 'rug'
}

export interface IProtocolMetricsV2 {
	id: string
	name: string
	address?: string | null
	symbol?: string | null
	url: string
	referralUrl?: string | null
	description: string
	chain: string
	logo: string
	audits: string | null
	audit_note: string | null
	gecko_id: string | null
	cmcId: string | null
	category: string
	tags?: Array<string> | null
	chains: Array<string>
	module?: string | null
	treasury?: string | null
	twitter: string
	audit_links: Array<string>
	openSource?: boolean
	forkedFrom: Array<string>
	oraclesByChain: Record<string, Array<string>>
	parentProtocol?: string
	governanceID?: Array<string>
	github?: Array<string>
	currentChainTvls?: Record<string, number>
	isParentProtocol?: boolean
	mcap: number | null
	methodology?: string
	raises?: Array<IProtocolRaise>
	hacks?: Array<IHackApiItem>
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

type ProtocolChartBreakdownType = 'chain-breakdown' | 'token-breakdown'

type IProtocolChartTimestamp = string | number

type IProtocolValueChartRawPoint = [IProtocolChartTimestamp, number]
export type IProtocolValueChartRaw = IProtocolValueChartRawPoint[]
type IProtocolValueChartPoint = [number, number]
export type IProtocolValueChart = IProtocolValueChartPoint[]

export type IProtocolChainBreakdownValue = Record<string, number>
type IProtocolChainBreakdownChartRawPoint = [IProtocolChartTimestamp, IProtocolChainBreakdownValue]
export type IProtocolChainBreakdownChartRaw = IProtocolChainBreakdownChartRawPoint[]
type IProtocolChainBreakdownChartPoint = [number, IProtocolChainBreakdownValue]
export type IProtocolChainBreakdownChart = IProtocolChainBreakdownChartPoint[]

export type IProtocolTokenBreakdownValue = Record<string, number>
type IProtocolTokenBreakdownChartRawPoint = [IProtocolChartTimestamp, IProtocolTokenBreakdownValue]
export type IProtocolTokenBreakdownChartRaw = IProtocolTokenBreakdownChartRawPoint[]
type IProtocolTokenBreakdownChartPoint = [number, IProtocolTokenBreakdownValue]
export type IProtocolTokenBreakdownChart = IProtocolTokenBreakdownChartPoint[]

export interface IProtocolChartV2Params {
	protocol: string
	key?: string
	currency?: string
	tokensToExclude?: string[]
	breakdownType?: ProtocolChartBreakdownType
	timeout?: number
}

export interface IProtocolExpenses {
	protocolId: string
	headcount?: number
	annualUsdCost: Record<string, number>
	annualTokenCosts?: Record<string, Record<string, number>>
	sources?: Array<string> | null
	notes?: Array<string> | null
	lastUpdate?: string | null
}
