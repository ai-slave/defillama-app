import { lazy, useMemo, useState } from 'react'
import { buildSparseCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { createSingleSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { ProSegmented } from '~/containers/ProDashboard/ui/ProSegmented'
import { formatPercent } from '~/utils/numberFormat'
import { useGrowthData, chartToModel, type LooprDailyRow } from './api'
import { KpiCard, ChartCard, SectionHeader, ChartSkeleton, SimpleTable, fmtUsd } from './ui'

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
	{ value: 'aerodrome', label: 'Aerodrome' },
	{ value: 'velodrome', label: 'Velodrome' },
	{ value: 'votemarket', label: 'VoteMarket' }
]

const ACTIVE_ACCOUNTS_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Active Accounts',
		type: 'line',
		encode: { x: 'timestamp', y: 'Active Accounts' },
		color: '#6366f1'
	}
]
const ACTIVE_POSITIONS_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Active Positions',
		type: 'line',
		encode: { x: 'timestamp', y: 'Active Positions' },
		color: '#34d399'
	}
]
const CUMULATIVE_ACCOUNTS_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Cumulative Accounts',
		type: 'line',
		encode: { x: 'timestamp', y: 'Cumulative Accounts' },
		color: '#fb923c'
	}
]
const CUMULATIVE_POSITIONS_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Cumulative Positions',
		type: 'line',
		encode: { x: 'timestamp', y: 'Cumulative Positions' },
		color: '#a78bfa'
	}
]
const MET_PRICE_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'MET Price',
		type: 'line',
		encode: { x: 'timestamp', y: 'MET Price' },
		color: '#fb923c'
	}
]
const VSP_PRICE_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'VSP Price',
		type: 'line',
		encode: { x: 'timestamp', y: 'VSP Price' },
		color: '#a78bfa'
	}
]

function dailyToPairs(
	rows: Array<LooprDailyRow> | undefined,
	metric: 'active_users' | 'active_positions'
): Array<[number, number | null]> {
	if (!rows) return []
	const points = new Array<[number, number | null]>(rows.length)
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i]
		points[i] = [Math.floor(Date.parse(`${row.day}T00:00:00Z`) / 1000), row[metric]]
	}
	return points
}

function capitalize(s: string) {
	return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function Growth() {
	const { data, isLoading } = useGrowthData()
	const k = data?.kpis ?? ({} as Partial<NonNullable<typeof data>['kpis']>)
	const loopr = data?.loopr
	const looprChains = loopr?.chains
	const depositsByChain = data?.depositsByChain
	const marketCombined = data?.marketComparison?.combined
	const cs = data?.caseStudies ?? ({} as Partial<NonNullable<typeof data>['caseStudies']>)

	const [spendVenue, setSpendVenue] = useState('aerodrome')

	const looprTotalDatasets = useMemo(() => {
		const activeAccounts: Array<Array<number>> = []
		const activePositions: Array<Array<number>> = []
		const cumulativeAccounts: Array<Array<number>> = []
		const cumulativePositions: Array<Array<number>> = []
		for (const row of loopr?.total ?? []) {
			const timestamp = Date.parse(`${row.day}T00:00:00Z`)
			activeAccounts.push([timestamp, row.active_users])
			activePositions.push([timestamp, row.active_positions])
			cumulativeAccounts.push([timestamp, row.cumulative_users])
			cumulativePositions.push([timestamp, row.cumulative_positions])
		}
		return {
			activeAccounts: { dimensions: ['timestamp', 'Active Accounts'], source: activeAccounts },
			activePositions: { dimensions: ['timestamp', 'Active Positions'], source: activePositions },
			cumulativeAccounts: { dimensions: ['timestamp', 'Cumulative Accounts'], source: cumulativeAccounts },
			cumulativePositions: { dimensions: ['timestamp', 'Cumulative Positions'], source: cumulativePositions }
		} satisfies Record<string, MultiSeriesChartDataset>
	}, [loopr?.total])

	const tokenPriceDatasets = useMemo(() => {
		const met: MultiSeriesChartDataset = {
			dimensions: ['timestamp', 'MET Price'],
			source: (data?.tokenPrices?.MET?.history ?? []).map((point) => [point.timestamp * 1e3, point.price])
		}
		const vsp: MultiSeriesChartDataset = {
			dimensions: ['timestamp', 'VSP Price'],
			source: (data?.tokenPrices?.VSP?.history ?? []).map((point) => [point.timestamp * 1e3, point.price])
		}
		return { met, vsp }
	}, [data?.tokenPrices])

	const perChainModels = useMemo(() => {
		if (!looprChains) return undefined
		const entries = Object.entries(looprChains)
		const build = (metric: 'active_users' | 'active_positions') =>
			buildSparseCartesianChartModel(
				entries.map(([chain, rows]) => {
					const name = capitalize(chain)
					return {
						name,
						type: 'line' as const,
						color: CHAIN_COLORS[name] || '#6366f1',
						connectNulls: true,
						data: dailyToPairs(rows, metric)
					}
				})
			)
		return { activeUsers: build('active_users'), activePositions: build('active_positions') }
	}, [looprChains])

	const depositsModel = useMemo(
		() =>
			depositsByChain
				? (() => {
						const model = chartToModel(depositsByChain)
						return {
							...model,
							charts: model.charts.map((chart) => ({
								...chart,
								type: 'line' as const,
								color: CHAIN_COLORS[chart.name] || '#6366f1'
							}))
						}
					})()
				: undefined,
		[depositsByChain]
	)

	const marketComboModel = useMemo(
		() =>
			marketCombined
				? (() => {
						const model = chartToModel(marketCombined)
						return {
							...model,
							charts: model.charts.map((chart, index) => ({
								...chart,
								type: 'line' as const,
								color: index === 0 ? '#6366f1' : '#f59e0b'
							}))
						}
					})()
				: undefined,
		[marketCombined]
	)

	const morphoMarketModel = useMemo(
		() =>
			cs.morphoMarket
				? (() => {
						const model = chartToModel(cs.morphoMarket)
						return {
							...model,
							charts: model.charts.map((chart, index) => ({
								...chart,
								type: 'line' as const,
								color: ['#6366f1', '#fb923c', '#34d399'][index] || '#6366f1',
								yAxisIndex: chart.name.includes('%') ? 1 : 0,
								valueSymbol: chart.name.includes('%') ? '%' : '$'
							}))
						}
					})()
				: undefined,
		[cs.morphoMarket]
	)

	const morphoMarkets = useMemo(
		() =>
			(cs.morphoMarkets ?? []).map((market) => {
				const model = chartToModel(market)
				return {
					market,
					model: {
						...model,
						charts: model.charts.map((chart, index) => ({
							...chart,
							type: 'line' as const,
							color: ['#6366f1', '#fb923c', '#34d399'][index] || '#6366f1',
							yAxisIndex: chart.name.includes('%') ? 1 : 0,
							valueSymbol: chart.name.includes('%') ? '%' : '$'
						}))
					}
				}
			}),
		[cs.morphoMarkets]
	)

	const spendVsTvl = useMemo(() => {
		const block = (cs.spendVsTvl ?? []).find((item) => item.venue === spendVenue)
		if (!block) return undefined
		const model = chartToModel(block)
		return {
			block,
			model: {
				...model,
				charts: model.charts.map((chart, index) => ({
					...chart,
					type: index === 0 ? ('line' as const) : ('bar' as const),
					color: index === 0 ? '#6366f1' : '#fb923c',
					yAxisIndex: index
				}))
			}
		}
	}, [cs.spendVsTvl, spendVenue])

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
				{isLoading || looprTotalDatasets.activeAccounts.source.length === 0 ? (
					<ChartSkeleton title="Active Accounts" />
				) : (
					<ChartCard title="Active Accounts" subtitle="Owner-deduped across chains">
						<MultiSeriesChart
							dataset={looprTotalDatasets.activeAccounts}
							charts={ACTIVE_ACCOUNTS_CHART}
							valueSymbol=""
							chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
							height="280px"
						/>
					</ChartCard>
				)}
				{isLoading || looprTotalDatasets.activePositions.source.length === 0 ? (
					<ChartSkeleton title="Active Positions" />
				) : (
					<ChartCard title="Active Positions" subtitle="Combined open positions">
						<MultiSeriesChart
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
					<MultiSeriesChart
						dataset={looprTotalDatasets.cumulativeAccounts}
						charts={CUMULATIVE_ACCOUNTS_CHART}
						valueSymbol=""
						chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
						height="280px"
					/>
				</ChartCard>
				<ChartCard title="Cumulative Positions" subtitle="Across all chains">
					<MultiSeriesChart
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
				{perChainModels?.activeUsers && (
					<ChartCard title="Active Users by Chain">
						<MultiSeriesChart
							dataset={perChainModels.activeUsers.dataset}
							charts={perChainModels.activeUsers.charts}
							valueSymbol=""
							height="280px"
							hideDefaultLegend={false}
							exportButtons="hidden"
						/>
					</ChartCard>
				)}
				{perChainModels?.activePositions && (
					<ChartCard title="Active Positions by Chain">
						<MultiSeriesChart
							dataset={perChainModels.activePositions.dataset}
							charts={perChainModels.activePositions.charts}
							valueSymbol=""
							height="280px"
							hideDefaultLegend={false}
							exportButtons="hidden"
						/>
					</ChartCard>
				)}
			</div>

			{depositsModel && (
				<>
					<SectionHeader>Loopr · Deposits by Chain</SectionHeader>
					<ChartCard title="Total deposits over time" subtitle="USD deposits per chain">
						<MultiSeriesChart
							dataset={depositsModel.dataset}
							charts={depositsModel.charts}
							valueSymbol="$"
							height="320px"
							hideDefaultLegend={false}
							exportButtons="hidden"
						/>
					</ChartCard>
				</>
			)}

			{loopr?.byStrategy?.length ? (
				<>
					<SectionHeader>Loopr · By Strategy</SectionHeader>
					<ChartCard title="Active strategies" subtitle="Deposits, users and performance fee per strategy">
						<SimpleTable
							getOccurrenceKey={(row) => JSON.stringify([row.strategyId, row.asset])}
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
									render: (r) =>
										r.performanceFeePct == null ? '—' : formatPercent(r.performanceFeePct, { input: 'percent' })
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
						<MultiSeriesChart
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
						<MultiSeriesChart
							dataset={tokenPriceDatasets.vsp}
							charts={VSP_PRICE_CHART}
							valueSymbol="$"
							chartOptions={DOLLAR_SINGLE_SERIES_CHART_OPTIONS}
							height="280px"
						/>
					</ChartCard>
				)}
			</div>

			{marketComboModel && (
				<>
					<SectionHeader>Ecosystem TVL Change vs ETH (cumulative)</SectionHeader>
					<ChartCard
						title="Cumulative % change since baseline"
						subtitle="Combined ecosystem TVL change vs ETH/USD change — 2y window"
					>
						<MultiSeriesChart
							dataset={marketComboModel.dataset}
							charts={marketComboModel.charts}
							valueSymbol="%"
							height="320px"
							hideDefaultLegend={false}
							exportButtons="hidden"
						/>
					</ChartCard>
				</>
			)}

			{morphoMarketModel && (
				<>
					<SectionHeader>Morpho Market · Supply / Borrow / Utilization</SectionHeader>
					<ChartCard title="Featured Morpho market" subtitle="Daily supply / borrow / utilization">
						<MultiSeriesChart
							dataset={morphoMarketModel.dataset}
							charts={morphoMarketModel.charts}
							valueSymbol="$"
							height="340px"
							hideDefaultLegend={false}
							exportButtons="hidden"
						/>
					</ChartCard>
				</>
			)}

			{morphoMarkets.length > 0 && (
				<>
					<SectionHeader>Metronome Morpho Markets</SectionHeader>
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						{morphoMarkets.map(({ market, model }) => {
							return (
								<ChartCard
									key={market.id}
									title={market.title || market.label}
									subtitle="Daily supply / borrow / utilization"
								>
									<MultiSeriesChart
										dataset={model.dataset}
										charts={model.charts}
										valueSymbol="$"
										height="300px"
										hideDefaultLegend={false}
										exportButtons="hidden"
									/>
								</ChartCard>
							)
						})}
					</div>
				</>
			)}

			{spendVsTvl && (
				<>
					<SectionHeader>Incentive Spend vs Pool TVL · Efficiency</SectionHeader>
					<ChartCard
						title={`${spendVenue} — weekly spend vs pool TVL`}
						subtitle="Compare incentive outlay against the TVL it attracted"
					>
						<ProSegmented
							size="sm"
							label="Spend venue"
							className="mb-3"
							options={SPEND_VENUES}
							value={spendVenue}
							onValueChange={setSpendVenue}
						/>
						<MultiSeriesChart
							key={spendVenue}
							dataset={spendVsTvl.model.dataset}
							charts={spendVsTvl.model.charts}
							valueSymbol="$"
							height="340px"
							hideDefaultLegend={false}
							exportButtons="hidden"
						/>
					</ChartCard>
				</>
			)}
		</div>
	)
}
