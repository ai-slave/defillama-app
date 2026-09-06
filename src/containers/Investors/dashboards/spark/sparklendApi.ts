import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { V2_SERVER_URL } from '~/constants'
import {
	fetchAdapterProtocolChartData,
	fetchAdapterProtocolChartDataByBreakdownType,
	fetchAdapterProtocolMetrics
} from '~/containers/AdapterMetrics/api'
import { fetchProtocolTvlChart } from '~/containers/ProtocolOverview/api'
import { YIELD_EARN_DATASET_API } from '~/containers/Yields/constants'
import type { EarnPageRow } from '~/containers/Yields/data/types'
import type { YieldsPaginatedTableResponse } from '~/containers/Yields/yieldsTableQuery'
import { fetchJson } from '~/utils/async'
import { readInvestorApiJson } from '../../api.types'
import { createSeriesConfigs } from './chartDefaults'

const PROTOCOL_SLUG = 'sparklend'
const STALE_TIME = 10 * 60 * 1000
const EMPTY_TVL_DATASET: MultiSeriesChartDataset = { source: [], dimensions: ['timestamp', 'TVL'] }
const EMPTY_INFLOWS_DATASET: MultiSeriesChartDataset = { source: [], dimensions: ['timestamp', 'USD Inflows'] }
const EMPTY_BORROWED_DATASET: MultiSeriesChartDataset = { source: [], dimensions: ['timestamp', 'Borrowed'] }

interface SparklendTvlResponse {
	chainTvls?: Record<string, { tvl?: Array<{ date: number | string; totalLiquidityUSD?: number | string | null }> }>
	currentChainTvls?: { borrowed?: number | null }
}

export function useSparklendMetrics() {
	const fees = useQuery({
		queryKey: ['sparklend-fees-metrics'],
		queryFn: () => fetchAdapterProtocolMetrics({ adapterType: 'fees', protocol: PROTOCOL_SLUG }),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	const revenue = useQuery({
		queryKey: ['sparklend-revenue-metrics'],
		queryFn: () =>
			fetchAdapterProtocolMetrics({ adapterType: 'fees', protocol: PROTOCOL_SLUG, dataType: 'dailyRevenue' }),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	const supplySideRevenue = useQuery({
		queryKey: ['sparklend-supply-side-revenue-metrics'],
		queryFn: () =>
			fetchAdapterProtocolMetrics({
				adapterType: 'fees',
				protocol: PROTOCOL_SLUG,
				dataType: 'dailySupplySideRevenue'
			}),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return {
		fees: fees.data,
		revenue: revenue.data,
		supplySideRevenue: supplySideRevenue.data,
		isLoading: fees.isLoading || revenue.isLoading || supplySideRevenue.isLoading
	}
}

export function useSparklendTvlChart() {
	const query = useQuery({
		queryKey: ['sparklend-tvl-chart'],
		queryFn: () => fetchProtocolTvlChart({ protocol: PROTOCOL_SLUG }),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		const raw = query.data
		if (!raw || !Array.isArray(raw) || raw.length === 0) {
			return {
				tvlDataset: EMPTY_TVL_DATASET,
				inflowsDataset: EMPTY_INFLOWS_DATASET,
				previousTvl: null,
				isLoading: query.isLoading
			}
		}

		const source = new Array<Array<number>>(raw.length)
		const inflowSource: MultiSeriesChartDataset['source'] = []
		for (let i = 0; i < raw.length; i++) {
			const [timestamp, value] = raw[i]
			const chartTimestamp = Math.floor(timestamp / 1e3) * 1e3
			source[i] = [chartTimestamp, value]
			if (i > 0) {
				const previousValue = raw[i - 1][1]
				inflowSource.push([chartTimestamp, value - previousValue])
			}
		}

		return {
			tvlDataset: { source, dimensions: ['timestamp', 'TVL'] },
			inflowsDataset: { source: inflowSource, dimensions: ['timestamp', 'USD Inflows'] },
			previousTvl: raw.length >= 2 ? raw[raw.length - 2][1] : null,
			isLoading: query.isLoading
		}
	}, [query.data, query.isLoading])
}

export function useSparklendBorrowedChart() {
	const query = useQuery({
		queryKey: ['sparklend-borrowed-chart'],
		queryFn: async () => {
			const res = await fetch(`${V2_SERVER_URL}/metrics/tvl/protocol/${PROTOCOL_SLUG}`)
			if (!res.ok) return { dataset: EMPTY_BORROWED_DATASET, current: null }
			const data = await readInvestorApiJson<SparklendTvlResponse>(res)
			const chainTvls = data?.chainTvls || {}
			const store = new Map<number, number>()
			for (const key in chainTvls) {
				if (!key.endsWith('-borrowed')) continue
				const arr = chainTvls[key]?.tvl || []
				for (const item of arr) {
					const d = Number(item?.date)
					const v = Number(item?.totalLiquidityUSD ?? 0)
					if (!Number.isFinite(d) || !Number.isFinite(v)) continue
					store.set(d, (store.get(d) ?? 0) + v)
				}
			}
			const source: MultiSeriesChartDataset['source'] = []
			for (const [date, value] of store) {
				source.push([date * 1e3, value])
			}
			source.sort((a, b) => (a[0] as number) - (b[0] as number))
			const current = data?.currentChainTvls?.borrowed ?? null
			return { dataset: { source, dimensions: ['timestamp', 'Borrowed'] }, current }
		},
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(
		() => ({
			borrowedDataset: query.data?.dataset ?? EMPTY_BORROWED_DATASET,
			currentBorrowed: query.data?.current ?? null,
			isLoading: query.isLoading
		}),
		[query.data, query.isLoading]
	)
}

function buildMetricDataset(data: Array<[number, number]>, name: string): MultiSeriesChartDataset {
	const source = new Array<MultiSeriesChartDataset['source'][number]>(data.length)
	for (let i = 0; i < data.length; i++) {
		source[i] = [data[i][0] * 1e3, data[i][1]]
	}
	return { source, dimensions: ['timestamp', name] }
}

function areMetricsAligned(series: Array<Array<[number, number]>>) {
	const length = series[0].length
	for (let i = 1; i < series.length; i++) {
		if (series[i].length !== length) return false
	}
	for (let i = 0; i < length; i++) {
		const timestamp = series[0][i][0]
		for (let j = 1; j < series.length; j++) {
			if (series[j][i][0] !== timestamp) return false
		}
	}
	return true
}

export function useSparklendFeesCharts() {
	const fees = useQuery({
		queryKey: ['sparklend-fees-chart'],
		queryFn: () => fetchAdapterProtocolChartData({ adapterType: 'fees', protocol: PROTOCOL_SLUG }),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	const revenue = useQuery({
		queryKey: ['sparklend-revenue-chart'],
		queryFn: () =>
			fetchAdapterProtocolChartData({ adapterType: 'fees', protocol: PROTOCOL_SLUG, dataType: 'dailyRevenue' }),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	const supplySideRevenue = useQuery({
		queryKey: ['sparklend-supply-side-revenue-chart'],
		queryFn: () =>
			fetchAdapterProtocolChartData({
				adapterType: 'fees',
				protocol: PROTOCOL_SLUG,
				dataType: 'dailySupplySideRevenue'
			}),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		const feesData = fees.data ?? []
		const revenueData = revenue.data ?? []
		const supplySideRevenueData = supplySideRevenue.data ?? []
		let feesDataset: MultiSeriesChartDataset
		let revenueDataset: MultiSeriesChartDataset
		let supplySideRevenueDataset: MultiSeriesChartDataset

		if (areMetricsAligned([feesData, revenueData, supplySideRevenueData])) {
			const feesSource = new Array<Array<number>>(feesData.length)
			const revenueSource = new Array<Array<number>>(feesData.length)
			const supplySideRevenueSource = new Array<Array<number>>(feesData.length)
			for (let i = 0; i < feesData.length; i++) {
				const timestamp = feesData[i][0] * 1e3
				feesSource[i] = [timestamp, feesData[i][1]]
				revenueSource[i] = [timestamp, revenueData[i][1]]
				supplySideRevenueSource[i] = [timestamp, supplySideRevenueData[i][1]]
			}
			feesDataset = { source: feesSource, dimensions: ['timestamp', 'Fees'] }
			revenueDataset = { source: revenueSource, dimensions: ['timestamp', 'Revenue'] }
			supplySideRevenueDataset = { source: supplySideRevenueSource, dimensions: ['timestamp', 'Supply Side Revenue'] }
		} else {
			feesDataset = buildMetricDataset(feesData, 'Fees')
			revenueDataset = buildMetricDataset(revenueData, 'Revenue')
			supplySideRevenueDataset = buildMetricDataset(supplySideRevenueData, 'Supply Side Revenue')
		}

		return {
			feesDataset,
			revenueDataset,
			supplySideRevenueDataset,
			isLoading: fees.isLoading || revenue.isLoading || supplySideRevenue.isLoading
		}
	}, [fees.data, fees.isLoading, revenue.data, revenue.isLoading, supplySideRevenue.data, supplySideRevenue.isLoading])
}

interface YieldPool {
	pool: string
	chain: string
	symbol: string
	tvlUsd: number
	apy: number | null
	apyBase: number | null
	apyReward: number | null
	poolMeta: string | null
}

export function useSparklendYieldPools() {
	const query = useQuery({
		queryKey: ['sparklend-yield-pools'],
		queryFn: async () => {
			const data = await fetchJson<YieldsPaginatedTableResponse<EarnPageRow>>(
				`${YIELD_EARN_DATASET_API}?pageSize=all&includeMemeTokens=true&protocol=SparkLend`
			)
			return data.rows
				.filter((pool) => pool.projectslug === PROTOCOL_SLUG)
				.map((pool): YieldPool => ({
					pool: pool.configID,
					chain: pool.chains[0],
					symbol: pool.pool,
					tvlUsd: pool.tvl ?? 0,
					apy: pool.apy,
					apyBase: pool.apyBase,
					apyReward: pool.apyReward,
					poolMeta: pool.poolMeta ?? null
				}))
				.sort((a, b) => b.tvlUsd - a.tvlUsd)
		},
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return { pools: query.data ?? [], isLoading: query.isLoading }
}

function breakdownToChart(
	data: Array<[number, Record<string, number>]> | null | undefined,
	type: 'line' | 'bar',
	timestampMultiplier: 1 | 1000
) {
	if (!data || data.length === 0) {
		return {
			dataset: { source: [], dimensions: ['timestamp'] } satisfies MultiSeriesChartDataset,
			charts: [] as ReturnType<typeof createSeriesConfigs>
		}
	}

	const lastEntry = data[data.length - 1]?.[1] ?? {}
	const stacks = Object.keys(lastEntry).sort((a, b) => (lastEntry[b] ?? 0) - (lastEntry[a] ?? 0))
	const source = new Array<MultiSeriesChartDataset['source'][number]>(data.length)
	for (let i = 0; i < data.length; i++) {
		const [timestamp, values] = data[i]
		const row = new Array<number>(stacks.length + 1)
		row[0] = timestamp * timestampMultiplier
		for (let stackIndex = 0; stackIndex < stacks.length; stackIndex++) {
			row[stackIndex + 1] = values[stacks[stackIndex]] || 0
		}
		source[i] = row
	}

	return {
		dataset: { source, dimensions: ['timestamp', ...stacks] },
		charts: createSeriesConfigs(stacks, type, undefined, 'a')
	}
}

export function useSparklendChainBreakdown() {
	const tvlByChainQuery = useQuery({
		queryKey: ['sparklend-tvl-chain-breakdown'],
		queryFn: () => fetchProtocolTvlChart({ protocol: PROTOCOL_SLUG, breakdownType: 'chain-breakdown' }),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	const feesByChainQuery = useQuery({
		queryKey: ['sparklend-fees-chain-breakdown'],
		queryFn: () =>
			fetchAdapterProtocolChartDataByBreakdownType({ adapterType: 'fees', protocol: PROTOCOL_SLUG, type: 'chain' }),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		// TVL chart timestamps are normalized by fetchProtocolTvlChart; adapter fee timestamps remain seconds.
		const tvlByChain = breakdownToChart(tvlByChainQuery.data, 'line', 1)
		const feesByChain = breakdownToChart(feesByChainQuery.data, 'bar', 1000)

		return {
			tvlByChain,
			feesByChain,
			isLoading: tvlByChainQuery.isLoading || feesByChainQuery.isLoading
		}
	}, [tvlByChainQuery.data, tvlByChainQuery.isLoading, feesByChainQuery.data, feesByChainQuery.isLoading])
}
