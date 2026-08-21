import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchAdapterProtocolChartDataByBreakdownType } from '~/containers/AdapterMetrics/api'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import type { Chart, Kpi as KpiT } from './transform'
import { breakdownToSeries, groupTopN, SeriesTrendChart } from './TrendChart'
import {
	countKpi,
	KpiGrid,
	PageLoader,
	PROTOCOL,
	QUERY_OPTS,
	SectionHeader,
	TimeAreaCard,
	usdKpi,
	useProtocolMetrics,
	useUniswapData,
	useUniswapDefs
} from './ui'

// The ir-server only supplies what DefiLlama doesn't have: the Dune-sourced KPIs
// (trades, wallets, wallet share, assets) plus the static exploit history and the
// weekly traders/trades series. Everything else reads DefiLlama client-side, so the
// ir-server's DefiLlama-derived overview fields can be removed later.
interface OverviewData {
	kpis: Record<string, KpiT | undefined>
	tradersWeekly: Chart
	tradesWeekly: Chart
}

export default function Overview() {
	const { data } = useUniswapData<OverviewData>('overview')
	const defs = useUniswapDefs()

	// Headline totals straight from DefiLlama (exact 24h/30d/all-time, not chart sums).
	const dex = useProtocolMetrics(ADAPTER_TYPES.DEXS)
	const fees = useProtocolMetrics(ADAPTER_TYPES.FEES)
	const holders = useProtocolMetrics(ADAPTER_TYPES.FEES, ADAPTER_DATA_TYPES.DAILY_HOLDERS_REVENUE)

	// Straight from the DefiLlama chain-breakdown endpoint (the internal pro-dashboard
	// by-chain route is a server-side proxy this dashboard doesn't need), grouped to the
	// top 12 chains plus Others client-side.
	const volumeByChain = useQuery({
		queryKey: ['uniswap-breakdown', 'volume-by-chain'],
		queryFn: async () =>
			groupTopN(
				breakdownToSeries(
					await fetchAdapterProtocolChartDataByBreakdownType({
						adapterType: ADAPTER_TYPES.DEXS,
						protocol: PROTOCOL,
						type: 'chain'
					})
				),
				12
			),
		...QUERY_OPTS
	})
	const volumeByVersion = useQuery({
		queryKey: ['uniswap-breakdown', 'volume-by-version'],
		queryFn: async () =>
			breakdownToSeries(
				await fetchAdapterProtocolChartDataByBreakdownType({
					adapterType: ADAPTER_TYPES.DEXS,
					protocol: PROTOCOL,
					type: 'version'
				})
			),
		...QUERY_OPTS
	})
	const feesByVersion = useQuery({
		queryKey: ['uniswap-breakdown', 'fees-by-version'],
		queryFn: async () =>
			breakdownToSeries(
				await fetchAdapterProtocolChartDataByBreakdownType({
					adapterType: ADAPTER_TYPES.FEES,
					protocol: PROTOCOL,
					dataType: ADAPTER_DATA_TYPES.DAILY_FEES,
					type: 'version'
				})
			),
		...QUERY_OPTS
	})

	const kpis: Record<string, KpiT | undefined> = useMemo(() => {
		const dune = data?.kpis ?? {}
		return {
			// ir-server (Dune + static)
			trades: dune.trades,
			wallets: dune.wallets,
			walletShare: dune.walletShare,
			assets: dune.assets,
			exploitHistory: dune.exploitHistory,
			// DefiLlama, client-side
			allTimeVolume: usdKpi(dex.data?.totalAllTime),
			volume30d: usdKpi(dex.data?.total30d),
			volume24h: usdKpi(dex.data?.total24h),
			chainsLive: countKpi(dex.data?.chains?.length, 'chains'),
			feesAllTime: usdKpi(fees.data?.totalAllTime),
			fees30d: usdKpi(fees.data?.total30d),
			fees24h: usdKpi(fees.data?.total24h),
			// Fees that accrue to LPs: total fees minus the UNI buyback-and-burn cut. Only shown
			// once both totals are in, so a failed buyback fetch never inflates the figure.
			lpFeesAllTime:
				fees.data?.totalAllTime != null && holders.data?.totalAllTime != null
					? usdKpi(fees.data.totalAllTime - holders.data.totalAllTime)
					: undefined
		}
	}, [data, dex.data, fees.data, holders.data])

	if (!data || dex.isPending || fees.isPending || holders.isPending) return <PageLoader />

	return (
		<div className="flex flex-col gap-10">
			{/* All KPIs up top, grouped, so every headline figure reads without scrolling. */}
			<section className="flex flex-col gap-6">
				<KpiGrid
					label="Volume"
					kpis={kpis}
					cols={3}
					items={[
						['allTimeVolume', 'All-time Volume Settled', defs.volume],
						['volume30d', 'Volume (30d)', undefined],
						['volume24h', 'Volume (24h)', undefined]
					]}
				/>
				<KpiGrid
					label="Fees"
					kpis={kpis}
					items={[
						['feesAllTime', 'Fees (Lifetime)', defs.fees],
						['fees30d', 'Fees (30d)', undefined],
						['fees24h', 'Fees (24h)', undefined],
						['lpFeesAllTime', 'Fees to Liquidity Providers (Lifetime)', defs.lpFees]
					]}
				/>
				<KpiGrid
					label="Activity"
					kpis={kpis}
					cols={3}
					items={[
						['trades', 'Trades (Lifetime)', undefined],
						['wallets', 'Wallets (Lifetime)', defs.wallets],
						['walletShare', 'Share of All DEX Wallets (30d)', defs.walletShare]
					]}
				/>
				<KpiGrid
					label="Reach & Security"
					kpis={kpis}
					cols={3}
					items={[
						['chainsLive', 'Chains Live', undefined],
						['assets', 'Assets (Traded 30d)', defs.assets],
						['exploitHistory', 'Core Protocol Exploit History', undefined]
					]}
				/>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>Volume</SectionHeader>
				<SeriesTrendChart
					title="Total Volume by Chain"
					subtitle="Swap volume across all versions, split by chain (top chains plus Others)."
					series={volumeByChain.data}
					isLoading={volumeByChain.isLoading}
					isError={volumeByChain.isError}
					defaultView="month"
					minBucket="week"
				/>
				<SeriesTrendChart
					title="Volume by Version"
					subtitle="Swap volume split by protocol version."
					series={volumeByVersion.data}
					isLoading={volumeByVersion.isLoading}
					isError={volumeByVersion.isError}
					defaultView="month"
					minBucket="week"
				/>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>Fees</SectionHeader>
				<SeriesTrendChart
					title="Fees by Version"
					subtitle="Swap fees paid by users, split by protocol version."
					series={feesByVersion.data}
					isLoading={feesByVersion.isLoading}
					isError={feesByVersion.isError}
					defaultView="month"
					minBucket="week"
				/>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>Activity</SectionHeader>
				{/* Weekly unique counts must not be re-summed into coarser periods (a monthly sum of
				    weekly uniques double-counts returning wallets), so these render as plain weekly
				    lines instead of getting the aggregation toggle. */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<TimeAreaCard
						chart={data.tradersWeekly}
						valueSymbol=""
						subtitle={defs.traders ?? 'Weekly unique swapping wallets across all chains and versions.'}
					/>
					<TimeAreaCard
						chart={data.tradesWeekly}
						valueSymbol=""
						subtitle="Weekly swap count, all chains and versions."
					/>
				</div>
			</section>
		</div>
	)
}
