import { useMemo, useState } from 'react'
import MultiSeriesChart from '~/components/ECharts/MultiSeriesChart'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { Select } from '~/components/Select/Select'
import { chartColor, OTHERS_COLOR } from '~/constants/colors'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { TabPanel, Tabs } from '~/ui/Tabs'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber, formatPercent } from '~/utils/numberFormat'
import { UTR_PERCENT_OPTIONS, UTR_TIME_DATASET } from './constants'
import { LpPerformanceInsights } from './LiquidityProviders'
import { GradeFooterColumns } from './TokenPage'
import type {
	UtrCriterionBreakdown,
	UtrGradeScaleEntry,
	UtrMarketMakerBreakdownMetric,
	UtrMarketMakerPerformanceBreakdown,
	UtrMarketMakerProvider,
	UtrMarketMakerUptime,
	UtrSnapshotMetrics
} from './types'
import { marketMakerCriterionRawPercent } from './units'

const CRITERIA = [
	{ key: 'mm_volume_pct', label: 'Market Maker Volume (as a % of total volume)' },
	{ key: 'mm_depth_pct', label: 'Market Maker Depth (as a % of total depth)' },
	{ key: 'mm_uptime_sla', label: 'Market Maker Uptime / KPI Adherence' }
] as const

function usd(value: number | null | undefined): string {
	return value == null ? 'N/A' : `$${formatNumber(Math.round(value))}`
}

function normalizedEngagementType(value: string | null | undefined): string {
	if (!value) return 'Engagement not disclosed'
	return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function CriterionCards({
	criteria,
	gradingScale,
	onOpen
}: {
	criteria: Array<UtrCriterionBreakdown>
	gradingScale?: Array<UtrGradeScaleEntry> | null
	onOpen: (criterion: UtrCriterionBreakdown) => void
}) {
	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
			{CRITERIA.map((definition) => {
				const criterion = criteria.find((entry) => entry.key === definition.key) ?? null
				return (
					<Panel key={definition.key} padding="none">
						<div className="flex min-h-20 items-start justify-between gap-2 px-4 py-3">
							<div className="flex flex-col gap-1">
								<h3 className="body-sm text-secondary">{definition.label}</h3>
								<span className="label-lg">
									{formatPercent(marketMakerCriterionRawPercent(criterion?.raw ?? null), UTR_PERCENT_OPTIONS) ?? 'N/A'}
								</span>
							</div>
							<Tooltip
								content={`Open ${definition.label} details`}
								render={
									<Button
										type="button"
										size="sm"
										square
										disabled={!criterion}
										aria-label={`Open ${definition.label} details`}
										onClick={() => criterion && onOpen(criterion)}
									/>
								}
							>
								<Icon name="arrow-right" height={16} width={16} />
							</Tooltip>
						</div>
						<GradeFooterColumns
							score={criterion?.score ?? null}
							grade={criterion?.grade}
							gradingScale={gradingScale}
							percentile={criterion?.percentile}
						/>
					</Panel>
				)
			})}
		</div>
	)
}

function EmptyState() {
	return (
		<Panel padding="none" className="min-h-32">
			<div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-tertiary">
				<Icon name="eye-off" height={22} width={22} />
				<p className="body-sm">Data not disclosed</p>
			</div>
		</Panel>
	)
}

function PerformanceSummary({ providers }: { providers: Array<UtrMarketMakerProvider> }) {
	return (
		<Panel padding="none">
			<PanelHeader>
				<PanelTitle as="h3">Performance Summary</PanelTitle>
				<span className="rounded-full border border-medium bg-brand-muted px-2 py-0.5 body-xs text-link">
					Prev. 30D
				</span>
			</PanelHeader>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[760px] body-sm">
					<thead>
						<tr className="border-b border-subtle text-left label-sm text-secondary">
							<th className="px-4 py-2.5">Provider</th>
							<th className="px-3 py-2.5">Engagement</th>
							<th className="px-3 py-2.5 text-right">Avg. spread</th>
							<th className="px-3 py-2.5 text-right">Depth ±0.50%</th>
							<th className="px-3 py-2.5 text-right">Depth ±1.00%</th>
							<th className="px-3 py-2.5 text-right">Depth ±2.00%</th>
							<th className="px-4 py-2.5 text-right">Avg. volume</th>
						</tr>
					</thead>
					<tbody>
						{providers.map((provider) => (
							<tr
								key={`${provider.name}-${provider.engagementType ?? ''}`}
								className="border-b border-subtle last:border-b-0"
							>
								<td className="px-4 py-2.5 label-md">{provider.name}</td>
								<td className="px-3 py-2.5 text-secondary">{normalizedEngagementType(provider.engagementType)}</td>
								<td className="px-3 py-2.5 text-right tabular-nums">
									{formatPercent(provider.avgSpread, UTR_PERCENT_OPTIONS) ?? 'N/A'}
								</td>
								<td className="px-3 py-2.5 text-right tabular-nums">{usd(provider.avgBidAskDepth50)}</td>
								<td className="px-3 py-2.5 text-right tabular-nums">{usd(provider.avgBidAskDepth100)}</td>
								<td className="px-3 py-2.5 text-right tabular-nums">{usd(provider.avgBidAskDepth200)}</td>
								<td className="px-4 py-2.5 text-right tabular-nums">{usd(provider.avgFillVolumeTotal)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="border-t border-subtle px-4 py-2 body-sm text-secondary">
				{providers.length} active market maker{providers.length === 1 ? '' : 's'}
			</div>
		</Panel>
	)
}

type BreakdownMode = 'depth' | 'volume'
type DepthSide = 'bidAsk' | 'bid' | 'ask'
type DepthBand = 'depth50' | 'depth100' | 'depth200'
type VolumeSide = 'total' | 'maker' | 'taker'
type ValueUnit = 'usd' | 'percent'

function selectBreakdownMetric(
	breakdown: UtrMarketMakerPerformanceBreakdown | null | undefined,
	mode: BreakdownMode,
	depthSide: DepthSide,
	depthBand: DepthBand,
	volumeSide: VolumeSide
): UtrMarketMakerBreakdownMetric | null {
	if (mode === 'depth') return breakdown?.depth?.[depthSide]?.[depthBand] ?? null
	return breakdown?.volume?.[volumeSide] ?? null
}

const PERCENT_TIME_OPTIONS = createTimeSeriesChartOptions('%')

function breakdownSeries(metric: UtrMarketMakerBreakdownMetric, unit: ValueUnit): Array<MultiSeriesChartSeriesConfig> {
	const providerSeries = metric.series.map((entry, index): MultiSeriesChartSeriesConfig => ({
		type: 'bar',
		name: entry.name,
		encode: { x: 0, y: 1 },
		stack: 'providers',
		color: chartColor(index),
		data: entry.dailyBreakdown.map((point): [number, number] => [
			Date.parse(point.date),
			unit === 'percent' ? (point.percentage ?? 0) : (point.value ?? 0)
		])
	}))
	return [
		...providerSeries,
		{
			type: 'bar',
			name: 'All Others',
			encode: { x: 0, y: 1 },
			stack: 'providers',
			color: OTHERS_COLOR,
			data: metric.dailyBreakdown.map((point): [number, number] => [
				Date.parse(point.date),
				unit === 'percent' ? (point.allOthersPercentage ?? 0) : (point.allOthers ?? 0)
			])
		}
	]
}

function PerformanceBreakdown({ breakdown }: { breakdown: UtrMarketMakerPerformanceBreakdown }) {
	const [mode, setMode] = useState<BreakdownMode>('depth')
	const [depthSide, setDepthSide] = useState<DepthSide>('bidAsk')
	const [depthBand, setDepthBand] = useState<DepthBand>('depth200')
	const [volumeSide, setVolumeSide] = useState<VolumeSide>('total')
	const [unit, setUnit] = useState<ValueUnit>('usd')
	const [display, setDisplay] = useState<'chart' | 'table'>('chart')
	const metric = selectBreakdownMetric(breakdown, mode, depthSide, depthBand, volumeSide)
	const series = useMemo(() => (metric ? breakdownSeries(metric, unit) : []), [metric, unit])
	const providerShare = metric?.avgBreakdown.marketMakersPercentage ?? null

	return (
		<Panel padding="none">
			<PanelHeader>
				<PanelTitle as="h3">Performance Breakdown</PanelTitle>
				<SegmentedControl
					label="Breakdown metric"
					variant="default"
					size="md"
					value={mode}
					onValueChange={(value) => setMode(value as BreakdownMode)}
					options={[
						{ value: 'depth', label: 'Depth' },
						{ value: 'volume', label: 'Volume' }
					]}
				/>
				{mode === 'depth' ? (
					<>
						<SegmentedControl
							label="Order book side"
							variant="default"
							size="md"
							value={depthSide}
							onValueChange={(value) => setDepthSide(value as DepthSide)}
							options={[
								{ value: 'bidAsk', label: 'Bid & Ask' },
								{ value: 'bid', label: 'Bid' },
								{ value: 'ask', label: 'Ask' }
							]}
						/>
						<SegmentedControl
							label="Depth band"
							variant="default"
							size="md"
							value={depthBand}
							onValueChange={(value) => setDepthBand(value as DepthBand)}
							options={[
								{ value: 'depth50', label: '±0.50%' },
								{ value: 'depth100', label: '±1.00%' },
								{ value: 'depth200', label: '±2.00%' }
							]}
						/>
					</>
				) : (
					<SegmentedControl
						label="Volume side"
						variant="default"
						size="md"
						value={volumeSide}
						onValueChange={(value) => setVolumeSide(value as VolumeSide)}
						options={[
							{ value: 'total', label: 'Total' },
							{ value: 'maker', label: 'Maker' },
							{ value: 'taker', label: 'Taker' }
						]}
					/>
				)}
			</PanelHeader>
			{metric ? (
				<div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
					<div className="flex flex-col gap-5 border-b border-subtle p-4 lg:border-r lg:border-b-0">
						<div className="flex items-center justify-between gap-4">
							<div className="flex flex-col gap-1">
								<span className="body-sm text-secondary">All Market Makers</span>
								<strong className="heading-sm">{formatPercent(providerShare, UTR_PERCENT_OPTIONS) ?? 'N/A'}</strong>
								<span className="mono-md">{usd(metric.avgBreakdown.marketMakers)}</span>
							</div>
							<div
								className="size-28 shrink-0 rounded-full"
								aria-label={`Market makers account for ${formatPercent(providerShare, UTR_PERCENT_OPTIONS) ?? 'N/A'}`}
								style={{
									background: `radial-gradient(circle at center, var(--bg-surface) 0 44%, transparent 45%), conic-gradient(var(--bg-brand) 0 ${Math.max(0, Math.min(100, providerShare ?? 0))}%, var(--bg-surface-elevated-2) 0)`
								}}
							/>
						</div>
						<div className="flex flex-col gap-1 border-t border-subtle pt-3">
							<span className="body-sm text-secondary">All Others</span>
							<strong className="label-lg">
								{formatPercent(metric.avgBreakdown.allOthersPercentage, UTR_PERCENT_OPTIONS) ?? 'N/A'}
							</strong>
							<span className="mono-sm">{usd(metric.avgBreakdown.allOthers)}</span>
						</div>
						<div className="rounded-lg bg-surface-elevated-1 p-3 body-sm text-secondary">
							Market makers supplied the highest tracked share during this 30-day window on the peak day shown in the
							daily breakdown.
						</div>
					</div>
					<div className="flex min-w-0 flex-col gap-3 p-4">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h4 className="label-md">Daily Breakdown</h4>
							<div className="flex flex-wrap gap-2">
								<SegmentedControl
									label="Breakdown unit"
									variant="solid"
									size="md"
									value={unit}
									onValueChange={(value) => setUnit(value as ValueUnit)}
									options={[
										{ value: 'usd', label: '$' },
										{ value: 'percent', label: '%' }
									]}
								/>
								<SegmentedControl
									label="Breakdown display"
									variant="default"
									size="md"
									value={display}
									onValueChange={(value) => setDisplay(value as 'chart' | 'table')}
									options={[
										{ value: 'chart', label: 'Chart' },
										{ value: 'table', label: 'Table' }
									]}
								/>
							</div>
						</div>
						{display === 'chart' ? (
							<MultiSeriesChart
								dataset={UTR_TIME_DATASET}
								charts={series}
								valueSymbol={unit === 'percent' ? '%' : '$'}
								chartOptions={unit === 'percent' ? PERCENT_TIME_OPTIONS : undefined}
								height="320px"
								hideDefaultLegend={false}
								hideDataZoom
								exportButtons="hidden"
							/>
						) : (
							<div className="max-h-[320px] overflow-auto rounded-lg border border-subtle">
								<table className="w-full body-sm">
									<thead className="sticky top-0 bg-surface">
										<tr className="border-b border-subtle text-left label-sm text-secondary">
											<th className="px-3 py-2">Date</th>
											<th className="px-3 py-2 text-right">Market Makers</th>
											<th className="px-3 py-2 text-right">All Others</th>
										</tr>
									</thead>
									<tbody>
										{metric.dailyBreakdown.map((point) => (
											<tr key={point.date} className="border-b border-subtle last:border-b-0">
												<td className="px-3 py-2">{point.date.slice(0, 10)}</td>
												<td className="px-3 py-2 text-right tabular-nums">
													{unit === 'percent'
														? (formatPercent(point.marketMakersPercentage, UTR_PERCENT_OPTIONS) ?? 'N/A')
														: usd(point.marketMakers)}
												</td>
												<td className="px-3 py-2 text-right tabular-nums">
													{unit === 'percent'
														? (formatPercent(point.allOthersPercentage, UTR_PERCENT_OPTIONS) ?? 'N/A')
														: usd(point.allOthers)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</div>
			) : (
				<div className="flex min-h-60 items-center justify-center body-sm text-tertiary">
					No breakdown data available
				</div>
			)}
		</Panel>
	)
}

const UPTIME_VIEWS = ['comparison', 'breakdown'] as const
type UptimeView = (typeof UPTIME_VIEWS)[number]
const UPTIME_VIEW_OPTIONS: ReadonlyArray<{ value: UptimeView; label: string }> = [
	{ value: 'comparison', label: 'Uptime Comparison' },
	{ value: 'breakdown', label: 'Uptime Breakdown' }
]

function UptimeCalculations({ rows }: { rows: Array<UtrMarketMakerUptime> }) {
	const [mode, setMode] = useState<UptimeView>('comparison')
	const [providerName, setProviderName] = useState(rows[0]?.name ?? '')
	const provider = rows.find((entry) => entry.name === providerName) ?? rows[0] ?? null
	return (
		<Panel padding="none">
			<Tabs<UptimeView> value={mode} values={UPTIME_VIEWS} onValueChange={setMode}>
				<PanelHeader>
					<PanelTitle as="h3">Uptime Calculations</PanelTitle>
					<span className="rounded-full border border-medium bg-brand-muted px-2 py-0.5 body-xs text-link">
						Prev. 30D
					</span>
					<SegmentedControl
						semantics="tabs"
						label="Uptime view"
						variant="default"
						size="md"
						options={UPTIME_VIEW_OPTIONS}
					/>
				</PanelHeader>
				<TabPanel value={mode}>
					{mode === 'comparison' ? (
						<div className="overflow-x-auto">
							<table className="w-full min-w-[760px] body-sm">
								<thead>
									<tr className="border-b border-subtle text-left label-sm text-secondary">
										<th className="px-4 py-2.5">Market Maker</th>
										<th className="px-3 py-2.5 text-right">Avg. spread</th>
										<th className="px-3 py-2.5 text-right">Depth ±0.50%</th>
										<th className="px-3 py-2.5 text-right">Depth ±1.00%</th>
										<th className="px-3 py-2.5 text-right">Depth ±2.00%</th>
										<th className="px-3 py-2.5 text-right">Combined uptime</th>
										<th className="px-4 py-2.5 text-right">Status</th>
									</tr>
								</thead>
								<tbody>
									{rows.map((entry) => {
										const achieved = (entry.performance?.avgUptime ?? 0) >= (entry.uptimeObligation ?? 0)
										return (
											<tr key={entry.name} className="border-b border-subtle last:border-b-0">
												<td className="px-4 py-2.5">
													<span className="flex flex-col gap-0.5">
														<strong className="label-md">{entry.name}</strong>
														<span className="body-xs text-tertiary">
															{normalizedEngagementType(entry.engagementType)}
														</span>
													</span>
												</td>
												<td className="px-3 py-2.5 text-right tabular-nums">
													{formatPercent(entry.performance?.avgBidAskSpread, UTR_PERCENT_OPTIONS) ?? 'N/A'}
												</td>
												<td className="px-3 py-2.5 text-right tabular-nums">
													{formatPercent(entry.performance?.avgDepth50, UTR_PERCENT_OPTIONS) ?? 'N/A'}
												</td>
												<td className="px-3 py-2.5 text-right tabular-nums">
													{formatPercent(entry.performance?.avgDepth100, UTR_PERCENT_OPTIONS) ?? 'N/A'}
												</td>
												<td className="px-3 py-2.5 text-right tabular-nums">
													{formatPercent(entry.performance?.avgDepth200, UTR_PERCENT_OPTIONS) ?? 'N/A'}
												</td>
												<td className="px-3 py-2.5 text-right tabular-nums">
													{formatPercent(entry.performance?.avgUptime, UTR_PERCENT_OPTIONS) ?? 'N/A'}
												</td>
												<td className="px-4 py-2.5 text-right">
													<span
														className={`rounded-full px-2 py-1 body-xs ${
															achieved ? 'bg-success-tint-strong text-success' : 'bg-error-tint-strong text-error'
														}`}
													>
														{achieved ? 'Achieved' : 'Lagging'}
													</span>
												</td>
											</tr>
										)
									})}
								</tbody>
							</table>
						</div>
					) : (
						<div className="flex flex-col gap-3 p-4">
							<Select
								label="Provider"
								allValues={rows.map((entry) => entry.name)}
								selectedValues={provider?.name ?? ''}
								setSelectedValues={setProviderName}
								variant="filter"
								size="md"
								className="self-start"
							/>
							<div className="max-h-[360px] overflow-auto rounded-lg border border-subtle">
								<table className="w-full min-w-[620px] body-sm">
									<thead className="sticky top-0 bg-surface">
										<tr className="border-b border-subtle text-left label-sm text-secondary">
											<th className="px-3 py-2">Date</th>
											<th className="px-3 py-2 text-right">Uptime</th>
											<th className="px-3 py-2 text-right">Spread target</th>
											<th className="px-3 py-2 text-right">Spread reported</th>
											<th className="px-3 py-2 text-right">Spread status</th>
										</tr>
									</thead>
									<tbody>
										{(provider?.breakdown ?? []).map((entry) => (
											<tr key={entry.date} className="border-b border-subtle last:border-b-0">
												<td className="px-3 py-2">{entry.date.slice(0, 10)}</td>
												<td className="px-3 py-2 text-right tabular-nums">
													{formatPercent(entry.uptimeRatio, UTR_PERCENT_OPTIONS) ?? 'N/A'}
												</td>
												<td className="px-3 py-2 text-right tabular-nums">
													{formatPercent(entry.targetSpread, UTR_PERCENT_OPTIONS) ?? 'N/A'}
												</td>
												<td className="px-3 py-2 text-right tabular-nums">
													{formatPercent(entry.reportedSpread, UTR_PERCENT_OPTIONS) ?? 'N/A'}
												</td>
												<td className="px-3 py-2 text-right">
													{entry.achievedSpread == null ? 'N/A' : entry.achievedSpread ? 'Achieved' : 'Lagging'}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</TabPanel>
			</Tabs>
		</Panel>
	)
}

export function MarketMakerPerformance({
	metrics,
	providers,
	breakdown,
	uptimeCalculations,
	criteria,
	gradingScale,
	onOpenCriterion
}: {
	metrics: UtrSnapshotMetrics | null
	providers: Array<UtrMarketMakerProvider>
	breakdown: UtrMarketMakerPerformanceBreakdown | null
	uptimeCalculations: Array<UtrMarketMakerUptime>
	criteria: Array<UtrCriterionBreakdown>
	gradingScale?: Array<UtrGradeScaleEntry> | null
	onOpenCriterion: (criterion: UtrCriterionBreakdown) => void
}) {
	const providerSpreads = providers.flatMap((provider) => (provider.avgSpread == null ? [] : [provider.avgSpread]))
	const avgProviderSpread =
		providerSpreads.length > 0
			? providerSpreads.reduce((total, value) => total + value, 0) / providerSpreads.length
			: metrics?.vwasBps == null
				? null
				: metrics.vwasBps / 100
	const hasData = Boolean(
		providers.length > 0 ||
		breakdown ||
		uptimeCalculations.length > 0 ||
		metrics?.mmDepthPct != null ||
		metrics?.mmVolumePct != null ||
		metrics?.mmUptimePct != null ||
		criteria.some((criterion) => criterion.raw != null)
	)
	return (
		<section className="flex flex-col gap-4" aria-labelledby="liquidity-providers-heading">
			<h2 id="liquidity-providers-heading" className="heading-sm">
				Performance Overview: Liquidity Providers
			</h2>
			{hasData ? (
				<>
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						<LpPerformanceInsights
							mmDepthPct={metrics?.mmDepthPct ?? null}
							mmVolumePct={metrics?.mmVolumePct ?? null}
							avgSpreadPct={avgProviderSpread}
						/>
						{providers.length > 0 ? <PerformanceSummary providers={providers} /> : <EmptyState />}
					</div>
					{breakdown ? <PerformanceBreakdown breakdown={breakdown} /> : null}
					{uptimeCalculations.length > 0 ? <UptimeCalculations rows={uptimeCalculations} /> : null}
				</>
			) : (
				<EmptyState />
			)}
			<CriterionCards criteria={criteria} gradingScale={gradingScale} onOpen={onOpenCriterion} />
		</section>
	)
}
