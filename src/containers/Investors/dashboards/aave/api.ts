import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { readInvestorApiJson, type ApiIsoTimestamp, type ApiNumericString } from '../../api.types'

// Aave GraphQL serializes monetary values and decimal rates as strings; normalization happens below.

export interface AaveReserveSupplyInfo {
	apy: { value: ApiNumericString }
	maxLTV: { value: ApiNumericString }
	liquidationThreshold: { value: ApiNumericString }
	liquidationBonus: { value: ApiNumericString }
	canBeCollateral: boolean
	supplyCap: { usd: string }
	supplyCapReached: boolean
	total: { value: string }
}

export interface AaveReserveBorrowInfo {
	apy: { value: string }
	total: { usd: string }
	reserveFactor: { value: string }
	availableLiquidity: { usd: string }
	utilizationRate: { value: string }
	borrowCap: { usd: string }
	borrowCapReached: boolean
	borrowingState: string
	baseVariableBorrowRate?: { value: string }
	variableRateSlope1?: { value: string }
	variableRateSlope2?: { value: string }
	optimalUsageRate?: { value: string }
}

export interface AaveIncentive {
	extraSupplyApr?: { value: string }
	borrowAprDiscount?: { value: string }
	rewardTokenSymbol?: string
}

export interface AaveEmodeInfo {
	categoryId: number
	label: string
	maxLTV: { value: string }
	liquidationThreshold: { value: string }
}

export interface AaveReserve {
	underlyingToken: { symbol: string; name: string; address: string; decimals: number }
	size: { usd: string }
	usdExchangeRate?: ApiNumericString | null
	isFrozen: boolean
	isPaused: boolean
	flashLoanEnabled?: boolean | null
	supplyInfo: AaveReserveSupplyInfo
	borrowInfo: AaveReserveBorrowInfo | null
	incentives?: Array<AaveIncentive> | null
	eModeInfo?: Array<AaveEmodeInfo> | null
}

export interface AaveMarket {
	name: string
	address: string
	chain: { chainId: number; name: string }
	totalMarketSize: string
	totalAvailableLiquidity: string
	reserves: Array<AaveReserve>
}

export interface FlatReserve {
	symbol: string
	name: string
	chain: string
	chainId: number
	market: string
	marketAddress: string
	tokenAddress: string
	sizeUsd: number
	oraclePrice: number | null
	supplyApy: number
	borrowApy: number | null
	utilization: number | null
	maxLTV: number
	liquidationThreshold: number
	liquidationBonus: number
	canBeCollateral: boolean
	isFrozen: boolean
	isPaused: boolean
	flashLoanEnabled: boolean
	borrowingEnabled: boolean
	totalBorrowedUsd: number
	availableLiquidityUsd: number
	rewardSupplyApr: number | null
	rewardBorrowDiscount: number | null
	eModeCategories: Array<string>
	// Rate model params
	baseVariableBorrowRate: number | null
	variableRateSlope1: number | null
	variableRateSlope2: number | null
	optimalUsageRate: number | null
}

export interface APYSample {
	// Aave returns full ISO timestamps and orders APY history newest-first.
	date: ApiIsoTimestamp
	avgRate: { value: ApiNumericString }
}

export interface GHOReserveData {
	underlyingToken: { symbol: string; name: string; address: string }
	size: { usd: string }
	supplyInfo: { apy: { value: string }; total: { value: string }; supplyCap: { usd: string } }
	borrowInfo: {
		apy: { value: string }
		total: { usd: string }
		availableLiquidity: { usd: string }
		utilizationRate: { value: string }
		reserveFactor: { value: string }
		borrowCap: { usd: string }
		borrowCapReached: boolean
	}
}

export type TimeWindow = 'LAST_DAY' | 'LAST_WEEK' | 'LAST_MONTH' | 'LAST_SIX_MONTHS' | 'LAST_YEAR'

const STALE_TIME = 10 * 60 * 1000

async function fetchAaveQuery<T>(queryName: string, params?: Record<string, unknown>): Promise<T> {
	const response = await fetch('/api/dynamic/aave/graphql', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ queryName, ...(params ? { params } : {}) })
	})
	if (!response.ok) throw new Error(`Aave API error: ${response.status}`)
	return readInvestorApiJson<T>(response)
}

export function pct(value: string | undefined): number {
	if (!value) return 0
	return parseFloat(value) * 100
}

export function num(value: string | undefined): number {
	if (!value) return 0
	return parseFloat(value)
}

export function formatAaveMarkets(markets: Array<AaveMarket>): Array<FlatReserve> {
	const reserves: Array<FlatReserve> = []
	for (const market of markets) {
		for (const reserve of market.reserves) {
			const sizeUsd = num(reserve.size.usd)
			if (!(sizeUsd >= 1000)) continue
			reserves.push({
				symbol: reserve.underlyingToken.symbol,
				name: reserve.underlyingToken.name,
				chain: market.chain.name,
				chainId: market.chain.chainId,
				market: market.name,
				marketAddress: market.address,
				tokenAddress: reserve.underlyingToken.address,
				sizeUsd,
				oraclePrice: reserve.usdExchangeRate ? num(reserve.usdExchangeRate) : null,
				supplyApy: pct(reserve.supplyInfo.apy.value),
				borrowApy: reserve.borrowInfo ? pct(reserve.borrowInfo.apy.value) : null,
				utilization: reserve.borrowInfo ? pct(reserve.borrowInfo.utilizationRate.value) : null,
				maxLTV: pct(reserve.supplyInfo.maxLTV.value),
				liquidationThreshold: pct(reserve.supplyInfo.liquidationThreshold.value),
				liquidationBonus: pct(reserve.supplyInfo.liquidationBonus.value),
				canBeCollateral: reserve.supplyInfo.canBeCollateral,
				isFrozen: reserve.isFrozen,
				isPaused: reserve.isPaused,
				flashLoanEnabled: reserve.flashLoanEnabled ?? false,
				borrowingEnabled: reserve.borrowInfo?.borrowingState === 'ENABLED',
				totalBorrowedUsd: reserve.borrowInfo ? num(reserve.borrowInfo.total.usd) : 0,
				availableLiquidityUsd: reserve.borrowInfo ? num(reserve.borrowInfo.availableLiquidity.usd) : 0,
				rewardSupplyApr: extractRewardSupplyApr(reserve.incentives),
				rewardBorrowDiscount: extractRewardBorrowDiscount(reserve.incentives),
				eModeCategories: (reserve.eModeInfo ?? []).map((category) => category.label),
				baseVariableBorrowRate: reserve.borrowInfo?.baseVariableBorrowRate
					? pct(reserve.borrowInfo.baseVariableBorrowRate.value)
					: null,
				variableRateSlope1: reserve.borrowInfo?.variableRateSlope1
					? pct(reserve.borrowInfo.variableRateSlope1.value)
					: null,
				variableRateSlope2: reserve.borrowInfo?.variableRateSlope2
					? pct(reserve.borrowInfo.variableRateSlope2.value)
					: null,
				optimalUsageRate: reserve.borrowInfo?.optimalUsageRate ? pct(reserve.borrowInfo.optimalUsageRate.value) : null
			})
		}
	}
	return reserves
}

export function buildAaveApyDataset(samples: Array<APYSample>, type: 'supply' | 'borrow'): MultiSeriesChartDataset {
	const dimension = type === 'supply' ? 'Supply APY' : 'Borrow APY'
	const source = new Array<Array<number>>(samples.length)
	for (let i = 0; i < samples.length; i++) {
		const sample = samples[i]
		source[samples.length - i - 1] = [Math.floor(Date.parse(sample.date) / 1000) * 1000, pct(sample.avgRate.value)]
	}
	return { source, dimensions: ['timestamp', dimension] }
}

function extractRewardSupplyApr(incentives?: Array<AaveIncentive> | null): number | null {
	if (!incentives) return null
	for (const inc of incentives) {
		if (inc.extraSupplyApr) return pct(inc.extraSupplyApr.value)
	}
	return null
}

function extractRewardBorrowDiscount(incentives?: Array<AaveIncentive> | null): number | null {
	if (!incentives) return null
	for (const inc of incentives) {
		if (inc.borrowAprDiscount) return pct(inc.borrowAprDiscount.value)
	}
	return null
}

export function useAaveMarkets() {
	const query = useQuery({
		queryKey: ['aave-markets'],
		queryFn: () => fetchAaveQuery<{ data: { markets: Array<AaveMarket> } }>('markets'),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		const markets = query.data?.data?.markets ?? []

		const reserves = formatAaveMarkets(markets)

		return { markets, reserves, isLoading: query.isLoading }
	}, [query.data, query.isLoading])
}

export function useAaveAPYHistory(
	chainId: number | undefined,
	market: string | undefined,
	underlyingToken: string | undefined,
	window: TimeWindow,
	type: 'supply' | 'borrow'
) {
	const queryName = type === 'supply' ? 'supplyAPYHistory' : 'borrowAPYHistory'
	const enabled = !!chainId && !!market && !!underlyingToken

	const query = useQuery({
		queryKey: ['aave-apy-history', type, chainId, market, underlyingToken, window],
		queryFn: () =>
			fetchAaveQuery<{ data: Record<string, Array<APYSample>> }>(queryName, {
				chainId,
				market,
				underlyingToken,
				window
			}),
		enabled,
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		const key = type === 'supply' ? 'supplyAPYHistory' : 'borrowAPYHistory'
		const samples = query.data?.data?.[key] ?? []
		const dataset = buildAaveApyDataset(samples, type)
		return { dataset, isLoading: query.isLoading }
	}, [query.data, query.isLoading, type])
}

export function useAaveGHOReserve() {
	const query = useQuery({
		queryKey: ['aave-gho-reserve'],
		queryFn: () => fetchAaveQuery<{ data: { reserve: GHOReserveData } }>('ghoReserve'),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		const reserve = query.data?.data?.reserve ?? null
		return { reserve, isLoading: query.isLoading }
	}, [query.data, query.isLoading])
}
