import { createColumnHelper, useTable } from '@tanstack/react-table'
import { lazy, useMemo, useState } from 'react'
import {
	createSingleSeriesChartOptions,
	createTimeSeriesChartOptions
} from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { displayTableFeatures } from '~/components/Table/features/display'
import { TabStatus } from '~/containers/Investors/TabStatus'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import { buildRevenueChartModels, timeframeStartIndex, type Aggregation, type Timeframe } from './chartData'
import { getValidTimeframeForAggregation, useRevenueData, type WalletEntry } from './revenueApi'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const EMISSIONS_PERCENTAGE_CHART_OPTIONS = createSingleSeriesChartOptions('%')
const EMISSIONS_ABSOLUTE_CHART_OPTIONS = createTimeSeriesChartOptions(' NEAR')

const EMISSIONS_PERCENTAGE_CHART: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Revenue as % of Emissions',
		type: 'line',
		encode: { x: 'timestamp', y: 'Revenue as % of Emissions' }
	}
]

const EMISSIONS_ABSOLUTE_CHARTS: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Cumulative Revenue',
		type: 'line',
		color: '#00C1DE',
		encode: { x: 'timestamp', y: 'Cumulative Revenue' }
	},
	{
		name: 'Cumulative Emissions',
		type: 'line',
		color: '#FF6B6B',
		encode: { x: 'timestamp', y: 'Cumulative Emissions' }
	}
]

function KpiCard({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-subtle bg-surface p-4">
			<div className="flex items-center gap-1">
				<span className="label-sm tracking-wide text-secondary">{label}</span>
				{tooltip && (
					<span className="group relative cursor-help">
						<svg className="size-3.5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<circle cx="12" cy="12" r="10" strokeWidth="2" />
							<path d="M12 16v-4M12 8h.01" strokeWidth="2" strokeLinecap="round" />
						</svg>
						<span className="pointer-events-none absolute top-5 left-0 z-10 hidden w-64 rounded-md border border-subtle bg-overlay p-2 body-sm text-secondary shadow-overlay group-hover:block">
							{tooltip}
						</span>
					</span>
				)}
			</div>
			<span className="mono-xl text-primary">{value}</span>
		</div>
	)
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-1 label-md text-secondary">{title}</h3>
			{subtitle && <p className="mb-3 body-sm text-secondary">{subtitle}</p>}
			{children}
		</div>
	)
}

function SectionHeader({ children }: { children: React.ReactNode }) {
	return <h2 className="title-sm tracking-wider text-secondary uppercase">{children}</h2>
}

const walletColumnHelper = createColumnHelper<typeof displayTableFeatures, WalletEntry>()

const walletColumns = walletColumnHelper.columns([
	walletColumnHelper.accessor('wallet', {
		header: 'Wallet',
		cell: (info) => {
			const row = info.row.original
			return row.link ? (
				<a href={row.link} target="_blank" rel="noopener noreferrer" className="mono-md text-link hover:underline">
					{info.getValue()}
				</a>
			) : (
				<span className="mono-md">{info.getValue()}</span>
			)
		},
		size: 300
	}),
	walletColumnHelper.accessor((row) => row.total ?? undefined, {
		id: 'totalFormatted',
		header: 'Total NEAR',
		cell: ({ row }) => <span className="tabular-nums">{row.original.totalFormatted}</span>,
		size: 150
	}),
	walletColumnHelper.accessor((row) => row.total ?? undefined, {
		id: 'shareFormatted',
		header: 'Share',
		cell: ({ row }) => <span className="tabular-nums">{row.original.shareFormatted}</span>,
		size: 100
	})
])

export default function Revenue() {
	const { data, isLoading } = useRevenueData()
	const [globalTimeframe, setGlobalTimeframe] = useState<Timeframe>('all')
	const [aggregation, setAggregation] = useState<Aggregation>('daily')
	const [emissionsView, setEmissionsView] = useState<'percentage' | 'absolute'>('percentage')

	const walletTable = useTable({
		features: displayTableFeatures,
		defaultColumn: { sortUndefined: 'last' },
		data: data?.walletBreakdown ?? [],
		columns: walletColumns,
		initialState: {
			sorting: [{ id: 'totalFormatted', desc: true }]
		}
	})

	const emissionsDataset = useMemo<MultiSeriesChartDataset | null>(() => {
		if (!data) return null

		const start = timeframeStartIndex(data.rawData.emissionsDates, globalTimeframe)
		const length = data.rawData.emissionsDates.length - start
		const source = new Array<MultiSeriesChartDataset['source'][number]>(length)

		if (emissionsView === 'percentage') {
			for (let index = 0; index < length; index++) {
				const sourceIndex = start + index
				source[index] = [
					Date.parse(`${data.rawData.emissionsDates[sourceIndex]}T00:00:00Z`),
					data.rawData.percentageFromCumulative[sourceIndex] || 0
				]
			}
			return { dimensions: ['timestamp', 'Revenue as % of Emissions'], source }
		}

		for (let index = 0; index < length; index++) {
			const sourceIndex = start + index
			source[index] = [
				Date.parse(`${data.rawData.emissionsDates[sourceIndex]}T00:00:00Z`),
				data.rawData.cumulativeRevenue[sourceIndex] || 0,
				data.rawData.cumulativeEmissions[sourceIndex] || 0
			]
		}
		return { dimensions: ['timestamp', 'Cumulative Revenue', 'Cumulative Emissions'], source }
	}, [data, emissionsView, globalTimeframe])

	const chartView = useMemo(
		() => (data ? buildRevenueChartModels(data.rawData, globalTimeframe, aggregation) : null),
		[aggregation, data, globalTimeframe]
	)

	if (isLoading) return <TabStatus variant="loading" />
	if (!data || !chartView || !emissionsDataset)
		return <TabStatus variant="error">Couldn't load NEAR revenue.</TabStatus>

	return (
		<div className="flex flex-col gap-6">
			<details className="group rounded-xl border border-subtle bg-surface transition-all hover:border-strong">
				<summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 label-lg text-primary">
					<span>Quick Investment Thesis</span>
					<svg
						className="size-5 shrink-0 text-secondary transition-transform duration-200 group-open:rotate-180"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
					</svg>
				</summary>
				<div className="flex flex-col gap-4 border-t border-subtle px-5 pt-4 pb-5 body-md text-secondary">
					<p>
						The standard way to evaluate NEAR understates its traction. Base-chain metrics alone miss the majority of
						fee-generating activity. When NEAR Intents volume is included, the annualized fee run rate as of early 2026
						is approximately $53M, placing NEAR&apos;s P/S ratio at roughly 28x. Ethereum trades at 194x. Solana trades
						at 40x. At a $1.49B market cap, that gap is the core of the investment case.
					</p>
					<p>
						The February 2026 fee switch is the structural event that makes this legible onchain. Before it, Intents
						fees accrued outside the base protocol. After it, 100% of NEAR Intents volume triggers $NEAR purchases
						through a three-tier fee architecture. Combined with the 70% gas burn on base-chain fees, every dollar of
						Intents volume now creates direct, measurable supply compression. The token has moved from utility to
						fee-accrual.
					</p>
					<p>
						The October 2025 halving cut annual inflation from 5% to 2.5%, lowering the deflationary threshold by half.
						At $1.22 per NEAR, the protocol now needs approximately $177M in daily volume to become net deflationary.
						The trailing 90-day daily average through February 2026 was $77M. Under base case growth of 3.5x annually,
						the model projects NEAR crosses the deflationary threshold in 2026, with the threshold itself declining each
						subsequent year as the blended take rate rises with native front-end adoption.
					</p>
					<p>
						There is also a reflexive element worth understanding. As the NEAR price rises, each token bought back
						through the Intents fee mechanism absorbs more USD-denominated issuance in token terms, meaning higher
						prices lower the volume required for net deflation. Volume drives deflation, deflation drives price
						appreciation, price appreciation broadens institutional access, institutional access drives volume. This
						loop operates most forcefully at inflection points, which is where the protocol appears to be now.
					</p>
				</div>
			</details>

			<div className="flex items-center justify-between">
				<SectionHeader>Dashboard Timeframe</SectionHeader>
				<SegmentedControl<Timeframe>
					variant="default"
					size="md"
					// Holds its width so the heading wraps instead; shrinking, it clipped "All" at 375px.
					className="shrink-0"
					label="Dashboard timeframe"
					value={globalTimeframe}
					onValueChange={(v) => setGlobalTimeframe(getValidTimeframeForAggregation(v, aggregation) as Timeframe)}
					options={[
						{ value: '7d', label: '7D' },
						{ value: '30d', label: '30D' },
						{ value: 'ytd', label: 'YTD' },
						{ value: '1y', label: '1Y' },
						{ value: 'all', label: 'All' }
					]}
				/>
			</div>

			<div className="flex flex-col gap-4">
				<SectionHeader>Total Fees Generated</SectionHeader>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<KpiCard
						label="All Time"
						value={data.kpis.fees.allTime.formatted}
						tooltip="Total fees earned by NEAR Protocol and Products, converted from USD to NEAR at daily prices"
					/>
					<KpiCard label="YTD" value={data.kpis.fees.ytd.formatted} tooltip="Year to date total fees" />
					<KpiCard label="30D" value={data.kpis.fees.d30.formatted} tooltip="Last 30 days total fees" />
				</div>
			</div>

			<div className="flex flex-col gap-4">
				<SectionHeader>Revenue</SectionHeader>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<KpiCard
						label="All Time"
						value={data.kpis.revenue.allTime.formatted}
						tooltip="NEAR received by intents fee wallets (fefundsadmin + 1csfundsadmin) plus protocol transaction fees (70% burned)"
					/>
					<KpiCard label="YTD" value={data.kpis.revenue.ytd.formatted} tooltip="Year to date revenue" />
					<KpiCard label="30D" value={data.kpis.revenue.d30.formatted} tooltip="Last 30 days revenue" />
				</div>
			</div>

			<div className="flex items-center justify-between">
				<SectionHeader>Data Aggregation</SectionHeader>
				<SegmentedControl<Aggregation>
					variant="default"
					size="md"
					label="Data aggregation"
					value={aggregation}
					onValueChange={(nextAggregation) => {
						setAggregation(nextAggregation)
						setGlobalTimeframe(getValidTimeframeForAggregation(globalTimeframe, nextAggregation) as Timeframe)
					}}
					options={[
						{ value: 'daily', label: 'Daily' },
						{ value: 'weekly', label: 'Weekly' },
						{ value: 'monthly', label: 'Monthly' }
					]}
				/>
			</div>

			<div className="flex flex-col gap-4">
				<SectionHeader>Total Fees Generated in NEAR</SectionHeader>
				<ChartCard
					title="All fees earned by NEAR Protocol and Products"
					subtitle={`Converted from USD to NEAR at daily prices. Line shows cumulative (left axis), bars show ${aggregation} breakdown (right axis).`}
				>
					<MultiSeriesChart
						dataset={chartView.feesModel.dataset}
						charts={chartView.feesModel.charts}
						groupBy={aggregation}
						valueSymbol=" NEAR"
						height="400px"
						showTotalInTooltip
						hideDefaultLegend={false}
						exportButtons="hidden"
					/>
				</ChartCard>
			</div>

			<div className="flex flex-col gap-4">
				<SectionHeader>Revenue Over Time</SectionHeader>
				<ChartCard
					title="NEAR received by protocol"
					subtitle={`Intents fee wallets (fefundsadmin + 1csfundsadmin) plus protocol transaction fees (70% burned). Line shows cumulative (left axis), bars show ${aggregation} breakdown (right axis).`}
				>
					<MultiSeriesChart
						dataset={chartView.revenueModel.dataset}
						charts={chartView.revenueModel.charts}
						groupBy={aggregation}
						valueSymbol=" NEAR"
						height="400px"
						showTotalInTooltip
						hideDefaultLegend={false}
						exportButtons="hidden"
					/>
				</ChartCard>
			</div>

			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<SectionHeader>Revenue vs Emissions</SectionHeader>
					<SegmentedControl<typeof emissionsView>
						variant="default"
						size="md"
						label="Revenue vs emissions view"
						value={emissionsView}
						onValueChange={setEmissionsView}
						options={[
							{ value: 'percentage', label: '% of Emissions' },
							{ value: 'absolute', label: 'Absolute' }
						]}
					/>
				</div>
				<ChartCard
					title="Comparison of protocol revenue relative to token issuance"
					subtitle={
						emissionsView === 'percentage'
							? 'Cumulative revenue as percentage of cumulative emissions'
							: 'Cumulative revenue vs cumulative emissions'
					}
				>
					{emissionsView === 'percentage' ? (
						<MultiSeriesChart
							dataset={emissionsDataset}
							charts={EMISSIONS_PERCENTAGE_CHART}
							valueSymbol="%"
							chartOptions={EMISSIONS_PERCENTAGE_CHART_OPTIONS}
							height="400px"
						/>
					) : (
						<MultiSeriesChart
							dataset={emissionsDataset}
							charts={EMISSIONS_ABSOLUTE_CHARTS}
							valueSymbol=" NEAR"
							chartOptions={EMISSIONS_ABSOLUTE_CHART_OPTIONS}
							height="400px"
							hideDefaultLegend={false}
							exportButtons="hidden"
						/>
					)}
				</ChartCard>
			</div>

			{data.walletBreakdown && data.walletBreakdown.length > 0 && (
				<div className="flex flex-col gap-4">
					<SectionHeader>Wallet Breakdown</SectionHeader>
					<div className="overflow-x-auto rounded-lg border border-subtle bg-surface">
						<table className="w-full">
							<thead>
								{walletTable.getHeaderGroups().map((headerGroup) => (
									<tr key={headerGroup.id} className="border-b border-subtle">
										{headerGroup.headers.map((header) => (
											<th
												key={header.id}
												className="px-4 py-3 text-left title-sm tracking-wide text-secondary uppercase"
												style={{ width: header.getSize() }}
												onClick={header.column.getToggleSortingHandler()}
											>
												<div className="flex cursor-pointer items-center gap-1">
													{typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : null}
													{header.column.getIsSorted() === 'asc'
														? ' ↑'
														: header.column.getIsSorted() === 'desc'
															? ' ↓'
															: ''}
												</div>
											</th>
										))}
									</tr>
								))}
							</thead>
							<tbody>
								{walletTable.getRowModel().rows.map((row) => (
									<tr key={row.id} className="border-b border-subtle last:border-b-0 hover:bg-hover-row">
										{row.getVisibleCells().map((cell) => (
											<td key={cell.id} className="px-4 py-2.5 body-md text-primary">
												{typeof cell.column.columnDef.cell === 'function'
													? cell.column.columnDef.cell(cell.getContext())
													: (cell.getValue() as string)}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{data.metadata?.faq && data.metadata.faq.length > 0 && (
				<div className="flex flex-col gap-4">
					<SectionHeader>Frequently Asked Questions</SectionHeader>
					<div className="flex flex-col gap-3">
						{keyedOccurrences(data.metadata.faq, (item) => item.question).map(({ item, key }, idx) => (
							<details
								key={key}
								className="group overflow-hidden rounded-lg border border-subtle bg-surface transition-all hover:border-strong"
							>
								<summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5 label-md text-primary transition-colors hover:bg-hover-row">
									<span className="flex items-start gap-3">
										<span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-(--text-secondary) label-sm text-(--bg-surface)">
											{idx + 1}
										</span>
										<span className="pt-0.5">{item.question}</span>
									</span>
									<svg
										className="mt-1 size-5 shrink-0 text-secondary transition-transform duration-200 group-open:rotate-180"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
									</svg>
								</summary>
								<div className="border-t border-subtle bg-hover-row px-5 pt-4 pb-5">
									<p className="pl-9 body-md text-secondary">{item.answer}</p>
								</div>
							</details>
						))}
					</div>
				</div>
			)}

			{data.metadata && (
				<div className="rounded-lg border border-subtle bg-surface p-4 body-sm text-secondary">
					<p>
						Data via{' '}
						{Object.entries(data.metadata.links || {}).map(([key, url], idx, arr) => (
							<span key={key}>
								<a href={url} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
									{key}
								</a>
								{idx < arr.length - 1 ? ' · ' : ''}
							</span>
						))}
					</p>
					<p className="mt-1">Last updated: {data.metadata.updatedAt}</p>
				</div>
			)}
		</div>
	)
}
