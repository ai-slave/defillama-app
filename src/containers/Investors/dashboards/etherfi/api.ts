import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { buildTimeSeriesDataset } from '~/components/ECharts/timeSeriesDataset'
import type { MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import { fetchAdapterProtocolChartData, fetchAdapterProtocolMetrics } from '~/containers/AdapterMetrics/api'
import { fetchProtocolTvlChart } from '~/containers/ProtocolOverview/api'

const PROTOCOL_SLUG = 'etherfi-cash-liquid'
const STALE_TIME = 10 * 60 * 1000

export function buildEtherfiCashTvlData(raw: Array<readonly [number, number]>) {
	// fetchProtocolTvlChart has already normalized its tuple timestamps to Unix milliseconds.
	if (raw.length === 0) {
		return {
			tvlDataset: { source: [], dimensions: ['timestamp', 'TVL'] } satisfies MultiSeriesChart2Dataset,
			inflowsDataset: {
				source: [],
				dimensions: ['timestamp', 'USD Inflows']
			} satisfies MultiSeriesChart2Dataset,
			previousTvl: null,
			previousInflow: null
		}
	}

	const tvlSource = new Array<{ timestamp: number; TVL: number }>(raw.length)
	const inflowsSource: Array<{ timestamp: number; 'USD Inflows': number }> = []
	for (let i = 0; i < raw.length; i++) {
		const [ts, value] = raw[i]
		tvlSource[i] = { timestamp: ts, TVL: value }
		if (i === 0) continue
		const prevValue = raw[i - 1][1]
		if (!Number.isFinite(value) || !Number.isFinite(prevValue)) continue
		inflowsSource.push({ timestamp: ts, 'USD Inflows': value - prevValue })
	}

	return {
		tvlDataset: { source: tvlSource, dimensions: ['timestamp', 'TVL'] } satisfies MultiSeriesChart2Dataset,
		inflowsDataset: {
			source: inflowsSource,
			dimensions: ['timestamp', 'USD Inflows']
		} satisfies MultiSeriesChart2Dataset,
		previousTvl: tvlSource.length >= 2 ? tvlSource[tvlSource.length - 2].TVL : null,
		previousInflow: inflowsSource.length >= 2 ? inflowsSource[inflowsSource.length - 2]['USD Inflows'] : null
	}
}

export function useEtherfiCashMetrics() {
	const fees = useQuery({
		queryKey: ['etherfi-cash-fees-metrics'],
		queryFn: () => fetchAdapterProtocolMetrics({ adapterType: 'fees', protocol: PROTOCOL_SLUG }),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	const revenue = useQuery({
		queryKey: ['etherfi-cash-revenue-metrics'],
		queryFn: () =>
			fetchAdapterProtocolMetrics({ adapterType: 'fees', protocol: PROTOCOL_SLUG, dataType: 'dailyRevenue' }),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return {
		fees: fees.data,
		revenue: revenue.data,
		isLoading: fees.isLoading || revenue.isLoading
	}
}

export function useEtherfiCashTvlChart() {
	const query = useQuery({
		queryKey: ['etherfi-cash-tvl-chart'],
		queryFn: () => fetchProtocolTvlChart({ protocol: PROTOCOL_SLUG }),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		const raw = query.data
		if (!raw || !Array.isArray(raw) || raw.length === 0) {
			return { ...buildEtherfiCashTvlData([]), isLoading: query.isLoading }
		}
		return { ...buildEtherfiCashTvlData(raw), isLoading: query.isLoading }
	}, [query.data, query.isLoading])
}

export function useEtherfiCashFeesCharts() {
	const fees = useQuery({
		queryKey: ['etherfi-cash-fees-chart'],
		queryFn: () => fetchAdapterProtocolChartData({ adapterType: 'fees', protocol: PROTOCOL_SLUG }),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	const revenue = useQuery({
		queryKey: ['etherfi-cash-revenue-chart'],
		queryFn: () =>
			fetchAdapterProtocolChartData({ adapterType: 'fees', protocol: PROTOCOL_SLUG, dataType: 'dailyRevenue' }),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	const holdersRevenue = useQuery({
		queryKey: ['etherfi-cash-holders-revenue-chart'],
		queryFn: () =>
			fetchAdapterProtocolChartData({
				adapterType: 'fees',
				protocol: PROTOCOL_SLUG,
				dataType: 'dailyHoldersRevenue'
			}),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		const feesDataset = buildTimeSeriesDataset(fees.data ?? [], 'Fees', 1000)
		const revenueDataset = buildTimeSeriesDataset(revenue.data ?? [], 'Revenue', 1000)
		const holdersPoints = holdersRevenue.data ?? []
		const holdersSource = new Array<{ timestamp: number; 'Holders Revenue': number }>(holdersPoints.length)
		let hasHoldersRevenue = false
		for (let i = 0; i < holdersPoints.length; i++) {
			const [timestamp, value] = holdersPoints[i]
			holdersSource[i] = { timestamp: timestamp * 1e3, 'Holders Revenue': value }
			if (value !== 0) hasHoldersRevenue = true
		}
		const holdersRevenueDataset = {
			source: holdersSource,
			dimensions: ['timestamp', 'Holders Revenue']
		} satisfies MultiSeriesChart2Dataset

		return {
			feesDataset,
			revenueDataset,
			holdersRevenueDataset,
			hasHoldersRevenue,
			isLoading: fees.isLoading || revenue.isLoading || holdersRevenue.isLoading
		}
	}, [fees.data, fees.isLoading, revenue.data, revenue.isLoading, holdersRevenue.data, holdersRevenue.isLoading])
}
