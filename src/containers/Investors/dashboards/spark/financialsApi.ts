import { useQuery } from '@tanstack/react-query'
import { buildColumnarTimeSeriesDataset } from '~/components/ECharts/timeSeriesDataset'
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
	series: PieSeriesItem[]
}

interface TimeSeriesItem {
	name: string
	data: number[]
}

interface TimeSeriesData {
	title: string
	dates: string[]
	series: TimeSeriesItem[]
	products?: string[]
	chains?: string[]
}

interface AllocatedAssetsEntry {
	name: string
	value: number
	formatted: string
	pct: number
	children?: Array<{ name: string; value: number; formatted: string }>
}

interface AllocatedAssetsHistorical {
	dates: string[]
	byProtocol: TimeSeriesItem[]
	byNetwork: TimeSeriesItem[]
	byAsset: TimeSeriesItem[]
}

interface AllocatedAssetsAPIData {
	title: string
	total: number
	totalFormatted: string
	date: string
	byProtocol: AllocatedAssetsEntry[]
	byNetwork: AllocatedAssetsEntry[]
	byAsset: AllocatedAssetsEntry[]
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
	data: number[]
}

interface BuybacksData {
	title: string
	dates: string[]
	series: BuybackSeriesItem[]
}

interface QuarterlyReport {
	label: string
	url: string
}

export interface FinancialsAPIResponse {
	meta: {
		projectId: number
		projectName: string
		updatedAt: string
		links: Record<string, string>
		quarterlyReports?: QuarterlyReport[]
	}
	kpis: KpiItem[]
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

function parseDatesToUnix(dates: readonly string[]) {
	const timestamps = new Array<number>(dates.length)
	for (let i = 0; i < dates.length; i++) timestamps[i] = parseDateToUnix(dates[i])
	return timestamps
}

function seriesNames(series: readonly { name: string }[]) {
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

type LegacySeries = {
	name: string
	type: 'line' | 'bar'
	color: string
	data: Array<[number, number]>
	yAxisIndex?: number
	areaStyle?: { opacity: number }
}

function buildTreasurySeries(chart: TreasuryData): LegacySeries[] {
	const timestamps = parseDatesToUnix(chart.dates)
	const output = new Array<LegacySeries>(chart.series.length + 1)

	for (let i = 0; i < chart.series.length; i++) {
		const input = chart.series[i]
		const data = new Array<[number, number]>(timestamps.length)
		for (let j = 0; j < timestamps.length; j++) data[j] = [timestamps[j], input.data[j]]
		output[i] = { name: input.name, type: 'line', color: '#4FC3F7', data }
	}

	const thresholdData = new Array<[number, number]>(timestamps.length)
	for (let i = 0; i < timestamps.length; i++) thresholdData[i] = [timestamps[i], chart.threshold]
	output[chart.series.length] = {
		name: 'Buyback Threshold',
		type: 'line',
		color: '#EF5350',
		areaStyle: { opacity: 0 },
		data: thresholdData
	}

	return output
}

function buildBuybacksSeries(chart: BuybacksData): LegacySeries[] {
	const timestamps = parseDatesToUnix(chart.dates)
	const output = new Array<LegacySeries>(chart.series.length)

	for (let i = 0; i < chart.series.length; i++) {
		const input = chart.series[i]
		const data = new Array<[number, number]>(timestamps.length)
		for (let j = 0; j < timestamps.length; j++) data[j] = [timestamps[j], input.data[j]]
		output[i] = {
			name: input.name,
			type: input.type,
			color: input.type === 'bar' ? '#1f6feb' : '#3fb950',
			data,
			yAxisIndex: input.type === 'line' ? 1 : 0,
			areaStyle: input.type === 'line' ? { opacity: 0 } : undefined
		}
	}

	return output
}

type TimeSeriesChart = ReturnType<typeof buildTimeSeriesChart>

export interface FinancialsViewModel {
	kpis: KpiItem[]
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
	treasurySeries: LegacySeries[]
	buybacksSeries: LegacySeries[]
	quarterlyReports?: QuarterlyReport[]
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
		treasurySeries: buildTreasurySeries(charts.treasury),
		buybacksSeries: buildBuybacksSeries(charts.buybacks),
		quarterlyReports: response.meta.quarterlyReports
	}
}

export function useFinancialsData() {
	const query = useQuery<FinancialsViewModel>({
		queryKey: ['spark-financials'],
		queryFn: async () => {
			const res = await fetch(API_URL)
			if (!res.ok) throw new Error(`Financials API error: ${res.status}`)
			const response: FinancialsAPIResponse = await res.json()
			return buildFinancialsViewModel(response)
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	if (!query.data) return { data: null, isLoading: query.isLoading || query.isPending }
	return { data: query.data, isLoading: false }
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
