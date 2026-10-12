import { lazy, Suspense, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { buildSparseCartesianChartModel, type CartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { createSingleSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanelExportShellLoading, ChartPanelTitle, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { slug } from '~/utils'
import { formatPercent } from '~/utils/numberFormat'
import { useTab, chartToModel, type LooprDailyRow, type GrowthResponse } from './api'
import { ChartCard, SimpleTable, fmtUsd } from './ui'

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

function MorphoMarketPanel({ title, model }: { title: string; model: CartesianChartModel }) {
	const chartExport = useGetChartInstance()
	return (
		<Panel>
			<ChartPanelToolbar
				leading={<ChartPanelTitle subtitle="Daily supply / borrow / utilization">{title}</ChartPanelTitle>}
			>
				<ChartExportButtons
					chart={chartExport}
					filename={slug(title)}
					title={title}
					csvSource={{ type: 'dataset', prepare: () => model.dataset }}
				/>
			</ChartPanelToolbar>
			<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
				<MultiSeriesChart
					dataset={model.dataset}
					charts={model.charts}
					valueSymbol="$"
					showLegend
					exportButtons={chartExport}
				/>
			</Suspense>
		</Panel>
	)
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
	const activeUsersChart = useGetChartInstance()
	const activePositionsChart = useGetChartInstance()
	const depositsChart = useGetChartInstance()
	const marketComboChart = useGetChartInstance()
	const morphoMarketChart = useGetChartInstance()
	const spendVsTvlChart = useGetChartInstance()

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

			<h2 className="heading-xs">Loopr · Daily activity (combined)</h2>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<Panel>
					{isLoading || looprTotalDatasets.activeAccounts.source.length === 0 ? (
						<ChartPanelExportShellLoading />
					) : (
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								exportButtons="auto"
								title="Active Accounts"
								subtitle="Owner-deduped across chains"
								headingAs="h3"
								dataset={looprTotalDatasets.activeAccounts}
								charts={ACTIVE_ACCOUNTS_CHART}
								valueSymbol=""
								chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
							/>
						</Suspense>
					)}
				</Panel>
				<Panel>
					{isLoading || looprTotalDatasets.activePositions.source.length === 0 ? (
						<ChartPanelExportShellLoading />
					) : (
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								exportButtons="auto"
								title="Active Positions"
								subtitle="Combined open positions"
								headingAs="h3"
								dataset={looprTotalDatasets.activePositions}
								charts={ACTIVE_POSITIONS_CHART}
								valueSymbol=""
								chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
							/>
						</Suspense>
					)}
				</Panel>
			</div>

			<h2 className="heading-xs">Loopr · Cumulative onboarding</h2>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<Panel>
					{isLoading ? (
						<ChartPanelExportShellLoading />
					) : (
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								exportButtons="auto"
								title="Cumulative Accounts"
								subtitle="Owner-deduped across chains"
								headingAs="h3"
								dataset={looprTotalDatasets.cumulativeAccounts}
								charts={CUMULATIVE_ACCOUNTS_CHART}
								valueSymbol=""
								chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
							/>
						</Suspense>
					)}
				</Panel>
				<Panel>
					{isLoading ? (
						<ChartPanelExportShellLoading />
					) : (
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								exportButtons="auto"
								title="Cumulative Positions"
								subtitle="Across all chains"
								headingAs="h3"
								dataset={looprTotalDatasets.cumulativePositions}
								charts={CUMULATIVE_POSITIONS_CHART}
								valueSymbol=""
								chartOptions={UNITLESS_SINGLE_SERIES_CHART_OPTIONS}
							/>
						</Suspense>
					)}
				</Panel>
			</div>

			<h2 className="heading-xs">Loopr · Per-chain activity</h2>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{perChainModels?.activeUsers && (
					<Panel>
						<ChartPanelToolbar leading={<ChartPanelTitle>Active Users by chain</ChartPanelTitle>}>
							<ChartExportButtons
								chart={activeUsersChart}
								filename="odyssey-active-users-by-chain"
								title="Active Users by chain"
								csvSource={{ type: 'dataset', prepare: () => perChainModels.activeUsers.dataset }}
							/>
						</ChartPanelToolbar>
						<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
							<MultiSeriesChart
								dataset={perChainModels.activeUsers.dataset}
								charts={perChainModels.activeUsers.charts}
								valueSymbol=""
								showLegend
								exportButtons={activeUsersChart}
							/>
						</Suspense>
					</Panel>
				)}
				{perChainModels?.activePositions && (
					<Panel>
						<ChartPanelToolbar leading={<ChartPanelTitle>Active Positions by chain</ChartPanelTitle>}>
							<ChartExportButtons
								chart={activePositionsChart}
								filename="odyssey-active-positions-by-chain"
								title="Active Positions by chain"
								csvSource={{ type: 'dataset', prepare: () => perChainModels.activePositions.dataset }}
							/>
						</ChartPanelToolbar>
						<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
							<MultiSeriesChart
								dataset={perChainModels.activePositions.dataset}
								charts={perChainModels.activePositions.charts}
								valueSymbol=""
								showLegend
								exportButtons={activePositionsChart}
							/>
						</Suspense>
					</Panel>
				)}
			</div>

			{depositsModel && (
				<>
					<h2 className="heading-xs">Loopr · Deposits by chain</h2>
					<Panel>
						<ChartPanelToolbar
							leading={<ChartPanelTitle subtitle="USD deposits per chain">Total deposits over time</ChartPanelTitle>}
						>
							<ChartExportButtons
								chart={depositsChart}
								filename="odyssey-total-deposits-over-time"
								title="Total deposits over time"
								csvSource={{ type: 'dataset', prepare: () => depositsModel.dataset }}
							/>
						</ChartPanelToolbar>
						<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
							<MultiSeriesChart
								dataset={depositsModel.dataset}
								charts={depositsModel.charts}
								valueSymbol="$"
								showLegend
								exportButtons={depositsChart}
							/>
						</Suspense>
					</Panel>
				</>
			)}

			{loopr?.byStrategy?.length ? (
				<>
					<h2 className="heading-xs">Loopr · By strategy</h2>
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

			<h2 className="heading-xs">Token Prices</h2>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{tokenPriceDatasets.met.source.length > 0 && (
					<Panel>
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								exportButtons="auto"
								title="MET Price"
								subtitle="Metronome governance token"
								headingAs="h3"
								dataset={tokenPriceDatasets.met}
								charts={MET_PRICE_CHART}
								valueSymbol="$"
								chartOptions={DOLLAR_SINGLE_SERIES_CHART_OPTIONS}
							/>
						</Suspense>
					</Panel>
				)}
				{tokenPriceDatasets.vsp.source.length > 0 && (
					<Panel>
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								exportButtons="auto"
								title="VSP Price"
								subtitle="Vesper governance token"
								headingAs="h3"
								dataset={tokenPriceDatasets.vsp}
								charts={VSP_PRICE_CHART}
								valueSymbol="$"
								chartOptions={DOLLAR_SINGLE_SERIES_CHART_OPTIONS}
							/>
						</Suspense>
					</Panel>
				)}
			</div>

			{marketComboModel && (
				<>
					<h2 className="heading-xs">Ecosystem TVL Change vs ETH (cumulative)</h2>
					<Panel>
						<ChartPanelToolbar
							leading={
								<ChartPanelTitle subtitle="Combined ecosystem TVL change vs ETH/USD change — 2y window">
									Cumulative % change since baseline
								</ChartPanelTitle>
							}
						>
							<ChartExportButtons
								chart={marketComboChart}
								filename="odyssey-cumulative-tvl-change-vs-eth"
								title="Cumulative % change since baseline"
								csvSource={{ type: 'dataset', prepare: () => marketComboModel.dataset }}
							/>
						</ChartPanelToolbar>
						<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
							<MultiSeriesChart
								dataset={marketComboModel.dataset}
								charts={marketComboModel.charts}
								valueSymbol="%"
								showLegend
								exportButtons={marketComboChart}
							/>
						</Suspense>
					</Panel>
				</>
			)}

			{morphoMarketModel && (
				<>
					<h2 className="heading-xs">Morpho market · Supply / Borrow / Utilization</h2>
					<Panel>
						<ChartPanelToolbar
							leading={
								<ChartPanelTitle subtitle="Daily supply / borrow / utilization">Featured Morpho market</ChartPanelTitle>
							}
						>
							<ChartExportButtons
								chart={morphoMarketChart}
								filename="odyssey-featured-morpho-market"
								title="Featured Morpho market"
								csvSource={{ type: 'dataset', prepare: () => morphoMarketModel.dataset }}
							/>
						</ChartPanelToolbar>
						<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
							<MultiSeriesChart
								dataset={morphoMarketModel.dataset}
								charts={morphoMarketModel.charts}
								valueSymbol="$"
								showLegend
								exportButtons={morphoMarketChart}
							/>
						</Suspense>
					</Panel>
				</>
			)}

			{morphoMarkets.length > 0 && (
				<>
					<h2 className="heading-xs">Metronome Morpho markets</h2>
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						{morphoMarkets.map(({ market, model }) => (
							<MorphoMarketPanel key={market.id} title={market.title || market.label} model={model} />
						))}
					</div>
				</>
			)}

			{spendVsTvl && (
				<>
					<h2 className="heading-xs">Incentive Spend vs Pool TVL · Efficiency</h2>
					<Panel>
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
							<ChartExportButtons
								chart={spendVsTvlChart}
								filename="odyssey-spend-vs-pool-tvl"
								title={`${spendVenue} — weekly spend vs pool TVL`}
								csvSource={{ type: 'dataset', prepare: () => spendVsTvl.model.dataset }}
							/>
						</ChartPanelToolbar>
						<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
							<MultiSeriesChart
								key={spendVenue}
								dataset={spendVsTvl.model.dataset}
								charts={spendVsTvl.model.charts}
								valueSymbol="$"
								showLegend
								exportButtons={spendVsTvlChart}
							/>
						</Suspense>
					</Panel>
				</>
			)}
		</div>
	)
}
