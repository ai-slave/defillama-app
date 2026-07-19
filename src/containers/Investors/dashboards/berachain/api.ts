import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createChartRecord, createChartRow } from '~/components/ECharts/dynamicRow'
import { fetchAdapterProtocolChartData } from '~/containers/AdapterMetrics/api'
import ChainCharts from '~/containers/ProDashboard/services/ChainCharts'

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
		queryFn: () => fetch('/api/public/berachain/revenue').then((r) => r.json()),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})
}

export interface BerachainIncomeServerData {
	chainFees: [number, number][]
	bribes: [number, number][]
	bexRevenue: [number, number][]
	bexVolume: [number, number][]
	bendFees: [number, number][]
	bendRevenue: [number, number][]
}

export async function fetchBerachainIncomeServerData(): Promise<BerachainIncomeServerData> {
	const [chainFees, bribes, bexRevenue, bexVolume, bendFees, bendRevenue] = await Promise.all([
		ChainCharts.chainFees('Berachain').catch(() => [] as [number, number][]),
		fetchAdapterProtocolChartData({
			adapterType: 'fees',
			protocol: 'berachain-incentive-buys',
			dataType: 'dailyBribesRevenue'
		}).catch(() => [] as [number, number][]),
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

	return { chainFees, bribes, bexRevenue, bexVolume, bendFees, bendRevenue }
}

type TimestampRow = { timestamp: number } & Record<string, number>

function buildTimeSeries(data: [number, number][], label: string) {
	const source = new Array<TimestampRow>(data.length)
	for (let i = 0; i < data.length; i++) {
		const [timestamp, value] = data[i]
		const row = createChartRow<number>(timestamp * 1000)
		row[label] = value ?? 0
		source[i] = row
	}
	return source
}

function buildMonthlyAndCumulative(daily: TimestampRow[], keys: string[]) {
	const monthMap = new Map<number, TimestampRow>()
	const totals = createChartRecord<number>()
	for (const key of keys) totals[key] = 0

	const cumulative = new Array<TimestampRow>(daily.length)
	for (let i = 0; i < daily.length; i++) {
		const entry = daily[i]
		const date = new Date(entry.timestamp)
		const monthTimestamp = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
		let month = monthMap.get(monthTimestamp)
		if (!month) {
			month = createChartRow<number>(monthTimestamp)
			for (const key of keys) month[key] = 0
			monthMap.set(monthTimestamp, month)
		}

		const cumulativeEntry = createChartRow<number>(entry.timestamp)
		for (const key of keys) {
			const value = entry[key] ?? 0
			month[key] += value
			totals[key] += value
			cumulativeEntry[key] = totals[key]
		}
		cumulative[i] = cumulativeEntry
	}

	return {
		monthly: Array.from(monthMap.values()),
		cumulative
	}
}

function buildCumulative(daily: TimestampRow[], keys: string[]) {
	const totals = createChartRecord<number>()
	for (const key of keys) totals[key] = 0

	const cumulative = new Array<TimestampRow>(daily.length)
	for (let i = 0; i < daily.length; i++) {
		const entry = daily[i]
		const cumulativeEntry = createChartRow<number>(entry.timestamp)
		for (const key of keys) {
			totals[key] += entry[key] ?? 0
			cumulativeEntry[key] = totals[key]
		}
		cumulative[i] = cumulativeEntry
	}
	return cumulative
}

function mergeSeries(series: { data: [number, number][]; label: string }[], keys: string[]) {
	const dateMap = new Map<number, TimestampRow>()

	for (const { data, label } of series) {
		for (const [timestampSeconds, value] of data) {
			const timestamp = timestampSeconds * 1000
			let entry = dateMap.get(timestamp)
			if (!entry) {
				entry = createChartRow<number>(timestamp)
				for (const key of keys) entry[key] = 0
				dateMap.set(timestamp, entry)
			}
			entry[label] = value ?? 0
		}
	}

	return Array.from(dateMap.values()).sort((a, b) => a.timestamp - b.timestamp)
}

function datasetView(source: TimestampRow[], keys: string[]) {
	return { source, dimensions: ['timestamp', ...keys] }
}

export function useBerachainIncomeData(serverData?: BerachainIncomeServerData) {
	const chainFees = useQuery({
		queryKey: ['berachain-chain-fees-chart'],
		queryFn: () => ChainCharts.chainFees('Berachain'),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		initialData: serverData?.chainFees
	})

	const bribes = useQuery({
		queryKey: ['berachain-bribes-chart'],
		queryFn: () =>
			fetchAdapterProtocolChartData({
				adapterType: 'fees',
				protocol: 'berachain-incentive-buys',
				dataType: 'dailyBribesRevenue'
			}),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false,
		initialData: serverData?.bribes
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
			chainFees.isLoading ||
			bribes.isLoading ||
			bexRevenue.isLoading ||
			bexVolume.isLoading ||
			bendFees.isLoading ||
			bendRevenue.isLoading

		const chainFeesData = chainFees.data ?? []
		const bribesData = bribes.data ?? []
		const bexRevenueData = bexRevenue.data ?? []
		const bexVolumeData = bexVolume.data ?? []
		const bendFeesData = bendFees.data ?? []
		const bendRevenueData = bendRevenue.data ?? []

		const berachainKeys = ['Chain Fees', 'Incentives']
		const berachainDaily = mergeSeries(
			[
				{ data: chainFeesData, label: 'Chain Fees' },
				{ data: bribesData, label: 'Incentives' }
			],
			berachainKeys
		)
		const berachainSeries = buildMonthlyAndCumulative(berachainDaily, berachainKeys)

		// BEX section
		const bexKeys = ['Revenue']
		const bexDaily = buildTimeSeries(bexRevenueData, 'Revenue')
		const bexSeries = buildMonthlyAndCumulative(bexDaily, bexKeys)

		// BEX volume
		const bexVolumeDaily = buildTimeSeries(bexVolumeData, 'Volume')
		const bexVolumeCumulative = buildCumulative(bexVolumeDaily, ['Volume'])

		// Bend section: Fees + Revenue
		const bendKeys = ['Fees', 'Revenue']
		const bendDaily = mergeSeries(
			[
				{ data: bendFeesData, label: 'Fees' },
				{ data: bendRevenueData, label: 'Revenue' }
			],
			bendKeys
		)
		const bendSeries = buildMonthlyAndCumulative(bendDaily, bendKeys)

		const totalRevenueKeys = ['Chain Fees', 'Incentives', 'BEX Revenue', 'BEND Revenue']
		const totalRevenueDaily = mergeSeries(
			[
				{ data: chainFeesData, label: 'Chain Fees' },
				{ data: bribesData, label: 'Incentives' },
				{ data: bexRevenueData, label: 'BEX Revenue' },
				{ data: bendRevenueData, label: 'BEND Revenue' }
			],
			totalRevenueKeys
		)
		const totalRevenueCumulative = buildCumulative(totalRevenueDaily, totalRevenueKeys)

		return {
			isLoading,
			berachain: {
				monthly: datasetView(berachainSeries.monthly, berachainKeys),
				cumulative: datasetView(berachainSeries.cumulative, berachainKeys),
				chainFeesCumulative: datasetView(berachainSeries.cumulative, ['Chain Fees']),
				incentivesCumulative: datasetView(berachainSeries.cumulative, ['Incentives'])
			},
			bex: {
				monthly: datasetView(bexSeries.monthly, bexKeys),
				cumulative: datasetView(bexSeries.cumulative, bexKeys),
				volumeCumulative: datasetView(bexVolumeCumulative, ['Volume'])
			},
			bend: {
				monthly: datasetView(bendSeries.monthly, bendKeys),
				cumulative: datasetView(bendSeries.cumulative, bendKeys),
				feesCumulative: datasetView(bendSeries.cumulative, ['Fees']),
				revenueCumulative: datasetView(bendSeries.cumulative, ['Revenue'])
			},
			totalRevenue: {
				cumulative: datasetView(totalRevenueCumulative, totalRevenueKeys)
			}
		}
	}, [
		chainFees.data,
		chainFees.isLoading,
		bribes.data,
		bribes.isLoading,
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
