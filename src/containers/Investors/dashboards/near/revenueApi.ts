import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { formatCompactNumber } from '~/utils/numberFormat'
import { readInvestorApiJson, type ApiDate, type ApiIsoTimestamp } from '../../api.types'

interface FormattedValue {
	value: number
	formatted: string
}

interface Metadata {
	projectName: string
	updatedAt: ApiIsoTimestamp
	links?: Record<string, string>
	feeWallets?: Record<string, string>
	faq?: Array<{
		question: string
		answer: string
	}>
}

interface ChartSeries {
	name: string
	data: number[]
	type?: 'bar' | 'line'
	stack?: string
}

interface ChartData {
	title: string
	subtitle?: string
	// Daily IR charts use UTC calendar dates, e.g. "2026-07-18".
	dates: ApiDate[]
	series: ChartSeries[]
}

interface WalletEntry {
	wallet: string
	address: string | null
	link: string | null
	total: number
	totalFormatted: string
	shareFormatted: string
}

interface WalletBreakdownData {
	title: string
	wallets: WalletEntry[]
	total: number
	totalFormatted: string
}

interface SupplyChartData {
	title: string
	dates: ApiDate[]
	series: ChartSeries[]
}

export interface RevenueAPIResponse {
	metadata: Metadata
	fees: {
		feesChart: ChartData
		kpis: {
			allTimeFees?: FormattedValue
			ytdFees?: FormattedValue
			thirtyDayFees?: FormattedValue
			allTimeIntent?: FormattedValue
			allTimeProtocol?: FormattedValue
			latestCumulative?: FormattedValue
		}
	}
	revenue: {
		revenueChart: ChartData
		walletBreakdown?: WalletBreakdownData
		kpis: {
			allTimeRevenue?: FormattedValue
			ytdRevenue?: FormattedValue
			thirtyDayRevenue?: FormattedValue
			twelveMonthRevenue?: FormattedValue
			allTimeIntent?: FormattedValue
			allTimeProtocol?: FormattedValue
			latestCumulative?: FormattedValue
		}
	}
	emissions: {
		revenueVsEmissionsChart: ChartData
		revenueBreakdownChart?: ChartData
		percentageChart: ChartData
		supplyChart?: SupplyChartData
		kpis: {
			latestRevenue: FormattedValue
			latestEmissions: FormattedValue
			latestPercentage: FormattedValue
			netPosition?: FormattedValue
			circulatingSupply?: FormattedValue
		}
	}
}

function formatNear(value: number): string {
	const fractionDigits = Math.abs(value) >= 1e6 || Math.abs(value) < 1e3 ? 2 : 1
	return `${formatCompactNumber(value, {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	})} NEAR`
}

function sumLastNDays(series: number[], n: number): number {
	const start = Math.max(0, series.length - n)
	return series.slice(start).reduce((sum, val) => sum + val, 0)
}

function getCumulativeData(data: number[]): number[] {
	const cumulative: number[] = []
	let sum = 0
	for (const val of data) {
		sum += val
		cumulative.push(sum)
	}
	return cumulative
}

function findSeries(chart: ChartData, name: string): number[] {
	return chart.series.find((series) => series.name === name)?.data ?? []
}

function sumSeries(...series: number[][]): number[] {
	const length = Math.max(0, ...series.map((values) => values.length))
	return Array.from({ length }, (_, index) => series.reduce((sum, values) => sum + (values[index] ?? 0), 0))
}

export function extractNearRevenueSeries(response: RevenueAPIResponse) {
	const intentFees = findSeries(response.fees.feesChart, 'Intent Fees')
	const protocolFees = findSeries(response.fees.feesChart, 'Protocol Fees')
	const cumulativeFees = findSeries(response.fees.feesChart, 'Cumulative Total')

	// The current API exposes the combined series directly. Keep the wallet-name fallback for cached legacy responses.
	const currentIntentRevenue = findSeries(response.revenue.revenueChart, 'Intents Revenue')
	const legacyIntentRevenue = sumSeries(
		findSeries(response.revenue.revenueChart, 'fefundsadmin'),
		findSeries(response.revenue.revenueChart, '1csfundsadmin')
	)
	const intentRevenue = currentIntentRevenue.length > 0 ? currentIntentRevenue : legacyIntentRevenue
	const protocolRevenue = findSeries(response.revenue.revenueChart, 'Protocol Revenue (70% Burned)')
	const cumulativeRevenue = findSeries(response.revenue.revenueChart, 'Cumulative Total')

	return {
		intentFees,
		protocolFees,
		cumulativeFees,
		totalFees: sumSeries(intentFees, protocolFees),
		intentRevenue,
		protocolRevenue,
		cumulativeRevenue,
		totalRevenue: sumSeries(intentRevenue, protocolRevenue),
		dailyEmissions: findSeries(response.emissions.revenueVsEmissionsChart, 'Daily Emissions')
	}
}

export type { FormattedValue, WalletEntry, Metadata }

export function getValidTimeframeForAggregation(timeframe: string, aggregation: string): string {
	// If monthly aggregation, minimum timeframe is 1y
	if (aggregation === 'monthly') {
		if (timeframe === '7d' || timeframe === '30d') {
			return '1y'
		}
	}
	// If weekly aggregation, minimum is 30d
	if (aggregation === 'weekly') {
		if (timeframe === '7d') {
			return '30d'
		}
	}
	return timeframe
}

export function useRevenueData() {
	const query = useQuery<RevenueAPIResponse>({
		queryKey: ['near-revenue'],
		queryFn: async () => {
			const res = await fetch('/api/public/near/revenue')
			if (!res.ok) throw new Error(`NEAR Revenue API error: ${res.status}`)
			return readInvestorApiJson<RevenueAPIResponse>(res)
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		if (!query.data) {
			return { data: null, isLoading: query.isLoading || query.isPending }
		}

		const { metadata, fees, revenue, emissions } = query.data

		const extracted = extractNearRevenueSeries(query.data)
		const intentFeesSeries = extracted.intentFees
		const protocolFeesSeries = extracted.protocolFees
		const cumulativeFeesSeries = extracted.cumulativeFees
		const totalFeesSeries = extracted.totalFees
		const intentRevenueSeries = extracted.intentRevenue
		const protocolRevenueSeries = extracted.protocolRevenue
		const cumulativeRevenueSeries = extracted.cumulativeRevenue
		const totalRevenueSeries = extracted.totalRevenue
		const emissionsSeriesData = extracted.dailyEmissions

		// Calculate cumulative data
		const cumulativeFees = cumulativeFeesSeries.length > 0 ? cumulativeFeesSeries : getCumulativeData(totalFeesSeries)
		const cumulativeRevenue =
			cumulativeRevenueSeries.length > 0 ? cumulativeRevenueSeries : getCumulativeData(totalRevenueSeries)
		const cumulativeProtocolRevenue = getCumulativeData(protocolRevenueSeries)
		const cumulativeIntentsRevenue = getCumulativeData(intentRevenueSeries)
		const cumulativeEmissions = getCumulativeData(emissionsSeriesData)

		// Calculate KPIs for different periods
		const fees7d = totalFeesSeries.length > 0 ? sumLastNDays(totalFeesSeries, 7) : 0
		const fees1y = totalFeesSeries.length > 0 ? sumLastNDays(totalFeesSeries, 365) : 0
		const revenue7d = sumLastNDays(totalRevenueSeries, 7)
		const revenue1y = sumLastNDays(totalRevenueSeries, 365)

		// Use dates from revenue chart (primary source)
		const chartDates = revenue.revenueChart.dates
		const feeChartDates = fees.feesChart.dates
		const emissionsDates = emissions.revenueVsEmissionsChart.dates

		// Wallet breakdown
		const walletBreakdown: WalletEntry[] = revenue.walletBreakdown?.wallets || []

		// Calculate actual percentage from cumulative data
		const percentageFromCumulative = cumulativeRevenue.map((rev, i) => {
			const em = cumulativeEmissions[i] || 1
			return em > 0 ? (rev / em) * 100 : 0
		})

		return {
			data: {
				kpis: {
					fees: {
						allTime: {
							value: fees.kpis.allTimeFees?.value || 0,
							formatted: fees.kpis.allTimeFees?.formatted || formatNear(0)
						},
						ytd: {
							value: fees.kpis.ytdFees?.value || 0,
							formatted: fees.kpis.ytdFees?.formatted || formatNear(0)
						},
						d30: {
							value: fees.kpis.thirtyDayFees?.value || 0,
							formatted: fees.kpis.thirtyDayFees?.formatted || formatNear(0)
						},
						d7: {
							value: fees7d,
							formatted: formatNear(fees7d)
						},
						y1: {
							value: fees1y,
							formatted: formatNear(fees1y)
						}
					},
					revenue: {
						allTime: {
							value: revenue.kpis.allTimeRevenue?.value || 0,
							formatted: revenue.kpis.allTimeRevenue?.formatted || formatNear(0)
						},
						ytd: {
							value: revenue.kpis.ytdRevenue?.value || 0,
							formatted: revenue.kpis.ytdRevenue?.formatted || formatNear(0)
						},
						d30: {
							value: revenue.kpis.thirtyDayRevenue?.value || 0,
							formatted: revenue.kpis.thirtyDayRevenue?.formatted || formatNear(0)
						},
						d7: {
							value: revenue7d,
							formatted: formatNear(revenue7d)
						},
						y1: {
							value: revenue.kpis.twelveMonthRevenue?.value || revenue1y,
							formatted: revenue.kpis.twelveMonthRevenue?.formatted || formatNear(revenue1y)
						}
					}
				},
				feesChartData: {
					dates: feeChartDates,
					cumulative: cumulativeFees,
					protocolFees: protocolFeesSeries,
					intentFees: intentFeesSeries
				},
				revenueChartData: {
					dates: chartDates,
					cumulative: cumulativeRevenue,
					burn: protocolRevenueSeries,
					intents: intentRevenueSeries
				},
				emissionsChartData: {
					dates: emissionsDates,
					cumulativeRevenue,
					cumulativeEmissions,
					percentage: percentageFromCumulative
				},
				walletBreakdown,
				metadata,
				rawData: {
					feesDates: feeChartDates,
					totalFeesSeries,
					protocolFeesSeries,
					intentFeesSeries,
					cumulativeFees,
					revenueDates: chartDates,
					burnRevenueSeries: protocolRevenueSeries,
					intentsRevenueSeries: intentRevenueSeries,
					cumulativeRevenue,
					cumulativeBurnRevenue: cumulativeProtocolRevenue,
					cumulativeIntentsRevenue,
					emissionsDates,
					cumulativeEmissions,
					percentageFromCumulative
				}
			},
			isLoading: false
		}
	}, [query.data, query.isLoading, query.isPending])
}
