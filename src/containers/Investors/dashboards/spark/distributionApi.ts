import { useQuery } from '@tanstack/react-query'
import { createChartRow } from '~/components/ECharts/dynamicRow'
import type { MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import { assignColors } from './api'
import { createSeriesConfigs } from './chartDefaults'

type ChartRow = { date: number } & Record<string, number | undefined>

export interface SparkDistributionChartPayload {
	data: ChartRow[]
	keys: string[]
}

export interface DistributionResponse {
	meta: { updatedAt: string }
	charts: {
		actualRevenue: SparkDistributionChartPayload
		revenueProjection: SparkDistributionChartPayload
		susdsTvl: SparkDistributionChartPayload
		xrSusds: SparkDistributionChartPayload
		xrSusdc: SparkDistributionChartPayload
		stakedUsdsTvl: SparkDistributionChartPayload
	}
}

export interface ProcessedChart {
	dataset: MultiSeriesChart2Dataset
	charts: ReturnType<typeof createSeriesConfigs>
}

export interface DistributionViewModel {
	actualRevenue: ProcessedChart
	revenueProjection: ProcessedChart
	susdsTvl: ProcessedChart
	xrSusds: ProcessedChart
	xrSusdc: ProcessedChart
	stakedUsdsTvl: ProcessedChart
}

function getKeys(chart: SparkDistributionChartPayload, fallbackKey: string) {
	const keys = new Array<string>(chart.keys.length)
	for (let i = 0; i < chart.keys.length; i++) {
		keys[i] = chart.keys[i] === 'undefined' ? fallbackKey : chart.keys[i]
	}
	return keys
}

export function buildSparkDistributionChart(
	chart: SparkDistributionChartPayload,
	type: 'line' | 'bar',
	stack: string | undefined,
	fallbackKey = 'USD'
): ProcessedChart {
	const keys = getKeys(chart, fallbackKey)
	const source = new Array<MultiSeriesChart2Dataset['source'][number]>(chart.data.length)

	for (let i = 0; i < chart.data.length; i++) {
		const input = chart.data[i]
		const row = createChartRow<number>(input.date * 1e3)
		for (let j = 0; j < chart.keys.length; j++) {
			row[keys[j]] = input[chart.keys[j]] ?? 0
		}
		source[i] = row
	}

	const colors = assignColors(keys)
	return {
		dataset: { source, dimensions: ['timestamp', ...keys] },
		charts: createSeriesConfigs(keys, type, colors, stack)
	}
}

export function buildSparkCumulativeBarAsLineChart(
	chart: SparkDistributionChartPayload,
	fallbackKey = 'USD'
): ProcessedChart {
	const keys = getKeys(chart, fallbackKey)
	const totals = new Array<number>(keys.length).fill(0)
	const source = new Array<MultiSeriesChart2Dataset['source'][number]>(chart.data.length)

	// Revenue projection values are daily flows: accumulate them once, then render the result as lines.
	for (let i = 0; i < chart.data.length; i++) {
		const input = chart.data[i]
		const row = createChartRow<number>(input.date * 1e3)
		for (let j = 0; j < chart.keys.length; j++) {
			totals[j] += input[chart.keys[j]] ?? 0
			row[keys[j]] = totals[j]
		}
		source[i] = row
	}

	const colors = assignColors(keys)
	return {
		dataset: { source, dimensions: ['timestamp', ...keys] },
		charts: createSeriesConfigs(keys, 'line', colors, 'a')
	}
}

export function buildDistributionViewModel({ charts }: DistributionResponse): DistributionViewModel {
	return {
		actualRevenue: buildSparkDistributionChart(charts.actualRevenue, 'bar', 'a'),
		revenueProjection: buildSparkCumulativeBarAsLineChart(charts.revenueProjection),
		susdsTvl: buildSparkDistributionChart(charts.susdsTvl, 'line', 'a'),
		xrSusds: buildSparkDistributionChart(charts.xrSusds, 'bar', 'a'),
		xrSusdc: buildSparkDistributionChart(charts.xrSusdc, 'bar', 'a'),
		stakedUsdsTvl: buildSparkDistributionChart(charts.stakedUsdsTvl, 'line', 'a')
	}
}

export function useDistributionData() {
	const query = useQuery<DistributionViewModel>({
		queryKey: ['spark-distribution-rewards'],
		queryFn: async () => {
			const res = await fetch('/api/public/spark/distribution-rewards')
			if (!res.ok) throw new Error(`Distribution API error: ${res.status}`)
			const response: DistributionResponse = await res.json()
			return buildDistributionViewModel(response)
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	if (!query.data) return { data: null, isLoading: query.isLoading || query.isPending }
	return { data: query.data, isLoading: false }
}
