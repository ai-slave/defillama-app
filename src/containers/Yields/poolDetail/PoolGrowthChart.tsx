import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
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
import { Icon } from '~/ui/Icon'
import { inputStyles } from '~/ui/Input'
import { metricSeriesToggleStyles } from '~/ui/MetricChip'
import { PanelHeader, PanelTitle } from '~/ui/Panel'
import { LoadingIndicator } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import {
	buildGrowthChart,
	buildGrowthGaps,
	buildGrowthSeries,
	buildGrowthSummary,
	firstMeasuredIndex,
	growthAxisDigits,
	growthFractionDigits,
	growthOutcomeLabel,
	growthReasonLabel,
	resolveGrowthAnchor,
	type GrowthChartModel,
	type GrowthGapKind,
	type GrowthSummary
} from './growthChart'
import { CHART_PALETTE } from './poolCharts'
import { buildBandMarkArea, isoDay, rangeCount } from './poolChartUtils'
import { PoolRangeControl } from './PoolRangeControl'
import {
	getGrowthAnchorDate,
	getGrowthDeposit,
	getGrowthDepositQueryValue,
	getPoolHistoryRange,
	getPoolRangeQueryKey,
	GROWTH_MAX_DEPOSIT
} from './queryState'
import { getChartTooltipItems, getChartTooltipTimestamp, getChartTooltipValue, type ChartTooltipItem } from './tooltip'
import type { PoolHistoryRange } from './types'
import { useQueryDraft } from './useQueryDraft'
import { useVerifiedHistoryFetcher } from './useVerifiedHistory'
import { useWidestHistory } from './useWidestHistory'

const li = (inner: string) => `<li style="list-style:none;">${inner}</li>`

const valueOf = (item: ChartTooltipItem): number | null => {
	const raw = getChartTooltipValue(item)
	const value = typeof raw === 'number' ? raw : raw == null ? null : Number(raw)
	return value != null && Number.isFinite(value) ? value : null
}

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const VERIFIED_NAME = 'Verified'
// The protocol's quoted rate where the exit could not price the position: its own series, dashed
// with hollow markers, so it can never be read as the executed line.
const QUOTED_NAME = 'Quoted'

// Translucent [light, dark] fill for the shaded gap bands: neutral grey, because a gap is a hole in
// our own coverage and must not read as an accusation against the pool.
const GAP_BAND_FILL: Record<GrowthGapKind, readonly [light: string, dark: string]> = {
	unmeasured: ['rgba(126, 138, 160, 0.18)', 'rgba(126, 138, 160, 0.3)']
}

// Only runs at least this long get a shaded band. Measured across the dataset, 71% of gap runs are
// 1-2 days but they are just 6% of the missing days: drawn as bands they are sub-pixel hairlines
// that read as a stray cursor rather than as missing data, and widening them would overstate how
// long the pool was actually dark. Runs of 7+ days are 83% of the missing days and wide enough to
// read as bands. Short runs simply break the line without a band.
const GAP_BAND_MIN_DAYS = 7

// A drawdown smaller than this is measurement dust, not something a holder experienced.
const DRAWDOWN_DISPLAY_THRESHOLD_PCT = -0.1

function buildChartInputs(
	model: GrowthChartModel,
	range: PoolHistoryRange,
	deposit: number,
	anchorDate: string | null,
	isDark: boolean
): {
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	// The day the deposit was actually made, after snapping to a measured day. Null when the
	// window holds no measurement at all.
	anchoredOn: string | null
	summary: GrowthSummary | null
	// Decimals the y-axis needs for this window; fewer and the ticks print duplicate labels.
	axisDigits: number
} {
	const shade = (key: 'accent') => CHART_PALETTE[key][isDark ? 1 : 0]
	const total = model.dates.length
	// The chart begins AT the deposit: an explicit anchor replaces the range's own start, so there
	// is never dead space to the left of the first dollar.
	const windowStart = total - rangeCount(range, total)
	const requested = resolveGrowthAnchor(model, anchorDate, windowStart, total)
	// Begin where measurement begins. A pool can carry years of reported history behind only a few
	// weeks of measurement, and plotting that unmeasured run as empty axis would squeeze the line
	// into a sliver at the right edge. Clamping forward never hides measured data.
	const firstMeasured = firstMeasuredIndex(model, requested, total)
	const start = firstMeasured === -1 ? requested : firstMeasured
	const { anchor, measured, quoted } = buildGrowthSeries(model, start, total)

	// Shade the long breaks so a substantial dark stretch reads as "something happened here" instead
	// of as a rendering glitch. The per-day tooltip supplies the detail on hover, so the band itself
	// stays silent.
	const gaps = buildGrowthGaps(model, anchor, total)
	const bands = gaps.filter((gap) => gap.days >= GAP_BAND_MIN_DAYS)
	const markArea = buildBandMarkArea(bands, GAP_BAND_FILL, isDark)

	const dimensions = ['timestamp', VERIFIED_NAME, QUOTED_NAME]
	const charts: Array<MultiSeriesChartSeriesConfig> = [
		{
			type: 'line',
			name: VERIFIED_NAME,
			encode: { x: 0, y: 1 },
			color: shade('accent'),
			valueSymbol: '$',
			hideAreaStyle: true,
			// The whole point of a measured series: an unmeasured day is a hole in the evidence,
			// so the line breaks rather than drawing a straight guess across it.
			connectNulls: false,
			...(markArea ? { markArea } : {})
		},
		{
			type: 'line',
			name: QUOTED_NAME,
			encode: { x: 0, y: 2 },
			color: shade('accent'),
			valueSymbol: '$',
			hideAreaStyle: true,
			connectNulls: false,
			lineStyle: { type: 'dashed', width: 1.5 },
			showSymbol: true,
			symbol: 'emptyCircle',
			symbolSize: 5
		}
	]

	// The series math is unit-free multiples; the deposit is applied once, here.
	const scale = (value: number | null) => (value == null ? null : value * deposit)
	const rows = new Array<MultiSeriesChartDataset['source'][number]>(total - start)
	for (let sourceIndex = start, rowIndex = 0; sourceIndex < total; sourceIndex++, rowIndex++) {
		rows[rowIndex] = [model.dates[sourceIndex], scale(measured[rowIndex]), scale(quoted[rowIndex])]
	}

	let low = Number.POSITIVE_INFINITY
	let high = Number.NEGATIVE_INFINITY
	for (const row of rows) {
		for (const value of [row[1], row[2]]) {
			if (typeof value !== 'number') continue
			if (value < low) low = value
			if (value > high) high = value
		}
	}
	const span = Number.isFinite(high - low) ? high - low : 0

	return {
		dataset: { source: rows, dimensions },
		charts,
		anchoredOn: anchor === -1 ? null : isoDay(model.dates[anchor]),
		summary: buildGrowthSummary(model, anchor, total, deposit),
		axisDigits: growthAxisDigits(span)
	}
}

function buildTooltipFormatter(model: GrowthChartModel, digits: number) {
	// The outcome is a per-day fact, not a plotted series, so it is looked up by the tooltip's
	// timestamp rather than carried in the dataset.
	const outcomeByDate = new Map<number, string>()
	const reasonByDate = new Map<number, string>()
	for (let index = 0; index < model.dates.length; index++) {
		const label = growthOutcomeLabel(model.outcomes[index])
		if (label) outcomeByDate.set(model.dates[index], label)
		const reason = growthReasonLabel(model.reasons[index])
		if (reason && model.quoted[index] != null) reasonByDate.set(model.dates[index], reason)
	}
	const valueOptions = { minimumFractionDigits: digits, maximumFractionDigits: digits } as const

	return (params: unknown) => {
		const items = getChartTooltipItems(params)
		if (items.length === 0) return ''

		const timestamp = getChartTooltipTimestamp(items[0])
		let html = Number.isFinite(timestamp) ? formatTooltipChartDate(timestamp, 'daily') : ''

		const item = items.find((candidate) => candidate.seriesName === VERIFIED_NAME)
		const quotedItem = items.find((candidate) => candidate.seriesName === QUOTED_NAME)
		const value = item ? valueOf(item) : null
		const quotedValue = quotedItem ? valueOf(quotedItem) : null
		if (item && value != null) {
			html += li(`${item.marker} Value: ${formatUsd(value, valueOptions)}`)
		} else if (quotedItem && quotedValue != null) {
			// The two never share a label: this is what the protocol said, not what a holder got.
			const reason = reasonByDate.get(timestamp)
			html += li(`${quotedItem.marker} Quoted value: ${formatUsd(quotedValue, valueOptions)}`)
			html += li(`<span style="opacity:0.7">Quoted — exit not executable that day${reason ? `: ${reason}` : ''}</span>`)
		} else if (item) {
			// A gap day is worth naming: silence would read as "no data at all" for the day. On those
			// days the series name is dropped — "Verified: not measured" is nonsense.
			html += li(`${item.marker} Not measured`)
		}

		const outcome = outcomeByDate.get(timestamp)
		if (outcome) html += li(`<span style="opacity:0.7">${outcome}</span>`)

		return html
	}
}

// The answer to the question the chart asks, in words — so the user doesn't have to hover the last
// point and do the arithmetic. A measured loss is stated as plainly as a gain.
function GrowthReadout({
	summary,
	deposit,
	digits,
	setQuery
}: {
	summary: GrowthSummary
	deposit: number
	digits: number
	setQuery: (next: Record<string, string | undefined>) => void
}) {
	const [depositText, setDepositText, depositFocus] = useQueryDraft(deposit, getGrowthDeposit)
	const commitDeposit = useDebouncedCallback(
		(text: string) => setQuery({ deposit: getGrowthDepositQueryValue(getGrowthDeposit(text)) }),
		300
	)
	const money = { compact: true, minimumCompactValue: 1_000_000, maximumFractionDigits: digits } as const
	const percent = { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 } as const
	const down = summary.gain < 0
	const toneClass = down ? 'text-(--yield-negative-text)' : 'text-(--yield-positive-text)'

	const drawdown = summary.drawdown
	// Dust is not a dip. Only a fall a holder would actually have felt earns a place here.
	const showDrawdown = drawdown != null && drawdown.pct <= DRAWDOWN_DISPLAY_THRESHOLD_PCT

	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-subtle px-3 py-2">
			{/* Universal, never gated: nothing classifies the denomination's currency (EURC passes
			    `stablecoin_only`), so hiding it for "stablecoins" would hide it wrongly. */}
			<Tooltip content="Yield only, measured from the pool's redemption rate. It deliberately excludes the deposit token's own price move: over one stETH window the yield was +10.5% while the dollar value moved +48%.">
				<span className={`mono-md-bold underline decoration-dotted ${toneClass}`}>
					{formatUsd(summary.gain, { ...money, signDisplay: 'exceptZero' })} (
					{formatPercent(summary.returnPct, { ...percent, signDisplay: 'exceptZero' })})
				</span>
			</Tooltip>
			<span className="body-sm text-tertiary">
				{summary.annualizedPct == null ? null : <>{formatPercent(summary.annualizedPct, percent)} APY over </>}
				{formatNumber(summary.days)} {summary.days === 1 ? 'day' : 'days'}
			</span>
			{showDrawdown ? (
				<Tooltip
					content={`Deepest fall from a previous high: peak ${isoDay(drawdown.peakDate)}, low ${isoDay(
						drawdown.troughDate
					)}. ${drawdown.recovered ? 'The value has since made the dip back.' : 'The value is still below that peak.'}`}
				>
					<span
						className={`body-sm underline decoration-dotted ${drawdown.recovered ? 'text-tertiary' : 'text-(--yield-negative-text)'}`}
					>
						<span aria-hidden>▼ </span>
						{formatPercent(Math.abs(drawdown.pct), percent)} worst drawdown
						{drawdown.recovered ? ' (recovered)' : ''}
					</span>
				</Tooltip>
			) : null}
			<label className="ml-auto flex items-center gap-1.5 body-sm text-secondary">
				<Tooltip content="Click anywhere on the chart to deposit on a different day">
					<span className="underline decoration-dotted">Deposit</span>
				</Tooltip>
				<span className="relative">
					<span className="pointer-events-none absolute top-0 bottom-0 left-2 my-auto flex items-center text-tertiary">
						$
					</span>
					<input
						type="number"
						min={0}
						max={GROWTH_MAX_DEPOSIT}
						step="any"
						inputMode="decimal"
						value={depositText}
						onFocus={depositFocus.onFocus}
						onBlur={() => {
							commitDeposit.flush()
							depositFocus.onBlur()
						}}
						onChange={(event) => {
							setDepositText(event.target.value)
							commitDeposit(event.target.value)
						}}
						className={`${inputStyles} w-28 pl-5`}
						aria-label="Hypothetical deposit amount in dollars"
					/>
				</span>
			</label>
		</div>
	)
}

// Snaps a clicked pixel to the nearest day in the visible window. Clicking anywhere in the plot
// works — requiring a hit on the 1px line itself would make rebasing feel broken.
function nearestDate(instance: echarts.ECharts, offsetX: number, offsetY: number, dates: Array<number>): string | null {
	if (dates.length === 0) return null
	if (!instance.containPixel('grid', [offsetX, offsetY])) return null
	const converted = instance.convertFromPixel({ gridIndex: 0 }, [offsetX, offsetY])
	const target = Array.isArray(converted) ? Number(converted[0]) : Number(converted)
	if (!Number.isFinite(target)) return null

	let best = dates[0]
	let bestDistance = Math.abs(dates[0] - target)
	for (const date of dates) {
		const distance = Math.abs(date - target)
		if (distance < bestDistance) {
			bestDistance = distance
			best = date
		}
	}
	return isoDay(best)
}

export function PoolGrowthChart({
	model,
	poolId,
	initialRange = 'max'
}: {
	model: GrowthChartModel
	poolId: string
	initialRange?: PoolHistoryRange
}) {
	const router = useRouter()
	const [isDark] = useDarkModeManager()
	const range = getPoolHistoryRange(router.query[getPoolRangeQueryKey('growth')])
	// Safe to slice narrower views locally because rebasing is recomputed per window.
	const { fetchHistory, isPending: historyAccessPending } = useVerifiedHistoryFetcher(poolId)
	const {
		model: currentModel,
		loading,
		error
	} = useWidestHistory(
		initialRange,
		model,
		range,
		(next) => fetchHistory(next).then((history) => buildGrowthChart(history)),
		!historyAccessPending
	)
	const [instance, setInstance] = useState<echarts.ECharts | null>(null)
	const anchorDate = getGrowthAnchorDate(router.query.growthFrom)
	const deposit = getGrowthDeposit(router.query.deposit)
	const digits = growthFractionDigits(deposit)

	// MultiSeriesChart reapplies its ECharts model when these input references change, so keep
	// them stable across unrelated renders.
	const { dataset, charts, anchoredOn, summary, axisDigits } = useMemo(
		() => buildChartInputs(currentModel, range, deposit, anchorDate, isDark),
		[anchorDate, currentModel, deposit, isDark, range]
	)
	const chartOptions = useMemo(
		() => ({
			tooltip: { formatter: buildTooltipFormatter(currentModel, digits) },
			// The line moves by fractions of a percent against a large deposit, so the shared
			// zero-baseline would flatten it completely. `min: undefined` clears it.
			yAxis: {
				min: undefined,
				scale: true,
				axisLabel: {
					formatter: (value: number) =>
						formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, maximumFractionDigits: axisDigits })
				}
			}
		}),
		[axisDigits, currentModel, digits]
	)

	const setQuery = (patch: Record<string, string | undefined>) => {
		void pushShallowQuery(router, patch, router.pathname)
	}

	// Kept in a ref so the zrender listener below is registered once per chart instance instead of
	// re-bound on every render, while still pushing through the CURRENT router.
	const rebase = useRef(setQuery)
	useEffect(() => {
		rebase.current = setQuery
	})

	// Clicking the plot rebases the deposit to that day. Registered on the zrender layer so the
	// whole plot area is clickable, not just the 1px series line.
	useEffect(() => {
		// A range change that needs a fetch unmounts the chart in this same commit; the disposed
		// instance is still in state until its `onReady(null)` lands, and its zrender is gone.
		if (!instance || instance.isDisposed()) return
		const dates = dataset.source.map((row) => Number(row[0]))
		const zr = instance.getZr()
		const onClick = (event: { offsetX?: number; offsetY?: number }) => {
			if (event.offsetX == null || event.offsetY == null) return
			const date = nearestDate(instance, event.offsetX, event.offsetY, dates)
			if (date) rebase.current({ growthFrom: date })
		}
		zr.on('click', onClick)
		return () => {
			zr.off('click', onClick)
		}
	}, [dataset, instance])

	return (
		<>
			<PanelHeader>
				{/* Names the deposit the line is rebased to, so a typed amount is reflected in the heading. */}
				<PanelTitle>
					Growth of {formatUsd(deposit, { compact: true, minimumCompactValue: 1_000_000, maximumFractionDigits: 2 })}
				</PanelTitle>
				<div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
					<PoolRangeControl kind="growth" />
					<ChartExportButtons
						chartInstance={() => instance}
						filename={`yields-${poolId}-growth`}
						csvSource={{ type: 'dataset', prepare: () => dataset }}
					/>
				</div>
			</PanelHeader>

			{!loading && !error && summary ? (
				<GrowthReadout summary={summary} deposit={deposit} digits={digits} setQuery={setQuery} />
			) : null}

			{/* The toolbar exists only to clear a pinned deposit day, so it appears only with one. */}
			{anchorDate ? (
				<ChartPanelToolbar>
					<Tooltip
						content="Clear the chosen deposit day and go back to the start of the selected range"
						render={
							<button
								type="button"
								aria-label="Clear the chosen deposit day"
								onClick={() => setQuery({ growthFrom: undefined })}
								className={metricSeriesToggleStyles}
								data-active
							/>
						}
					>
						<span className="flex items-center gap-1">
							Deposited {anchoredOn ?? anchorDate}
							<Icon name="x" height={12} width={12} />
						</span>
					</Tooltip>
				</ChartPanelToolbar>
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
				) : !anchoredOn ? (
					<ChartPanelBodyFallback className="body-sm text-tertiary">
						No measured redemptions in this range.
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
							valueSymbol="$"
							containerClassName={CHART_FILL.default}
							hideDefaultLegend
							exportButtons="hidden"
							// The slider only narrows the view: the line still rebases at the anchor and the
							// readout follows the range control. Options apply with `notMerge`, so a rebase or
							// a new deposit resets the zoom to the full window.
							onReady={setInstance}
						/>
					</Suspense>
				)}
			</ChartPanelBody>
		</>
	)
}
