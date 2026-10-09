import { lazy, Suspense, useMemo, useState } from 'react'
import { buildSparseCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { createSingleSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import {
	CHART_FILL,
	ChartPanel,
	ChartPanelBodyFallback,
	ChartPanelExportShellFallback,
	ChartPanelTitle,
	ChartPanelToolbar
} from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { LoadingIndicator } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { formatPercent } from '~/utils/numberFormat'
import { useTab, chartToModel, type LooprDailyRow, type GrowthResponse } from './api'
import { ChartCard, SectionHeader, SimpleTable, fmtUsd } from './ui'

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
	const { data, isLoading } = useTab<GrowthResponse>('growth')
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
				{data ? (
					<>
						<StatTile label="Active Accounts" value={k.activeAccounts?.formatted ?? '—'} sub="Loopr — current" />
						<StatTile label="Active Positions" value={k.activePositions?.formatted ?? '—'} sub="Loopr — current" />
						<StatTile label="Total Users" value={k.totalUsers?.formatted ?? '—'} sub="Loopr — cumulative" />
						<StatTile
							label="Morpho Utilization"
							value={k.morphoUtilization?.formatted ?? '—'}
							sub="All Metronome markets"
						/>
					</>
				) : (
					<>
						<StatTile label="Active Accounts" sub="Loopr — current" loading />
						<StatTile label="Active Positions" sub="Loopr — current" loading />
						<StatTile label="Total Users" sub="Loopr — cumulative" loading />
						<StatTile label="Morpho Utilization" sub="All Metronome markets" loading />
					</>
				)}
			</div>

			<SectionHeader>Loopr · Daily Activity (Combined)</SectionHeader>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<ChartPanel>
					{isLoading || looprTotalDatasets.activeAccounts.source.length === 0 ? (
						<ChartPanelExportShellFallback
							role="status"
							aria-live="polite"
							className="flex items-center justify-center"
						>
							<LoadingIndicator />
						</ChartPanelExportShellFallback>
					) : (
						<Suspense fallback={<ChartPanelExportShellFallback />}>
							<MultiSeriesChart
								title="Active Accounts"
								subtitle="Owner-deduped across chains"
								headingAs="h3"
								dataset={looprTotalDatasets.activeAccounts}
								charts={ACTIVE_ACCOUNTS_CHART}
								valueSymbol=""
								chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
								containerClassName={CHART_FILL}
							/>
						</Suspense>
					)}
				</ChartPanel>
				<ChartPanel>
					{isLoading || looprTotalDatasets.activePositions.source.length === 0 ? (
						<ChartPanelExportShellFallback
							role="status"
							aria-live="polite"
							className="flex items-center justify-center"
						>
							<LoadingIndicator />
						</ChartPanelExportShellFallback>
					) : (
						<Suspense fallback={<ChartPanelExportShellFallback />}>
							<MultiSeriesChart
								title="Active Positions"
								subtitle="Combined open positions"
								headingAs="h3"
								dataset={looprTotalDatasets.activePositions}
								charts={ACTIVE_POSITIONS_CHART}
								valueSymbol=""
								chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
								containerClassName={CHART_FILL}
							/>
						</Suspense>
					)}
				</ChartPanel>
			</div>

			<SectionHeader>Loopr · Cumulative Onboarding</SectionHeader>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<ChartPanel>
					{isLoading ? (
						<ChartPanelExportShellFallback
							role="status"
							aria-live="polite"
							className="flex items-center justify-center"
						>
							<LoadingIndicator />
						</ChartPanelExportShellFallback>
					) : (
						<Suspense fallback={<ChartPanelExportShellFallback />}>
							<MultiSeriesChart
								title="Cumulative Accounts"
								subtitle="Owner-deduped across chains"
								headingAs="h3"
								dataset={looprTotalDatasets.cumulativeAccounts}
								charts={CUMULATIVE_ACCOUNTS_CHART}
								valueSymbol=""
								chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
								containerClassName={CHART_FILL}
							/>
						</Suspense>
					)}
				</ChartPanel>
				<ChartPanel>
					{isLoading ? (
						<ChartPanelExportShellFallback
							role="status"
							aria-live="polite"
							className="flex items-center justify-center"
						>
							<LoadingIndicator />
						</ChartPanelExportShellFallback>
					) : (
						<Suspense fallback={<ChartPanelExportShellFallback />}>
							<MultiSeriesChart
								title="Cumulative Positions"
								subtitle="Across all chains"
								headingAs="h3"
								dataset={looprTotalDatasets.cumulativePositions}
								charts={CUMULATIVE_POSITIONS_CHART}
								valueSymbol=""
								chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
								containerClassName={CHART_FILL}
							/>
						</Suspense>
					)}
				</ChartPanel>
			</div>

			<SectionHeader>Loopr · Per-Chain Activity</SectionHeader>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{perChainModels?.activeUsers && (
					<ChartPanel>
						<ChartPanelToolbar leading={<ChartPanelTitle>Active Users by Chain</ChartPanelTitle>} />
						<Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart
								dataset={perChainModels.activeUsers.dataset}
								charts={perChainModels.activeUsers.charts}
								valueSymbol=""
								containerClassName={CHART_FILL}
								showLegend
								exportButtons="hidden"
							/>
						</Suspense>
					</ChartPanel>
				)}
				{perChainModels?.activePositions && (
					<ChartPanel>
						<ChartPanelToolbar leading={<ChartPanelTitle>Active Positions by Chain</ChartPanelTitle>} />
						<Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart
								dataset={perChainModels.activePositions.dataset}
								charts={perChainModels.activePositions.charts}
								valueSymbol=""
								containerClassName={CHART_FILL}
								showLegend
								exportButtons="hidden"
							/>
						</Suspense>
					</ChartPanel>
				)}
			</div>

			{depositsModel && (
				<>
					<SectionHeader>Loopr · Deposits by Chain</SectionHeader>
					<ChartPanel>
						<ChartPanelToolbar
							leading={<ChartPanelTitle subtitle="USD deposits per chain">Total deposits over time</ChartPanelTitle>}
						/>
						<Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart
								dataset={depositsModel.dataset}
								charts={depositsModel.charts}
								valueSymbol="$"
								containerClassName={CHART_FILL}
								showLegend
								exportButtons="hidden"
							/>
						</Suspense>
					</ChartPanel>
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
					<ChartPanel>
						<Suspense fallback={<ChartPanelExportShellFallback />}>
							<MultiSeriesChart
								title="MET Price"
								subtitle="Metronome governance token"
								headingAs="h3"
								dataset={tokenPriceDatasets.met}
								charts={MET_PRICE_CHART}
								valueSymbol="$"
								chartOptions={DOLLAR_SINGLE_SERIES_CHART_OPTIONS}
								containerClassName={CHART_FILL}
							/>
						</Suspense>
					</ChartPanel>
				)}
				{tokenPriceDatasets.vsp.source.length > 0 && (
					<ChartPanel>
						<Suspense fallback={<ChartPanelExportShellFallback />}>
							<MultiSeriesChart
								title="VSP Price"
								subtitle="Vesper governance token"
								headingAs="h3"
								dataset={tokenPriceDatasets.vsp}
								charts={VSP_PRICE_CHART}
								valueSymbol="$"
								chartOptions={DOLLAR_SINGLE_SERIES_CHART_OPTIONS}
								containerClassName={CHART_FILL}
							/>
						</Suspense>
					</ChartPanel>
				)}
			</div>

			{marketComboModel && (
				<>
					<SectionHeader>Ecosystem TVL Change vs ETH (cumulative)</SectionHeader>
					<ChartPanel>
						<ChartPanelToolbar
							leading={
								<ChartPanelTitle subtitle="Combined ecosystem TVL change vs ETH/USD change — 2y window">
									Cumulative % change since baseline
								</ChartPanelTitle>
							}
						/>
						<Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart
								dataset={marketComboModel.dataset}
								charts={marketComboModel.charts}
								valueSymbol="%"
								containerClassName={CHART_FILL}
								showLegend
								exportButtons="hidden"
							/>
						</Suspense>
					</ChartPanel>
				</>
			)}

			{morphoMarketModel && (
				<>
					<SectionHeader>Morpho Market · Supply / Borrow / Utilization</SectionHeader>
					<ChartPanel>
						<ChartPanelToolbar
							leading={
								<ChartPanelTitle subtitle="Daily supply / borrow / utilization">Featured Morpho market</ChartPanelTitle>
							}
						/>
						<Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart
								dataset={morphoMarketModel.dataset}
								charts={morphoMarketModel.charts}
								valueSymbol="$"
								containerClassName={CHART_FILL}
								showLegend
								exportButtons="hidden"
							/>
						</Suspense>
					</ChartPanel>
				</>
			)}

			{morphoMarkets.length > 0 && (
				<>
					<SectionHeader>Metronome Morpho Markets</SectionHeader>
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						{morphoMarkets.map(({ market, model }) => {
							return (
								<ChartPanel key={market.id}>
									<ChartPanelToolbar
										leading={
											<ChartPanelTitle subtitle="Daily supply / borrow / utilization">
												{market.title || market.label}
											</ChartPanelTitle>
										}
									/>
									<Suspense fallback={<ChartPanelBodyFallback />}>
										<MultiSeriesChart
											dataset={model.dataset}
											charts={model.charts}
											valueSymbol="$"
											containerClassName={CHART_FILL}
											showLegend
											exportButtons="hidden"
										/>
									</Suspense>
								</ChartPanel>
							)
						})}
					</div>
				</>
			)}

			{spendVsTvl && (
				<>
					<SectionHeader>Incentive Spend vs Pool TVL · Efficiency</SectionHeader>
					<ChartPanel>
						<ChartPanelToolbar
							leading={
								<ChartPanelTitle subtitle="Compare incentive outlay against the TVL it attracted">{`${spendVenue} — weekly spend vs pool TVL`}</ChartPanelTitle>
							}
						>
							<SegmentedControl
								variant="default"
								size="md"
								label="Spend venue"
								options={SPEND_VENUES}
								value={spendVenue}
								onValueChange={setSpendVenue}
							/>
						</ChartPanelToolbar>
						<Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart
								key={spendVenue}
								dataset={spendVsTvl.model.dataset}
								charts={spendVsTvl.model.charts}
								valueSymbol="$"
								containerClassName={CHART_FILL}
								showLegend
								exportButtons="hidden"
							/>
						</Suspense>
					</ChartPanel>
				</>
			)}
		</div>
	)
}
