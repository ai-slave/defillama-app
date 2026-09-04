import type * as echarts from 'echarts/core'
import type {
	ChartTimeGrouping,
	ChartTimeGroupingWithCumulative,
	MultiSeriesChartOptions
} from '~/components/ECharts/MultiSeriesChart/types'
import type { SponsoredResearchReportSummary } from '~/containers/Articles/types'
import type { BridgeVolumePoint } from '~/containers/Bridges/api.types'
import type { Hack } from '~/containers/Hacks/model'
import type { Raise } from '~/containers/Raises/model'
import type { IncomeStatementMetric, IProtocolMetricsV2 } from './api.types'
import { protocolCharts, type ProtocolChartsLabels } from './constants'

export interface IProtocolPageMetrics {
	tvl: boolean
	dexs: boolean
	dexsNotionalVolume: boolean
	perps: boolean
	openInterest: boolean
	optionsPremiumVolume: boolean
	optionsNotionalVolume: boolean
	dexAggregators: boolean
	perpsAggregators: boolean
	bridgeAggregators: boolean
	stablecoins: boolean
	bridge: boolean
	treasury: boolean
	unlocks: boolean
	incentives: boolean
	yields: boolean
	fees: boolean
	revenue: boolean
	forks: boolean
	governance: boolean
	nfts: boolean
	dev: boolean
	inflows: boolean
	activeUsers: boolean
	newUsers: boolean
	txCount: boolean
	gasUsed: boolean
	liquidationVolume: boolean
	collateralLiquidated: boolean
	borrowed: boolean
	tokenRights: boolean
}

export interface IProtocolFaqAnswerPart {
	text: string
	href?: string
}

export interface IProtocolFaqItem {
	id: string
	question: string
	answer: IProtocolFaqAnswerPart[]
}

interface IAdapterOverview {
	total24h: number | null
	total7d: number | null
	total30d: number | null
	total1y: number | null
	annualized1y: number | null
	totalAllTime: number | null
	methodology?: string | null
	methodologyURL?: string | null
	breakdownMethodology?: Record<string, string> | null
	childMethodologies?: Array<[string, string | null, string | null]>
	defaultChartView?: ChartTimeGrouping
	chainBreakdown?: Record<
		string,
		{ total24h: number | null; total7d: number | null; total30d: number | null; totalAllTime: number | null }
	> | null
}

type IProtocolOverviewChartSeries = Array<[number, number | null]>
type IProtocolOverviewInitialMultiSeriesChartData = Partial<Record<ProtocolChartsLabels, IProtocolOverviewChartSeries>>

export interface IProtocolOverviewPageData {
	initialMultiSeriesChartData: IProtocolOverviewInitialMultiSeriesChartData
	id: string
	name: string
	token: {
		symbol: string | null
		gecko_id: string | null
		gecko_url: string | null
		explorer_url: string | null
		tokenPageRoute?: string | null
	}
	category?: string | null
	tags?: Array<string> | null
	otherProtocols?: Array<string> | null
	childProtocols?: Array<{
		name: string
		href: string
		category: string | null
		chains: string[]
	}>
	deprecated?: boolean
	chains: Array<string> | null
	currentTvlByChain: Record<string, number> | null
	description?: string
	website?: string | null
	isWebsiteReferral?: boolean
	twitter?: string | null
	safeHarbor?: boolean
	tvlMethodology?: string | null
	tvlMethodologyUrl?: string | null
	github?: Array<string> | null
	metrics: IProtocolPageMetrics
	fees: IAdapterOverview | null
	revenue: IAdapterOverview | null
	holdersRevenue: IAdapterOverview | null
	dexVolume: IAdapterOverview | null
	dexNotionalVolume: IAdapterOverview | null
	dexAggregatorVolume: IAdapterOverview | null
	perpVolume: IAdapterOverview | null
	openInterest: IAdapterOverview | null
	perpAggregatorVolume: IAdapterOverview | null
	bridgeAggregatorVolume: IAdapterOverview | null
	optionsPremiumVolume: IAdapterOverview | null
	optionsNotionalVolume: IAdapterOverview | null
	liquidationVolume: IAdapterOverview | null
	collateralLiquidated: IAdapterOverview | null
	bridgeVolume: Array<Pick<BridgeVolumePoint, 'date' | 'depositUSD' | 'withdrawUSD'>> | null
	incentives?: {
		emissions24h: number | null
		emissions7d: number | null
		emissions30d: number | null
		emissions1y: number | null
		emissionsAllTime: number | null
		emissionsMonthlyAverage1y: number | null
		methodology?: string
	} | null
	treasury: {
		ownTokens: number | null
		stablecoins: number | null
		majors: number | null
		others: number | null
		total: number | null
	} | null
	unlocks: {
		recent?: { timestamp: number; amount: number }
		upcoming?: { timestamp: number; amount: number }
	} | null
	yields: { noOfPoolsTracked: number | null; averageAPY: number | null } | null
	governance: {
		lastProposal: {
			title: string
			status: string
		}
	} | null
	articles: SponsoredResearchReportSummary[] | null
	users?: {
		activeUsers: number | null
		newUsers: number | null
		transactions: number | null
		gasUsed: number | null
		gasUsedUsd: number | null
	} | null
	raises: Array<Raise> | null
	expenses: {
		headcount: number | null
		total: number
		annualUsdCost: Array<[string, number]>
		sources: Array<string> | null
		notes: Array<string> | null
		lastUpdate: string
	} | null
	tokenCGData?: {
		price: {
			current: number | null
			ath: number | null
			athDate: string | null
			atl: number | null
			atlDate: string | null
		}
		marketCap: { current: number | null }
		totalSupply: number | null
		fdv: { current: number | null }
		volume24h: {
			total: number | null
			cex: number | null
			dex: number | null
		}
		symbol: string | null
	} | null
	outstandingFDV: number | null
	audits: {
		total: number
		auditLinks: Array<string>
		note: string | null
	} | null
	isCEX?: boolean
	researchSponsorEntity?: {
		entityType: 'protocol' | 'cex'
		entitySlug: string
	}
	hasKeyMetrics?: boolean
	competitors?: Array<{ name: string; tvl: number }>
	hacks: Array<Hack>
	chartDenominations: Array<{ symbol: string; geckoId?: string | null }>
	chartColors: Record<string, string>
	availableCharts: ProtocolChartsLabels[]
	hallmarks: Array<[number, string]>
	rangeHallmarks: Array<[[number, number], string]>
	geckoId: string | null
	governanceApis: Array<string> | null
	incomeStatement?: {
		data: Record<
			'monthly' | 'quarterly' | 'yearly' | 'cumulative',
			Record<string, { timestamp: number; values: Record<string, IncomeStatementMetric> }>
		>
		labelsByType: Record<string, Array<string>>
		methodology: Record<string, string>
		breakdownMethodology: Record<string, Record<string, string>>
		hasOtherTokenHolderFlows: boolean
		hasTokenHolderNetIncome: boolean
		components?: Array<{
			name: string
			id: string
			protocolType: string
			module: string | null
		}> | null
	} | null
	openSmolStatsSummaryByDefault?: boolean
	warningBanners?: IProtocolMetricsV2['warningBanners']
	defaultChartView?: ChartTimeGrouping
	seoTitle: string
	seoDescription: string
	defaultToggledCharts: ProtocolChartsLabels[]
	isOracleProtocol: boolean
	oracleTvs: Record<string, number> | null
	entityQuestions?: string[]
	faqItems?: IProtocolFaqItem[]
	treasuryMethodologyUrl?: string | null
}

export interface IToggledMetrics extends Record<
	(typeof protocolCharts)[keyof typeof protocolCharts],
	'true' | 'false'
> {
	events: 'true' | 'false'
	denomination: string | null
}

export const createDisabledProtocolToggledMetrics = (): IToggledMetrics => ({
	tvl: 'false',
	totalAssets: 'false',
	tvs: 'false',
	mcap: 'false',
	tokenPrice: 'false',
	tokenVolume: 'false',
	fdv: 'false',
	fees: 'false',
	revenue: 'false',
	holdersRevenue: 'false',
	dexVolume: 'false',
	dexNotionalVolume: 'false',
	perpVolume: 'false',
	openInterest: 'false',
	optionsPremiumVolume: 'false',
	optionsNotionalVolume: 'false',
	perpAggregatorVolume: 'false',
	bridgeAggregatorVolume: 'false',
	dexAggregatorVolume: 'false',
	liquidationVolume: 'false',
	collateralLiquidated: 'false',
	unlocks: 'false',
	incentives: 'false',
	staking_tvl: 'false',
	borrowed_tvl: 'false',
	medianApy: 'false',
	usdInflows: 'false',
	treasury: 'false',
	bridgeDeposits: 'false',
	bridgeWithdrawals: 'false',
	totalProposals: 'false',
	successfulProposals: 'false',
	maxVotes: 'false',
	activeAddresses: 'false',
	newAddresses: 'false',
	transactions: 'false',
	gasUsed: 'false',
	tweets: 'false',
	nftVolume: 'false',
	bridgeVolume: 'false',
	events: 'false',
	denomination: null
})

export interface IProtocolCoreChartProps {
	chartData: Partial<Record<ProtocolChartsLabels, Array<[number, number | null]>>>
	chartColors: Record<string, string>
	valueSymbol?: string
	hallmarks: Array<[number, string]> | null
	rangeHallmarks: Array<[[number, number], string]> | null
	chartOptions?: MultiSeriesChartOptions
	height?: string
	unlockTokenSymbol?: string | null
	gasUsedValueSymbol?: string
	isThemeDark: boolean
	groupBy?: ChartTimeGroupingWithCumulative
	hideDataZoom?: boolean
	onReady?: (instance: echarts.ECharts | null) => void
}
