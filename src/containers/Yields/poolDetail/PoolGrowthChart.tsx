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
import { ChartPanelBody, ChartPanelBodyFallback, CHART_FILL } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { metricSeriesToggleStyles } from '~/ui/MetricChip'
import { PanelHeader, PanelTitle } from '~/ui/Panel'
import { LoadingIndicator } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import {
	formatNumber,
	formatPercent,
	formatUsd,
	type FormatPercentOptions,
	type FormatUsdOptions
} from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import {
	buildCombinedSummary,
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
	selectGrowthDrawdown,
	type GrowthChartModel,
	type GrowthCombinedSummary,
	type IntrinsicSourceSeries,
	type GrowthGapKind,
	type GrowthSummary
} from './growthChart'
import { CHART_PALETTE } from './poolCharts'
import { buildBandMarkArea, isoDay, rangeCount } from './poolChartUtils'
import { PoolRangeControl } from './PoolRangeControl'
import {
	getBooleanOverride,
	getGrowthAnchorDate,
	getGrowthDeposit,
	getGrowthDepositQueryValue,
	getPoolHistoryRange,
	getPoolRangeQueryKey,
	getPoolSeriesQueryKey,
	getSeriesVisibility,
	GROWTH_MAX_DEPOSIT
} from './queryState'
import { readoutBlockStyles, readoutCellsStyles, ReadoutCell, readoutInputStyles, SeriesMark } from './readout'
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

const VERIFIED_NAME = 'This pool'
// The protocol's quoted rate where the exit could not price the position: its own series, dashed
// with hollow markers, so it can never be read as the executed line.
const QUOTED_NAME = 'Quoted'
// Stacked on the pool's band, not a second line beside it: the two are halves of one return.
// Dashed on top, which in this chart means "not an executed measurement".
const ASSET_FALLBACK_NAME = 'the deposit token'
// Off by default: the chart's premise is measurement.
const INTRINSIC_QUERY_KEY = getPoolSeriesQueryKey('growth', 'intrinsic')
const INTRINSIC_DEFAULT_ON = false
// The quoted line stays outside this stack.
const GROWTH_STACK = 'growth'

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
	isDark: boolean,
	withIntrinsic: boolean,
	assetName: string
): {
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	// The day the deposit was actually made, after snapping to a measured day. Null when the
	// window holds no measurement at all.
	anchoredOn: string | null
	summary: GrowthSummary | null
	// Null whenever that line isn't drawn.
	combinedSummary: GrowthCombinedSummary | null
	// The deposit, so band heights read as money made.
	axisMin: number
	// Decimals the y-axis needs for this window; fewer and the ticks print duplicate labels.
	axisDigits: number
} {
	const shade = (key: 'accent' | 'intrinsic') => CHART_PALETTE[key][isDark ? 1 : 0]
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
	const series = buildGrowthSeries(model, start, total)
	const { anchor, measured, quoted, asset } = series
	// No intrinsic leg means no toggle, so a stale `growthIntrinsic=true` draws nothing.
	const showIntrinsic = withIntrinsic && model.hasIntrinsic

	// Shade the long breaks so a substantial dark stretch reads as "something happened here" instead
	// of as a rendering glitch. The per-day tooltip supplies the detail on hover, so the band itself
	// stays silent.
	const gaps = buildGrowthGaps(model, anchor, total)
	const bands = gaps.filter((gap) => gap.days >= GAP_BAND_MIN_DAYS)
	const markArea = buildBandMarkArea(bands, GAP_BAND_FILL, isDark)

	const dimensions = showIntrinsic
		? ['timestamp', VERIFIED_NAME, QUOTED_NAME, assetName]
		: ['timestamp', VERIFIED_NAME, QUOTED_NAME]
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
			...(showIntrinsic ? { stack: GROWTH_STACK, stackStrategy: 'all' as const } : {}),
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

	// Fills down to the measured line, so the filled height is exactly what the asset added and the
	// line below keeps its own reading.
	if (showIntrinsic) {
		charts.push({
			type: 'line',
			name: assetName,
			encode: { x: 0, y: 3 },
			color: shade('intrinsic'),
			valueSymbol: '$',
			stack: GROWTH_STACK,
			// A losing asset must subtract from the pool's line, not restart the stack at zero.
			stackStrategy: 'all',
			areaStyle: { color: shade('intrinsic'), opacity: 0.5 },
			lineStyle: { width: 1 },
			connectNulls: false
		})
	}

	// The series math is unit-free multiples; the deposit is applied once, here.
	const scale = (value: number | null) => (value == null ? null : value * deposit)
	const rows = new Array<MultiSeriesChartDataset['source'][number]>(total - start)
	for (let sourceIndex = start, rowIndex = 0; sourceIndex < total; sourceIndex++, rowIndex++) {
		// Column 3 is the CONTRIBUTION, not the total: the stack sums it.
		rows[rowIndex] = showIntrinsic
			? [model.dates[sourceIndex], scale(measured[rowIndex]), scale(quoted[rowIndex]), scale(asset[rowIndex])]
			: [model.dates[sourceIndex], scale(measured[rowIndex]), scale(quoted[rowIndex])]
	}

	let low = Number.POSITIVE_INFINITY
	let high = Number.NEGATIVE_INFINITY
	for (const row of rows) {
		const base = typeof row[1] === 'number' ? row[1] : null
		const band = typeof row[3] === 'number' ? row[3] : null
		// The stacked top, since that is what the axis must fit.
		const stackedTop = base != null && band != null ? base + band : null
		for (const value of [row[1], row[2], stackedTop]) {
			if (typeof value !== 'number') continue
			if (value < low) low = value
			if (value > high) high = value
		}
	}
	// The deposit floor is what makes a band's height the money it made; a loss pushes it lower.
	const axisMin = Math.min(deposit, Number.isFinite(low) ? low : deposit)
	const span = Number.isFinite(high - axisMin) ? high - axisMin : 0

	return {
		dataset: { source: rows, dimensions },
		charts,
		anchoredOn: anchor === -1 ? null : isoDay(model.dates[anchor]),
		summary: buildGrowthSummary(model, anchor, total, deposit),
		combinedSummary: showIntrinsic ? buildCombinedSummary(model, series, start, total, deposit) : null,
		axisMin,
		axisDigits: growthAxisDigits(span)
	}
}

function buildTooltipFormatter(model: GrowthChartModel, digits: number, assetName: string) {
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

		// Shown signed, with the total stated outright: unadded stacks are how stacks get misread.
		const assetItem = items.find((candidate) => candidate.seriesName === assetName)
		const assetValue = assetItem ? valueOf(assetItem) : null
		if (assetItem && assetValue != null && value != null) {
			html += li(
				`${assetItem.marker} ${assetName}: ${formatUsd(assetValue, { ...valueOptions, signDisplay: 'exceptZero' })}`
			)
			html += li(`<span style="opacity:0.7">Total: ${formatUsd(value + assetValue, valueOptions)}</span>`)
		}

		const outcome = outcomeByDate.get(timestamp)
		if (outcome) html += li(`<span style="opacity:0.7">${outcome}</span>`)

		return html
	}
}

/** A band's legend key: its mark, what it contributed, and that contribution as an annual rate. */
function LedgerEntry({
	swatch,
	label,
	hint,
	gain,
	rate,
	money,
	percent,
	mark = 'line'
}: {
	swatch: string
	label: string
	hint: string
	gain: number
	rate: number | null
	money: FormatUsdOptions
	percent: FormatPercentOptions
	/** Matches how the series is drawn: a rule for the line, a block for the filled band. */
	mark?: 'line' | 'block'
}) {
	return (
		<ReadoutCell
			hint={hint}
			label={
				<>
					<SeriesMark color={swatch} shape={mark} />
					{label}
				</>
			}
		>
			{/* Ink, not the series colour: the swatch already carries identity. */}
			<span className="mono-sm-bold text-primary">{formatUsd(gain, { ...money, signDisplay: 'exceptZero' })}</span>
			{rate == null ? null : <span className="body-sm text-tertiary">{formatPercent(rate, percent)} APY</span>}
		</ReadoutCell>
	)
}

const DEPOSIT_INPUT_ID = 'growth-deposit-amount'

// The answer to the question the chart asks, in words — so the user doesn't have to hover the last
// point and do the arithmetic. A measured loss is stated as plainly as a gain.
function GrowthReadout({
	summary,
	anchoredOn,
	anchorDate,
	combined,
	assetName,
	colors,
	hasIntrinsic,
	deposit,
	digits,
	setQuery
}: {
	summary: GrowthSummary | null
	/** The day the line is anchored to, after snapping to a measured day. */
	anchoredOn: string | null
	/** The day the reader pinned, if any. Only a pinned day can be cleared. */
	anchorDate: string | null
	/** Null when that line isn't drawn. */
	combined: GrowthCombinedSummary | null
	/** The intrinsic source pool's symbol, where there is one. */
	assetName: string
	/** Shared with the plot so the legend cannot drift. */
	colors: { pool: string; asset: string }
	/** Whether there is an asset leg to fold in, which is what makes its absence worth stating. */
	hasIntrinsic: boolean
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

	// Whatever the chart is actually drawing.
	const total = combined ?? summary
	const toneClass = (total?.gain ?? 0) < 0 ? 'text-(--yield-negative-text)' : 'text-(--yield-positive-text)'

	const drawdown = summary ? selectGrowthDrawdown(summary, combined) : null
	// Dust is not a dip. Only a fall a holder would actually have felt earns a place here.
	const showDrawdown = drawdown != null && drawdown.pct <= DRAWDOWN_DISPLAY_THRESHOLD_PCT

	return (
		<div className={`${readoutBlockStyles} ${readoutCellsStyles}`}>
			{/* Also the chart's legend: the mark beside each figure is what names a band. */}
			{combined ? (
				<LedgerEntry
					swatch={colors.pool}
					label="This pool"
					hint="What the pool itself earned, measured by simulating a real withdrawal on-chain each day."
					gain={combined.poolGain}
					rate={combined.poolAnnualizedPct}
					money={money}
					percent={percent}
				/>
			) : null}
			{combined ? (
				<LedgerEntry
					swatch={colors.asset}
					mark="block"
					label={assetName}
					hint={`What ${assetName} earned by itself, which it would have done in any pool. Measured the same way as the pool's own figure, by simulating a withdrawal from ${assetName} each day.`}
					gain={combined.assetGain}
					rate={combined.assetAnnualizedPct}
					money={money}
					percent={percent}
				/>
			) : null}
			{total ? (
				<ReadoutCell
					label="Became"
					hint={`What the deposit grew to, counting only the yield shown here. No price move is included, so this is not a portfolio value.${
						combined && summary && combined.asOf < summary.to
							? ` Taken at ${isoDay(combined.asOf)}, the last day both legs were measured.`
							: ''
					}`}
				>
					<span className={`mono-md-bold ${toneClass}`}>{formatUsd(total.endValue, money)}</span>
					<span className={`mono-sm ${toneClass}`}>
						{formatPercent(total.returnPct, { ...percent, signDisplay: 'exceptZero' })}
					</span>
				</ReadoutCell>
			) : null}
			{/* One band: the split would repeat this figure, so the rate only gets its own cell here. */}
			{total && combined == null && summary?.annualizedPct != null ? (
				<ReadoutCell label="Annualized">
					<span className="mono-sm-bold text-primary">{formatPercent(summary.annualizedPct, percent)}</span>
				</ReadoutCell>
			) : null}
			{total ? (
				<ReadoutCell label="Held">
					<span className="mono-sm-bold text-primary">
						{formatNumber(total.days)} {total.days === 1 ? 'day' : 'days'}
					</span>
				</ReadoutCell>
			) : null}
			{total && combined == null && hasIntrinsic ? (
				<ReadoutCell label="Excludes">
					<span className="body-sm text-tertiary">{assetName}&apos;s own yield</span>
				</ReadoutCell>
			) : null}
			{showDrawdown ? (
				<ReadoutCell
					label="Worst drawdown"
					hint={`Deepest fall from a previous high: peak ${isoDay(drawdown.peakDate)}, low ${isoDay(
						drawdown.troughDate
					)}. ${drawdown.recovered ? 'The value has since made the dip back.' : 'The value is still below that peak.'}`}
				>
					<span className={`mono-sm-bold ${drawdown.recovered ? 'text-primary' : 'text-(--yield-negative-text)'}`}>
						<span aria-hidden>▼ </span>
						{formatPercent(Math.abs(drawdown.pct), percent)}
					</span>
					{drawdown.recovered ? <span className="body-sm text-tertiary">recovered</span> : null}
				</ReadoutCell>
			) : null}

			<ReadoutCell
				className="ml-auto"
				hint="A hypothetical size. It scales the figures; the percentages are the same at any amount."
				label={<label htmlFor={DEPOSIT_INPUT_ID}>Deposit</label>}
			>
				<span className="body-sm text-tertiary">$</span>
				<input
					id={DEPOSIT_INPUT_ID}
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
					className={`${readoutInputStyles} w-24`}
					aria-label="Hypothetical deposit amount in dollars"
				/>
			</ReadoutCell>
			{/* Shown whether or not a day was picked: the line always starts on the first day actually
			    measured, which a reader otherwise has no way of knowing. */}
			{anchoredOn ? (
				<ReadoutCell
					label="Deposited"
					hint="The day the line starts from. Click anywhere on the chart to move it, and it settles on the next day we measured."
				>
					<span className="mono-sm-bold text-primary">{anchoredOn}</span>
					{anchorDate ? (
						<Tooltip
							content="Clear the chosen day and go back to the start of this range"
							render={
								<button
									type="button"
									aria-label="Clear the chosen deposit day"
									onClick={() => setQuery({ growthFrom: undefined })}
									className="flex items-center rounded-full p-0.5 text-tertiary hover:text-primary focus-visible:focus-ring"
								/>
							}
						>
							<Icon name="x" height={12} width={12} />
						</Tooltip>
					) : null}
				</ReadoutCell>
			) : null}
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
	initialRange = 'max',
	intrinsicSymbol = null,
	intrinsicSeries = null
}: {
	model: GrowthChartModel
	poolId: string
	initialRange?: PoolHistoryRange
	/** Names the second band for the asset it represents. */
	intrinsicSymbol?: string | null
	/** The source pool's measured rates, keyed by date, so a range change can rebuild the band. */
	intrinsicSeries?: IntrinsicSourceSeries | null
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
		(next) => fetchHistory(next).then((history) => buildGrowthChart(history, intrinsicSeries)),
		!historyAccessPending
	)
	const [instance, setInstance] = useState<echarts.ECharts | null>(null)
	const anchorDate = getGrowthAnchorDate(router.query.growthFrom)
	const deposit = getGrowthDeposit(router.query.deposit)
	const withIntrinsic = getSeriesVisibility(router.query[INTRINSIC_QUERY_KEY], INTRINSIC_DEFAULT_ON)
	const digits = growthFractionDigits(deposit)
	const assetName = intrinsicSymbol ?? ASSET_FALLBACK_NAME
	// Shared by the plot and the legend so the two cannot disagree.
	const colors = {
		pool: CHART_PALETTE.accent[isDark ? 1 : 0],
		asset: CHART_PALETTE.intrinsic[isDark ? 1 : 0]
	}

	// MultiSeriesChart reapplies its ECharts model when these input references change, so keep
	// them stable across unrelated renders.
	const { dataset, charts, anchoredOn, summary, combinedSummary, axisMin, axisDigits } = useMemo(
		() => buildChartInputs(currentModel, range, deposit, anchorDate, isDark, withIntrinsic, assetName),
		[anchorDate, assetName, currentModel, deposit, isDark, range, withIntrinsic]
	)
	const chartOptions = useMemo(
		() => ({
			tooltip: { formatter: buildTooltipFormatter(currentModel, digits, assetName) },
			// Anchored at the deposit, not zero (which flattens) or the data's low (an arbitrary base).
			// Only the floor is pinned, so the top still breathes with the data.
			yAxis: {
				min: axisMin,
				scale: true,
				axisLabel: {
					formatter: (value: number) =>
						formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, maximumFractionDigits: axisDigits })
				}
			}
		}),
		[assetName, axisDigits, axisMin, currentModel, digits]
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
					{/* Only where the pool has an intrinsic leg. */}
					{currentModel.hasIntrinsic ? (
						<Tooltip
							content={`Stack what ${assetName} earned by itself on top of what the pool earned, both measured on-chain. Its price move is still not drawn.`}
						>
							<button
								type="button"
								aria-pressed={withIntrinsic}
								onClick={() =>
									setQuery({ [INTRINSIC_QUERY_KEY]: getBooleanOverride(!withIntrinsic, INTRINSIC_DEFAULT_ON) })
								}
								className={metricSeriesToggleStyles}
								data-active={withIntrinsic}
							>
								{intrinsicSymbol ? `${intrinsicSymbol} yield` : 'Asset yield'}
							</button>
						</Tooltip>
					) : null}
					<PoolRangeControl kind="growth" />
					<ChartExportButtons
						chartInstance={() => instance}
						filename={`yields-${poolId}-growth`}
						csvSource={{ type: 'dataset', prepare: () => dataset }}
					/>
				</div>
			</PanelHeader>

			{!loading && !error ? (
				<GrowthReadout
					summary={summary}
					anchoredOn={anchoredOn}
					anchorDate={anchorDate}
					combined={combinedSummary}
					assetName={assetName}
					colors={colors}
					hasIntrinsic={currentModel.hasIntrinsic}
					deposit={deposit}
					digits={digits}
					setQuery={setQuery}
				/>
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
