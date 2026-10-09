import { useQuery } from '@tanstack/react-query'
import { buildAlignedCartesianChartModel, type CartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { buildColumnarTimeSeriesDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import { readInvestorApiJson, type ApiDate, type ApiDateOrMonth, type ApiIsoTimestamp } from '../../api.types'
import { assignColors } from './api'
import { createSeriesConfigs } from './chartDefaults'

const API_URL = '/api/public/spark/financials'

interface FormattedValue {
	value: number
	formatted: string
}

interface KpiItem {
	label: string
	value: number
	formatted: string
}

interface PieSeriesItem {
	name: string
	value: number
	formatted: string
	pct: number
}

interface ProjectedBreakdown {
	title: string
	total: number
	totalFormatted: string
	series: Array<PieSeriesItem>
}

interface TimeSeriesItem {
	name: string
	data: Array<number>
}

interface TimeSeriesData {
	title: string
	// Returns are monthly YYYY-MM; the remaining Spark charts are daily YYYY-MM-DD.
	dates: Array<ApiDateOrMonth>
	series: Array<TimeSeriesItem>
	products?: Array<string>
	chains?: Array<string>
}

interface AllocatedAssetsEntry {
	name: string
	value: number
	formatted: string
	pct: number
	children?: Array<{ name: string; value: number; formatted: string }>
}

interface AllocatedAssetsHistorical {
	dates: Array<ApiDate>
	byProtocol: Array<TimeSeriesItem>
	byNetwork: Array<TimeSeriesItem>
	byAsset: Array<TimeSeriesItem>
}

interface AllocatedAssetsAPIData {
	title: string
	total: number
	totalFormatted: string
	date: ApiDate
	byProtocol: Array<AllocatedAssetsEntry>
	byNetwork: Array<AllocatedAssetsEntry>
	byAsset: Array<AllocatedAssetsEntry>
	historical: AllocatedAssetsHistorical
}

export type AllocatedAssetsData = Pick<
	AllocatedAssetsAPIData,
	'title' | 'totalFormatted' | 'byProtocol' | 'byNetwork' | 'byAsset'
>

interface TvlData extends TimeSeriesData {
	current: number
	currentFormatted: string
}

interface TreasuryData extends TimeSeriesData {
	threshold: number
	thresholdFormatted: string
}

interface BuybackSeriesItem {
	name: string
	type: 'bar' | 'line'
	data: Array<number>
}

interface BuybacksData {
	title: string
	dates: Array<ApiDate>
	series: Array<BuybackSeriesItem>
}

interface QuarterlyReport {
	label: string
	url: string
}

export interface FinancialsAPIResponse {
	meta: {
		projectId: number
		projectName: string
		updatedAt: ApiIsoTimestamp
		links: Record<string, string>
		quarterlyReports?: Array<QuarterlyReport>
	}
	kpis: Array<KpiItem>
	treasuryKpis: {
		totalAssets: FormattedValue
		buybackThreshold: FormattedValue
		vsThreshold: FormattedValue
	}
	buybackKpis: {
		usdsSpent: FormattedValue
		spkBought: FormattedValue
		avgPrice: FormattedValue
	}
	charts: {
		projectedBreakdown: ProjectedBreakdown
		monthlyGross: TimeSeriesData
		monthlyNet: TimeSeriesData
		allocatedAssets: AllocatedAssetsAPIData
		tvl: TvlData
		sparklendDeposits: TimeSeriesData
		sparklendBorrows: TimeSeriesData
		sllTvl: TimeSeriesData
		savingsTvl: TimeSeriesData
		supplyTotal: TimeSeriesData
		supplyByChain: TimeSeriesData
		treasury: TreasuryData
		buybacks: BuybacksData
	}
}

function parseDateToUnix(date: string) {
	return Date.parse(date.length === 7 ? `${date}-01T00:00:00Z` : `${date}T00:00:00Z`) / 1000
}

function parseDatesToMilliseconds(dates: ReadonlyArray<string>) {
	const timestamps = new Array<number>(dates.length)
	for (let i = 0; i < dates.length; i++) timestamps[i] = parseDateToUnix(dates[i]) * 1e3
	return timestamps
}

function seriesNames(series: ReadonlyArray<{ name: string }>) {
	const names = new Array<string>(series.length)
	for (let i = 0; i < series.length; i++) names[i] = series[i].name
	return names
}

function buildTimeSeriesChart(
	chart: TimeSeriesData,
	type: 'line' | 'bar',
	stack?: string,
	assignSeriesColors = false,
	firstColor?: string
) {
	const names = seriesNames(chart.series)
	return {
		dataset: buildColumnarTimeSeriesDataset(chart.dates, chart.series, (date) => parseDateToUnix(date) * 1e3, 0),
		charts: createSeriesConfigs(names, type, assignSeriesColors ? assignColors(names) : undefined, stack, firstColor),
		title: chart.title
	}
}

function buildTreasuryModel(chart: TreasuryData): CartesianChartModel {
	const thresholdValues = new Array<number>(chart.dates.length).fill(chart.threshold)
	return buildAlignedCartesianChartModel(
		parseDatesToMilliseconds(chart.dates),
		[
			...chart.series.map((series) => ({
				name: series.name,
				type: 'line' as const,
				color: '#4FC3F7',
				values: series.data
			})),
			{
				name: 'Buyback Threshold',
				type: 'line' as const,
				color: '#EF5350',
				areaStyle: { opacity: 0 },
				values: thresholdValues
			}
		],
		{ timestampMultiplier: 1 }
	)
}

function buildBuybacksModel(chart: BuybacksData): CartesianChartModel {
	return buildAlignedCartesianChartModel(
		parseDatesToMilliseconds(chart.dates),
		chart.series.map((series) => ({
			name: series.name,
			type: series.type,
			color: series.type === 'bar' ? '#1f6feb' : '#3fb950',
			values: series.data,
			yAxisIndex: series.type === 'line' ? 1 : 0,
			areaStyle: series.type === 'line' ? { opacity: 0 } : undefined,
			valueSymbol: 'SPK'
		})),
		{ timestampMultiplier: 1 }
	)
}

type TimeSeriesChart = ReturnType<typeof buildTimeSeriesChart>

export interface FinancialsViewModel {
	kpis: Array<KpiItem>
	treasuryKpis: FinancialsAPIResponse['treasuryKpis']
	buybackKpis: FinancialsAPIResponse['buybackKpis']
	projectedBreakdown: ProjectedBreakdown
	breakdownColors: Record<string, string>
	monthlyGross: TimeSeriesChart
	monthlyNet: TimeSeriesChart
	supplyTotal: TimeSeriesChart
	supplyByChain: TimeSeriesChart
	allocatedAssets: AllocatedAssetsData
	aaHistorical: Record<'byProtocol' | 'byNetwork' | 'byAsset', TimeSeriesChart>
	tvl: TimeSeriesChart & { currentFormatted: string }
	deposits: TimeSeriesChart
	borrows: TimeSeriesChart
	sllTvl: TimeSeriesChart
	savingsTvl: TimeSeriesChart
	treasuryModel: CartesianChartModel
	buybacksModel: CartesianChartModel
	quarterlyReports?: Array<QuarterlyReport>
}

export function buildFinancialsViewModel(response: FinancialsAPIResponse): FinancialsViewModel {
	const { charts } = response
	const allocatedDates = charts.allocatedAssets.historical.dates
	const protocolSeries = charts.allocatedAssets.historical.byProtocol
	const networkSeries = charts.allocatedAssets.historical.byNetwork
	const assetSeries = charts.allocatedAssets.historical.byAsset
	const { title, totalFormatted, byProtocol, byNetwork, byAsset } = charts.allocatedAssets

	return {
		kpis: response.kpis,
		treasuryKpis: response.treasuryKpis,
		buybackKpis: response.buybackKpis,
		projectedBreakdown: charts.projectedBreakdown,
		breakdownColors: assignColors(seriesNames(charts.projectedBreakdown.series)),
		monthlyGross: buildTimeSeriesChart(charts.monthlyGross, 'bar', 'a', true),
		monthlyNet: buildTimeSeriesChart(charts.monthlyNet, 'bar', 'a', true),
		supplyTotal: buildTimeSeriesChart(charts.supplyTotal, 'line'),
		supplyByChain: buildTimeSeriesChart(charts.supplyByChain, 'line', 'a', true),
		allocatedAssets: { title, totalFormatted, byProtocol, byNetwork, byAsset },
		aaHistorical: {
			byProtocol: buildTimeSeriesChart({ title: '', dates: allocatedDates, series: protocolSeries }, 'line', 'a', true),
			byNetwork: buildTimeSeriesChart({ title: '', dates: allocatedDates, series: networkSeries }, 'line', 'a', true),
			byAsset: buildTimeSeriesChart({ title: '', dates: allocatedDates, series: assetSeries }, 'line', 'a', true)
		},
		tvl: {
			...buildTimeSeriesChart(charts.tvl, 'line', 'a', true),
			currentFormatted: charts.tvl.currentFormatted
		},
		deposits: buildTimeSeriesChart(charts.sparklendDeposits, 'line'),
		borrows: buildTimeSeriesChart(charts.sparklendBorrows, 'line', undefined, false, '#f85149'),
		sllTvl: buildTimeSeriesChart(charts.sllTvl, 'line', 'a', true),
		savingsTvl: buildTimeSeriesChart(charts.savingsTvl, 'line', 'a', true),
		treasuryModel: buildTreasuryModel(charts.treasury),
		buybacksModel: buildBuybacksModel(charts.buybacks),
		quarterlyReports: response.meta.quarterlyReports
	}
}

export function useFinancialsData() {
	return useQuery<FinancialsViewModel>({
		queryKey: ['spark-financials'],
		queryFn: async () => {
			const res = await fetch(API_URL)
			if (!res.ok) throw new Error(`Financials API error: ${res.status}`)
			const response = await readInvestorApiJson<FinancialsAPIResponse>(res)
			return buildFinancialsViewModel(response)
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})
}

export type {
	AllocatedAssetsEntry,
	PieSeriesItem,
	QuarterlyReport,
	BuybackSeriesItem,
	TreasuryData,
	TimeSeriesData,
	TimeSeriesItem,
	FormattedValue,
	KpiItem
}
