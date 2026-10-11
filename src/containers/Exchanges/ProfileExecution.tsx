import { useState, type CSSProperties, type ReactNode } from 'react'
import { HEAT_DOWN } from '~/constants/colors'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { StatusBadge } from '~/ui/StatusBadge'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import { MethodologyLink } from './docsLinks'
import {
	EXCHANGE_SEGMENT_LABELS,
	type ExchangeExecutionFeedHealth,
	type ExchangeMarketExecution,
	type ExchangePairModel,
	type ExchangeProfileModel,
	type ExchangeSegment
} from './models'

// Execution metrics are one-way bps figures; 1bp of $10k is exactly $1, so bps values
// render as dollars at the reference size — the framing regular users reason in.

// Spreads read most naturally as a percentage of price, not dollars.
export const pctOfBps = (bps: number | null) => {
	if (bps == null) return 'n/a'
	const pct = bps / 100
	const digits = pct >= 0.1 ? 2 : pct >= 0.01 ? 3 : 4
	return formatPercent(pct, { input: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export const NA = <span className="text-tertiary">n/a</span>

/** Exchange change fields arrive as fractions (0.05), so the cell owns the ×100 for Change. */
export function FractionChange({ value }: { value: number | null | undefined }) {
	return value == null ? <span className="text-tertiary">–</span> : <Change value={value * 100} />
}

export function SlippagePair({ predicted, actual }: { predicted: number | null; actual: number | null }) {
	if (actual == null) return NA
	return (
		<span className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
			{predicted == null ? null : (
				<span className="whitespace-nowrap text-tertiary">{`p ${formatUsd(predicted, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'} →`}</span>
			)}
			<span className="whitespace-nowrap">
				{formatUsd(actual, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'}
			</span>
		</span>
	)
}

export function Markout({ value }: { value: number | null }) {
	if (value == null) return NA
	return (
		<span className={value > 0 ? 'text-data-down' : 'text-data-up'}>
			{formatUsd(value, { signDisplay: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
		</span>
	)
}

/**
 * A size ladder or a set of horizons in one column, each rung labeled. A column apiece
 * would push the liquidity figures off the row; one unlabeled line would not say which
 * size or horizon it meant.
 */
export function StackedRows({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
	return (
		<span className="flex flex-col items-end gap-0.5 leading-tight">
			{rows.map((row) => (
				<span key={row.label} className="flex items-center justify-end gap-1.5 whitespace-nowrap">
					<span className="label-sm text-tertiary">{row.label}</span>
					{row.value}
				</span>
			))}
		</span>
	)
}

/**
 * Intra-spread volume: the share of measured volume printed strictly inside the spread the
 * book showed, at a price no displayed order offered. Honest books print 0.1–2%. Below
 * INSIDE_MIN_PCT it is mostly a coarse tick grid or clock jitter, a false flag, so nothing is
 * shown; from INSIDE_NOTE_PCT it is worth a look, from INSIDE_WARN_PCT a large part of the
 * volume did not trade against the book on show.
 */
export const INSIDE_MIN_PCT = 2.5
export const INSIDE_NOTE_PCT = 5
export const INSIDE_WARN_PCT = 10
export const insideShown = (pct: number | null | undefined): number | null =>
	pct != null && pct >= INSIDE_MIN_PCT ? pct : null

export function IntraSpread({ pct }: { pct: number | null | undefined }) {
	const shown = insideShown(pct)
	if (shown == null) return null
	const text = formatPercent(shown, { input: 'percent', maximumFractionDigits: shown >= 10 ? 0 : 1 })
	if (shown >= INSIDE_WARN_PCT) {
		return (
			<Tooltip
				content="A large share of this volume did not trade against the order book on show."
				className="ms-auto w-fit"
			>
				<span className="flex items-center gap-1 text-warning">
					<Icon name="alert-triangle" className="size-3.5" aria-hidden="true" />
					{text}
				</span>
			</Tooltip>
		)
	}
	return <span className={shown >= INSIDE_NOTE_PCT ? 'text-warning' : undefined}>{text}</span>
}

/** bps at a reference size, read at a multiple of it: $100k is ten $10k units. */
const scaleBps = (bps: number | null, units: number) => (bps == null ? null : bps * units)

/** The slippage fields both the listing row and the per-token row carry. */
interface SlippageLadderValues {
	predictedSlippage10kBps: number | null
	realizedSlippage10kBps: number | null
	predictedSlippage100kBps: number | null
	realizedSlippage100kBps: number | null
}

/**
 * $10k and $100k rungs of the same measurement. bps are per unit of notional, so the
 * $100k rung is the same bps read at ten times the size; dollars at each rung's own
 * size is what makes the two lines comparable for someone thinking in order size.
 */
export function SlippageLadder({ execution }: { execution: SlippageLadderValues | null }) {
	if (execution?.realizedSlippage10kBps == null && execution?.realizedSlippage100kBps == null) return NA
	return (
		<StackedRows
			rows={[
				{
					label: '$10k',
					value: (
						<SlippagePair
							predicted={execution?.predictedSlippage10kBps ?? null}
							actual={execution?.realizedSlippage10kBps ?? null}
						/>
					)
				},
				{
					label: '$100k',
					value: (
						<SlippagePair
							predicted={scaleBps(execution?.predictedSlippage100kBps ?? null, 10)}
							actual={scaleBps(execution?.realizedSlippage100kBps ?? null, 10)}
						/>
					)
				}
			]}
		/>
	)
}

/** Markout at one and five minutes, the two horizons both listing surfaces show. */
export function MarkoutHorizons({
	execution
}: {
	execution: { markout1mBps: number | null; markout5mBps: number | null } | null
}) {
	if (execution?.markout1mBps == null && execution?.markout5mBps == null) return NA
	return (
		<StackedRows
			rows={[
				{ label: '1m', value: <Markout value={execution?.markout1mBps ?? null} /> },
				{ label: '5m', value: <Markout value={execution?.markout5mBps ?? null} /> }
			]}
		/>
	)
}

const gapMs = (value: number) =>
	value >= 1000
		? `${formatNumber(value / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}s`
		: `${formatNumber(value, { maximumFractionDigits: 0 })}ms`

/** Feed latency detail: how fast the venue's public BTC order book feed updates,
 * from our own tick capture. Display-only; a slow or degraded reading never enters
 * the ranking, because it cannot be separated from publishing policy or a capture
 * problem on our side. */
function FeedHealth({ feed }: { feed: ExchangeExecutionFeedHealth }) {
	const stats = [
		{
			label: 'Typical update gap',
			value: `~${gapMs(feed.avgGapMs)}`,
			help: 'Elapsed time divided by book updates, so bursts of same-instant updates do not distort it.'
		},
		{
			label: 'Slowest 1% of gaps',
			value: gapMs(feed.p99GapMs),
			help: '99% of book updates arrived faster than this.'
		},
		{
			label: 'Longest gap',
			value: gapMs(feed.maxGapMs),
			help: 'The single longest wait between two book updates that day.'
		},
		{
			label: 'Feed downtime',
			value: feed.downtimeS > 0 ? `${Math.round(feed.downtimeS)}s` : 'none',
			help: 'Time the feed went silent long enough to count as an outage, not a quiet market.'
		}
	]
	return (
		<Card padding="sm" className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<h3 className="label-md">Order book feed speed</h3>
				<Tooltip
					content={`Latest measured day: ${feed.date}.`}
					className="w-fit cursor-help body-sm text-secondary underline decoration-dotted"
					tabIndex={0}
				>
					BTC perp book
				</Tooltip>
				{feed.degraded ? (
					<StatusBadge
						status="caution"
						tooltip="Outside the venue's normal range, which can also mean a capture problem on our side. Feed speed never affects the REAL score."
					>
						degraded day
					</StatusBadge>
				) : null}
			</div>
			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				{stats.map((stat) => (
					<div key={stat.label} className="flex flex-col gap-0.5">
						<Tooltip
							content={stat.help}
							className="w-fit cursor-help label-md text-secondary underline decoration-dotted"
							tabIndex={0}
						>
							{stat.label}
						</Tooltip>
						<span className="mono-xl">{stat.value}</span>
					</div>
				))}
			</div>
			<p className="body-sm text-tertiary">
				Measured from our own capture of the venue's public order book feed. Fast venues push many updates a second;
				some venues publish on a fixed interval by design, and a quiet market updates less because nothing changes, so
				this reflects the public feed, not order-processing speed. It is shown for transparency and never enters the
				REAL score.
			</p>
		</Card>
	)
}

/** Segments with at least one measured market, in tab order. */
export function measuredExecutionSegments(profile: ExchangeProfileModel): Array<ExchangeSegment> {
	return (['spot', 'linear_perp', 'inverse_perp'] as const).filter((segment) =>
		(profile.segments[segment]?.pairs ?? []).some((pair) => pair.execution)
	)
}

const SEGMENT_IN_TEXT: Record<ExchangeSegment, string> = {
	spot: 'spot',
	linear_perp: 'USD perps',
	inverse_perp: 'COIN perps'
}
/** bps of $10k read as dollars, two decimals. */
export const money = (bps: number) => formatUsd(bps, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'

export const SEGMENT_SHORT: Record<ExchangeSegment, string> = {
	spot: 'Spot',
	linear_perp: 'USD perp',
	inverse_perp: 'COIN perp'
}

/** One labeled line per segment, the stacked cell the merged tables use; N/A when there is none. */
export function SegmentLines({
	present,
	value
}: {
	present: ReadonlyArray<ExchangeSegment>
	value: (segment: ExchangeSegment) => ReactNode
}) {
	if (present.length === 0) return <span className="text-tertiary">N/A</span>
	return <StackedRows rows={present.map((segment) => ({ label: SEGMENT_SHORT[segment], value: value(segment) }))} />
}

/**
 * Light red on the dearer half of this table's markets, deeper the dearer; nothing on
 * the cheaper half, because a cheap reading next to a book that does not show what trades
 * is not good news. Mid-rank, so a figure every market shares (one fee) stays unshaded.
 */
function dearShade(values: Array<number | null>): (value: number | null) => CSSProperties | undefined {
	const sorted = values.filter((value): value is number => value != null).sort((a, b) => a - b)
	return (value) => {
		if (value == null || sorted.length < 3) return undefined
		const below = sorted.filter((other) => other < value).length
		const ties = sorted.filter((other) => other === value).length
		const rank = (below + (ties - 1) / 2) / (sorted.length - 1)
		const alpha = (rank - 0.5) * 0.18
		return alpha < 0.015
			? undefined
			: { backgroundColor: `color-mix(in srgb, ${HEAT_DOWN} ${Math.round(alpha * 1000) / 10}%, transparent)` }
	}
}
const insideShade = (pct: number | null): CSSProperties | undefined =>
	pct == null
		? undefined
		: pct >= INSIDE_WARN_PCT
			? { backgroundColor: `color-mix(in srgb, ${HEAT_DOWN} 9%, transparent)` }
			: pct >= INSIDE_NOTE_PCT
				? { backgroundColor: 'var(--bg-warning-tint)' }
				: undefined

interface ExecutionColumn {
	label: string
	help: string
	value: (execution: ExchangeMarketExecution) => number | null
	render: (execution: ExchangeMarketExecution) => ReactNode
	shade?: (value: number | null) => CSSProperties | undefined
}

function executionColumns(rows: Array<ExchangeMarketExecution>): Array<ExecutionColumn> {
	const bands = (rows[0]?.slippage ?? []).map((band, index) => ({ ...band, index }))
	const columns: Array<ExecutionColumn> = [
		{
			label: 'Cost to trade $10k',
			help: 'All-in cost of a $10k market order: base-tier taker fee plus half the effective spread. VIP tiers lower the fee part.',
			value: (execution) => execution.costToTradeBps,
			render: (execution) => (execution.costToTradeBps == null ? NA : money(execution.costToTradeBps))
		},
		{
			label: 'Spread',
			help: 'q = the spread the book quoted, then the spread trades actually paid (twice the gap between fill and mid), as a percentage of price.',
			value: (execution) => execution.effectiveSpreadBps,
			render: (execution) =>
				execution.effectiveSpreadBps == null ? (
					NA
				) : (
					<span className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
						{execution.quotedSpreadBps == null ? null : (
							<span className="whitespace-nowrap text-tertiary">{`q ${pctOfBps(execution.quotedSpreadBps)} →`}</span>
						)}
						<span>{pctOfBps(execution.effectiveSpreadBps)}</span>
					</span>
				)
		},
		{
			label: 'Intra-spread vol.',
			help: 'Share of measured volume printed inside the spread the book showed. Blank below 2.5%, amber from 5%, a warning from 10%.',
			value: (execution) => insideShown(execution.insideSpreadPct),
			render: (execution) => <IntraSpread pct={execution.insideSpreadPct} />,
			shade: insideShade
		},
		...bands
			.filter((band) => rows.some((row) => row.slippage[band.index]?.realizedBps != null))
			.map((band): ExecutionColumn => ({
				label: `Slippage ${band.size}`,
				help: `What the book before a ${band.size} order predicted, then what fills of that size paid, in dollars.`,
				value: (execution) => execution.slippage[band.index]?.realizedBps ?? null,
				render: (execution) => {
					const rung = execution.slippage[band.index]
					return (
						<SlippagePair
							predicted={rung?.predictedBps == null ? null : rung.predictedBps * band.units}
							actual={rung?.realizedBps == null ? null : rung.realizedBps * band.units}
						/>
					)
				}
			})),
		...(
			[
				['1s', 'markout1sBps'],
				['15s', 'markout15sBps'],
				['1m', 'markout1mBps'],
				['5m', 'markout5mBps']
			] as const
		).map(([horizon, field]): ExecutionColumn => ({
			label: `Markout ${horizon}`,
			help: `Where the price went ${horizon} after a fill, per $10k. Lower is better; positive means it kept moving against the taker.`,
			value: (execution) => execution[field],
			render: (execution) => <Markout value={execution[field]} />
		})),
		{
			label: 'Measured',
			help: 'Hours of tick coverage behind the trailing 30-day window.',
			value: (execution) => execution.hoursCovered,
			render: (execution) => <span className="text-tertiary">{`${execution.hoursCovered}h`}</span>,
			shade: () => undefined
		},
		{
			label: 'Taker fee',
			help: 'Base-tier taker fee the cost to trade includes.',
			value: (execution) => execution.takerFeeBps,
			render: (execution) => (execution.takerFeeBps == null ? NA : pctOfBps(execution.takerFeeBps))
		}
	]
	return columns.map((column) => ({ ...column, shade: column.shade ?? dearShade(rows.map(column.value)) }))
}

export function ProfileExecution({ profile }: { profile: ExchangeProfileModel }) {
	const segments = measuredExecutionSegments(profile)
	const [picked, setPicked] = useState<ExchangeSegment | null>(null)
	const segment =
		picked && segments.includes(picked)
			? picked
			: segments.includes('linear_perp')
				? 'linear_perp'
				: segments.includes('spot')
					? 'spot'
					: segments[0]
	if (!segment) return null
	const markets = (profile.segments[segment]?.pairs ?? [])
		.filter((pair): pair is ExchangePairModel & { execution: ExchangeMarketExecution } => pair.execution != null)
		.sort((a, b) => b.execution.notionalUsd - a.execution.notionalUsd)
	const columns = executionColumns(markets.map((pair) => pair.execution))
	const venue = profile.executionBySegment[segment]
	// The venue's own segment figure in the same shape, so it reads down the same columns. It
	// carries the $10k and $100k sizes only; the other columns stay blank on this row.
	const basket: ExchangeMarketExecution | null = venue
		? {
				...venue,
				quotedSpreadBps: null,
				takerFeeBps: null,
				markout1sBps: null,
				markout15sBps: null,
				notionalUsd: 0,
				insideMeasuredUsd: 0,
				slippage: (markets[0]?.execution.slippage ?? []).map((rung) => ({
					...rung,
					predictedBps:
						rung.size === '$10k'
							? venue.predictedSlippage10kBps
							: rung.size === '$100k'
								? venue.predictedSlippage100kBps
								: null,
					realizedBps:
						rung.size === '$10k'
							? venue.realizedSlippage10kBps
							: rung.size === '$100k'
								? venue.realizedSlippage100kBps
								: null
				}))
			}
		: null
	const costs = segments.flatMap((each) => {
		const cost = profile.executionBySegment[each]?.costToTradeBps
		return cost == null ? [] : [`${money(cost)} on ${SEGMENT_IN_TEXT[each]}`]
	})
	const measuredCount = segments.reduce(
		(count, each) => count + (profile.segments[each]?.pairs ?? []).filter((pair) => pair.execution).length,
		0
	)
	const cellClass = 'border-t border-subtle px-2 py-2 text-right whitespace-nowrap'
	return (
		<div className="flex flex-col gap-2">
			<Card padding="sm">
				<p className="body-md">
					{costs.length > 0 ? `A $10k market order costs about ${costs.join(', ')}, taker fee included. ` : ''}
					{`Measured on ${measuredCount} markets from every trade and the order book before it, over the last 30 days.`}{' '}
					<MethodologyLink />
				</p>
			</Card>
			<Card padding="none">
				<div className="flex items-center gap-2 p-2">
					<SegmentedControl<ExchangeSegment>
						value={segment}
						onValueChange={setPicked}
						options={segments.map((each) => ({ value: each, label: EXCHANGE_SEGMENT_LABELS[each] }))}
						label="Execution segment"
						variant="default"
						size="md"
					/>
					<span className="ms-auto body-sm text-tertiary">{`${markets.length} markets`}</span>
				</div>
				{/* Many columns of paired figures: a compact 12px recipe and cells that never wrap, so
				    a narrow screen scrolls the table sideways with the market column pinned. */}
				<div className="overflow-x-auto">
					<table className="w-full body-sm">
						<thead>
							<tr>
								<th className="sticky left-0 z-10 bg-surface px-2 pt-3 pb-2 text-left label-sm text-secondary">
									Market
								</th>
								{columns.map((column) => (
									<th
										key={column.label}
										className="px-2 pt-3 pb-2 text-right label-sm whitespace-nowrap text-secondary"
									>
										<Tooltip
											content={column.help}
											className="ms-auto w-fit cursor-help whitespace-nowrap underline decoration-dotted"
											tabIndex={0}
										>
											{column.label}
										</Tooltip>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{basket ? (
								<tr>
									<th
										scope="row"
										className="sticky left-0 z-10 border-t border-subtle bg-surface px-2 py-2 text-left label-sm whitespace-nowrap"
									>
										<Tooltip
											content={`The venue's figure: its tokens' markets merged by volume, tokens weighted by cross-venue ${segment === 'spot' ? 'spot volume' : 'open interest'}, the same weights for every venue.`}
											className="w-fit cursor-help underline decoration-dotted"
											tabIndex={0}
										>
											{`${profile.name} basket`}
										</Tooltip>
									</th>
									{columns.map((column) => (
										<td key={column.label} className={cellClass}>
											{column.value(basket) == null ? null : column.render(basket)}
										</td>
									))}
								</tr>
							) : null}
							{markets.map((pair) => (
								<tr key={pair.pairId}>
									<th
										scope="row"
										className="sticky left-0 z-10 border-t border-subtle bg-surface px-2 py-2 text-left label-sm whitespace-nowrap uppercase"
									>
										{pair.symbol}
									</th>
									{columns.map((column) => (
										<td key={column.label} className={cellClass} style={column.shade?.(column.value(pair.execution))}>
											{column.render(pair.execution)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<p className="border-t border-subtle p-3 body-sm text-tertiary">
					Last 30 days, per $10k unless a size is named. p and q are what the book predicted and quoted; red marks the
					dearest markets here. n/a means not measured.
				</p>
			</Card>
			{profile.execution?.feed ? <FeedHealth feed={profile.execution.feed} /> : null}
		</div>
	)
}
