import { Card } from '~/ui/Card'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import type { ExchangeExecutionFeedHealth, ExchangeExecutionModel, ExchangeExecutionPairModel } from './models'

// Execution metrics are one-way bps figures; 1bp of $10k is exactly $1, so bps values
// render as dollars at the reference size — the framing regular users reason in.
const usd = (bps: number | null, digits = 2) =>
	bps == null ? 'n/a' : formatUsd(bps, { minimumFractionDigits: digits, maximumFractionDigits: digits })

// Spreads read most naturally as a percentage of price, not dollars.
const pctOfBps = (bps: number | null) => {
	if (bps == null) return 'n/a'
	const pct = bps / 100
	const digits = pct >= 0.1 ? 2 : pct >= 0.01 ? 3 : 4
	return formatPercent(pct, { input: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits })
}

const NA = <span className="text-tertiary">n/a</span>

function SlippagePair({ predicted, actual }: { predicted: number | null; actual: number | null }) {
	if (actual == null) return NA
	return (
		<span className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
			{predicted == null ? null : <span className="whitespace-nowrap text-tertiary">{`p ${usd(predicted)} →`}</span>}
			<span className="whitespace-nowrap">{usd(actual)}</span>
		</span>
	)
}

function Markout({ value }: { value: number | null }) {
	if (value == null) return NA
	return (
		<span className={value > 0 ? 'text-data-down' : 'text-data-up'}>
			{formatUsd(value, { signDisplay: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
		</span>
	)
}

function summarySentences(execution: ExchangeExecutionModel): string[] {
	const sentences: string[] = []
	if (execution.costToTradeBps != null) {
		sentences.push(
			`A $10k market order here costs about ${usd(execution.costToTradeBps)} all-in: base-tier taker fee plus spread. VIP fee tiers can lower the fee part; the slippage figures below exclude fees entirely, since venues charge fees separately after the fill.`
		)
	}
	const actual = execution.realizedSlippage10kBps
	const predicted = execution.predictedSlippage10kBps
	if (actual != null && predicted != null) {
		const gap = actual - predicted
		sentences.push(
			gap <= 0.05
				? `The book delivers what it promises: it predicted ${usd(predicted)} of slippage on a $10k fill, and fills actually cost ${usd(actual)}.`
				: `The book promised ${usd(predicted)} of slippage on a $10k fill; fills actually cost ${usd(actual)}, which is ${usd(gap)} more, so displayed depth partly moves before fills land.`
		)
	}
	if (execution.markout1mBps != null) {
		sentences.push(
			execution.markout1mBps > 0
				? `In the minute after a $10k fill the price keeps moving against the taker by about ${usd(Math.abs(execution.markout1mBps))} on average.`
				: `In the minute after a fill the price tends to come back about ${usd(Math.abs(execution.markout1mBps))} (per $10k) in the taker's favour.`
		)
	}
	sentences.push(
		`Measured from ${execution.hoursCovered}h of tick-level fills across ${execution.pairs.length} pair${execution.pairs.length === 1 ? '' : 's'} (${execution.assets.join(', ')}): actual trades, not venue claims. Linear perps only for now.`
	)
	return sentences
}

const HEADER_HELP: Array<{ label: string; help: string; align?: 'end' }> = [
	{ label: 'Pair', help: 'Perpetual market on the shared measurement basket.' },
	{
		label: 'Cost to trade',
		help: 'All-in cost of a $10k market order: base-tier taker fee plus half the effective spread. VIP tiers can lower the fee part.',
		align: 'end'
	},
	{
		label: 'Spread',
		help: 'Effective spread as a percentage of price: twice the gap between fill price and the mid price at fill time. Hover a value for the quoted (displayed) spread.',
		align: 'end'
	},
	{
		label: 'Slippage $10k',
		help: 'Predicted first (what walking the pre-trade book for each fill’s own size promised), then what fills of at least $10k actually paid, in dollars for a $10k trade.',
		align: 'end'
	},
	{
		label: 'Slippage $100k',
		help: 'Same comparison for fills of at least $100k, in dollars for a $100k trade.',
		align: 'end'
	},
	{
		label: 'Slippage $1M',
		help: 'Same comparison for fills of at least $1M, in dollars for a $1M trade. Fills this large are rare, so this is often not measured.',
		align: 'end'
	},
	{
		label: 'Markout 1s',
		help: 'Where the price went 1 second after a fill, in dollars per $10k. Lower is better; positive means the price kept moving against the taker.',
		align: 'end'
	},
	{
		label: 'Markout 15s',
		help: 'Where the price went 15 seconds after a fill, in dollars per $10k. Lower is better.',
		align: 'end'
	},
	{
		label: 'Markout 1m',
		help: 'Where the price went 1 minute after a fill, in dollars per $10k. Lower is better.',
		align: 'end'
	},
	{
		label: 'Markout 5m',
		help: 'Where the price went 5 minutes after a fill, in dollars per $10k. Lower is better.',
		align: 'end'
	},
	{
		label: 'Measured',
		help: 'Hours of tick coverage and number of fills behind this pair’s trailing window.',
		align: 'end'
	}
]

function PairRow({ pair }: { pair: ExchangeExecutionPairModel }) {
	// bps → dollars at the column's own trade size: ×10 for $100k, ×100 for $1M
	const at = (bps: number | null, sizeUnits: number) => (bps == null ? null : bps * sizeUnits)
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
						{usd(pair.costToTradeBps)} <span className="text-tertiary">/$10k</span>
					</>
				)}
			</td>
			<td className="border-t border-subtle px-2 py-2 text-right whitespace-nowrap">
				{pair.effectiveSpreadBps == null ? (
					NA
				) : (
					<Tooltip content={`Quoted spread: ${pctOfBps(pair.quotedSpreadBps)}`} className="ms-auto w-fit">
						<span>{pctOfBps(pair.effectiveSpreadBps)}</span>
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
					<span>{`${pair.hoursCovered}h`}</span>
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
			help: 'Average time between order book updates on the BTC perp book: elapsed time divided by updates, so bursts of same-instant updates do not distort it.'
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
			help: 'Total time the book feed went silent long enough to count as an outage rather than a quiet market.'
		}
	]
	return (
		<Card padding="sm" className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<h3 className="label-md">Order book feed speed</h3>
				<Tooltip content={`Latest measured day: ${feed.date}.`} className="w-fit">
					<span className="body-sm text-secondary underline decoration-dotted">BTC perp book</span>
				</Tooltip>
				{feed.degraded ? (
					<Tooltip
						content="This day's reading is outside the venue's normal range. That can also come from a capture problem on our side rather than the venue, which is one reason feed speed never affects the ranking."
						className="w-fit"
					>
						<span className="rounded-sm border border-current px-1.5 py-0.5 label-sm text-warning">degraded day</span>
					</Tooltip>
				) : null}
			</div>
			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				{stats.map((stat) => (
					<div key={stat.label} className="flex flex-col gap-0.5">
						<Tooltip content={stat.help} className="w-fit">
							<span className="label-md text-secondary underline decoration-dotted">{stat.label}</span>
						</Tooltip>
						<span className="mono-xl">{stat.value}</span>
					</div>
				))}
			</div>
			<p className="body-sm text-tertiary">
				Measured from our own capture of the venue's public order book feed. Fast venues push many updates a second;
				some venues publish on a fixed interval by design, and a quiet market updates less because nothing changes, so
				this reflects the public feed, not order-processing speed. It is shown for transparency and never enters the
				quality ranking.
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
										<Tooltip content={column.help} className={column.align === 'end' ? 'ms-auto w-fit' : 'w-fit'}>
											<span className="whitespace-nowrap underline decoration-dotted">{column.label}</span>
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
