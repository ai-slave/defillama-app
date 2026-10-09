import { useQuery } from '@tanstack/react-query'
import { buildColumnarTimeSeriesDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import { formatNumber } from '~/utils/numberFormat'
import { readInvestorApiJson, type ApiDate } from '../../api.types'
import { assignColors } from '../spark/api'
import { datasetChartOptions, multiSeriesCharts } from './chartDefaults'
import { formatSonicUsd } from './format'

interface FormattedValue {
	value: number
	formatted: string
}

interface TimeSeriesData {
	title: string
	dates: Array<ApiDate>
	series: Array<{ name: string; data: Array<number> }>
}

interface OverviewKpis {
	total24h: FormattedValue
	total7d: FormattedValue
	total30d: FormattedValue
	totalAllTime: FormattedValue
	change1d: FormattedValue
	change7d: FormattedValue
	change1m: FormattedValue
}

export interface TopProtocolEntry {
	name: string
	logo: string | null
	category: string | null
	total24h: number
	total24hFormatted: string
	total7d: number
	total30d: number
	totalAllTime: number
}

interface AssetCategory {
	name: string
	value: number
	formatted: string
	pct: number
	breakdown: Record<string, number>
}

export interface EcosystemAPIResponse {
	tvl: {
		tvl: {
			title: string
			current: number
			currentFormatted: string
			dates: Array<ApiDate>
			series: Array<{ name: string; data: Array<number> }>
		}
	}
	fees: {
		feesChart: TimeSeriesData
		kpis: OverviewKpis
		topProtocols: Array<TopProtocolEntry>
	}
	dexVolume: {
		volumeChart: TimeSeriesData
		kpis: OverviewKpis
		topDexes: Array<TopProtocolEntry>
	}
	stablecoins: {
		stablecoinChart: TimeSeriesData
		kpis: {
			currentCirculating: FormattedValue
			currentMinted: FormattedValue
			currentBridged: FormattedValue
		}
	}
	chainAssets: {
		assetBreakdown: {
			title: string
			total: number
			totalFormatted: string
			categories: Array<AssetCategory>
		}
	}
}

function parseDateToMs(dateStr: string): number {
	return Date.parse(`${dateStr}T00:00:00Z`)
}

export type { AssetCategory }

export function buildEcosystemViewModel(d: EcosystemAPIResponse) {
	const tvlDataset = buildColumnarTimeSeriesDataset(d.tvl.tvl.dates, d.tvl.tvl.series, parseDateToMs, 0)
	const feesDataset = buildColumnarTimeSeriesDataset(d.fees.feesChart.dates, d.fees.feesChart.series, parseDateToMs, 0)
	const volumeDataset = buildColumnarTimeSeriesDataset(
		d.dexVolume.volumeChart.dates,
		d.dexVolume.volumeChart.series,
		parseDateToMs,
		0
	)

	// The aggregate is already Minted + Bridged, so stacking it would count the supply twice.
	const stableSeries: TimeSeriesData['series'] = []
	const stableSeriesNames: Array<string> = []
	for (const series of d.stablecoins.stablecoinChart.series) {
		if (series.name === 'Total Circulating') continue
		stableSeries.push(series)
		stableSeriesNames.push(series.name)
	}
	const stableDataset = buildColumnarTimeSeriesDataset(
		d.stablecoins.stablecoinChart.dates,
		stableSeries,
		parseDateToMs,
		0
	)
	const stableColors = assignColors(stableSeriesNames)

	const latestIndex = d.stablecoins.stablecoinChart.dates.length - 1
	const stableBreakdown: Array<{ name: string; value: number; formatted: string; pct: string }> = []
	let stableBreakdownTotal = 0
	for (const series of stableSeries) {
		const value = latestIndex >= 0 ? (series.data[latestIndex] ?? 0) : 0
		if (value <= 0) continue
		stableBreakdown.push({ name: series.name, value, formatted: formatSonicUsd(value), pct: '' })
		stableBreakdownTotal += value
	}
	stableBreakdown.sort((a, b) => b.value - a.value)
	const stableBreakdownNames = new Array<string>(stableBreakdown.length)
	for (let i = 0; i < stableBreakdown.length; i++) {
		const item = stableBreakdown[i]
		item.pct = formatNumber((item.value / stableBreakdownTotal) * 100, {
			minimumFractionDigits: 1,
			maximumFractionDigits: 1,
			useGrouping: false
		})
		stableBreakdownNames[i] = item.name
	}

	// The upstream total category is used for the KPI, not as a second pie slice.
	const assetCategories: Array<AssetCategory> = []
	const assetCategoryNames: Array<string> = []
	for (const category of d.chainAssets.assetBreakdown.categories) {
		if (category.name === 'total') continue
		assetCategories.push(category)
		assetCategoryNames.push(category.name)
	}

	return {
		tvl: {
			dataset: tvlDataset,
			charts: multiSeriesCharts(d.tvl.tvl.series, 'line'),
			chartOptions: datasetChartOptions(tvlDataset.source.length, '$'),
			title: d.tvl.tvl.title,
			currentFormatted: d.tvl.tvl.currentFormatted
		},
		fees: {
			dataset: feesDataset,
			charts: multiSeriesCharts(d.fees.feesChart.series, 'bar', 'a'),
			chartOptions: datasetChartOptions(feesDataset.source.length, '$'),
			kpis: d.fees.kpis,
			topProtocols: d.fees.topProtocols,
			title: d.fees.feesChart.title
		},
		dexVolume: {
			dataset: volumeDataset,
			charts: multiSeriesCharts(d.dexVolume.volumeChart.series, 'bar', 'a'),
			chartOptions: datasetChartOptions(volumeDataset.source.length, '$'),
			kpis: d.dexVolume.kpis,
			topDexes: d.dexVolume.topDexes,
			title: d.dexVolume.volumeChart.title
		},
		stablecoins: {
			dataset: stableDataset,
			charts: multiSeriesCharts(stableSeries, 'line', 'Total', stableColors),
			chartOptions: datasetChartOptions(stableDataset.source.length, '$'),
			kpis: d.stablecoins.kpis,
			title: d.stablecoins.stablecoinChart.title,
			breakdown: stableBreakdown,
			pieColors: assignColors(stableBreakdownNames),
			breakdownTotalFormatted: formatSonicUsd(stableBreakdownTotal)
		},
		chainAssets: {
			categories: assetCategories,
			pieColors: assignColors(assetCategoryNames),
			totalFormatted: d.chainAssets.assetBreakdown.totalFormatted,
			title: d.chainAssets.assetBreakdown.title
		}
	}
}

export type EcosystemViewModel = ReturnType<typeof buildEcosystemViewModel>

export function useEcosystemData() {
	return useQuery<EcosystemViewModel>({
		queryKey: ['sonic-ecosystem'],
		queryFn: async () => {
			const res = await fetch('/api/public/sonic/ecosystem')
			if (!res.ok) throw new Error(`Ecosystem API error: ${res.status}`)
			const response = await readInvestorApiJson<EcosystemAPIResponse>(res)
			return buildEcosystemViewModel(response)
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})
}
