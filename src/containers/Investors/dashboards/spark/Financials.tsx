import { lazy, Suspense, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { CHART_FILL, ChartPanel, ChartPanelBodyLoading, ChartPanelTitle, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { PanelStatus, PanelLoadingStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { formatPercent } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { assignColors } from './api'
import {
	DOLLAR_CHART_OPTIONS,
	DOLLAR_SCROLL_CHART_OPTIONS,
	DOLLAR_STACKED_SCROLL_CHART_OPTIONS,
	HIDDEN_EXPORT,
	UNITLESS_CHART_OPTIONS,
	UNITLESS_STACKED_SCROLL_CHART_OPTIONS
} from './chartDefaults'
import { useFinancialsData, type AllocatedAssetsData, type AllocatedAssetsEntry } from './financialsApi'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

function sparkExportTitle(title: string) {
	const lowerTitle = title.toLowerCase()
	return lowerTitle.includes('spark') || title.startsWith('SPK') ? title : `Spark ${title}`
}

function SectionHeader({ children }: { children: React.ReactNode }) {
	return <h2 className="title-sm tracking-wider text-secondary uppercase">{children}</h2>
}

type AADimension = 'byProtocol' | 'byNetwork' | 'byAsset'

const AA_VIEW_OPTIONS = [
	{ value: 'breakdown', label: 'Breakdown' },
	{ value: 'historical', label: 'Historical' }
] as const

const AA_DIMENSION_OPTIONS = [
	{ value: 'byProtocol', label: 'By Protocol' },
	{ value: 'byNetwork', label: 'By Network' },
	{ value: 'byAsset', label: 'By Asset' }
] as const

function AllocatedAssetsSection({
	allocatedAssets,
	aaHistorical
}: {
	allocatedAssets: AllocatedAssetsData
	aaHistorical: Record<
		AADimension,
		{
			dataset: IMultiSeriesChartProps['dataset']
			charts: NonNullable<IMultiSeriesChartProps['charts']>
			title: string
		}
	>
}) {
	const [view, setView] = useState<'breakdown' | 'historical'>('breakdown')
	const historical = useGetChartInstance()
	const [dimension, setDimension] = useState<AADimension>('byProtocol')
	const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

	const currentEntries: Array<AllocatedAssetsEntry> = allocatedAssets[dimension]
	const pieColors = useMemo(() => assignColors(currentEntries.map((e) => e.name)), [currentEntries])

	const toggleRow = (idx: number) => {
		setExpandedRows((prev) => {
			const next = new Set(prev)
			if (next.has(idx)) next.delete(idx)
			else next.add(idx)
			return next
		})
	}

	const onDimensionChange = (dim: AADimension) => {
		setDimension(dim)
		setExpandedRows(new Set())
	}

	const hist = aaHistorical[dimension]

	return (
		<div className="flex flex-col gap-4">
			<SectionHeader>SLL Allocated Assets</SectionHeader>
			<ChartPanel>
				<ChartPanelToolbar leading={<ChartPanelTitle>{allocatedAssets.title}</ChartPanelTitle>}>
					<SegmentedControl<typeof view>
						variant="default"
						size="md"
						label="Allocated assets view"
						options={AA_VIEW_OPTIONS}
						value={view}
						onValueChange={setView}
					/>
					<SegmentedControl
						variant="default"
						size="md"
						label="Allocated assets grouping"
						options={AA_DIMENSION_OPTIONS}
						value={dimension}
						onValueChange={onDimensionChange}
					/>
					{view === 'historical' ? (
						<ChartExportButtons
							chartInstance={historical.chartInstance}
							filename={`spark-allocated-assets-${dimension}`}
							title={sparkExportTitle(allocatedAssets.title)}
							csvSource={{ type: 'dataset', prepare: () => hist.dataset }}
						/>
					) : null}
				</ChartPanelToolbar>

				{view === 'breakdown' ? (
					/* The donut is a side tile beside its list, so it keeps its own height rather than the 360 body floor. */
					<div className="grid grid-cols-1 gap-4 px-2 pb-2 md:grid-cols-2">
						<div className="min-h-[320px]">
							<Suspense fallback={<ChartPanelBodyLoading className="min-h-[320px]" />}>
								<PieChart
									chartData={currentEntries}
									stackColors={pieColors}
									radius={['40%', '70%']}
									height="320px"
									valueSymbol="$"
								/>
							</Suspense>
						</div>
						<div>
							<div className="max-h-[400px] overflow-y-auto">
								{currentEntries.map((entry, idx) => {
									const hasChildren = entry.children && entry.children.length > 0
									const isOpen = expandedRows.has(idx)
									const color = pieColors[entry.name] || 'var(--text-tertiary)'
									const row = (
										<>
											<span className="flex w-4 shrink-0 justify-center">
												{hasChildren ? (
													<Icon
														name="chevron-right"
														className={`size-3.5 text-tertiary transition-transform ${isOpen ? 'rotate-90' : ''}`}
													/>
												) : null}
											</span>
											<span className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} />
											<span className="min-w-0 flex-1 truncate body-md text-primary">{entry.name}</span>
											<span className="shrink-0 label-md text-primary">{entry.formatted}</span>
											<span className="w-12 shrink-0 text-right body-sm text-secondary">
												{formatPercent(entry.pct, { input: 'percent' })}
											</span>
										</>
									)
									return (
										<div key={entry.name} className="border-b border-subtle last:border-b-0">
											{hasChildren ? (
												<button
													type="button"
													aria-expanded={isOpen}
													className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-2.5 text-left hover:bg-hover-row"
													onClick={() => toggleRow(idx)}
												>
													{row}
												</button>
											) : (
												<div className="flex w-full items-center gap-2 px-1 py-2.5">{row}</div>
											)}
											{isOpen && entry.children && (
												<div className="pb-2 pl-8">
													{entry.children.map((child) => (
														<div key={child.name} className="flex items-center py-1.5 body-sm text-secondary">
															<span className="min-w-0 flex-1 truncate">{child.name}</span>
															<span className="shrink-0">{child.formatted}</span>
														</div>
													))}
												</div>
											)}
										</div>
									)
								})}
							</div>
							<div className="mt-3 flex items-center justify-between border-t border-subtle pt-3">
								<span className="body-md text-secondary">Total AUM</span>
								<span className="title-md text-primary">{allocatedAssets.totalFormatted}</span>
							</div>
						</div>
					</div>
				) : (
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={hist.dataset}
							charts={hist.charts}
							valueSymbol="$"
							stacked
							solidChartAreaStyle
							containerClassName={CHART_FILL}
							chartOptions={DOLLAR_STACKED_SCROLL_CHART_OPTIONS}
							exportButtons="hidden"
							onReady={historical.handleChartReady}
						/>
					</Suspense>
				)}
			</ChartPanel>
		</div>
	)
}

function MonthlyReturnsSection({ data }: { data: NonNullable<ReturnType<typeof useFinancialsData>['data']> }) {
	const gross = useGetChartInstance()
	const net = useGetChartInstance()

	return (
		<div className="flex flex-col gap-4">
			<SectionHeader>Monthly Returns</SectionHeader>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>{data.monthlyGross.title}</ChartPanelTitle>}>
						<ChartPngExportButton
							chartInstance={gross.chartInstance}
							filename="gross-returns"
							title={sparkExportTitle(data.monthlyGross.title)}
							smol
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={data.monthlyGross.dataset}
							charts={data.monthlyGross.charts}
							valueSymbol="$"
							containerClassName={CHART_FILL}
							showLegend={data.monthlyGross.charts.length > 1}
							chartOptions={DOLLAR_SCROLL_CHART_OPTIONS}
							exportButtons={HIDDEN_EXPORT}
							onReady={gross.handleChartReady}
						/>
					</Suspense>
				</ChartPanel>
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>{data.monthlyNet.title}</ChartPanelTitle>}>
						<ChartPngExportButton
							chartInstance={net.chartInstance}
							filename="net-returns"
							title={sparkExportTitle(data.monthlyNet.title)}
							smol
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={data.monthlyNet.dataset}
							charts={data.monthlyNet.charts}
							valueSymbol="$"
							containerClassName={CHART_FILL}
							showLegend={data.monthlyNet.charts.length > 1}
							chartOptions={DOLLAR_SCROLL_CHART_OPTIONS}
							exportButtons={HIDDEN_EXPORT}
							onReady={net.handleChartReady}
						/>
					</Suspense>
				</ChartPanel>
			</div>
		</div>
	)
}

function SusdsDistributionSection({ data }: { data: NonNullable<ReturnType<typeof useFinancialsData>['data']> }) {
	const total = useGetChartInstance()
	const byChain = useGetChartInstance()

	return (
		<div className="flex flex-col gap-4">
			<SectionHeader>sUSDS Distribution</SectionHeader>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>Spark-distributed USDS</ChartPanelTitle>}>
						<ChartPngExportButton
							chartInstance={total.chartInstance}
							filename="spark-distributed-usds"
							title={sparkExportTitle('Spark-distributed USDS')}
							smol
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={data.supplyTotal.dataset}
							charts={data.supplyTotal.charts}
							valueSymbol=""
							containerClassName={CHART_FILL}
							chartOptions={UNITLESS_CHART_OPTIONS}
							exportButtons={HIDDEN_EXPORT}
							onReady={total.handleChartReady}
						/>
					</Suspense>
				</ChartPanel>
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>{data.supplyByChain.title}</ChartPanelTitle>}>
						<ChartPngExportButton
							chartInstance={byChain.chartInstance}
							filename="susds-by-chain"
							title={sparkExportTitle(data.supplyByChain.title)}
							smol
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={data.supplyByChain.dataset}
							charts={data.supplyByChain.charts}
							valueSymbol=""
							stacked
							solidChartAreaStyle
							containerClassName={CHART_FILL}
							chartOptions={UNITLESS_STACKED_SCROLL_CHART_OPTIONS}
							exportButtons={HIDDEN_EXPORT}
							onReady={byChain.handleChartReady}
						/>
					</Suspense>
				</ChartPanel>
			</div>
		</div>
	)
}

type FinData = NonNullable<ReturnType<typeof useFinancialsData>['data']>

function TvlSection({ data }: { data: FinData }) {
	const tvl = useGetChartInstance()
	return (
		<div className="flex flex-col gap-4">
			<SectionHeader>Total Value Locked</SectionHeader>
			<StatTile label="Current TVL" value={data.tvl.currentFormatted} />
			<ChartPanel>
				<ChartPanelToolbar leading={<ChartPanelTitle>{data.tvl.title}</ChartPanelTitle>}>
					<ChartPngExportButton
						chartInstance={tvl.chartInstance}
						filename="tvl"
						title={sparkExportTitle(data.tvl.title)}
						smol
					/>
				</ChartPanelToolbar>
				<Suspense fallback={<ChartPanelBodyLoading />}>
					<MultiSeriesChart
						dataset={data.tvl.dataset}
						charts={data.tvl.charts}
						valueSymbol="$"
						stacked
						solidChartAreaStyle
						containerClassName={CHART_FILL}
						chartOptions={DOLLAR_STACKED_SCROLL_CHART_OPTIONS}
						exportButtons={HIDDEN_EXPORT}
						onReady={tvl.handleChartReady}
					/>
				</Suspense>
			</ChartPanel>
		</div>
	)
}

function DepositsAndBorrowsSection({ data }: { data: FinData }) {
	const deposits = useGetChartInstance()
	const borrows = useGetChartInstance()
	return (
		<div className="flex flex-col gap-4">
			<SectionHeader>SparkLend Deposits &amp; Borrows</SectionHeader>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>{data.deposits.title}</ChartPanelTitle>}>
						<ChartPngExportButton
							chartInstance={deposits.chartInstance}
							filename="sparklend-deposits"
							title={sparkExportTitle(data.deposits.title)}
							smol
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={data.deposits.dataset}
							charts={data.deposits.charts}
							valueSymbol="$"
							containerClassName={CHART_FILL}
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={HIDDEN_EXPORT}
							onReady={deposits.handleChartReady}
						/>
					</Suspense>
				</ChartPanel>
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>{data.borrows.title}</ChartPanelTitle>}>
						<ChartPngExportButton
							chartInstance={borrows.chartInstance}
							filename="sparklend-borrows"
							title={sparkExportTitle(data.borrows.title)}
							smol
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={data.borrows.dataset}
							charts={data.borrows.charts}
							valueSymbol="$"
							containerClassName={CHART_FILL}
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={HIDDEN_EXPORT}
							onReady={borrows.handleChartReady}
						/>
					</Suspense>
				</ChartPanel>
			</div>
		</div>
	)
}

function SllTvlSection({ data }: { data: FinData }) {
	const sllTvl = useGetChartInstance()
	return (
		<div className="flex flex-col gap-4">
			<SectionHeader>SLL TVL by Chain</SectionHeader>
			<ChartPanel>
				<ChartPanelToolbar leading={<ChartPanelTitle>{data.sllTvl.title}</ChartPanelTitle>}>
					<ChartPngExportButton
						chartInstance={sllTvl.chartInstance}
						filename="sll-tvl-by-chain"
						title={sparkExportTitle(data.sllTvl.title)}
						smol
					/>
				</ChartPanelToolbar>
				<Suspense fallback={<ChartPanelBodyLoading />}>
					<MultiSeriesChart
						dataset={data.sllTvl.dataset}
						charts={data.sllTvl.charts}
						valueSymbol="$"
						stacked
						solidChartAreaStyle
						containerClassName={CHART_FILL}
						chartOptions={DOLLAR_STACKED_SCROLL_CHART_OPTIONS}
						exportButtons={HIDDEN_EXPORT}
						onReady={sllTvl.handleChartReady}
					/>
				</Suspense>
			</ChartPanel>
		</div>
	)
}

function SavingsTvlSection({ data }: { data: FinData }) {
	const savingsTvl = useGetChartInstance()
	return (
		<div className="flex flex-col gap-4">
			<SectionHeader>Spark Savings TVL by Chain</SectionHeader>
			<ChartPanel>
				<ChartPanelToolbar leading={<ChartPanelTitle>{data.savingsTvl.title}</ChartPanelTitle>}>
					<ChartPngExportButton
						chartInstance={savingsTvl.chartInstance}
						filename="spark-savings-tvl-by-chain"
						title={sparkExportTitle(data.savingsTvl.title)}
						smol
					/>
				</ChartPanelToolbar>
				<Suspense fallback={<ChartPanelBodyLoading />}>
					<MultiSeriesChart
						dataset={data.savingsTvl.dataset}
						charts={data.savingsTvl.charts}
						valueSymbol="$"
						stacked
						solidChartAreaStyle
						containerClassName={CHART_FILL}
						chartOptions={DOLLAR_STACKED_SCROLL_CHART_OPTIONS}
						exportButtons={HIDDEN_EXPORT}
						onReady={savingsTvl.handleChartReady}
					/>
				</Suspense>
			</ChartPanel>
		</div>
	)
}

function TreasurySection({ data }: { data: FinData }) {
	const treasury = useGetChartInstance()
	const buybacks = useGetChartInstance()
	return (
		<div className="flex flex-col gap-4">
			<SectionHeader>Treasury &amp; Buybacks</SectionHeader>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div className="rounded-lg border border-subtle bg-surface p-4">
					<h3 className="mb-3 label-md text-secondary">Treasury</h3>
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between border-b border-subtle py-2">
							<span className="body-sm text-secondary">Total Treasury Assets</span>
							<span className="title-md text-primary">{data.treasuryKpis.totalAssets.formatted}</span>
						</div>
						<div className="flex items-center justify-between border-b border-subtle py-2">
							<span className="body-sm text-secondary">Buyback Threshold</span>
							<span className="title-md text-primary">{data.treasuryKpis.buybackThreshold.formatted}</span>
						</div>
						<div className="flex items-center justify-between py-2">
							<span className="body-sm text-secondary">Current vs Threshold</span>
							<span className={`title-md ${data.treasuryKpis.vsThreshold.value >= 0 ? 'text-success' : 'text-error'}`}>
								{data.treasuryKpis.vsThreshold.formatted}
							</span>
						</div>
					</div>
				</div>
				<div className="rounded-lg border border-subtle bg-surface p-4">
					<h3 className="mb-3 label-md text-secondary">SPK Buyback Tracker</h3>
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between border-b border-subtle py-2">
							<span className="body-sm text-secondary">USDS Spent</span>
							<span className="title-md text-primary">{data.buybackKpis.usdsSpent.formatted}</span>
						</div>
						<div className="flex items-center justify-between border-b border-subtle py-2">
							<span className="body-sm text-secondary">SPK Bought</span>
							<span className="title-md text-primary">{data.buybackKpis.spkBought.formatted}</span>
						</div>
						<div className="flex items-center justify-between py-2">
							<span className="body-sm text-secondary">Avg Price</span>
							<span className="title-md text-primary">{data.buybackKpis.avgPrice.formatted}</span>
						</div>
					</div>
				</div>
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>Total Treasury</ChartPanelTitle>}>
						<ChartPngExportButton
							chartInstance={treasury.chartInstance}
							filename="total-treasury"
							title={sparkExportTitle('Total Treasury')}
							smol
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={data.treasuryModel.dataset}
							charts={data.treasuryModel.charts}
							valueSymbol="$"
							containerClassName={CHART_FILL}
							onReady={treasury.handleChartReady}
							showLegend
							exportButtons="hidden"
						/>
					</Suspense>
				</ChartPanel>
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>SPK Buybacks</ChartPanelTitle>}>
						<ChartPngExportButton
							chartInstance={buybacks.chartInstance}
							filename="spk-buybacks"
							title={sparkExportTitle('SPK Buybacks')}
							smol
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={data.buybacksModel.dataset}
							charts={data.buybacksModel.charts}
							valueSymbol=""
							containerClassName={CHART_FILL}
							onReady={buybacks.handleChartReady}
							showLegend
							exportButtons="hidden"
						/>
					</Suspense>
				</ChartPanel>
			</div>
		</div>
	)
}

export default function Financials() {
	const query = useFinancialsData()
	const data = query.data

	// A failed refresh of data already shown keeps it; the error and its Try again replace the tab only before data loads.
	if (queryReadFailed(query))
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn't load Spark financials.
			</PanelStatus>
		)
	if (!data) return <PanelLoadingStatus />

	return (
		<div className="flex flex-col gap-6">
			{/* Section 1: KPIs */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{data.kpis.map((kpi) => (
					<StatTile key={kpi.label} label={kpi.label} value={kpi.formatted} />
				))}
			</div>

			{/* Section 2: Projected Returns Breakdown */}
			<div className="flex flex-col gap-4">
				<SectionHeader>Projected Returns Breakdown</SectionHeader>
				<ChartPanel>
					<ChartPanelToolbar leading={<ChartPanelTitle>{data.projectedBreakdown.title}</ChartPanelTitle>} />
					{/* The donut is a side tile beside its table, so it keeps its own height rather than the 360 body floor. */}
					<div className="grid grid-cols-1 gap-4 px-2 pb-2 md:grid-cols-2">
						<div className="min-h-[300px]">
							<Suspense fallback={<ChartPanelBodyLoading className="min-h-[300px]" />}>
								<PieChart
									chartData={data.projectedBreakdown.series}
									stackColors={data.breakdownColors}
									radius={['40%', '70%']}
									height="300px"
									valueSymbol="$"
								/>
							</Suspense>
						</div>
						<div>
							<table className="w-full">
								<thead>
									<tr className="border-b border-subtle">
										<th className="pb-2 text-left title-sm text-secondary uppercase">Product</th>
										<th className="pb-2 text-right title-sm text-secondary uppercase">Revenue</th>
										<th className="pb-2 text-right title-sm text-secondary uppercase">Share</th>
									</tr>
								</thead>
								<tbody>
									{data.projectedBreakdown.series.map((item) => (
										<tr key={item.name} className="border-b border-subtle last:border-b-0">
											<td className="py-2.5 body-md text-primary">
												<span
													className="mr-2 inline-block size-2 rounded-full"
													style={{ background: data.breakdownColors[item.name] || 'var(--text-tertiary)' }}
												/>
												{item.name}
											</td>
											<td className="py-2.5 text-right title-md text-primary">{item.formatted}</td>
											<td className="py-2.5 text-right body-md text-secondary">
												{formatPercent(item.pct, { input: 'percent' })}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							<div className="mt-3 flex items-center justify-between border-t border-subtle pt-3">
								<span className="body-md text-secondary">Total</span>
								<span className="title-md text-primary">{data.projectedBreakdown.totalFormatted}</span>
							</div>
						</div>
					</div>
				</ChartPanel>
			</div>

			{/* Section 3: Monthly Returns */}
			<MonthlyReturnsSection data={data} />

			{/* Section 4: sUSDS Distribution */}
			<SusdsDistributionSection data={data} />

			{/* Section 5: Allocated Assets */}
			<AllocatedAssetsSection allocatedAssets={data.allocatedAssets} aaHistorical={data.aaHistorical} />

			<TvlSection data={data} />
			<DepositsAndBorrowsSection data={data} />
			<SllTvlSection data={data} />
			<SavingsTvlSection data={data} />
			<TreasurySection data={data} />

			{/* Section 11: Quarterly Reports */}
			{data.quarterlyReports && data.quarterlyReports.length > 0 && (
				<div className="flex flex-col gap-4">
					<SectionHeader>Quarterly Reports</SectionHeader>
					<div className="rounded-lg border border-subtle bg-surface p-4">
						<div className="flex flex-col">
							{data.quarterlyReports.map((report) => (
								<a
									key={report.url}
									href={report.url}
									target="_blank"
									rel="noopener noreferrer"
									className="border-b border-subtle py-3 label-md text-link last:border-b-0 hover:underline"
								>
									{report.label}
								</a>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
