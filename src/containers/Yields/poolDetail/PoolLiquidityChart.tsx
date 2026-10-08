import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import { lazy, type ReactNode, Suspense, useMemo, useRef } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { StateTimelineOption, StateTimelinePoint } from '~/components/ECharts/MultiSeriesChart/stateTimeline'
import type {
	IMultiSeriesChartProps,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { formatTooltipChartDate } from '~/components/ECharts/shared/formatters'
import { getTooltipAxisValue } from '~/components/ECharts/shared/tooltip'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useDebouncedCallback } from '~/hooks/useDebounce'
import { ChartPanelBody, ChartPanelBodyFallback, CHART_FILL } from '~/ui/ChartPanel'
import { metricSeriesToggleStyles } from '~/ui/MetricChip'
import { PanelHeader, PanelTitle } from '~/ui/Panel'
import { LoadingIndicator } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { VerifiedBlock, VerifiedExitStatus } from '../data/types'
import { exitCoverageLine, exitHeadline } from '../domain/exitPresentation'
import { answerExitCapacity, answerQueueFlow, type ExitCapacityAnswer, type QueueFlowAnswer } from './exitCapacity'
import { EXIT_OUTCOME_LABELS, exitFailures, type ExitReliabilityModel } from './exitReliability'
import { cleanClaim } from './ExitReliabilityPanel'
import {
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
import { DAY_MS, isoDay, rangeCount } from './poolChartUtils'
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
import { ReadoutCell, readoutFieldStyles, readoutKeysStyles, ReadoutKey } from './readout'
import { getChartTooltipItems, getChartTooltipValue, type ChartTooltipItem } from './tooltip'
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

// Named off the panel title: the stack totals deposits, and the green series is the withdrawable part.
const AVAILABLE_NAME = 'Withdrawable'
const REMAINDER_NAME = 'Rest of deposits'
const TOTAL_NAME = 'Total deposits'

// [light, dark] series fills. Withdrawable liquidity is the reassuring part of the stack, so it
// takes the positive hue; the remainder is neutral grey rather than a warning colour, because
// sitting beyond the instant lane is normal for a queued exit and is not bad news in itself.
const SERIES_COLOR: Record<'available' | 'remainder', readonly [light: string, dark: string]> = {
	available: CHART_PALETTE.accent,
	remainder: CHART_PALETTE.chartFill
}

// The strip's cell for a day with nothing to report: present, quiet, so incidents read against it.
const STRIP_BASE: readonly [light: string, dark: string] = ['rgba(9, 11, 12, 0.08)', 'rgba(255, 255, 255, 0.1)']

const SWATCH_FILL: Record<ExitClass, readonly [light: string, dark: string]> = {
	blocked: ['rgba(220, 38, 38, 0.95)', 'rgba(248, 81, 73, 1)'],
	partial: ['rgba(245, 127, 23, 0.55)', 'rgba(255, 167, 38, 0.6)']
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
	isDark: boolean
): {
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	blockedDays: number
	partialDays: number
	summary: LiquiditySummary | null
	timeline: StateTimelineOption
} {
	const shade = (key: 'available' | 'remainder') => SERIES_COLOR[key][isDark ? 1 : 0]
	const series = unit === 'usd' ? model.usd : model.units
	const total = model.dates.length
	const windowStart = total - rangeCount(range, total)
	// Start where the measurement starts, not where the reported history does.
	const firstMeasured = firstLiquidityIndex(model, windowStart, total)
	const start = firstMeasured === -1 ? windowStart : firstMeasured
	// The exit outcome per day as the strip under the plot; its counts agree with the exit ledger.
	let blockedDays = 0
	let partialDays = 0
	const points: Array<StateTimelinePoint> = []
	for (let index = start; index < total; index++) {
		const exitClass = model.classes[index]
		if (exitClass === 'blocked') blockedDays++
		else if (exitClass === 'partial') partialDays++
		const date = model.dates[index]
		if (date == null) continue
		const outcome = model.outcomes[index]
		if (exitClass && outcome) {
			points.push({
				timestamp: date,
				color: SWATCH_FILL[exitClass][isDark ? 1 : 0],
				label: EXIT_OUTCOME_LABELS[outcome]
			})
		} else if (series.total[index] != null) {
			points.push({ timestamp: date, color: STRIP_BASE[isDark ? 1 : 0], label: 'No interruption measured' })
		}
	}
	const timeline: StateTimelineOption = { points, stepMs: DAY_MS }

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
			color: shade('available')
		})
	}
	dimensions.push(REMAINDER_NAME)
	charts.push({
		type: 'line',
		name: REMAINDER_NAME,
		encode: { x: 0, y: dimensions.length - 1 },
		stack: 'deposits',
		color: shade('remainder')
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
		summary: buildLiquiditySummary(model, start, total, unit),
		timeline
	}
}

function buildTooltipFormatter(
	model: LiquidityChartModel,
	unit: LiquidityUnitKey,
	exitStatus: VerifiedExitStatus | null,
	isDark: boolean
) {
	const exitByDate = new Map<number, { kind: ExitClass; label: string }>()
	const quotedDates = new Set<number>()
	for (let index = 0; index < model.dates.length; index++) {
		const kind = model.classes[index]
		const outcome = model.outcomes[index]
		if (kind && outcome) exitByDate.set(model.dates[index], { kind, label: EXIT_OUTCOME_LABELS[outcome] })
		if (model.quotedTotal[index]) quotedDates.add(model.dates[index])
	}

	return (params: unknown) => {
		const items = getChartTooltipItems(params)
		if (items.length === 0) return ''
		const timestamp = getTooltipAxisValue(items[0])
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
			html += li(`${item.marker} ${name}: ${escapeHtml(formatAmount(value, unit, model.symbol))}${share}`)
		}

		if (measured != null && Number.isFinite(measured)) {
			html += li(`${TOTAL_NAME}: ${escapeHtml(formatAmount(measured, unit, model.symbol))}`, 'font-weight:600;')
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

		const exit = exitByDate.get(timestamp)
		if (exit) {
			const swatch = `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${SWATCH_FILL[exit.kind][isDark ? 1 : 0]};margin-right:6px;vertical-align:-1px"></span>`
			html += li(`${swatch}Exit that day: ${exit.label}`)
		}

		return html
	}
}

const POSITION_INPUT_ID = 'exit-position-size'

/** The plot's own key, the row above the plot. Every colour the chart uses is named here and nowhere else. */
function LiquidityKey({
	model,
	blockedDays,
	partialDays,
	isDark
}: {
	model: LiquidityChartModel
	blockedDays: number
	partialDays: number
	isDark: boolean
}) {
	return (
		<div className={readoutKeysStyles}>
			{model.uncappedQueue ? null : (
				<ReadoutKey color={SERIES_COLOR.available[isDark ? 1 : 0]}>{AVAILABLE_NAME}</ReadoutKey>
			)}
			<ReadoutKey
				color={SERIES_COLOR.remainder[isDark ? 1 : 0]}
				hint="The remaining deposits. For a pool whose exit is a withdrawal queue this is most of the pool and is normal: it means 'not immediate', not 'stuck'."
			>
				{REMAINDER_NAME}
			</ReadoutKey>
			{blockedDays ? (
				<ReadoutKey color={SWATCH_FILL.blocked[isDark ? 1 : 0]}>
					{formatNumber(blockedDays)} {blockedDays === 1 ? 'day' : 'days'} reverted
				</ReadoutKey>
			) : null}
			{partialDays ? (
				<ReadoutKey color={SWATCH_FILL.partial[isDark ? 1 : 0]}>
					{formatNumber(partialDays)} {partialDays === 1 ? 'day' : 'days'} partial exit only
				</ReadoutKey>
			) : null}
		</div>
	)
}

function describeExitMechanism(
	uncappedQueue: boolean,
	verified: VerifiedBlock | null
): { title: string; detail: string } {
	const status = verified?.exit?.status ?? null
	// The category alone; the figure is the next cell's job. A queue keeps its ETA.
	const headline = verified ? exitHeadline(verified) : null
	const title = status === 'partial' ? 'Partial' : (headline ?? (uncappedQueue ? 'Not measured' : '—'))
	// Blocked, unavailable, queued and unmeasured lead with the tile's line; lanes need no sentence.
	const coverage =
		verified && (status === 'blocked' || status === 'unavailable' || uncappedQueue) ? exitCoverageLine(verified) : null
	const plot = uncappedQueue
		? status === 'queued'
			? ''
			: 'Instant capacity was not measured, so this chart shows total deposits only.'
		: status === 'blocked' || status === 'unavailable'
			? 'This chart shows how much could be withdrawn instantly on earlier days.'
			: ''
	return { title, detail: coverage ? (plot ? `${coverage}. ${plot}` : coverage) : plot }
}

const CELL = 'border-t border-l border-subtle px-4 py-3'

/** One row of equal stats summarising the plot, label over figure. */
function LiquidityReadout({
	model,
	unit,
	flow,
	summary,
	verified,
	reliability
}: {
	model: LiquidityChartModel
	unit: LiquidityUnitKey
	/** Null unless the pool's exit is a LIVE queue. */
	flow: QueueFlowAnswer | null
	summary: LiquiditySummary | null
	/** The current measurement, whose exit wording the status cell reuses. */
	verified: VerifiedBlock | null
	/** The ledger over the whole history, for the simulated withdrawals' own count. */
	reliability: ExitReliabilityModel | null
}) {
	const mechanism = describeExitMechanism(model.uncappedQueue, verified)
	const status = verified?.exit?.status
	// No lane today means no figure, whatever an earlier day held.
	const lane = status === 'instant' || status === 'partial' || status === 'depleted'
	const available = lane ? (summary?.available ?? null) : null
	const availablePct = lane && summary?.availableFraction != null ? summary.availableFraction * 100 : null
	const feeBps = verified?.exit?.fee_bps ?? 0
	const failures = reliability ? exitFailures(reliability.incidents) : []
	const partialDays = failures.filter((i) => i.kind === 'partial').reduce((sum, i) => sum + i.days, 0)
	const revertedDays = failures.filter((i) => i.kind !== 'partial').reduce((sum, i) => sum + i.days, 0)
	const cleanDays = reliability ? reliability.fullDays + reliability.queuedDays : 0
	const cleanShare = reliability && reliability.measuredDays > 0 ? (cleanDays / reliability.measuredDays) * 100 : 0

	const figure = model.uncappedQueue ? (
		flow && flow.worstWeek > 0 ? (
			<ReadoutCell
				label="Queue paid out in one week"
				className={CELL}
				hint={`This pool has no instant lane, so the question is how much its queue actually moves. In the seven days from ${isoDay(
					flow.worstWeekFrom
				)} to ${isoDay(
					flow.worstWeekTo
				)} deposits fell by this much. New deposits net against withdrawals, so the queue paid out at least this amount in one week. A measured floor, never a promise.`}
			>
				<span className="mono-xl text-primary">≥ {formatAmount(flow.worstWeek, 'units', model.symbol)}</span>
			</ReadoutCell>
		) : null
	) : (
		<ReadoutCell
			label="Withdrawable now"
			hint="The most that could be withdrawn immediately, measured on-chain at that day's block. A binding constraint, not backing inventory."
			className={CELL}
		>
			<span className="mono-xl text-primary">
				{available == null ? '—' : formatAmount(available, unit, model.symbol)}
			</span>
			{availablePct != null ? (
				<span className="body-sm text-secondary">
					{formatPercent(availablePct, { input: 'percent', maximumFractionDigits: 1 })} of pool withdrawable at once
				</span>
			) : null}
		</ReadoutCell>
	)

	return (
		<div className="-mt-px -ml-px grid grid-cols-1 md:grid-cols-3">
			<ReadoutCell label="Exit Status" className={CELL}>
				<span className="mono-xl text-primary">{mechanism.title}</span>
				{mechanism.detail ? <span className="basis-full body-sm text-secondary">{mechanism.detail}</span> : null}
				{feeBps > 0 ? (
					<span className="basis-full body-sm text-(--yield-warning-text)">
						Exit fee {formatNumber(feeBps, { maximumFractionDigits: 2 })} bps
					</span>
				) : null}
			</ReadoutCell>
			{figure}

			{reliability ? (
				<ReadoutCell
					label={`Withdrawals ${cleanClaim(reliability)}`}
					hint="Every measured day we simulate a real holder withdrawing their whole position. This counts the days that withdrawal went through, over the full history."
					className={CELL}
				>
					<span className="mono-xl text-primary">
						{formatNumber(cleanDays)} / {formatNumber(reliability.measuredDays)}{' '}
						<span className="body-md text-secondary">days</span>
					</span>
					<span className="body-sm text-secondary">
						{formatPercent(cleanShare, { input: 'percent', maximumFractionDigits: 0 })}
					</span>
					<span className="flex basis-full flex-wrap gap-x-1.5 body-sm">
						{failures.length > 0 ? (
							<>
								{partialDays > 0 ? (
									<span className="text-warning">{formatNumber(partialDays)} days partial exit only</span>
								) : null}
								{partialDays > 0 && revertedDays > 0 ? (
									<span aria-hidden className="text-secondary">
										·
									</span>
								) : null}
								{revertedDays > 0 ? (
									<span className="text-(--yield-negative-text)">{formatNumber(revertedDays)} days reverted</span>
								) : null}
							</>
						) : (
							<span className="text-(--yield-positive-text)">No interruptions</span>
						)}
					</span>
				</ReadoutCell>
			) : null}
		</div>
	)
}

/** The one interactive line, above the plot: the reader's own amount against the measured lane. */
function WithdrawWhatIf({
	model,
	capacity,
	positionUsd,
	setQuery
}: {
	model: LiquidityChartModel
	capacity: ExitCapacityAnswer | null
	positionUsd: number | null
	setQuery: (next: Record<string, string | undefined>) => void
}) {
	const [positionText, setPositionText, positionFocus] = useQueryDraft(positionUsd ?? EXIT_SIZE_DEFAULT, getExitSize)
	const commitPosition = useDebouncedCallback(
		(text: string) => setQuery({ exitSize: getExitSizeQueryValue(getExitSize(text)) }),
		300
	)
	if (model.uncappedQueue) return null
	// In token units the field stays, disabled, so the reader sees why the answer is missing.
	const sizeDisabled = capacity == null || positionUsd == null
	return (
		<div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-4 py-2.5">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-2 body-md text-secondary">
				<label htmlFor={POSITION_INPUT_ID}>If you wanted to withdraw</label>
				<span
					className={`${readoutFieldStyles} inline-flex items-center gap-1 ${sizeDisabled ? 'text-disabled' : ''}`.trim()}
				>
					<span className="text-tertiary">$</span>
					<input
						id={POSITION_INPUT_ID}
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
						disabled={sizeDisabled}
						className="w-24 bg-transparent p-0 mono-md text-primary outline-hidden disabled:cursor-not-allowed"
					/>
				</span>
				{sizeDisabled ? (
					<span className="body-sm text-tertiary">in USD only</span>
				) : (
					<>
						<span>you could have on</span>
						<span className="mono-md-bold text-primary">
							{formatNumber(capacity.measuredDays - capacity.shortDays)} of {formatNumber(capacity.measuredDays)}
						</span>
						<span>days</span>
					</>
				)}
			</div>
		</div>
	)
}

export function PoolLiquidityChart({
	model,
	poolId,
	decimals,
	exitStatus = null,
	verified = null,
	reliability = null,
	ledger = null,
	initialRange = 'max'
}: {
	model: LiquidityChartModel
	poolId: string
	// Needed to rebuild the model when a wider range is fetched client-side.
	decimals: number | null
	// Current-state exit facts, which decide what an absent withdrawable figure MEANS.
	exitStatus?: VerifiedExitStatus | null
	/** The current measurement, for the headline's exit wording. */
	verified?: VerifiedBlock | null
	/** The whole ledger, for the record's own count beside today's figure. */
	reliability?: ExitReliabilityModel | null
	/** The interruptions block, rendered full width under the cells. */
	ledger?: ReactNode
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
		(next) =>
			fetchHistory(next).then(({ history }) => buildLiquidityChart(history, { decimals, symbol: model.symbol })),
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
	const { dataset, charts, blockedDays, partialDays, summary, timeline } = useMemo(
		() => buildChartInputs(currentModel, range, unit, isDark),
		[currentModel, isDark, range, unit]
	)
	const chartOptions = useMemo(
		() => ({
			tooltip: { formatter: buildTooltipFormatter(currentModel, unit, exitStatus, isDark) },
			yAxis: {
				axisLabel: {
					formatter: (value: number) =>
						unit === 'usd'
							? (formatUsd(value, { compact: true, compactSuffix: 'lowercase' }) ?? '')
							: formatNumber(value, { maximumFractionDigits: 0 })
				}
			}
		}),
		[currentModel, exitStatus, isDark, unit]
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
				<PanelTitle className="mr-auto">Exit history</PanelTitle>
				{currentModel.hasUnits ? (
					<Tooltip
						content="In dollars a fall can be an outflow OR the token's price dropping. Switch to token units to see deposit flows on their own."
						render={
							<button
								type="button"
								onClick={() => setQuery({ liqUnit: getLiquidityUnitQueryValue(unit === 'usd' ? 'native' : 'usd') })}
								className={metricSeriesToggleStyles}
								data-active={unit === 'units'}
							/>
						}
					>
						{unit === 'usd' ? `Show ${unitLabel(currentModel.symbol)}` : 'Show USD'}
					</Tooltip>
				) : null}
				<PoolRangeControl kind="liquidity" />
				<ChartExportButtons
					chartInstance={() => chartRef.current}
					filename={`yields-${poolId}-liquidity`}
					csvSource={{ type: 'dataset', prepare: () => dataset }}
				/>
			</PanelHeader>

			{!loading && !error ? (
				<WithdrawWhatIf model={currentModel} capacity={capacity} positionUsd={positionUsd} setQuery={setQuery} />
			) : null}

			{/* The key is its own row, so the body holds only the plot and stands as tall as the APY charts'. */}
			{!loading && !error ? (
				<LiquidityKey model={currentModel} blockedDays={blockedDays} partialDays={partialDays} isDark={isDark} />
			) : null}
			<ChartPanelBody>
				{loading ? (
					<ChartPanelBodyFallback role="status" aria-live="polite">
						<LoadingIndicator label={`Loading ${range} history`} />
					</ChartPanelBodyFallback>
				) : error ? (
					<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
						Couldn&apos;t load {range} history.
					</ChartPanelBodyFallback>
				) : (
					<Suspense
						fallback={
							<ChartPanelBodyFallback role="status" aria-live="polite">
								<LoadingIndicator label="Loading chart" />
							</ChartPanelBodyFallback>
						}
					>
						<MultiSeriesChart
							dataset={dataset}
							charts={charts}
							chartOptions={chartOptions}
							valueSymbol={unit === 'usd' ? '$' : ''}
							containerClassName={CHART_FILL}
							stacked
							stateTimeline={timeline}
							hideDefaultLegend
							exportButtons="hidden"
							onReady={(inst) => {
								chartRef.current = inst
							}}
						/>
					</Suspense>
				)}
			</ChartPanelBody>

			<div className="flex flex-col overflow-hidden border-t border-subtle">
				{!loading && !error ? (
					<LiquidityReadout
						model={currentModel}
						unit={unit}
						flow={flow}
						summary={summary}
						verified={verified}
						reliability={reliability}
					/>
				) : null}
				{ledger ? <div className="border-t border-subtle">{ledger}</div> : null}
			</div>
		</>
	)
}
