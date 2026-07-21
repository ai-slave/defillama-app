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
	incentives?: AaveIncentive[] | null
	eModeInfo?: AaveEmodeInfo[] | null
}

export interface AaveMarket {
	name: string
	address: string
	chain: { chainId: number; name: string }
	totalMarketSize: string
	totalAvailableLiquidity: string
	reserves: AaveReserve[]
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
	eModeCategories: string[]
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

export function formatAaveMarkets(markets: AaveMarket[]): FlatReserve[] {
	return markets.flatMap((m) =>
		m.reserves
			.filter((r) => num(r.size.usd) >= 1000)
			.map((r) => ({
				symbol: r.underlyingToken.symbol,
				name: r.underlyingToken.name,
				chain: m.chain.name,
				chainId: m.chain.chainId,
				market: m.name,
				marketAddress: m.address,
				tokenAddress: r.underlyingToken.address,
				sizeUsd: num(r.size.usd),
				oraclePrice: r.usdExchangeRate ? num(r.usdExchangeRate) : null,
				supplyApy: pct(r.supplyInfo.apy.value),
				borrowApy: r.borrowInfo ? pct(r.borrowInfo.apy.value) : null,
				utilization: r.borrowInfo ? pct(r.borrowInfo.utilizationRate.value) : null,
				maxLTV: pct(r.supplyInfo.maxLTV.value),
				liquidationThreshold: pct(r.supplyInfo.liquidationThreshold.value),
				liquidationBonus: pct(r.supplyInfo.liquidationBonus.value),
				canBeCollateral: r.supplyInfo.canBeCollateral,
				isFrozen: r.isFrozen,
				isPaused: r.isPaused,
				flashLoanEnabled: r.flashLoanEnabled ?? false,
				borrowingEnabled: r.borrowInfo?.borrowingState === 'ENABLED',
				totalBorrowedUsd: r.borrowInfo ? num(r.borrowInfo.total.usd) : 0,
				availableLiquidityUsd: r.borrowInfo ? num(r.borrowInfo.availableLiquidity.usd) : 0,
				rewardSupplyApr: extractRewardSupplyApr(r.incentives),
				rewardBorrowDiscount: extractRewardBorrowDiscount(r.incentives),
				eModeCategories: (r.eModeInfo ?? []).map((e) => e.label),
				baseVariableBorrowRate: r.borrowInfo?.baseVariableBorrowRate
					? pct(r.borrowInfo.baseVariableBorrowRate.value)
					: null,
				variableRateSlope1: r.borrowInfo?.variableRateSlope1 ? pct(r.borrowInfo.variableRateSlope1.value) : null,
				variableRateSlope2: r.borrowInfo?.variableRateSlope2 ? pct(r.borrowInfo.variableRateSlope2.value) : null,
				optimalUsageRate: r.borrowInfo?.optimalUsageRate ? pct(r.borrowInfo.optimalUsageRate.value) : null
			}))
	)
}

export function buildAaveApyDataset(samples: APYSample[], type: 'supply' | 'borrow'): MultiSeriesChartDataset {
	const dimension = type === 'supply' ? 'Supply APY' : 'Borrow APY'
	const source = new Array<number[]>(samples.length)
	for (let i = 0; i < samples.length; i++) {
		const sample = samples[i]
		source[samples.length - i - 1] = [Math.floor(Date.parse(sample.date) / 1000) * 1000, pct(sample.avgRate.value)]
	}
	return { source, dimensions: ['timestamp', dimension] }
}

function extractRewardSupplyApr(incentives?: AaveIncentive[] | null): number | null {
	if (!incentives) return null
	for (const inc of incentives) {
		if (inc.extraSupplyApr) return pct(inc.extraSupplyApr.value)
	}
	return null
}

function extractRewardBorrowDiscount(incentives?: AaveIncentive[] | null): number | null {
	if (!incentives) return null
	for (const inc of incentives) {
		if (inc.borrowAprDiscount) return pct(inc.borrowAprDiscount.value)
	}
	return null
}

export function useAaveMarkets() {
	const query = useQuery({
		queryKey: ['aave-markets'],
		queryFn: () => fetchAaveQuery<{ data: { markets: AaveMarket[] } }>('markets'),
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
			fetchAaveQuery<{ data: Record<string, APYSample[]> }>(queryName, {
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
