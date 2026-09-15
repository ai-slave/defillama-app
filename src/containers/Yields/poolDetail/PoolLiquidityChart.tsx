import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import { lazy, Suspense, useMemo, useRef } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type {
	IMultiSeriesChartProps,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { formatTooltipChartDate } from '~/components/ECharts/shared/formatters'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useDebouncedCallback } from '~/hooks/useDebounce'
import { ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar, CHART_FILL } from '~/ui/ChartPanel'
import { inputStyles } from '~/ui/Input'
import { metricSeriesToggleStyles } from '~/ui/MetricChip'
import { PanelHeader, PanelTitle } from '~/ui/Panel'
import { LoadingIndicator } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber, formatPercent, formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { VerifiedExitStatus } from '../data/types'
import { answerExitCapacity, answerQueueFlow, type ExitCapacityAnswer, type QueueFlowAnswer } from './exitCapacity'
import {
	buildLiquidityBands,
	buildLiquidityChart,
	buildLiquiditySummary,
	depositsOnly,
	firstLiquidityIndex,
	type ExitClass,
	type LiquidityChartModel,
	type LiquiditySummary,
	type LiquidityUnitKey
} from './liquidityChart'
import { CHART_PALETTE } from './poolCharts'
import { buildBandMarkArea, isoDay, rangeCount } from './poolChartUtils'
import { PoolRangeControl } from './PoolRangeControl'
import {
	EXIT_SIZE_DEFAULT,
	getExitSize,
	getExitSizeQueryValue,
	getLiquidityUnit,
	getLiquidityUnitQueryValue,
	getPoolHistoryRange,
	getPoolRangeQueryKey
} from './queryState'
import { getChartTooltipItems, getChartTooltipTimestamp, getChartTooltipValue, type ChartTooltipItem } from './tooltip'
import type { PoolHistoryRange } from './types'
import { useQueryDraft } from './useQueryDraft'
import { useVerifiedHistoryFetcher } from './useVerifiedHistory'
import { useWidestHistory } from './useWidestHistory'

const li = (inner: string, extra = '') => `<li style="list-style:none;${extra}">${inner}</li>`

const valueOf = (item: ChartTooltipItem | undefined): number | null => {
	if (!item) return null
	const raw = getChartTooltipValue(item)
	const value = typeof raw === 'number' ? raw : raw == null ? null : Number(raw)
	return value != null && Number.isFinite(value) ? value : null
}

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

// Named off the panel title so the legend, tooltip and readout speak one vocabulary: the stack
// totals DEPOSITS, and the green band is the part that is WITHDRAWABLE. "now" carries the
// instant-lane qualifier so the remainder never has to claim anything; calling it "not withdrawable"
// would be false for a pool whose exit is a working queue.
const AVAILABLE_NAME = 'Withdrawable now'
const REMAINDER_NAME = 'Rest of deposits'
const TOTAL_NAME = 'Total deposits'

// [light, dark] series fills. Withdrawable liquidity is the reassuring part of the stack, so it
// takes the positive hue; the remainder is neutral grey rather than a warning colour, because
// sitting beyond the instant lane is normal for a queued exit and is not bad news in itself.
const SERIES_COLOR: Record<'available' | 'remainder', readonly [light: string, dark: string]> = {
	available: CHART_PALETTE.accent,
	remainder: CHART_PALETTE.chartFill
}

// Background shading for the exit-health classes. Only these two are shaded: a working exit needs no
// mark, and a day we failed to measure is our gap, not the pool's.
// A revert outranks a partial however long each lasted, so blocked carries the heavier fill.
const BAND_FILL: Record<ExitClass, readonly [light: string, dark: string]> = {
	blocked: ['rgba(242, 54, 69, 0.22)', 'rgba(247, 82, 95, 0.38)'],
	partial: ['rgba(245, 127, 23, 0.16)', 'rgba(255, 167, 38, 0.24)']
}

// Both classes get one, since the key counts every affected day. Severity lives in the opacity.
const BAND_STROKE: Partial<Record<ExitClass, readonly [light: string, dark: string]>> = {
	blocked: ['rgba(242, 54, 69, 0.85)', 'rgba(247, 82, 95, 0.9)'],
	partial: ['rgba(245, 127, 23, 0.42)', 'rgba(255, 167, 38, 0.45)']
}

const SWATCH_FILL: Record<ExitClass, readonly [light: string, dark: string]> = {
	blocked: ['rgba(242, 54, 69, 0.55)', 'rgba(247, 82, 95, 0.65)'],
	partial: ['rgba(245, 127, 23, 0.6)', 'rgba(255, 167, 38, 0.7)']
}

const BAND_LABEL: Record<ExitClass, string> = {
	blocked: 'withdrawal reverted',
	partial: 'partial exit only'
}

function unitLabel(symbol: string | null): string {
	return symbol ?? 'tokens'
}

function formatAmount(value: number, unit: LiquidityUnitKey, symbol: string | null): string {
	if (unit === 'usd') {
		return formatUsd(value, { compact: true, compactSuffix: 'lowercase' }) ?? '-'
	}
	// Native token amounts carry the symbol so they can never be mistaken for dollars.
	return `${formatNumber(value, { maximumFractionDigits: value >= 1000 ? 0 : 4 })} ${unitLabel(symbol)}`
}

const asTimestamp = (value: unknown): number => (typeof value === 'number' ? value : 0)

function buildChartInputs(
	model: LiquidityChartModel,
	range: PoolHistoryRange,
	unit: LiquidityUnitKey,
	isDark: boolean,
	/** Drawn across the withdrawable series so the count in the readout has a picture. */
	positionUsd: number | null
): {
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	blockedDays: number
	partialDays: number
	summary: LiquiditySummary | null
} {
	const shade = (key: 'available' | 'remainder') => SERIES_COLOR[key][isDark ? 1 : 0]
	const series = unit === 'usd' ? model.usd : model.units
	const total = model.dates.length
	const windowStart = total - rangeCount(range, total)
	// Start where the measurement starts, not where the reported history does.
	const firstMeasured = firstLiquidityIndex(model, windowStart, total)
	const start = firstMeasured === -1 ? windowStart : firstMeasured
	const bands = buildLiquidityBands(model, start, total)
	// Counted per day over the plotted window, never summed from the bands: bands only draw runs
	// long enough to see, while the key must agree with the exit ledger, which counts every day.
	let blockedDays = 0
	let partialDays = 0
	for (let index = start; index < total; index++) {
		const exitClass = model.classes[index]
		if (exitClass === 'blocked') blockedDays++
		else if (exitClass === 'partial') partialDays++
	}

	const markArea = buildBandMarkArea(bands, BAND_FILL, isDark, BAND_STROKE)

	// Stacked so the top of the stack IS measured deposits and the upper band is literally the gap
	// the chart exists to show, rather than something the eye has to subtract. An uncapped queue has
	// no instant lane at all, so its withdrawable series is omitted rather than drawn flat at zero.
	const charts: Array<MultiSeriesChartSeriesConfig> = []
	const dimensions = ['timestamp']
	if (!model.uncappedQueue) {
		dimensions.push(AVAILABLE_NAME)
		charts.push({
			type: 'line',
			name: AVAILABLE_NAME,
			encode: { x: 0, y: dimensions.length - 1 },
			stack: 'deposits',
			color: shade('available'),
			...(markArea ? { markArea } : {}),
			...(positionUsd != null && unit === 'usd'
				? {
						markLine: {
							silent: true,
							symbol: 'none',
							label: { show: false },
							data: [{ yAxis: positionUsd }],
							lineStyle: { color: CHART_PALETTE.warn[isDark ? 1 : 0], type: 'dashed', width: 1.25 }
						}
					}
				: {})
		})
	}
	dimensions.push(REMAINDER_NAME)
	charts.push({
		type: 'line',
		name: REMAINDER_NAME,
		encode: { x: 0, y: dimensions.length - 1 },
		stack: 'deposits',
		color: shade('remainder'),
		...(model.uncappedQueue && markArea ? { markArea } : {})
	})

	const rows = new Array<MultiSeriesChartDataset['source'][number]>(total - start)
	for (let sourceIndex = start, rowIndex = 0; sourceIndex < total; sourceIndex++, rowIndex++) {
		const row: Array<number | null> = [model.dates[sourceIndex]]
		if (!model.uncappedQueue) row.push(series.available[sourceIndex])
		row.push(series.remainder[sourceIndex])
		rows[rowIndex] = row
	}

	return {
		dataset: { source: rows, dimensions },
		charts,
		blockedDays,
		partialDays,
		summary: buildLiquiditySummary(model, start, total, unit)
	}
}

function buildTooltipFormatter(
	model: LiquidityChartModel,
	unit: LiquidityUnitKey,
	exitStatus: VerifiedExitStatus | null
) {
	const classByDate = new Map<number, ExitClass>()
	const quotedDates = new Set<number>()
	for (let index = 0; index < model.dates.length; index++) {
		const kind = model.classes[index]
		if (kind) classByDate.set(model.dates[index], kind)
		if (model.quotedTotal[index]) quotedDates.add(model.dates[index])
	}

	return (params: unknown) => {
		const items = getChartTooltipItems(params)
		if (items.length === 0) return ''
		const timestamp = getChartTooltipTimestamp(items[0])
		let html = Number.isFinite(timestamp) ? formatTooltipChartDate(timestamp, 'daily') : ''

		const byName = new Map<string, ChartTooltipItem>()
		for (const item of items) byName.set(item.seriesName, item)

		// The plotted rows are already in the chosen unit, so the total is read back off them.
		let measured: number | null = null
		for (const name of [AVAILABLE_NAME, REMAINDER_NAME]) {
			const value = valueOf(byName.get(name))
			if (value != null) measured = (measured ?? 0) + value
		}

		for (const name of [AVAILABLE_NAME, REMAINDER_NAME]) {
			const item = byName.get(name)
			if (!item) continue
			const value = valueOf(item)
			if (value == null) continue
			// The share of deposits is the part that travels between pools of different sizes.
			const share =
				measured && measured > 0
					? ` (${formatPercent((value / measured) * 100, { input: 'percent', maximumFractionDigits: 1 })})`
					: ''
			html += li(`${item.marker} ${name}: ${formatAmount(value, unit, model.symbol)}${share}`)
		}

		if (measured != null && Number.isFinite(measured)) {
			html += li(`${TOTAL_NAME}: ${formatAmount(measured, unit, model.symbol)}`, 'font-weight:600;')
			if (quotedDates.has(timestamp)) {
				html += li(
					`<span style="opacity:0.7">Valued at the quoted rate: the exit could not price the supply that day</span>`
				)
			}
		}
		// A missing capacity series is not itself a queue; the live status decides.
		if (model.uncappedQueue) {
			html += li(
				exitStatus === 'queued'
					? '<span style="opacity:0.7">No instant lane: exit runs through an uncapped queue</span>'
					: '<span style="opacity:0.7">Exit capacity was never measured for this pool</span>'
			)
		}

		const kind = classByDate.get(timestamp)
		if (kind) html += li(`<span style="opacity:0.7">Exit that day: ${BAND_LABEL[kind]}</span>`)

		return html
	}
}

function LiquidityReadout({
	model,
	unit,
	capacity,
	flow,
	positionUsd,
	setQuery
}: {
	model: LiquidityChartModel
	unit: LiquidityUnitKey
	/** Null on a queue, where size is not the constraint, and in the native-unit view. */
	capacity: ExitCapacityAnswer | null
	/** The queued counterpart of `capacity`: null unless the pool's exit is a LIVE queue. */
	flow: QueueFlowAnswer | null
	positionUsd: number | null
	setQuery: (next: Record<string, string | undefined>) => void
}) {
	const [positionText, setPositionText, positionFocus] = useQueryDraft(positionUsd ?? EXIT_SIZE_DEFAULT, getExitSize)
	const commitPosition = useDebouncedCallback(
		(text: string) => setQuery({ exitSize: getExitSizeQueryValue(getExitSize(text)) }),
		300
	)
	// Each row answers a question the key row below cannot: how the position fares against the
	// instant lane, or how far deposits moved through a queue. The state itself ("no instant lane",
	// "capacity unmeasured") is already named in that key, so with neither answer there is nothing
	// left for this block to say.
	const showCapacity = capacity != null && positionUsd != null
	if (!showCapacity && !flow) return null
	return (
		<div className="flex flex-col gap-1 border-b border-subtle px-3 py-2">
			{capacity && positionUsd != null ? (
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<label className="flex items-center gap-1.5 body-sm text-secondary">
						Your position
						<span className="relative">
							<span className="pointer-events-none absolute top-0 bottom-0 left-2 my-auto flex items-center text-tertiary">
								$
							</span>
							<input
								type="number"
								min={0}
								step="any"
								inputMode="decimal"
								value={positionText}
								onFocus={positionFocus.onFocus}
								onBlur={() => {
									commitPosition.flush()
									positionFocus.onBlur()
								}}
								onChange={(event) => {
									setPositionText(event.target.value)
									commitPosition(event.target.value)
								}}
								className={`${inputStyles} w-32 pl-5`}
								aria-label="Position size to test against measured exit capacity"
							/>
						</span>
					</label>
					<span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
						<span
							className={`mono-md-bold ${capacity.shortDays > 0 ? 'text-(--yield-negative-text)' : 'text-(--yield-positive-text)'}`}
						>
							{capacity.shortDays > 0 ? `${capacity.shortDays} days` : 'Every day'}
						</span>
						<span className="body-sm text-secondary">
							{capacity.shortDays > 0 ? 'could not have exited in full' : 'could have exited in full'}
						</span>
						<span className="body-sm text-tertiary">{`of ${capacity.measuredDays} measured`}</span>
					</span>
					{/* A sizing rule, not a promise: the ceiling that held on nine days in ten. */}
					{capacity.comfortableUsd != null ? (
						<Tooltip
							content="The tenth-percentile withdrawable figure: a position this size would have exited in full on nine measured days out of ten. Past capacity, never a guarantee."
							className="ml-auto"
						>
							<span className="body-sm text-tertiary underline decoration-dotted">
								{`${formatUsd(capacity.comfortableUsd, USD_LOWERCASE_MILLIONS_OPTIONS)} clears 90% of days`}
							</span>
						</Tooltip>
					) : null}
				</div>
			) : null}

			{/* A queue has no instant lane BY DESIGN, so it reports how far deposits actually moved instead. */}
			{flow ? (
				<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<span
						className={`mono-md-bold ${flow.to < flow.from ? 'text-(--yield-negative-text)' : 'text-(--yield-positive-text)'}`}
					>
						{formatAmount(Math.abs(flow.to - flow.from), 'units', model.symbol)}
					</span>
					<span className="body-sm text-secondary">
						{flow.to < flow.from ? 'left the pool' : 'joined the pool'} over {flow.measuredDays} measured days
					</span>
					{/* Deposits net off against withdrawals, so a fall is a FLOOR on what the queue cleared. */}
					{flow.worstWeek > 0 ? (
						<Tooltip
							content={`Largest fall in measured deposits across any seven days, ${isoDay(flow.worstWeekFrom)} to ${isoDay(
								flow.worstWeekTo
							)}. New deposits net against withdrawals, so the queue processed at least this much in a week. A measured floor, never a promise.`}
						>
							<span className="body-sm text-tertiary underline decoration-dotted">
								{`queue cleared ≥ ${formatAmount(flow.worstWeek, 'units', model.symbol)} in a week`}
							</span>
						</Tooltip>
					) : null}
				</div>
			) : null}
		</div>
	)
}

export function PoolLiquidityChart({
	model,
	poolId,
	decimals,
	exitStatus = null,
	initialRange = 'max'
}: {
	model: LiquidityChartModel
	poolId: string
	// Needed to rebuild the model when a wider range is fetched client-side.
	decimals: number | null
	// Current-state exit facts, which decide what an absent withdrawable figure MEANS.
	exitStatus?: VerifiedExitStatus | null
	initialRange?: PoolHistoryRange
}) {
	const router = useRouter()
	const [isDark] = useDarkModeManager()
	const range = getPoolHistoryRange(router.query[getPoolRangeQueryKey('liquidity')])
	const { fetchHistory, isPending: historyAccessPending } = useVerifiedHistoryFetcher(poolId)
	const {
		model: widestModel,
		loading,
		error
	} = useWidestHistory(
		initialRange,
		model,
		range,
		(next) => fetchHistory(next).then((history) => buildLiquidityChart(history, { decimals, symbol: model.symbol })),
		!historyAccessPending
	)
	// A live queue has no instant lane by design, so the chart shows deposits alone even where the
	// capacity probe returned a figure on some days.
	const currentModel = useMemo(
		() => (exitStatus === 'queued' ? depositsOnly(widestModel) : widestModel),
		[exitStatus, widestModel]
	)
	const chartRef = useRef<echarts.ECharts | null>(null)
	// USD is the default. Native units are only offered when the pool carries a denomination, and are
	// the honest way to read FLOWS: in dollars a fall can be an outflow or the token's price dropping.
	// The URL says 'native'; the model keys the series 'units'. Translated here so neither side has
	// to know the other's vocabulary.
	const requestedUnit: LiquidityUnitKey = getLiquidityUnit(router.query.liqUnit) === 'native' ? 'units' : 'usd'
	const unit: LiquidityUnitKey = currentModel.hasUnits ? requestedUnit : 'usd'
	const setQuery = (patch: Record<string, string | undefined>) => {
		void pushShallowQuery(router, patch, router.pathname)
	}
	const positionUsd = currentModel.uncappedQueue || unit !== 'usd' ? null : getExitSize(router.query.exitSize)
	const { dataset, charts, blockedDays, partialDays, summary } = useMemo(
		() => buildChartInputs(currentModel, range, unit, isDark, positionUsd),
		[currentModel, isDark, positionUsd, range, unit]
	)
	const chartOptions = useMemo(
		() => ({
			tooltip: { formatter: buildTooltipFormatter(currentModel, unit, exitStatus) },
			yAxis: {
				axisLabel: {
					formatter: (value: number) =>
						unit === 'usd'
							? (formatUsd(value, { compact: true, compactSuffix: 'lowercase' }) ?? '')
							: formatNumber(value, { maximumFractionDigits: 0 })
				}
			}
		}),
		[currentModel, exitStatus, unit]
	)

	// The position the capacity answer sizes against. USD only: the series it compares to is USD,
	// and asking the question in token units would need a per-day price we do not carry.
	const capacity = useMemo(
		() =>
			positionUsd == null
				? null
				: answerExitCapacity(currentModel, positionUsd, {
						start: asTimestamp(dataset.source[0]?.[0]),
						end: asTimestamp(dataset.source[dataset.source.length - 1]?.[0])
					}),
		[currentModel, dataset, positionUsd]
	)

	const flow = useMemo(
		() =>
			answerQueueFlow(
				currentModel,
				{
					start: asTimestamp(dataset.source[0]?.[0]),
					end: asTimestamp(dataset.source[dataset.source.length - 1]?.[0])
				},
				exitStatus
			),
		[currentModel, dataset, exitStatus]
	)

	return (
		<>
			<PanelHeader>
				<PanelTitle>{currentModel.uncappedQueue ? 'Deposits' : 'Exit history'}</PanelTitle>
				<div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
					{currentModel.hasUnits ? (
						<Tooltip content="In dollars a fall can be an outflow OR the token's price dropping. Switch to token units to see deposit flows on their own.">
							<button
								type="button"
								aria-pressed={unit === 'units'}
								onClick={() => setQuery({ liqUnit: getLiquidityUnitQueryValue(unit === 'usd' ? 'native' : 'usd') })}
								className={metricSeriesToggleStyles}
								data-active={unit === 'units'}
							>
								{unit === 'usd' ? `Show ${unitLabel(currentModel.symbol)}` : 'Show USD'}
							</button>
						</Tooltip>
					) : null}
					<PoolRangeControl kind="liquidity" />
					<ChartExportButtons
						chartInstance={() => chartRef.current}
						filename={`yields-${poolId}-liquidity`}
						csvSource={{ type: 'dataset', prepare: () => dataset }}
					/>
				</div>
			</PanelHeader>

			{!loading && !error && summary ? (
				<LiquidityReadout
					model={currentModel}
					unit={unit}
					capacity={capacity}
					flow={flow}
					positionUsd={positionUsd}
					setQuery={setQuery}
				/>
			) : null}

			<ChartPanelToolbar>
				{currentModel.uncappedQueue ? (
					<Tooltip
						content={
							exitStatus === 'queued'
								? `No instant exit lane by design: withdrawals run through a queue that accepts any size. That is not the same as having no liquidity, so nothing is shown as withdrawable now.${
										// Flows are read in token units, so without them the queue's movement has no row above.
										currentModel.hasUnits
											? ''
											: ' Deposit flows need token units, which this pool does not report, so how far the queue has moved is not shown either.'
									}`
								: 'The exit-capacity probe returned nothing on this run, so the instant lane is unmeasured rather than absent. Withdrawals from this pool have succeeded; what is unknown is the ceiling.'
						}
					>
						<span className="body-sm text-secondary underline decoration-dotted">
							{exitStatus === 'queued' ? 'Exit runs through an uncapped queue' : 'Exit capacity unmeasured'}
						</span>
					</Tooltip>
				) : (
					<Tooltip content="The most that could be withdrawn immediately, measured on-chain at that day's block. A binding constraint, not backing inventory.">
						<span className="flex items-center gap-1.5 body-sm text-secondary">
							<span
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: SERIES_COLOR.available[isDark ? 1 : 0] }}
								aria-hidden
							/>
							<span className="underline decoration-dotted">{AVAILABLE_NAME}</span>
							{summary?.availableFraction != null ? (
								<>
									<span className="text-tertiary" aria-hidden>
										·
									</span>
									<span className="mono-md-bold text-primary">
										{formatPercent(summary.availableFraction * 100, { input: 'percent', maximumFractionDigits: 1 })}
									</span>
								</>
							) : null}
						</span>
					</Tooltip>
				)}
				<Tooltip content="The remaining deposits. For a pool whose exit is a withdrawal queue this is most of the pool and is normal: it means 'not immediate', not 'stuck'.">
					<span className="flex items-center gap-1.5 body-sm text-secondary">
						<span
							className="size-2 shrink-0 rounded-full"
							style={{ backgroundColor: SERIES_COLOR.remainder[isDark ? 1 : 0] }}
							aria-hidden
						/>
						<span className="underline decoration-dotted">{REMAINDER_NAME}</span>
					</span>
				</Tooltip>
				{blockedDays || partialDays ? (
					<span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 body-sm text-tertiary">
						{blockedDays ? (
							<span className="flex items-center gap-1.5">
								<span
									className="size-2 shrink-0 rounded-xs"
									style={{ backgroundColor: SWATCH_FILL.blocked[isDark ? 1 : 0] }}
									aria-hidden
								/>
								{blockedDays} {blockedDays === 1 ? 'day' : 'days'} withdrawal reverted
							</span>
						) : null}
						{partialDays ? (
							<span className="flex items-center gap-1.5">
								<span
									className="size-2 shrink-0 rounded-xs"
									style={{ backgroundColor: SWATCH_FILL.partial[isDark ? 1 : 0] }}
									aria-hidden
								/>
								{partialDays} {partialDays === 1 ? 'day' : 'days'} partial exit only
							</span>
						) : null}
					</span>
				) : null}
			</ChartPanelToolbar>

			{/* The panel gives this chart a fixed-height section, so the body fills whatever the readout and
			    key leave; the lower floor lets those wrap onto a second line without pushing the chart out
			    over the exit ledger below. */}
			<ChartPanelBody size="compact">
				{loading ? (
					<ChartPanelBodyFallback size="compact" role="status" aria-live="polite">
						<LoadingIndicator label={`Loading ${range} history`} />
					</ChartPanelBodyFallback>
				) : error ? (
					<ChartPanelBodyFallback size="compact" role="alert" className="body-sm text-data-down">
						Couldn&apos;t load {range} history.
					</ChartPanelBodyFallback>
				) : (
					<Suspense
						fallback={
							<ChartPanelBodyFallback size="compact" role="status" aria-live="polite">
								<LoadingIndicator label="Loading chart" />
							</ChartPanelBodyFallback>
						}
					>
						<MultiSeriesChart
							dataset={dataset}
							charts={charts}
							chartOptions={chartOptions}
							valueSymbol={unit === 'usd' ? '$' : ''}
							containerClassName={CHART_FILL.compact}
							stacked
							hideDefaultLegend
							exportButtons="hidden"
							onReady={(inst) => {
								chartRef.current = inst
							}}
						/>
					</Suspense>
				)}
			</ChartPanelBody>
		</>
	)
}
