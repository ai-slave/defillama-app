import type { BlockExplorersResponse } from '~/api/types'

export interface RawLiquidationPosition {
	owner: string
	liqPrice: number
	collateral: string
	collateralId: string
	collateralAmount: number
	collateralAmountUsd: number
}

export interface RawProtocolsResponse {
	protocols: Array<string>
}

export interface RawToken {
	symbol: string
	decimals: number
	price: number
}

export type RawTokenMap = Record<string, RawToken>

export type RawMultiChainTokenMap = Record<string, RawTokenMap>

interface RawLiquidationsResponseBase<TData, TTokens> {
	data: TData
	tokens: TTokens
	validThresholds: ['100k', '10k', 'all']
	timestamp: number
}

export type RawAllLiquidationsResponse = RawLiquidationsResponseBase<
	Partial<Record<string, Record<string, Array<RawLiquidationPosition>>>>,
	RawMultiChainTokenMap
>

export type RawLiquidationsProtocolData = Record<string, Array<RawLiquidationPosition>>

export interface NavLink {
	label: string
	to: string
}

export interface LiquidationsProtocolRef {
	id: string
	name: string
	slug: string
}

export interface LiquidationsChainRef {
	id: string
	name: string
	slug: string
}

export interface LiquidationPosition {
	protocolId: string
	protocolName: string
	protocolSlug: string
	chainId: string
	chainName: string
	chainSlug: string
	owner: string
	liqPrice: number
	collateral: string
	collateralId: string
	collateralAmount: number
	collateralAmountUsd: number
}

export interface OverviewProtocolRow extends LiquidationsProtocolRef {
	positionCount: number
	chainCount: number
	collateralCount: number
	totalCollateralUsd: number
}

export interface OverviewChainRow extends LiquidationsChainRef {
	positionCount: number
	protocolCount: number
	collateralCount: number
	totalCollateralUsd: number
}

export interface ProtocolChainRow extends LiquidationsChainRef {
	protocolId: string
	protocolName: string
	protocolSlug: string
	positionCount: number
	collateralCount: number
	totalCollateralUsd: number
}

export interface LiquidationsDistributionChartSeries {
	key: string
	label: string
	usd: Array<number>
	amount: Array<number>
	totalUsd: number
}

export type LiquidationsDistributionChartBreakdownKey = 'total' | 'protocol' | 'chain'

export interface LiquidationsDistributionChartView {
	bins: Array<number>
	series: Array<LiquidationsDistributionChartSeries>
}

export interface LiquidationsDistributionChartToken {
	key: string
	label: string
	totalUsd: number
	breakdowns: Record<LiquidationsDistributionChartBreakdownKey, LiquidationsDistributionChartView>
}

export interface LiquidationsDistributionChartData {
	tokens: Array<LiquidationsDistributionChartToken>
}

export interface LiquidationsOverviewPageProps {
	protocolLinks: Array<NavLink>
	timestamp: number
	protocolCount: number
	chainCount: number
	positionCount: number
	totalCollateralUsd: number
	distributionChart: LiquidationsDistributionChartData
	protocolRows: Array<OverviewProtocolRow>
	chainRows: Array<OverviewChainRow>
}

export interface LiquidationsOverviewShell {
	protocolLinks: Array<NavLink>
}

export interface TokenLiquidationsSectionData {
	tokenSymbol: string
	timestamp: number
	positionCount: number
	protocolCount: number
	chainCount: number
	totalCollateralUsd: number
	distributionChart: LiquidationsDistributionChartData
	protocolRows: Array<OverviewProtocolRow>
	chainRows: Array<OverviewChainRow>
}

export interface LiquidationsProtocolPageProps {
	protocolLinks: Array<NavLink>
	chainLinks: Array<NavLink>
	protocolId: string
	protocolName: string
	protocolSlug: string
	timestamp: number
	chainCount: number
	positionCount: number
	collateralCount: number
	totalCollateralUsd: number
	distributionChart: LiquidationsDistributionChartData
	chainRows: Array<ProtocolChainRow>
	ownerBlockExplorers: BlockExplorersResponse
	positions: Array<LiquidationPosition>
}

export interface LiquidationsProtocolShell {
	protocolLinks: Array<NavLink>
	chainLinks: Array<NavLink>
	protocolName: string
	protocolSlug: string
}

export interface LiquidationsChainPageProps {
	protocolLinks: Array<NavLink>
	chainLinks: Array<NavLink>
	protocolId: string
	protocolName: string
	protocolSlug: string
	chainId: string
	chainName: string
	chainSlug: string
	timestamp: number
	positionCount: number
	collateralCount: number
	totalCollateralUsd: number
	distributionChart: LiquidationsDistributionChartData
	chainRows: Array<ProtocolChainRow>
	ownerBlockExplorers: BlockExplorersResponse
	positions: Array<LiquidationPosition>
}

export interface LiquidationsChainShell {
	protocolLinks: Array<NavLink>
	chainLinks: Array<NavLink>
	protocolName: string
	protocolSlug: string
	chainName: string
	chainSlug: string
}
