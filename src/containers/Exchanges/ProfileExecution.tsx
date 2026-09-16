import type { ReactNode } from 'react'
import { Card } from '~/ui/Card'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import type { ExchangeExecutionFeedHealth, ExchangeExecutionModel, ExchangeExecutionPairModel } from './models'

// Execution metrics are one-way bps figures; 1bp of $10k is exactly $1, so bps values
// render as dollars at the reference size — the framing regular users reason in.

// Spreads read most naturally as a percentage of price, not dollars.
const pctOfBps = (bps: number | null) => {
	if (bps == null) return 'n/a'
	const pct = bps / 100
	const digits = pct >= 0.1 ? 2 : pct >= 0.01 ? 3 : 4
	return formatPercent(pct, { input: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export const NA = <span className="text-tertiary">n/a</span>

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
 * A size ladder or a set of horizons in one column, each rung labelled. A column apiece
 * would push the liquidity figures off the row; one unlabelled line would not say which
 * size or horizon it meant.
 */
function StackedRows({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
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
	return (
		<StackedRows
			rows={[
				{ label: '1m', value: <Markout value={execution?.markout1mBps ?? null} /> },
				{ label: '5m', value: <Markout value={execution?.markout5mBps ?? null} /> }
			]}
		/>
	)
}

function summarySentences(execution: ExchangeExecutionModel): Array<string> {
	const sentences: Array<string> = []
	if (execution.costToTradeBps != null) {
		sentences.push(
			`A $10k market order here costs about ${formatUsd(execution.costToTradeBps, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'} all-in: base-tier taker fee plus spread. VIP tiers lower the fee part; the slippage figures below exclude fees.`
		)
	}
	const actual = execution.realizedSlippage10kBps
	const predicted = execution.predictedSlippage10kBps
	if (actual != null && predicted != null) {
		const gap = actual - predicted
		sentences.push(
			gap <= 0.05
				? `The book delivers what it promises: it predicted ${formatUsd(predicted, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'} of slippage on a $10k fill, and fills actually cost ${formatUsd(actual, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'}.`
				: `The book promised ${formatUsd(predicted, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'} of slippage on a $10k fill; fills actually cost ${formatUsd(actual, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'}, which is ${formatUsd(gap, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'} more, so displayed depth partly moves before fills land.`
		)
	}
	if (execution.markout1mBps != null) {
		sentences.push(
			execution.markout1mBps > 0
				? `In the minute after a $10k fill the price keeps moving against the taker by about ${formatUsd(Math.abs(execution.markout1mBps), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'} on average.`
				: `In the minute after a fill the price tends to come back about ${formatUsd(Math.abs(execution.markout1mBps), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'} (per $10k) in the taker's favour.`
		)
	}
	sentences.push(
		`From ${execution.hoursCovered}h of tick-level fills across ${execution.pairs.length} pair${execution.pairs.length === 1 ? '' : 's'} (${execution.assets.join(', ')}): actual trades, not venue claims. USD perps only.`
	)
	return sentences
}

const HEADER_HELP: Array<{ label: string; help: string; align?: 'end' }> = [
	{ label: 'Pair', help: 'Perp market in the shared measurement basket.' },
	{
		label: 'Cost to trade',
		help: 'All-in cost of a $10k market order: base-tier taker fee plus half the effective spread. VIP tiers lower the fee part.',
		align: 'end'
	},
	{
		label: 'Spread',
		help: 'Twice the gap between fill price and mid at fill time, as a percentage of price. Hover a value for the quoted spread.',
		align: 'end'
	},
	{
		label: 'Slippage $10k',
		help: 'What the pre-trade book promised, then what fills of $10k or more actually paid, in dollars per $10k.',
		align: 'end'
	},
	{
		label: 'Slippage $100k',
		help: 'Same, for fills of $100k or more, per $100k.',
		align: 'end'
	},
	{
		label: 'Slippage $1M',
		help: 'Same, for fills of $1M or more, per $1M. Fills this large are rare, so often not measured.',
		align: 'end'
	},
	{
		label: 'Markout 1s',
		help: 'Where the price went 1 second after a fill, per $10k. Lower is better; positive means it kept moving against the taker.',
		align: 'end'
	},
	{
		label: 'Markout 15s',
		help: 'Where the price went 15 seconds after a fill, per $10k.',
		align: 'end'
	},
	{
		label: 'Markout 1m',
		help: 'Where the price went 1 minute after a fill, per $10k.',
		align: 'end'
	},
	{
		label: 'Markout 5m',
		help: 'Where the price went 5 minutes after a fill, per $10k.',
		align: 'end'
	},
	{
		label: 'Measured',
		help: 'Hours of tick coverage and fills behind this pair’s window.',
		align: 'end'
	}
]

const at = (bps: number | null, sizeUnits: number) => (bps == null ? null : bps * sizeUnits)

function PairRow({ pair }: { pair: ExchangeExecutionPairModel }) {
	// bps → dollars at the column's own trade size: ×10 for $100k, ×100 for $1M
	return (
		<tr>
			<th
				scope="row"
				className="sticky left-0 z-10 border-t border-subtle bg-surface px-2 py-2 text-left label-sm whitespace-nowrap"
			>
				{pair.asset}
			</th>
			<td className="border-t border-subtle px-2 py-2 text-right whitespace-nowrap">
				{pair.costToTradeBps == null ? (
					NA
				) : (
					<>
						{formatUsd(pair.costToTradeBps, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'}{' '}
						<span className="text-tertiary">/$10k</span>
					</>
				)}
			</td>
			<td className="border-t border-subtle px-2 py-2 text-right whitespace-nowrap">
				{pair.effectiveSpreadBps == null ? (
					NA
				) : (
					<Tooltip content={`Quoted spread: ${pctOfBps(pair.quotedSpreadBps)}`} className="ms-auto w-fit">
						{pctOfBps(pair.effectiveSpreadBps)}
					</Tooltip>
				)}
			</td>
			<td className="border-t border-subtle px-2 py-2 text-right whitespace-nowrap">
				<SlippagePair predicted={pair.predictedSlippage10kBps} actual={pair.realizedSlippage10kBps} />
			</td>
			<td className="border-t border-subtle px-2 py-2 text-right whitespace-nowrap">
				<SlippagePair predicted={at(pair.predictedSlippage100kBps, 10)} actual={at(pair.realizedSlippage100kBps, 10)} />
			</td>
			<td className="border-t border-subtle px-2 py-2 text-right whitespace-nowrap">
				<SlippagePair predicted={at(pair.predictedSlippage1mBps, 100)} actual={at(pair.realizedSlippage1mBps, 100)} />
			</td>
			<td className="border-t border-subtle px-2 py-2 text-right whitespace-nowrap">
				<Markout value={pair.markout1sBps} />
			</td>
			<td className="border-t border-subtle px-2 py-2 text-right whitespace-nowrap">
				<Markout value={pair.markout15sBps} />
			</td>
			<td className="border-t border-subtle px-2 py-2 text-right whitespace-nowrap">
				<Markout value={pair.markout1mBps} />
			</td>
			<td className="border-t border-subtle px-2 py-2 text-right whitespace-nowrap">
				<Markout value={pair.markout5mBps} />
			</td>
			<td className="border-t border-subtle px-2 py-2 text-right whitespace-nowrap text-tertiary">
				<Tooltip content={`${formatNumber(pair.fillCount)} fills measured`} className="ms-auto w-fit">
					{`${pair.hoursCovered}h`}
				</Tooltip>
			</td>
		</tr>
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
					className="w-fit body-sm text-secondary underline decoration-dotted"
				>
					BTC perp book
				</Tooltip>
				{feed.degraded ? (
					<Tooltip
						content="Outside the venue's normal range, which can also mean a capture problem on our side. Feed speed never affects the REAL score."
						className="w-fit"
					>
						<span className="rounded-sm border border-current px-1.5 py-0.5 label-sm text-warning">degraded day</span>
					</Tooltip>
				) : null}
			</div>
			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				{stats.map((stat) => (
					<div key={stat.label} className="flex flex-col gap-0.5">
						<Tooltip content={stat.help} className="w-fit label-md text-secondary underline decoration-dotted">
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

export function ProfileExecution({ execution }: { execution: ExchangeExecutionModel }) {
	return (
		<div className="flex flex-col gap-2">
			<Card padding="sm">
				<p className="body-md">{summarySentences(execution).join(' ')}</p>
			</Card>
			<Card padding="none">
				{/* Eleven columns of paired figures: a deliberate 12px compact recipe (headers and
				    cells together), and cells that never wrap, so a narrow screen scrolls the table
				    sideways with the pair column pinned instead of stacking every row three lines high. */}
				<div className="overflow-x-auto">
					<table className="w-full body-sm">
						<thead>
							<tr>
								{HEADER_HELP.map((column, index) => (
									<th
										key={column.label}
										className={`px-2 pt-3 pb-2 label-sm whitespace-nowrap text-secondary ${
											index === 0
												? 'sticky left-0 z-10 bg-surface text-left'
												: column.align === 'end'
													? 'text-right'
													: 'text-left'
										}`}
									>
										<Tooltip
											content={column.help}
											className={`${column.align === 'end' ? 'ms-auto w-fit' : 'w-fit'} whitespace-nowrap underline decoration-dotted`}
										>
											{column.label}
										</Tooltip>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{execution.pairs.map((pair) => (
								<PairRow key={pair.asset} pair={pair} />
							))}
						</tbody>
					</table>
				</div>
				<p className="border-t border-subtle p-3 body-sm text-tertiary">
					Slippage is in dollars at each trade size: predicted first (the book&rsquo;s promise), then what fills
					actually cost. Markouts are dollars per $10k traded; lower is better. Fill prices exclude trading fees, which
					venues charge separately after the fill. n/a means not measured, never zero.
				</p>
			</Card>
			{execution.feed ? <FeedHealth feed={execution.feed} /> : null}
		</div>
	)
}
