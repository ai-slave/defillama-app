import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createChartRow } from '~/components/ECharts/dynamicRow'
import type { MultiSeriesChart2Dataset } from '~/components/ECharts/types'
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
const EMPTY_TVL_DATASET: MultiSeriesChart2Dataset = { source: [], dimensions: ['timestamp', 'TVL'] }
const EMPTY_INFLOWS_DATASET: MultiSeriesChart2Dataset = { source: [], dimensions: ['timestamp', 'USD Inflows'] }
const EMPTY_BORROWED_DATASET: MultiSeriesChart2Dataset = { source: [], dimensions: ['timestamp', 'Borrowed'] }

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

		const source = new Array<MultiSeriesChart2Dataset['source'][number]>(raw.length)
		const inflowSource: MultiSeriesChart2Dataset['source'] = []
		for (let i = 0; i < raw.length; i++) {
			const [timestamp, value] = raw[i]
			const row: MultiSeriesChart2Dataset['source'][number] = {
				timestamp: Math.floor(timestamp / 1e3) * 1e3,
				TVL: value
			}
			if (i > 0) {
				const previousValue = raw[i - 1][1]
				row['USD Inflows'] = value - previousValue
				inflowSource.push(row)
			}
			source[i] = row
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
			const store: Record<number, number> = {}
			for (const key in chainTvls) {
				if (!key.endsWith('-borrowed')) continue
				const arr = chainTvls[key]?.tvl || []
				for (const item of arr) {
					const d = Number(item?.date)
					const v = Number(item?.totalLiquidityUSD ?? 0)
					if (!Number.isFinite(d) || !Number.isFinite(v)) continue
					store[d] = (store[d] ?? 0) + v
				}
			}
			const source: MultiSeriesChart2Dataset['source'] = []
			for (const dateKey in store) {
				source.push({ timestamp: +dateKey * 1e3, Borrowed: store[dateKey] })
			}
			source.sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
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

function buildMetricDataset(data: Array<[number, number]>, name: string): MultiSeriesChart2Dataset {
	const source = new Array<MultiSeriesChart2Dataset['source'][number]>(data.length)
	for (let i = 0; i < data.length; i++) {
		source[i] = { timestamp: data[i][0] * 1e3, [name]: data[i][1] }
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
		let feesDataset: MultiSeriesChart2Dataset
		let revenueDataset: MultiSeriesChart2Dataset
		let supplySideRevenueDataset: MultiSeriesChart2Dataset

		if (areMetricsAligned([feesData, revenueData, supplySideRevenueData])) {
			const source = new Array<MultiSeriesChart2Dataset['source'][number]>(feesData.length)
			for (let i = 0; i < feesData.length; i++) {
				source[i] = {
					timestamp: feesData[i][0] * 1e3,
					Fees: feesData[i][1],
					Revenue: revenueData[i][1],
					'Supply Side Revenue': supplySideRevenueData[i][1]
				}
			}
			feesDataset = { source, dimensions: ['timestamp', 'Fees'] }
			revenueDataset = { source, dimensions: ['timestamp', 'Revenue'] }
			supplySideRevenueDataset = { source, dimensions: ['timestamp', 'Supply Side Revenue'] }
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
				.map(
					(pool): YieldPool => ({
						pool: pool.configID,
						chain: pool.chains[0],
						symbol: pool.pool,
						tvlUsd: pool.tvl ?? 0,
						apy: pool.apy,
						apyBase: pool.apyBase,
						apyReward: pool.apyReward,
						poolMeta: pool.poolMeta ?? null
					})
				)
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
			dataset: { source: [], dimensions: ['timestamp'] } satisfies MultiSeriesChart2Dataset,
			charts: [] as ReturnType<typeof createSeriesConfigs>
		}
	}

	const lastEntry = data[data.length - 1]?.[1] ?? {}
	const stacks = Object.keys(lastEntry).sort((a, b) => (lastEntry[b] ?? 0) - (lastEntry[a] ?? 0))
	const source = new Array<MultiSeriesChart2Dataset['source'][number]>(data.length)
	for (let i = 0; i < data.length; i++) {
		const [timestamp, values] = data[i]
		const row = createChartRow<number>(timestamp * timestampMultiplier)
		for (const name of stacks) row[name] = values[name] || 0
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
