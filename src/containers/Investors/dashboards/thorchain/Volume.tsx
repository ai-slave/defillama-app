import { useState } from 'react'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { PanelLoadingStatus } from '~/ui/Status'
import { ApiTrendChart } from './ChainBreakdownChart'
import type { Chart, Kpi as KpiT } from './transform'
import { Kpi, KpiGrid, PlaceholderCard, TimeAreaCard, TimeBarCard, useThorchainData } from './ui'

// Each granularity is its OWN distinct-count dataset from raynalytics — the toggle
// switches datasets, it never aggregates (summing daily uniques would double-count
// wallets active on several days).
type WalletView = 'daily' | 'monthly' | 'quarterly' | 'yearly' | 'cumulative'
const WALLET_VIEWS: Array<{ value: WalletView; label: string }> = [
	{ value: 'daily', label: 'Daily' },
	{ value: 'monthly', label: 'Monthly' },
	{ value: 'quarterly', label: 'Quarterly' },
	{ value: 'yearly', label: 'Yearly' },
	{ value: 'cumulative', label: 'Cumulative' }
]

interface VolumeData {
	kpis: Record<string, KpiT | undefined>
	volumeChart: Chart
	volumeByChainChart?: Chart
	uniqueWalletsCharts?: Partial<Record<WalletView, Chart | null>>
	swapCountChart: Chart
}

const VOLUME_KPIS: Array<[string, string]> = [
	['volumeLifetime', 'Volume (Lifetime)'],
	['volume30d', 'Volume (30d)'],
	['avgDailyVolume30d', 'Avg Daily Volume (30d)']
]

const SWAP_KPIS: Array<[string, string]> = [
	['allTimeSwaps', 'All-Time Swaps'],
	['swaps30d', 'Swaps (30d)'],
	['avgDailySwaps30d', 'Avg Daily Swaps (30d)']
]

const TYPE_KPIS: Array<[string, string]> = [
	['nativeShare30d', 'Native Assets (30d)'],
	['tradeShare30d', 'Trade Assets (30d)'],
	['securedShare30d', 'Secured Assets (30d)']
]

// Full-width charts, each with Daily / Monthly / Quarterly / Cumulative views.
// All charts cover full history since April 2021 (by-chain via raynalytics).
export default function Volume() {
	const { data } = useThorchainData<VolumeData>('volume')
	const [walletView, setWalletView] = useState<WalletView>('daily')
	if (!data) return <PanelLoadingStatus />

	const walletChart = data.uniqueWalletsCharts?.[walletView]
	const walletToggle = (
		<SegmentedControl<WalletView>
			variant="default"
			size="md"
			label="Unique wallets period"
			options={WALLET_VIEWS.filter((v) => data.uniqueWalletsCharts?.[v.value])}
			value={walletView}
			onValueChange={setWalletView}
		/>
	)

	return (
		<div className="flex flex-col gap-6">
			<h2 className="heading-xs">Swap volume</h2>
			<KpiGrid kpis={data.kpis} items={VOLUME_KPIS} cols={3} />
			{data.volumeByChainChart?.series?.length ? (
				<ApiTrendChart chart={data.volumeByChainChart} subtitle="Swap volume per source chain." />
			) : (
				<PlaceholderCard
					title="Swap volume by chain"
					subtitle="Swap volume per source chain."
					note="volume.volumeByChainChart"
				/>
			)}

			<h2 className="heading-xs">Unique wallets</h2>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				<Kpi kpi={data.kpis.uniqueWalletsLifetime} label="Unique Wallets (Lifetime)" note="unique-wallets feed" />
				<Kpi
					kpi={data.kpis.uniqueWallets30d}
					label="Unique Wallets (30d)"
					def="Distinct wallets that transacted in the latest complete calendar month. It stands in for a rolling 30-day count, which has no data source: daily uniques can't be summed without double-counting."
					note="monthly uniques feed"
				/>
				<Kpi
					kpi={data.kpis.avgDailyActiveWallets30d}
					label="Avg Daily Unique Wallets (30d)"
					def="Average of the daily distinct-wallet counts over the trailing 30 days."
					note="daily uniques feed"
				/>
			</div>
			{walletChart ? (
				walletView === 'cumulative' ? (
					<TimeAreaCard
						chart={walletChart}
						valueSymbol=""
						subtitle="Total unique wallets over time."
						control={walletToggle}
						fullRange
					/>
				) : (
					<TimeBarCard
						chart={walletChart}
						valueSymbol=""
						subtitle="Distinct wallets transacting in each period. Every timeframe is its own distinct count."
						control={walletToggle}
						groupBy={walletView}
					/>
				)
			) : (
				<PlaceholderCard
					title="Unique wallets"
					subtitle="Distinct wallets per period. Awaiting feed."
					note="raynalytics unique-wallet endpoints"
				/>
			)}

			<h2 className="heading-xs">Swaps</h2>
			<KpiGrid kpis={data.kpis} items={SWAP_KPIS} cols={3} />
			<ApiTrendChart chart={data.swapCountChart} valueSymbol="" />

			<h2 className="heading-xs">Swap types</h2>
			<KpiGrid kpis={data.kpis} items={TYPE_KPIS} cols={3} />
			<ApiTrendChart chart={data.volumeChart} subtitle="Split by swap type." />
		</div>
	)
}
