import * as Ariakit from '@ariakit/react'
import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import { lazy, Suspense, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
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
import { Change } from '~/ui/Change'
import {
	CHART_FILL,
	ChartPanelBody,
	ChartPanelBodyEmpty,
	ChartPanelBodyError,
	ChartPanelBodyLoading
} from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { metricSeriesToggleStyles } from '~/ui/MetricChip'
import { PanelHeader, PanelTitle } from '~/ui/Panel'
import { popoverRowStyles } from '~/ui/Popover'
import { DrawerDismiss, PopoverSurface } from '~/ui/PopoverSurface'
import { Tooltip } from '~/ui/Tooltip'
import { formatDate } from '~/utils/dateFormat'
import { formatPercent, formatUsd, type FormatPercentOptions, type FormatUsdOptions } from '~/utils/numberFormat'
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
import {
	getBooleanOverride,
	getGrowthAnchorDate,
	getGrowthDeposit,
	getGrowthDepositQueryValue,
	getPoolHistoryRange,
	getPoolRangeQueryKey,
	getPoolSeriesQueryKey,
	getRangeQueryValue,
	getSeriesVisibility,
	GROWTH_MAX_DEPOSIT
} from './queryState'
import { ReadoutCell, readoutFieldStyles, SeriesMark } from './readout'
import { getChartTooltipItems, getChartTooltipValue, type ChartTooltipItem } from './tooltip'
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
	const summary = buildGrowthSummary(model, anchor, total, deposit)
	const combinedSummary = showIntrinsic ? buildCombinedSummary(model, series, start, total, deposit) : null
	// The answer, drawn where the line ends, so the plot and the sentence above it say one number.
	const endValue = (combinedSummary ?? summary)?.endValue ?? null
	const digits = growthFractionDigits(deposit)
	const endLabel = { minimumFractionDigits: digits, maximumFractionDigits: digits }

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
			...(markArea ? { markArea } : {}),
			...(endValue != null
				? {
						markLine: {
							silent: true,
							symbol: 'none',
							lineStyle: { type: 'dotted', width: 1, color: shade('accent'), opacity: 0.7 },
							label: {
								show: true,
								position: 'insideEndTop',
								formatter: () => formatUsd(endValue, endLabel),
								color: shade('accent'),
								fontSize: 11,
								fontWeight: 600
							},
							data: [{ yAxis: endValue }]
						}
					}
				: {})
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
		summary,
		combinedSummary,
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

		const timestamp = getTooltipAxisValue(items[0])
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
			html += li(
				`<span style="opacity:0.7">Quoted — exit not executable that day${reason ? `: ${escapeHtml(reason)}` : ''}</span>`
			)
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
				`${assetItem.marker} ${escapeHtml(assetName)}: ${formatUsd(assetValue, { ...valueOptions, signDisplay: 'exceptZero' })}`
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

const SINCE_OPTIONS = [
	{ value: '30d', label: '30 days ago' },
	{ value: '90d', label: '90 days ago' },
	{ value: 'max', label: 'First day measured' }
] as const satisfies ReadonlyArray<{ value: PoolHistoryRange; label: string }>

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
	range,
	firstDay,
	lastDay,
	presetDays,
	setQuery
}: {
	summary: GrowthSummary | null
	/** The day the line is anchored to, after snapping to a measured day. */
	anchoredOn: string | null
	/** The day the reader pinned, if any. */
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
	range: PoolHistoryRange
	/** The days a deposit can be pinned to: first measured to last measured. */
	firstDay: string | null
	lastDay: string | null
	/** The day each preset lands on, so the rows say what they will do. */
	presetDays: Record<PoolHistoryRange, string | null>
	setQuery: (next: Record<string, string | undefined>) => void
}) {
	const [depositText, setDepositText, depositFocus] = useQueryDraft(deposit, getGrowthDeposit)
	const commitDeposit = useDebouncedCallback(
		(text: string) => setQuery({ deposit: getGrowthDepositQueryValue(getGrowthDeposit(text)) }),
		300
	)
	// Full dollars: compacting past a million turns $1,163,213 into the $1M it started as.
	const money = { minimumFractionDigits: digits, maximumFractionDigits: digits } as const
	const percent = { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 } as const
	const rangeKey = getPoolRangeQueryKey('growth')

	// Whatever the chart is actually drawing.
	const total = combined ?? summary
	const annualized = combined == null ? summary?.annualizedPct : null

	const drawdown = summary ? selectGrowthDrawdown(summary, combined) : null
	// Dust is not a dip. Only a fall a holder would actually have felt earns a place here.
	const showDrawdown = drawdown != null && drawdown.pct <= DRAWDOWN_DISPLAY_THRESHOLD_PCT

	return (
		<div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-4 py-2.5">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-2 body-md text-secondary">
				<label htmlFor={DEPOSIT_INPUT_ID}>If you had deposited</label>
				<span className={`${readoutFieldStyles} inline-flex items-center gap-1`}>
					<span className="text-tertiary">$</span>
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
						className="w-24 bg-transparent p-0 mono-md text-primary outline-hidden"
						aria-label="Hypothetical deposit amount in dollars"
					/>
				</span>
				<span>on</span>
				<Ariakit.PopoverProvider placement="bottom-start">
					<Ariakit.PopoverDisclosure
						// The sentence's "on" names it for sighted readers only; the name says what the date sets.
						aria-label={`Deposit day: ${anchoredOn ? (formatDate(anchoredOn) ?? anchoredOn) : 'not set'}`}
						className={`${readoutFieldStyles} inline-flex items-center gap-1.5`}
					>
						{anchoredOn ? (formatDate(anchoredOn) ?? anchoredOn) : '—'}
						<Ariakit.PopoverDisclosureArrow className="size-3.5 shrink-0 text-tertiary" />
					</Ariakit.PopoverDisclosure>
					<PopoverSurface variant="panel" dismiss="own" className="sm:w-72">
						<div className="flex items-center justify-between gap-2 border-b border-subtle py-1 pr-1 pl-3">
							<Ariakit.PopoverHeading className="label-md text-primary">Deposit day</Ariakit.PopoverHeading>
							<DrawerDismiss label="Close deposit day" />
						</div>
						<div className="flex flex-col py-1">
							{SINCE_OPTIONS.map((option) => {
								const active = !anchorDate && range === option.value
								const day = presetDays[option.value]
								return (
									<Ariakit.PopoverDismiss
										key={option.value}
										className={popoverRowStyles}
										aria-current={active ? 'true' : undefined}
										onClick={() => setQuery({ [rangeKey]: getRangeQueryValue(option.value), growthFrom: undefined })}
									>
										<span className="flex items-baseline gap-2">
											<span className={active ? 'text-primary' : 'text-secondary'}>{option.label}</span>
											{day ? <span className="mono-sm text-tertiary">{formatDate(day) ?? day}</span> : null}
										</span>
										{active ? <Icon name="check" className="size-3.5 shrink-0 text-primary" aria-hidden /> : null}
									</Ariakit.PopoverDismiss>
								)
							})}
						</div>
						<label className="flex flex-col gap-1.5 border-t border-subtle px-3 py-3 label-sm text-secondary">
							Or pick a day
							<Input
								type="date"
								value={anchoredOn ?? ''}
								{...(firstDay ? { min: firstDay } : {})}
								{...(lastDay ? { max: lastDay } : {})}
								onChange={(event) => setQuery({ growthFrom: event.target.value || undefined, [rangeKey]: undefined })}
								className="cursor-pointer"
							/>
						</label>
					</PopoverSurface>
				</Ariakit.PopoverProvider>
			</div>

			{total ? (
				<ReadoutCell
					label="You would have today"
					hint={`Counting only the yield shown here. No price move is included, so this is not a portfolio value.${
						combined && summary && combined.asOf < summary.to
							? ` Taken at ${isoDay(combined.asOf)}, the last day both legs were measured.`
							: ''
					}`}
				>
					<span className="mono-xl text-primary">{formatUsd(total.endValue, money)}</span>
				</ReadoutCell>
			) : null}
			{total ? (
				<ReadoutCell label="Total return">
					<span className="mono-xl">
						<Change value={total.returnPct} />
					</span>
				</ReadoutCell>
			) : null}
			{annualized != null ? (
				<ReadoutCell label="Annualized">
					<span className="mono-xl text-primary">{formatPercent(annualized, percent)}</span>
				</ReadoutCell>
			) : null}

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
		</div>
	)
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
		failedRead
	} = useWidestHistory(
		initialRange,
		model,
		range,
		(next) => fetchHistory(next).then(({ history }) => buildGrowthChart(history, intrinsicSeries)),
		!historyAccessPending
	)
	const [instance, setInstance] = useState<echarts.ECharts | null>(null)
	const anchorDate = getGrowthAnchorDate(router.query.growthFrom)
	const deposit = getGrowthDeposit(router.query.deposit)
	const withIntrinsic = getSeriesVisibility(router.query[INTRINSIC_QUERY_KEY], INTRINSIC_DEFAULT_ON)
	const digits = growthFractionDigits(deposit)
	const assetName = intrinsicSymbol ?? ASSET_FALLBACK_NAME
	const firstMeasured = firstMeasuredIndex(currentModel, 0, currentModel.dates.length)
	const firstDay = firstMeasured === -1 ? null : isoDay(currentModel.dates[firstMeasured])
	const lastDay = currentModel.dates.length > 0 ? isoDay(currentModel.dates[currentModel.dates.length - 1]) : null
	const presetDay = (preset: PoolHistoryRange): string | null => {
		const total = currentModel.dates.length
		const index = firstMeasuredIndex(currentModel, total - rangeCount(preset, total), total)
		return index === -1 ? null : isoDay(currentModel.dates[index])
	}
	const presetDays: Record<PoolHistoryRange, string | null> = {
		'30d': presetDay('30d'),
		'90d': presetDay('90d'),
		max: firstDay
	}
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
						formatUsd(value, { minimumFractionDigits: axisDigits, maximumFractionDigits: axisDigits })
				}
			}
		}),
		[assetName, axisDigits, axisMin, currentModel, digits]
	)

	const setQuery = (patch: Record<string, string | undefined>) => {
		void pushShallowQuery(router, patch, router.pathname)
	}

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
							render={
								<button
									type="button"
									aria-pressed={withIntrinsic}
									onClick={() =>
										setQuery({ [INTRINSIC_QUERY_KEY]: getBooleanOverride(!withIntrinsic, INTRINSIC_DEFAULT_ON) })
									}
									className={metricSeriesToggleStyles}
									data-active={withIntrinsic}
								/>
							}
						>
							{intrinsicSymbol ? `${intrinsicSymbol} yield` : 'Asset yield'}
						</Tooltip>
					) : null}
					<ChartExportButtons
						chartInstance={() => instance}
						filename={`yields-${poolId}-growth`}
						csvSource={{ type: 'dataset', prepare: () => dataset }}
					/>
				</div>
			</PanelHeader>

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
				range={range}
				firstDay={firstDay}
				lastDay={lastDay}
				presetDays={presetDays}
				setQuery={setQuery}
			/>

			<ChartPanelBody>
				{failedRead ? (
					<ChartPanelBodyError retry={failedRead}>Couldn&apos;t load {range} history.</ChartPanelBodyError>
				) : loading ? (
					<ChartPanelBodyLoading label={`Loading ${range} history`} />
				) : !anchoredOn ? (
					<ChartPanelBodyEmpty>No measured redemptions in this range.</ChartPanelBodyEmpty>
				) : (
					<Suspense fallback={<ChartPanelBodyLoading />}>
						<MultiSeriesChart
							dataset={dataset}
							charts={charts}
							chartOptions={chartOptions}
							valueSymbol="$"
							containerClassName={CHART_FILL}
							exportButtons="hidden"
							// The slider only narrows the view; options apply with `notMerge`, so a new day or deposit resets the zoom.
							onReady={setInstance}
						/>
					</Suspense>
				)}
			</ChartPanelBody>
		</>
	)
}
