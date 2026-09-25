import { TokenLogo } from '~/components/TokenLogo'
import { Card as UICard } from '~/ui/Card'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import type { AggregatedMetrics } from './data'

type PickMode = 'max' | 'min'

function leader(
	rows: Array<AggregatedMetrics>,
	select: (row: AggregatedMetrics) => number | null | undefined,
	pick: PickMode
): AggregatedMetrics | null {
	let best: AggregatedMetrics | null = null
	let bestValue: number | null = null
	for (const row of rows) {
		const value = select(row)
		if (value == null) continue
		if (bestValue == null || (pick === 'max' ? value > bestValue : value < bestValue)) {
			best = row
			bestValue = value
		}
	}
	return best
}

function Card({ label, winner, value }: { label: string; winner: AggregatedMetrics | null; value: string }) {
	return (
		<div className="flex min-h-[4.875rem] flex-col justify-center gap-2 bg-surface p-4">
			<span className="label-sm text-secondary">{label}</span>
			<div className="flex items-center justify-between gap-2">
				{winner ? (
					<div className="flex min-w-0 items-center gap-2">
						<TokenLogo src={winner.marketMakerImageUrl} size={24} />
						<span className="truncate label-md">{winner.marketMakerName}</span>
					</div>
				) : (
					<span className="body-sm text-tertiary">—</span>
				)}
				<span className="shrink-0 body-sm text-secondary">{value}</span>
			</div>
		</div>
	)
}

// Spread is the one superlative where lower wins.
export function superlativeLeaders(aggregated: Record<string, AggregatedMetrics>) {
	const rows = Object.values(aggregated)
	return {
		depth: leader(rows, (r) => r.bidAskDepth?.value, 'max'),
		volume: leader(rows, (r) => r.dailyFillVolume?.value, 'max'),
		spread: leader(rows, (r) => r.topOfBookSpread?.value, 'min'),
		uptime: leader(rows, (r) => r.combinedUptime?.value, 'max')
	}
}

export function Superlatives({
	aggregated,
	period
}: {
	aggregated: Record<string, AggregatedMetrics>
	period: string
}) {
	const { depth: topDepth, volume: topVolume, spread: topSpread, uptime: topUptime } = superlativeLeaders(aggregated)

	return (
		<UICard padding="none" className="overflow-hidden">
			<div className="grid grid-cols-1 gap-px bg-border-subtle min-[713px]:grid-cols-2 min-[1120px]:grid-cols-4">
				<Card
					label={`Top Avg. (+/-) 2.00% Depth (${period})`}
					winner={topDepth}
					value={formatUsd(topDepth?.bidAskDepth?.value, { compact: true }) ?? '—'}
				/>
				<Card
					label={`Highest Volume (Maker & Taker) (${period})`}
					winner={topVolume}
					value={formatUsd(topVolume?.dailyFillVolume?.value, { compact: true }) ?? '—'}
				/>
				<Card
					label={`Top Bid-Ask Spread (${period})`}
					winner={topSpread}
					value={formatPercent(topSpread?.topOfBookSpread?.value, { input: 'percent' }) ?? '—'}
				/>
				<Card
					label={`Top KPI Adherence — Combined Uptime (${period})`}
					winner={topUptime}
					value={formatPercent(topUptime?.combinedUptime?.value, { input: 'percent' }) ?? '—'}
				/>
			</div>
		</UICard>
	)
}
