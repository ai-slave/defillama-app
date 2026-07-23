import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchAdapterProtocolChartData } from '~/containers/AdapterMetrics/api'
import ChainCharts from '~/containers/ProDashboard/services/ChainCharts'
import { readInvestorApiJson } from '../../api.types'

const STALE_TIME = 10 * 60 * 1000

export interface HoneyRevenueKpi {
	value: number
	formatted: string
}

export interface HoneyRevenueData {
	honeySupply: HoneyRevenueKpi
	susdeYield: {
		current: HoneyRevenueKpi
		avg30d: HoneyRevenueKpi
		avgFromInception: HoneyRevenueKpi
		lastUpdated: string
	}
	kpis: {
		annualRevenueCurrent: HoneyRevenueKpi
		annualRevenue30d: HoneyRevenueKpi
		annualRevenueInception: HoneyRevenueKpi
	}
}

export function useHoneyRevenueData() {
	return useQuery<HoneyRevenueData>({
		queryKey: ['berachain-honey-revenue'],
		queryFn: async () => {
			const response = await fetch('/api/public/berachain/revenue')
			if (!response.ok) throw new Error(`Berachain revenue API error: ${response.status}`)
			return readInvestorApiJson<HoneyRevenueData>(response)
		},
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})
}

export interface BerachainIncomeServerData {
	chainFees: [number, number][]
	bexRevenue: [number, number][]
	bexVolume: [number, number][]
	bendFees: [number, number][]
	bendRevenue: [number, number][]
}

export async function fetchBerachainIncomeServerData(): Promise<BerachainIncomeServerData> {
	const [chainFees, bexRevenue, bexVolume, bendFees, bendRevenue] = await Promise.all([
		ChainCharts.chainFees('Berachain').catch(() => [] as [number, number][]),
		fetchAdapterProtocolChartData({
			adapterType: 'fees',
			protocol: 'bex',
			dataType: 'dailyRevenue'
		}).catch(() => [] as [number, number][]),
		fetchAdapterProtocolChartData({
			adapterType: 'dexs',
			protocol: 'bex'
		}).catch(() => [] as [number, number][]),
		fetchAdapterProtocolChartData({
			adapterType: 'fees',
			protocol: 'bend',
			dataType: 'dailyFees'
		}).catch(() => [] as [number, number][]),
		fetchAdapterProtocolChartData({
			adapterType: 'fees',
			protocol: 'bend',
			dataType: 'dailyRevenue'
		}).catch(() => [] as [number, number][])
	])

	return { chainFees, bexRevenue, bexVolume, bendFees, bendRevenue }
}

type TimestampRow = number[]

function buildTimeSeries(data: [number, number][]) {
	const source = new Array<TimestampRow>(data.length)
	for (let i = 0; i < data.length; i++) {
		const [timestamp, value] = data[i]
		source[i] = [timestamp * 1000, value ?? 0]
	}
	return source
}

function buildMonthlyAndCumulative(daily: TimestampRow[], seriesCount: number) {
	const monthMap = new Map<number, TimestampRow>()
	const totals = new Array<number>(seriesCount).fill(0)

	const cumulative = new Array<TimestampRow>(daily.length)
	for (let i = 0; i < daily.length; i++) {
		const entry = daily[i]
		const date = new Date(entry[0])
		const monthTimestamp = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
		let month = monthMap.get(monthTimestamp)
		if (!month) {
			month = new Array(seriesCount + 1).fill(0)
			month[0] = monthTimestamp
			monthMap.set(monthTimestamp, month)
		}

		const cumulativeEntry = new Array<number>(seriesCount + 1)
		cumulativeEntry[0] = entry[0]
		for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex++) {
			const value = entry[seriesIndex + 1] ?? 0
			month[seriesIndex + 1] += value
			totals[seriesIndex] += value
			cumulativeEntry[seriesIndex + 1] = totals[seriesIndex]
		}
		cumulative[i] = cumulativeEntry
	}

	return {
		monthly: Array.from(monthMap.values()),
		cumulative
	}
}

function buildCumulative(daily: TimestampRow[], seriesCount: number) {
	const totals = new Array<number>(seriesCount).fill(0)

	const cumulative = new Array<TimestampRow>(daily.length)
	for (let i = 0; i < daily.length; i++) {
		const entry = daily[i]
		const cumulativeEntry = new Array<number>(seriesCount + 1)
		cumulativeEntry[0] = entry[0]
		for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex++) {
			totals[seriesIndex] += entry[seriesIndex + 1] ?? 0
			cumulativeEntry[seriesIndex + 1] = totals[seriesIndex]
		}
		cumulative[i] = cumulativeEntry
	}
	return cumulative
}

function mergeSeries(series: Array<[number, number][]>) {
	const dateMap = new Map<number, TimestampRow>()

	for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex++) {
		const data = series[seriesIndex]
		for (const [timestampSeconds, value] of data) {
			const timestamp = timestampSeconds * 1000
			let entry = dateMap.get(timestamp)
			if (!entry) {
				entry = new Array(series.length + 1).fill(0)
				entry[0] = timestamp
				dateMap.set(timestamp, entry)
			}
			entry[seriesIndex + 1] = value ?? 0
		}
	}

	return Array.from(dateMap.values()).sort((a, b) => a[0] - b[0])
}

function datasetView(source: TimestampRow[], allKeys: string[], selectedKeys: string[] = allKeys) {
	if (selectedKeys === allKeys) return { source, dimensions: ['timestamp', ...allKeys] }
	const indexes = selectedKeys.map((key) => allKeys.indexOf(key) + 1)
	return {
		source: source.map((row) => [row[0], ...indexes.map((index) => row[index])]),
		dimensions: ['timestamp', ...selectedKeys]
	}
}

export function useBerachainIncomeData(serverData?: BerachainIncomeServerData) {
	const chainFees = useQuery({
		queryKey: ['berachain-chain-fees-chart'],
		queryFn: () => ChainCharts.chainFees('Berachain'),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		initialData: serverData?.chainFees
	})

	const bexRevenue = useQuery({
		queryKey: ['berachain-bex-revenue-chart'],
		queryFn: () =>
			fetchAdapterProtocolChartData({
				adapterType: 'fees',
				protocol: 'bex',
				dataType: 'dailyRevenue'
			}),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		initialData: serverData?.bexRevenue
	})

	const bexVolume = useQuery({
		queryKey: ['berachain-bex-volume-chart'],
		queryFn: () =>
			fetchAdapterProtocolChartData({
				adapterType: 'dexs',
				protocol: 'bex'
			}),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		initialData: serverData?.bexVolume
	})

	const bendFees = useQuery({
		queryKey: ['berachain-bend-fees-chart'],
		queryFn: () =>
			fetchAdapterProtocolChartData({
				adapterType: 'fees',
				protocol: 'bend',
				dataType: 'dailyFees'
			}),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		initialData: serverData?.bendFees
	})

	const bendRevenue = useQuery({
		queryKey: ['berachain-bend-revenue-chart'],
		queryFn: () =>
			fetchAdapterProtocolChartData({
				adapterType: 'fees',
				protocol: 'bend',
				dataType: 'dailyRevenue'
			}),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		initialData: serverData?.bendRevenue
	})

	return useMemo(() => {
		const isLoading =
			chainFees.isLoading || bexRevenue.isLoading || bexVolume.isLoading || bendFees.isLoading || bendRevenue.isLoading

		const chainFeesData = chainFees.data ?? []
		const bexRevenueData = bexRevenue.data ?? []
		const bexVolumeData = bexVolume.data ?? []
		const bendFeesData = bendFees.data ?? []
		const bendRevenueData = bendRevenue.data ?? []

		const berachainKeys = ['Chain Fees']
		const berachainDaily = buildTimeSeries(chainFeesData)
		const berachainSeries = buildMonthlyAndCumulative(berachainDaily, berachainKeys.length)

		// BEX section
		const bexKeys = ['Revenue']
		const bexDaily = buildTimeSeries(bexRevenueData)
		const bexSeries = buildMonthlyAndCumulative(bexDaily, bexKeys.length)

		// BEX volume
		const bexVolumeDaily = buildTimeSeries(bexVolumeData)
		const bexVolumeCumulative = buildCumulative(bexVolumeDaily, 1)

		// Bend section: Fees + Revenue
		const bendKeys = ['Fees', 'Revenue']
		const bendDaily = mergeSeries([bendFeesData, bendRevenueData])
		const bendSeries = buildMonthlyAndCumulative(bendDaily, bendKeys.length)

		const totalRevenueKeys = ['Chain Fees', 'BEX Revenue', 'BEND Revenue']
		const totalRevenueDaily = mergeSeries([chainFeesData, bexRevenueData, bendRevenueData])
		const totalRevenueCumulative = buildCumulative(totalRevenueDaily, totalRevenueKeys.length)

		return {
			isLoading,
			berachain: {
				monthly: datasetView(berachainSeries.monthly, berachainKeys),
				cumulative: datasetView(berachainSeries.cumulative, berachainKeys),
				chainFeesCumulative: datasetView(berachainSeries.cumulative, berachainKeys, ['Chain Fees'])
			},
			bex: {
				monthly: datasetView(bexSeries.monthly, bexKeys),
				cumulative: datasetView(bexSeries.cumulative, bexKeys),
				volumeCumulative: datasetView(bexVolumeCumulative, ['Volume'])
			},
			bend: {
				monthly: datasetView(bendSeries.monthly, bendKeys),
				cumulative: datasetView(bendSeries.cumulative, bendKeys),
				feesCumulative: datasetView(bendSeries.cumulative, bendKeys, ['Fees']),
				revenueCumulative: datasetView(bendSeries.cumulative, bendKeys, ['Revenue'])
			},
			totalRevenue: {
				cumulative: datasetView(totalRevenueCumulative, totalRevenueKeys)
			}
		}
	}, [
		chainFees.data,
		chainFees.isLoading,
		bexRevenue.data,
		bexRevenue.isLoading,
		bexVolume.data,
		bexVolume.isLoading,
		bendFees.data,
		bendFees.isLoading,
		bendRevenue.data,
		bendRevenue.isLoading
	])
}
