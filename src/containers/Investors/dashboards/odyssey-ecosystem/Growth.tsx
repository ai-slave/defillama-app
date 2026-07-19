import { lazy, useMemo, useState } from 'react'
import { createSingleSeriesChartOptions } from '~/components/ECharts/timeSeriesChartOptions'
import type {
	IMultiSeriesChart2Props,
	IMultiSeriesChartProps,
	MultiSeriesChart2Dataset
} from '~/components/ECharts/types'
import { useGrowthData, chartToTs, type LooprDailyRow } from './api'
import {
	KpiCard,
	ChartCard,
	SectionHeader,
	ChartSkeleton,
	SimpleTable,
	fmtUsd,
	dollarPctChartOptions,
	formatNullablePercent
} from './ui'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>
const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const UNITLESS_SINGLE_SERIES_CHART_OPTIONS = createSingleSeriesChartOptions('')
const DOLLAR_SINGLE_SERIES_CHART_OPTIONS = createSingleSeriesChartOptions('$')

const CHAIN_COLORS: Record<string, string> = {
	Base: '#0052ff',
	Ethereum: '#627eea',
	Optimism: '#ff0420',
	Plasma: '#10b981',
	Combined: '#6366f1'
}

const SPEND_VENUES = [
	{ id: 'aerodrome', label: 'Aerodrome' },
	{ id: 'velodrome', label: 'Velodrome' },
	{ id: 'votemarket', label: 'VoteMarket' }
]

const ACTIVE_ACCOUNTS_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'Active Accounts',
		type: 'line',
		encode: { x: 'timestamp', y: 'Active Accounts' },
		color: '#6366f1'
	}
]
const ACTIVE_POSITIONS_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'Active Positions',
		type: 'line',
		encode: { x: 'timestamp', y: 'Active Positions' },
		color: '#34d399'
	}
]
const CUMULATIVE_ACCOUNTS_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'Cumulative Accounts',
		type: 'line',
		encode: { x: 'timestamp', y: 'Cumulative Accounts' },
		color: '#fb923c'
	}
]
const CUMULATIVE_POSITIONS_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'Cumulative Positions',
		type: 'line',
		encode: { x: 'timestamp', y: 'Cumulative Positions' },
		color: '#a78bfa'
	}
]
const MET_PRICE_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'MET Price',
		type: 'line',
		encode: { x: 'timestamp', y: 'MET Price' },
		color: '#fb923c'
	}
]
const VSP_PRICE_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'VSP Price',
		type: 'line',
		encode: { x: 'timestamp', y: 'VSP Price' },
		color: '#a78bfa'
	}
]

function TabBtns({
	active,
	onChange,
	options
}: {
	active: string
	onChange: (v: string) => void
	options: { id: string; label: string }[]
}) {
	return (
		<div className="mb-3 flex flex-wrap gap-1">
			{options.map((o) => (
				<button
					key={o.id}
					onClick={() => onChange(o.id)}
					className={`rounded-sm px-3 py-1 text-xs font-medium transition-colors ${
						active === o.id
							? 'bg-sl-accent text-on-brand'
							: 'border border-pro-cards-border bg-pro-cards-bg text-pro-text-secondary hover:text-pro-text-primary'
					}`}
				>
					{o.label}
				</button>
			))}
		</div>
	)
}

function dailyToPairs(rows: LooprDailyRow[] | undefined, metric: keyof LooprDailyRow): Array<[number, number | null]> {
	if (!rows) return []
	return rows.map(
		(r) => [Math.floor(Date.parse(r.day + 'T00:00:00Z') / 1000), Number(r[metric] ?? 0)] as [number, number | null]
	)
}

function capitalize(s: string) {
	return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function Growth() {
	const { data, isLoading } = useGrowthData()
	const k = data?.kpis ?? ({} as Partial<NonNullable<typeof data>['kpis']>)
	const loopr = data?.loopr
	const cs = data?.caseStudies ?? ({} as Partial<NonNullable<typeof data>['caseStudies']>)

	const [spendVenue, setSpendVenue] = useState('aerodrome')

	const looprTotalDatasets = useMemo(() => {
		const source: MultiSeriesChart2Dataset['source'] = (loopr?.total ?? []).map((row) => ({
			timestamp: Date.parse(`${row.day}T00:00:00Z`),
			'Active Accounts': row.active_users,
			'Active Positions': row.active_positions,
			'Cumulative Accounts': row.cumulative_users,
			'Cumulative Positions': row.cumulative_positions
		}))
		return {
			activeAccounts: { dimensions: ['timestamp', 'Active Accounts'], source },
			activePositions: { dimensions: ['timestamp', 'Active Positions'], source },
			cumulativeAccounts: { dimensions: ['timestamp', 'Cumulative Accounts'], source },
			cumulativePositions: { dimensions: ['timestamp', 'Cumulative Positions'], source }
		} satisfies Record<string, MultiSeriesChart2Dataset>
	}, [loopr?.total])

	const tokenPriceDatasets = useMemo(() => {
		const met: MultiSeriesChart2Dataset = {
			dimensions: ['timestamp', 'MET Price'],
			source: (data?.tokenPrices?.MET?.history ?? []).map((point) => ({
				timestamp: point.timestamp * 1e3,
				'MET Price': point.price
			}))
		}
		const vsp: MultiSeriesChart2Dataset = {
			dimensions: ['timestamp', 'VSP Price'],
			source: (data?.tokenPrices?.VSP?.history ?? []).map((point) => ({
				timestamp: point.timestamp * 1e3,
				'VSP Price': point.price
			}))
		}
		return { met, vsp }
	}, [data?.tokenPrices])

	const perChainActiveUsers = loopr?.chains
		? Object.entries(loopr.chains).map(([chain, rows]) => ({
				name: capitalize(chain),
				type: 'line' as const,
				color: CHAIN_COLORS[capitalize(chain)] || '#6366f1',
				data: dailyToPairs(rows, 'active_users')
			}))
		: undefined

	const perChainActivePositions = loopr?.chains
		? Object.entries(loopr.chains).map(([chain, rows]) => ({
				name: capitalize(chain),
				type: 'line' as const,
				color: CHAIN_COLORS[capitalize(chain)] || '#6366f1',
				data: dailyToPairs(rows, 'active_positions')
			}))
		: undefined

	const deposits = data?.depositsByChain
		? chartToTs(data.depositsByChain).map((s) => ({
				name: s.name,
				type: 'line' as const,
				color: CHAIN_COLORS[s.name] || '#6366f1',
				data: s.data
			}))
		: undefined

	const marketComboSeries = data?.marketComparison?.combined
		? chartToTs(data.marketComparison.combined).map((s, i) => ({
				name: s.name,
				type: 'line' as const,
				color: i === 0 ? '#6366f1' : '#f59e0b',
				data: s.data
			}))
		: undefined

	const morphoMarket = cs.morphoMarket
		? chartToTs(cs.morphoMarket).map((s, i) => ({
				name: s.name,
				type: 'line' as const,
				color: ['#6366f1', '#fb923c', '#34d399'][i] || '#6366f1',
				data: s.data,
				yAxisIndex: s.name.includes('%') ? 1 : 0
			}))
		: undefined

	const morphoMarkets = cs.morphoMarkets ?? []
	const spendVsTvlBlock = (cs.spendVsTvl || []).find((s) => s.venue === spendVenue)
	const spendVsTvlSeries = spendVsTvlBlock
		? chartToTs(spendVsTvlBlock).map((s, i) => ({
				name: s.name,
				type: i === 0 ? ('line' as const) : ('bar' as const),
				color: i === 0 ? '#6366f1' : '#fb923c',
				data: s.data,
				yAxisIndex: i
			}))
		: undefined

	return (
		<div className="flex flex-col gap-6">
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<KpiCard label="Active Accounts" value={k.activeAccounts?.formatted} sub="Loopr — current" />
				<KpiCard label="Active Positions" value={k.activePositions?.formatted} sub="Loopr — current" />
				<KpiCard label="Total Users" value={k.totalUsers?.formatted} sub="Loopr — cumulative" />
				<KpiCard label="Morpho Utilization" value={k.morphoUtilization?.formatted} sub="All Metronome markets" />
			</div>

			<SectionHeader>Loopr · Daily Activity (Combined)</SectionHeader>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{isLoading || !looprTotalDatasets.activeAccounts.source.length ? (
					<ChartSkeleton title="Active Accounts" />
				) : (
					<ChartCard title="Active Accounts" subtitle="Owner-deduped across chains">
						<MultiSeriesChart2
							dataset={looprTotalDatasets.activeAccounts}
							charts={ACTIVE_ACCOUNTS_CHART}
							valueSymbol=""
							chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
							height="280px"
						/>
					</ChartCard>
				)}
				{isLoading || !looprTotalDatasets.activePositions.source.length ? (
					<ChartSkeleton title="Active Positions" />
				) : (
					<ChartCard title="Active Positions" subtitle="Combined open positions">
						<MultiSeriesChart2
							dataset={looprTotalDatasets.activePositions}
							charts={ACTIVE_POSITIONS_CHART}
							valueSymbol=""
							chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
							height="280px"
						/>
					</ChartCard>
				)}
			</div>

			<SectionHeader>Loopr · Cumulative Onboarding</SectionHeader>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<ChartCard title="Cumulative Accounts" subtitle="Owner-deduped across chains">
					<MultiSeriesChart2
						dataset={looprTotalDatasets.cumulativeAccounts}
						charts={CUMULATIVE_ACCOUNTS_CHART}
						valueSymbol=""
						chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
						height="280px"
					/>
				</ChartCard>
				<ChartCard title="Cumulative Positions" subtitle="Across all chains">
					<MultiSeriesChart2
						dataset={looprTotalDatasets.cumulativePositions}
						charts={CUMULATIVE_POSITIONS_CHART}
						valueSymbol=""
						chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
						height="280px"
					/>
				</ChartCard>
			</div>

			<SectionHeader>Loopr · Per-Chain Activity</SectionHeader>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{perChainActiveUsers && (
					<ChartCard title="Active Users by Chain">
						<MultiSeriesChart series={perChainActiveUsers} height="280px" />
					</ChartCard>
				)}
				{perChainActivePositions && (
					<ChartCard title="Active Positions by Chain">
						<MultiSeriesChart series={perChainActivePositions} height="280px" />
					</ChartCard>
				)}
			</div>

			{deposits && (
				<>
					<SectionHeader>Loopr · Deposits by Chain</SectionHeader>
					<ChartCard title="Total deposits over time" subtitle="USD deposits per chain">
						<MultiSeriesChart series={deposits} valueSymbol="$" height="320px" />
					</ChartCard>
				</>
			)}

			{loopr?.byStrategy?.length ? (
				<>
					<SectionHeader>Loopr · By Strategy</SectionHeader>
					<ChartCard title="Active strategies" subtitle="Deposits, users and performance fee per strategy">
						<SimpleTable
							rows={loopr.byStrategy}
							cols={[
								{ key: 'strategyId', label: 'ID' },
								{ key: 'asset', label: 'Asset' },
								{ key: 'users', label: 'Users', right: true },
								{
									key: 'totalDepositedUsd',
									label: 'Deposited',
									right: true,
									render: (r) => r.totalDepositedFormatted || fmtUsd(r.totalDepositedUsd)
								},
								{
									key: 'performanceFeePct',
									label: 'Perf Fee',
									right: true,
									render: (r) => formatNullablePercent(r.performanceFeePct)
								},
								{
									key: 'chains',
									label: 'Chains',
									render: (r) =>
										Object.entries(r.chains)
											.map(([c, v]) => `${capitalize(c)}: ${v.users}u · ${fmtUsd(v.usd)}`)
											.join(' · ')
								}
							]}
						/>
					</ChartCard>
				</>
			) : null}

			<SectionHeader>Token Prices</SectionHeader>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{tokenPriceDatasets.met.source.length > 0 && (
					<ChartCard title="MET Price" subtitle="Metronome governance token">
						<MultiSeriesChart2
							dataset={tokenPriceDatasets.met}
							charts={MET_PRICE_CHART}
							valueSymbol="$"
							chartOptions={DOLLAR_SINGLE_SERIES_CHART_OPTIONS}
							height="280px"
						/>
					</ChartCard>
				)}
				{tokenPriceDatasets.vsp.source.length > 0 && (
					<ChartCard title="VSP Price" subtitle="Vesper governance token">
						<MultiSeriesChart2
							dataset={tokenPriceDatasets.vsp}
							charts={VSP_PRICE_CHART}
							valueSymbol="$"
							chartOptions={DOLLAR_SINGLE_SERIES_CHART_OPTIONS}
							height="280px"
						/>
					</ChartCard>
				)}
			</div>

			{marketComboSeries && (
				<>
					<SectionHeader>Ecosystem TVL Change vs ETH (cumulative)</SectionHeader>
					<ChartCard
						title="Cumulative % change since baseline"
						subtitle="Combined ecosystem TVL change vs ETH/USD change — 2y window"
					>
						<MultiSeriesChart series={marketComboSeries} valueSymbol="%" height="320px" />
					</ChartCard>
				</>
			)}

			{morphoMarket && (
				<>
					<SectionHeader>Morpho Market · Supply / Borrow / Utilization</SectionHeader>
					<ChartCard title="Featured Morpho market" subtitle="Daily supply / borrow / utilization">
						<MultiSeriesChart
							series={morphoMarket}
							valueSymbol="$"
							yAxisSymbols={['$', '%']}
							height="340px"
							chartOptions={dollarPctChartOptions}
						/>
					</ChartCard>
				</>
			)}

			{morphoMarkets.length > 0 && (
				<>
					<SectionHeader>Metronome Morpho Markets</SectionHeader>
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						{morphoMarkets.map((m) => {
							const series = chartToTs(m).map((s, i) => ({
								name: s.name,
								type: 'line' as const,
								color: ['#6366f1', '#fb923c', '#34d399'][i] || '#6366f1',
								data: s.data,
								yAxisIndex: s.name.includes('%') ? 1 : 0
							}))
							return (
								<ChartCard key={m.id} title={m.title || m.label} subtitle="Daily supply / borrow / utilization">
									<MultiSeriesChart
										series={series}
										valueSymbol="$"
										yAxisSymbols={['$', '%']}
										height="300px"
										chartOptions={dollarPctChartOptions}
									/>
								</ChartCard>
							)
						})}
					</div>
				</>
			)}

			{spendVsTvlBlock && (
				<>
					<SectionHeader>Incentive Spend vs Pool TVL · Efficiency</SectionHeader>
					<ChartCard
						title={`${spendVenue} — weekly spend vs pool TVL`}
						subtitle="Compare incentive outlay against the TVL it attracted"
					>
						<TabBtns active={spendVenue} onChange={setSpendVenue} options={SPEND_VENUES} />
						<MultiSeriesChart
							key={spendVenue}
							series={spendVsTvlSeries}
							valueSymbol="$"
							yAxisSymbols={['$', '$']}
							height="340px"
						/>
					</ChartCard>
				</>
			)}
		</div>
	)
}
