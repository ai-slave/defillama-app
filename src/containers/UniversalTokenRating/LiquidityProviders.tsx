import type { EChartsOption } from 'echarts'
import { PieChart } from 'echarts/charts'
import * as echarts from 'echarts/core'
import { Fragment, useMemo, useState } from 'react'
import { Select } from '~/components/Select/Select'
import { CHART_COLORS, oldBlue } from '~/constants/colors'
import { AccentBadge, SecondaryBadge, StatusBadge } from '~/containers/MarketMakers/badges'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Panel } from '~/ui/Panel'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Switch } from '~/ui/Switch'
import { formatNumber } from '~/utils/numberFormat'
import { getMockSeries, MOCK_MARKET_MAKERS, type MockMarketMaker, type MockSeriesPoint } from './mocks'
import { buildSeriesOption, ChartCaption, ChartLegend, SimpleChart, useChartAxisColor } from './SimpleChart'

echarts.use([PieChart])

const PROVIDER_PAGE_SIZE = 3
const DAY_PAGE_SIZE = 7
const WINDOW_DAYS = 30

const DEPTH_BANDS = ['(+/-) 0.50%', '(+/-) 1.00%', '(+/-) 2.00%'] as const
const SPREAD_SIDES = ['Bid & Ask', 'Bid', 'Ask'] as const

const BAND_FACTORS: Record<(typeof DEPTH_BANDS)[number], number> = {
	'(+/-) 0.50%': 0.45,
	'(+/-) 1.00%': 0.7,
	'(+/-) 2.00%': 1
}

const SIDE_FACTORS: Record<(typeof SPREAD_SIDES)[number], number> = {
	'Bid & Ask': 1,
	Bid: 0.52,
	Ask: 0.48
}

function providerColor(index: number): string {
	return CHART_COLORS[(index + 1) % CHART_COLORS.length]
}

function usd(value: number): string {
	return `$${formatNumber(Math.round(value))}`
}

function fmtDate(time: number): string {
	return new Date(time).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	})
}

function scaleSeries(points: MockSeriesPoint[], factor: number): MockSeriesPoint[] {
	return points.map(([time, value]) => [time, Math.round(value * factor)])
}

function ProviderAvatar({ index }: { index: number }) {
	return (
		<span
			className="flex size-8 items-center justify-center rounded-full text-white"
			style={{ backgroundColor: providerColor(index) }}
		>
			<Icon name="banknote" height={16} width={16} />
		</span>
	)
}

function ProviderHead({
	provider,
	index,
	withEngagement = false
}: {
	provider: MockMarketMaker
	index: number
	withEngagement?: boolean
}) {
	return (
		<div className="flex flex-col items-center gap-1.5">
			<ProviderAvatar index={index} />
			<span className="label-md">{provider.name}</span>
			{withEngagement ? <SecondaryBadge>{provider.engagement}</SecondaryBadge> : null}
		</div>
	)
}

function PaginationArrows({
	canPrev,
	canNext,
	onPrev,
	onNext,
	label
}: {
	canPrev: boolean
	canNext: boolean
	onPrev: () => void
	onNext: () => void
	label: string
}) {
	return (
		<span className="flex items-center gap-1.5">
			<Button type="button" size="sm" square disabled={!canPrev} onClick={onPrev} aria-label={`Previous ${label}`}>
				<Icon name="arrow-left" height={14} width={14} />
			</Button>
			<Button type="button" size="sm" square disabled={!canNext} onClick={onNext} aria-label={`Next ${label}`}>
				<Icon name="arrow-right" height={14} width={14} />
			</Button>
		</span>
	)
}

function ProviderPageFooter({
	page,
	total,
	onPage,
	bordered = true
}: {
	page: number
	total: number
	onPage: (page: number) => void
	bordered?: boolean
}) {
	const start = page * PROVIDER_PAGE_SIZE + 1
	const end = Math.min(total, start + PROVIDER_PAGE_SIZE - 1)
	return (
		<div className={`flex items-center justify-between gap-2 px-4 py-2.5 ${bordered ? 'border-t border-subtle' : ''}`}>
			<span className="body-sm text-secondary">
				{start}–{end} of {total} active market makers
			</span>
			<PaginationArrows
				canPrev={page > 0}
				canNext={end < total}
				onPrev={() => onPage(page - 1)}
				onNext={() => onPage(page + 1)}
				label="market makers"
			/>
		</div>
	)
}

export function LpPerformanceSummary({ providers = MOCK_MARKET_MAKERS }: { providers?: MockMarketMaker[] }) {
	const [page, setPage] = useState(0)
	const visible = providers.slice(page * PROVIDER_PAGE_SIZE, (page + 1) * PROVIDER_PAGE_SIZE)

	const rows: {
		label: string
		help: string
		render: (provider: MockMarketMaker) => string
	}[] = [
		{
			label: 'Avg. spread',
			help: 'Volume-weighted average bid/ask spread quoted by this market maker over the window.',
			render: (provider) => `${provider.avgSpreadPct.toFixed(2)}%`
		},
		{
			label: 'Avg. depth (+/-) 0.50%',
			help: 'Average two-sided depth quoted within 0.50% of mid price.',
			render: (provider) => usd(provider.avgDepth50)
		},
		{
			label: 'Avg. depth (+/-) 1.00%',
			help: 'Average two-sided depth quoted within 1.00% of mid price.',
			render: (provider) => usd(provider.avgDepth100)
		},
		{
			label: 'Avg. depth (+/-) 2.00%',
			help: 'Average two-sided depth quoted within 2.00% of mid price.',
			render: (provider) => usd(provider.avgDepth200)
		}
	]

	return (
		<Panel padding="none">
			<div className="flex items-center gap-2 border-b border-subtle px-4 py-3">
				<h3 className="label-lg">Performance Summary</h3>
				<AccentBadge className="h-6">Prev. 30D</AccentBadge>
			</div>
			<div className="flex-1 overflow-x-auto p-4">
				<table className="w-full border-collapse body-sm">
					<thead>
						<tr>
							<th className="w-[190px] px-2 py-2 text-left align-middle label-sm text-secondary">Provider</th>
							{visible.map((provider, index) => (
								<th key={provider.name} className="px-2 py-2 text-center">
									<ProviderHead provider={provider} index={page * PROVIDER_PAGE_SIZE + index} />
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.label}>
								<td className="px-2 py-1.5 text-secondary">
									<span className="flex items-center gap-1">
										{row.label}
										<QuestionHelper text={row.help} />
									</span>
								</td>
								{visible.map((provider) => (
									<td key={provider.name} className="px-2 py-1.5">
										<span className="flex h-7 w-full items-center justify-center rounded-full bg-surface-elevated-1 px-3 font-jetbrains tabular-nums">
											{row.render(provider)}
										</span>
									</td>
								))}
							</tr>
						))}
						<tr>
							<td className="px-2 py-1.5 text-secondary">Trading Summary</td>
							{visible.map((provider) => (
								<td key={provider.name} className="px-2 py-1.5">
									<Button type="button" size="sm" className="w-full justify-center">
										Details
										<Icon name="arrow-right" height={14} width={14} />
									</Button>
								</td>
							))}
						</tr>
					</tbody>
				</table>
			</div>
			<ProviderPageFooter page={page} total={providers.length} onPage={setPage} />
		</Panel>
	)
}

function buildDonutOption(slices: { name: string; value: number; color: string }[]): EChartsOption {
	return {
		tooltip: {
			trigger: 'item',
			valueFormatter: (value) => (typeof value === 'number' ? usd(value) : String(value ?? ''))
		},
		series: [
			{
				type: 'pie',
				radius: ['58%', '82%'],
				label: { show: false },
				emphasis: { scale: false },
				data: slices.map((slice) => ({
					name: slice.name,
					value: slice.value,
					itemStyle: { color: slice.color }
				}))
			}
		]
	}
}

export function LpPerformanceBreakdown({ providers = MOCK_MARKET_MAKERS }: { providers?: MockMarketMaker[] }) {
	const axisColor = useChartAxisColor()
	const [metric, setMetric] = useState<'Depth' | 'Volume'>('Depth')
	const [side, setSide] = useState<string>('Bid & Ask')
	const [band, setBand] = useState<string>('(+/-) 2.00%')
	const [unit, setUnit] = useState<'$' | '%'>('$')
	const [asTable, setAsTable] = useState(false)

	const factor =
		metric === 'Depth'
			? (BAND_FACTORS[band as keyof typeof BAND_FACTORS] ?? 1) * (SIDE_FACTORS[side as keyof typeof SIDE_FACTORS] ?? 1)
			: 1

	const { providerSeries, othersSeries } = useMemo(() => {
		const bases = metric === 'Depth' ? [72_000, 46_000, 38_000, 29_000] : [360_000, 230_000, 190_000, 145_000]
		const salt = metric === 'Depth' ? 900 : 1300
		return {
			providerSeries: providers.map((provider, index) =>
				scaleSeries(getMockSeries(salt + index * 13, WINDOW_DAYS, bases[index % bases.length], 0.35), factor)
			),
			othersSeries: scaleSeries(
				getMockSeries(salt + 777, WINDOW_DAYS, metric === 'Depth' ? 320_000 : 1_600_000, 0.25),
				factor
			)
		}
	}, [providers, metric, factor])

	const avgOf = (points: MockSeriesPoint[]) => points.reduce((sum, [, value]) => sum + value, 0) / points.length
	const providerAvgs = providerSeries.map(avgOf)
	const mmAvg = providerAvgs.reduce((sum, value) => sum + value, 0)
	const othersAvg = avgOf(othersSeries)
	const totalAvg = mmAvg + othersAvg

	const startLabel = fmtDate(othersSeries[0][0])
	const endLabel = fmtDate(othersSeries[othersSeries.length - 1][0])

	const peakDayIndex = providerSeries[0]
		.map((_, dayIndex) => providerSeries.reduce((sum, series) => sum + series[dayIndex][1], 0))
		.reduce((best, value, index, totals) => (value > totals[best] ? index : best), 0)
	const peakDayLabel = fmtDate(providerSeries[0][peakDayIndex][0])

	const dayTotals = othersSeries.map(
		([, othersValue], dayIndex) => othersValue + providerSeries.reduce((sum, series) => sum + series[dayIndex][1], 0)
	)

	const toUnit = (points: MockSeriesPoint[]): MockSeriesPoint[] =>
		unit === '$'
			? points
			: points.map(([time, value], dayIndex) => [
					time,
					dayTotals[dayIndex] ? Math.round((value / dayTotals[dayIndex]) * 10000) / 100 : 0
				])

	const chartSeries = [
		...providers.map((provider, index) => ({
			name: provider.name,
			type: 'bar' as const,
			stack: 'total',
			color: providerColor(index),
			data: toUnit(providerSeries[index])
		})),
		{
			name: 'All Others',
			type: 'bar' as const,
			stack: 'total',
			color: oldBlue,
			data: toUnit(othersSeries)
		}
	]

	const legendItems = [
		...providers.map((provider, index) => ({
			label: provider.name,
			color: providerColor(index)
		})),
		{ label: 'All Others', color: oldBlue }
	]

	const donutOption = buildDonutOption([
		...providers.map((provider, index) => ({
			name: provider.name,
			value: Math.round(providerAvgs[index]),
			color: providerColor(index)
		})),
		{ name: 'All Others', value: Math.round(othersAvg), color: oldBlue }
	])

	const stats: {
		label: string
		sharePct: number
		valueUsd: number
		ticks: string[]
	}[] = [
		{
			label: 'All Market Makers',
			sharePct: (mmAvg / totalAvg) * 100,
			valueUsd: mmAvg,
			ticks: providers.map((_, index) => providerColor(index))
		},
		{
			label: 'All Others',
			sharePct: (othersAvg / totalAvg) * 100,
			valueUsd: othersAvg,
			ticks: [oldBlue]
		},
		{
			label: 'Total',
			sharePct: 100,
			valueUsd: totalAvg,
			ticks: ['var(--border-medium)']
		}
	]

	return (
		<Panel padding="none">
			<div className="flex flex-wrap items-center gap-2 border-b border-subtle px-4 py-3">
				<h3 className="label-lg">Performance Breakdown</h3>
				<AccentBadge className="h-6">Prev. 30D</AccentBadge>
				<span className="ml-auto flex flex-wrap items-center gap-1.5">
					<SegmentedControl
						label="Breakdown metric"
						variant="solid"
						size="md"
						value={metric}
						onValueChange={(value) => setMetric(value as 'Depth' | 'Volume')}
						options={[
							{ value: 'Depth', label: 'Depth' },
							{ value: 'Volume', label: 'Volume' }
						]}
					/>
					{metric === 'Depth' ? (
						<>
							<Select
								allValues={SPREAD_SIDES.map((value) => ({
									key: value,
									name: value
								}))}
								selectedValues={side}
								setSelectedValues={setSide}
								label={side}
								labelType="none"
								variant="filter"
								size="md"
							/>
							<Select
								allValues={DEPTH_BANDS.map((value) => ({
									key: value,
									name: value
								}))}
								selectedValues={band}
								setSelectedValues={setBand}
								label={band}
								labelType="none"
								variant="filter"
								size="md"
							/>
						</>
					) : null}
				</span>
			</div>
			<div className="grid grid-cols-1 divide-y divide-(--border-subtle) lg:grid-cols-2 lg:divide-x lg:divide-y-0">
				<div className="flex flex-col gap-4 p-4">
					<div className="flex flex-wrap items-center gap-2">
						{metric === 'Depth' ? <SecondaryBadge>{`${side} ${band}`}</SecondaryBadge> : null}
						<SecondaryBadge>{`Average: ${startLabel} to ${endLabel}`}</SecondaryBadge>
					</div>
					<div className="flex flex-wrap items-center gap-4">
						<div className="flex min-w-[180px] flex-col gap-4">
							{stats.map((stat) => (
								<div key={stat.label} className="flex items-start gap-3">
									<span className="flex flex-col gap-0.5 pt-1">
										{stat.ticks.map((color) => (
											<span key={color} className="h-2.5 w-[3px] rounded-full" style={{ backgroundColor: color }} />
										))}
									</span>
									<div className="flex flex-col">
										<span className="body-sm text-secondary">{stat.label}</span>
										{stat.label === 'Total' ? null : (
											<span className="label-sm text-link">{stat.sharePct.toFixed(2)}%</span>
										)}
										<span className="font-jetbrains heading-xs tabular-nums">{usd(stat.valueUsd)}</span>
									</div>
								</div>
							))}
						</div>
						<SimpleChart option={donutOption} className="h-[260px] min-w-[220px] flex-1" />
					</div>
					<div className="flex gap-3 rounded-lg bg-surface-elevated-1 p-4">
						<Icon name="sparkles" height={18} width={18} className="mt-0.5 shrink-0 text-secondary" />
						<div className="flex flex-col gap-1">
							<p className="label-md">{metric} Insight</p>
							<p className="body-sm text-secondary">
								From {startLabel} to {endLabel}, the day with the highest combined {metric.toLowerCase()} from All
								Market Makers was {peakDayLabel}.
							</p>
						</div>
					</div>
				</div>
				<div className="flex flex-col gap-3 p-4">
					<div className="flex flex-wrap items-center gap-2">
						<h4 className="label-md">Daily Breakdown</h4>
						<span className="ml-auto flex items-center gap-3">
							<SegmentedControl
								label="Daily breakdown unit"
								variant="solid"
								size="sm"
								value={unit}
								onValueChange={(value) => setUnit(value as '$' | '%')}
								options={[
									{ value: '$', label: '$' },
									{ value: '%', label: '%' }
								]}
							/>
							<Switch
								label="Show as Table"
								value="lp-daily-table"
								checked={asTable}
								onChange={(event) => setAsTable(event.target.checked)}
							/>
						</span>
					</div>
					{asTable ? (
						<div className="max-h-[300px] flex-1 overflow-auto rounded-lg border border-subtle">
							<table className="w-full border-collapse body-sm">
								<thead>
									<tr className="sticky top-0 bg-surface">
										<th className="px-3 py-2 text-left label-sm text-secondary">Date</th>
										{legendItems.map((item) => (
											<th key={item.label} className="px-3 py-2 text-right label-sm text-secondary">
												{item.label}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{othersSeries.map(([time], dayIndex) => (
										<tr key={time} className="border-t border-subtle">
											<td className="px-3 py-1.5 text-secondary">{fmtDate(time)}</td>
											{[...providerSeries, othersSeries].map((series, seriesIndex) => (
												<td key={seriesIndex} className="px-3 py-1.5 text-right font-jetbrains tabular-nums">
													{unit === '$'
														? usd(toUnit(series)[dayIndex][1])
														: `${toUnit(series)[dayIndex][1].toFixed(2)}%`}
												</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<>
							<ChartCaption>
								{metric} ({unit === '$' ? 'USD' : '%'}) | Date
							</ChartCaption>
							<SimpleChart
								option={buildSeriesOption(chartSeries, axisColor, unit === '$' ? 'usd' : 'pct')}
								className="h-[280px] min-h-0 w-full flex-1"
							/>
						</>
					)}
					<ChartLegend items={legendItems} />
				</div>
			</div>
		</Panel>
	)
}

export function LpUptimeCalculations({ providers = MOCK_MARKET_MAKERS }: { providers?: MockMarketMaker[] }) {
	const [view, setView] = useState<'comparison' | 'breakdown'>('comparison')
	const [page, setPage] = useState(0)
	const [kpi, setKpi] = useState<string>('KPI: Depth (+/-) 2.00%')
	const [dayPage, setDayPage] = useState(0)

	const visible = providers.slice(page * PROVIDER_PAGE_SIZE, (page + 1) * PROVIDER_PAGE_SIZE)
	const globalIndex = (index: number) => page * PROVIDER_PAGE_SIZE + index

	const kpiTarget = 50_000
	const kpiSeries = useMemo(
		() =>
			providers.map((_, index) =>
				getMockSeries(2100 + index * 17 + (kpi.includes('Volume') ? 500 : 0), WINDOW_DAYS, kpiTarget, 0.35)
			),
		[providers, kpi]
	)
	const daysDescending = useMemo(
		() => kpiSeries[0].map((_, dayIndex) => WINDOW_DAYS - 1 - dayIndex).slice(0, WINDOW_DAYS),
		[kpiSeries]
	)
	const visibleDays = daysDescending.slice(dayPage * DAY_PAGE_SIZE, (dayPage + 1) * DAY_PAGE_SIZE)
	const dayStart = dayPage * DAY_PAGE_SIZE + 1
	const dayEnd = Math.min(WINDOW_DAYS, dayStart + DAY_PAGE_SIZE - 1)

	const achievedOn = (providerIndex: number, dayIndex: number) => kpiSeries[providerIndex][dayIndex][1] >= kpiTarget
	const achievedCount = (providerIndex: number) =>
		kpiSeries[providerIndex].reduce((count, [, value]) => count + (value >= kpiTarget ? 1 : 0), 0)

	const rubricRows: {
		label: string
		render: (provider: MockMarketMaker) => string
	}[] = [
		{
			label: 'Avg. bid ask spread',
			render: (provider) => `${provider.avgSpreadPct.toFixed(2)}%`
		},
		{ label: 'Avg. depth (+/-) 0.50%', render: () => '9.00%' },
		{ label: 'Avg. depth (+/-) 1.00%', render: () => '9.00%' },
		{ label: 'Avg. depth (+/-) 2.00%', render: () => '9.00%' }
	]

	return (
		<Panel padding="none">
			<div className="flex flex-wrap items-center gap-2 border-b border-subtle px-4 py-3">
				<h3 className="label-lg">Uptime Calculations</h3>
				<AccentBadge className="h-6">Prev. 30D</AccentBadge>
				<span className="ml-auto">
					<SegmentedControl
						label="Uptime view"
						variant="solid"
						size="md"
						value={view}
						onValueChange={(value) => setView(value as 'comparison' | 'breakdown')}
						options={[
							{ value: 'comparison', label: 'Uptime Comparison' },
							{ value: 'breakdown', label: 'Uptime Breakdown' }
						]}
					/>
				</span>
			</div>
			<div className="overflow-x-auto">
				{view === 'comparison' ? (
					<table className="w-full border-collapse body-sm">
						<thead>
							<tr>
								<th className="w-[220px] border-b border-subtle px-4 py-4 text-left align-top label-sm text-secondary">
									Rubric
								</th>
								{visible.map((provider, index) => (
									<th key={provider.name} className="border-b border-l border-subtle px-4 py-4 text-center">
										<ProviderHead provider={provider} index={globalIndex(index)} withEngagement />
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rubricRows.map((row) => (
								<tr key={row.label}>
									<td className="px-4 py-2.5 text-secondary">{row.label}</td>
									{visible.map((provider) => (
										<td
											key={provider.name}
											className="border-l border-subtle px-4 py-2.5 text-center font-jetbrains tabular-nums"
										>
											{row.render(provider)}
										</td>
									))}
								</tr>
							))}
							<tr className="border-t border-subtle">
								<td className="px-4 py-2.5 text-secondary">Combined uptime %</td>
								{visible.map((provider) => (
									<td
										key={provider.name}
										className="border-l border-subtle px-4 py-2.5 text-center font-jetbrains tabular-nums"
									>
										{provider.combinedUptimePct.toFixed(2)}%
									</td>
								))}
							</tr>
							<tr>
								<td className="px-4 py-2.5 text-secondary">Uptime obligation %</td>
								{visible.map((provider) => (
									<td
										key={provider.name}
										className="border-l border-subtle px-4 py-2.5 text-center font-jetbrains tabular-nums"
									>
										{provider.uptimeObligationPct.toFixed(2)}%
									</td>
								))}
							</tr>
							<tr>
								<td className="px-4 py-2.5 text-secondary">Uptime status</td>
								{visible.map((provider) => (
									<td key={provider.name} className="border-l border-subtle px-4 py-2.5 text-center">
										<StatusBadge
											status={provider.uptimeStatus === 'Achieved' ? 'full' : 'none'}
											label={provider.uptimeStatus}
											className="px-2.5 py-0.5"
										/>
									</td>
								))}
							</tr>
						</tbody>
					</table>
				) : (
					<table className="w-full border-collapse body-sm">
						<thead>
							<tr>
								<th className="w-[240px] border-b border-subtle px-4 py-4 text-left align-top">
									<div className="flex flex-col items-start gap-2">
										<span className="label-sm text-secondary">Key Performance Indicator</span>
										<Select
											allValues={['KPI: Depth (+/-) 2.00%', 'KPI: Volume'].map((value) => ({
												key: value,
												name: value
											}))}
											selectedValues={kpi}
											setSelectedValues={setKpi}
											label={kpi}
											labelType="none"
											variant="filter"
											size="md"
										/>
										<SecondaryBadge>{`${fmtDate(kpiSeries[0][0][0])} to ${fmtDate(
											kpiSeries[0][WINDOW_DAYS - 1][0]
										)}`}</SecondaryBadge>
									</div>
								</th>
								{visible.map((provider, index) => (
									<th key={provider.name} className="border-b border-l border-subtle px-4 py-4 align-top" colSpan={2}>
										<ProviderHead provider={provider} index={globalIndex(index)} withEngagement />
									</th>
								))}
							</tr>
							<tr>
								<th className="px-4 py-2 text-left label-sm text-secondary"> </th>
								{visible.map((provider) => (
									<Fragment key={provider.name}>
										<th className="border-l border-subtle px-4 py-2 text-center label-sm text-secondary">KPI status</th>
										<th className="px-4 py-2 text-center label-sm text-secondary">Actual KPI Vs Target KPI</th>
									</Fragment>
								))}
							</tr>
						</thead>
						<tbody>
							{visibleDays.map((dayIndex) => (
								<tr key={dayIndex} className="border-t border-subtle">
									<td className="px-4 py-2 text-secondary">{fmtDate(kpiSeries[0][dayIndex][0])}</td>
									{visible.map((provider, index) => {
										const achieved = achievedOn(globalIndex(index), dayIndex)
										const actual = kpiSeries[globalIndex(index)][dayIndex][1]
										return (
											<Fragment key={provider.name}>
												<td className="border-l border-subtle px-4 py-2 text-center">
													<StatusBadge
														status={achieved ? 'full' : 'none'}
														label={achieved ? 'Achieved' : 'Lagging'}
														className="px-2.5 py-0.5"
													/>
												</td>
												<td
													className={`px-4 py-2 text-center font-jetbrains tabular-nums ${
														achieved ? 'text-success' : 'text-error'
													}`}
												>
													{usd(actual)} Vs {usd(kpiTarget)}
												</td>
											</Fragment>
										)
									})}
								</tr>
							))}
							<tr className="border-t border-subtle">
								<td className="px-4 py-2.5 label-sm text-secondary">Achievement</td>
								{visible.map((provider, index) => {
									const count = achievedCount(globalIndex(index))
									return (
										<Fragment key={provider.name}>
											<td className="border-l border-subtle px-4 py-2.5 text-center">
												<span className="inline-flex rounded-full bg-surface-elevated-1 px-2.5 py-0.5 font-jetbrains label-sm tabular-nums">
													{((count / WINDOW_DAYS) * 100).toFixed(2)}%
												</span>
											</td>
											<td className="px-4 py-2.5 text-center font-jetbrains tabular-nums">
												{count} out of {WINDOW_DAYS} days met
											</td>
										</Fragment>
									)
								})}
							</tr>
						</tbody>
					</table>
				)}
			</div>
			<div className="flex flex-wrap items-center justify-between gap-2 border-t border-subtle px-4 py-2.5">
				{view === 'breakdown' ? (
					<span className="flex items-center gap-2">
						<PaginationArrows
							canPrev={dayPage > 0}
							canNext={dayEnd < WINDOW_DAYS}
							onPrev={() => setDayPage(dayPage - 1)}
							onNext={() => setDayPage(dayPage + 1)}
							label="days"
						/>
						<span className="body-sm text-secondary">
							Showing days {dayStart} to {dayEnd} of {WINDOW_DAYS}-day period
						</span>
					</span>
				) : (
					<span className="body-sm text-secondary">
						{page * PROVIDER_PAGE_SIZE + 1}–{Math.min(providers.length, (page + 1) * PROVIDER_PAGE_SIZE)} of{' '}
						{providers.length} active market makers
					</span>
				)}
				{view === 'breakdown' ? (
					<span className="flex items-center gap-2">
						<span className="body-sm text-secondary">
							{page * PROVIDER_PAGE_SIZE + 1}–{Math.min(providers.length, (page + 1) * PROVIDER_PAGE_SIZE)} of{' '}
							{providers.length} active market makers
						</span>
						<PaginationArrows
							canPrev={page > 0}
							canNext={(page + 1) * PROVIDER_PAGE_SIZE < providers.length}
							onPrev={() => setPage(page - 1)}
							onNext={() => setPage(page + 1)}
							label="market makers"
						/>
					</span>
				) : (
					<PaginationArrows
						canPrev={page > 0}
						canNext={(page + 1) * PROVIDER_PAGE_SIZE < providers.length}
						onPrev={() => setPage(page - 1)}
						onNext={() => setPage(page + 1)}
						label="market makers"
					/>
				)}
			</div>
		</Panel>
	)
}

export function LpPerformanceInsights({
	mmDepthPct,
	mmVolumePct,
	avgSpreadPct
}: {
	mmDepthPct: number | null
	mmVolumePct: number | null
	avgSpreadPct: number | null
}) {
	const fmt = (value: number | null) => (value == null ? 'N/A' : `${value.toFixed(2)}%`)
	return (
		<Panel padding="none">
			<div className="border-b border-subtle px-4 py-3">
				<h3 className="label-lg">Performance Insights</h3>
			</div>
			<p className="p-4 text-xl leading-relaxed">
				Within all spot exchanges, all market makers represent <span className="text-link">{fmt(mmDepthPct)}</span> of
				two-sided liquidity, <span className="text-link">{fmt(mmVolumePct)}</span> of total volume, and have maintained
				average spreads of <span className="text-link">{fmt(avgSpreadPct)}</span> in the past 30 days.
			</p>
		</Panel>
	)
}
