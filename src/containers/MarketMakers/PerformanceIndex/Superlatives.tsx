import { TokenLogo } from '~/components/TokenLogo'
import { Card as UICard } from '~/ui/Card'
import { abbreviateNumber } from '~/utils'
import type { AggregatedMetrics } from './data'

type PickMode = 'max' | 'min'

function leader(
	rows: AggregatedMetrics[],
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

function pctValue(value: number | null | undefined): string {
	if (value == null) return '—'
	return `${Number(value.toFixed(2))}%`
}

function usdValue(value: number | null | undefined): string {
	if (value == null) return '—'
	return abbreviateNumber(value, 2, '$') ?? '—'
}

function Card({ label, winner, value }: { label: string; winner: AggregatedMetrics | null; value: string }) {
	return (
		<div className="flex min-h-[4.875rem] flex-col justify-center gap-2 bg-surface p-4">
			<span className="label-sm text-secondary">{label}</span>
			<div className="flex items-center justify-between gap-2">
				{winner ? (
					<div className="flex min-w-0 items-center gap-2">
						<TokenLogo src={winner.marketMakerImageUrl} size={24} />
						<span className="truncate text-sm font-medium">{winner.marketMakerName}</span>
					</div>
				) : (
					<span className="body-sm text-tertiary">—</span>
				)}
				<span className="shrink-0 body-sm text-secondary">{value}</span>
			</div>
		</div>
	)
}

export function Superlatives({
	aggregated,
	period
}: {
	aggregated: Record<string, AggregatedMetrics>
	period: string
}) {
	const rows = Object.values(aggregated)

	const topDepth = leader(rows, (r) => r.bidAskDepth?.value, 'max')
	const topVolume = leader(rows, (r) => r.dailyFillVolume?.value, 'max')
	const topSpread = leader(rows, (r) => r.topOfBookSpread?.value, 'min')
	const topUptime = leader(rows, (r) => r.combinedUptime?.value, 'max')

	return (
		<UICard padding="none" className="overflow-hidden">
			<div className="grid grid-cols-1 gap-px bg-border-subtle min-[713px]:grid-cols-2 min-[1120px]:grid-cols-4">
				<Card
					label={`Top Avg. (+/-) 2.00% Depth (${period})`}
					winner={topDepth}
					value={usdValue(topDepth?.bidAskDepth?.value)}
				/>
				<Card
					label={`Highest Volume (Maker & Taker) (${period})`}
					winner={topVolume}
					value={usdValue(topVolume?.dailyFillVolume?.value)}
				/>
				<Card
					label={`Top Bid-Ask Spread (${period})`}
					winner={topSpread}
					value={pctValue(topSpread?.topOfBookSpread?.value)}
				/>
				<Card
					label={`Top KPI Adherence — Combined Uptime (${period})`}
					winner={topUptime}
					value={pctValue(topUptime?.combinedUptime?.value)}
				/>
			</div>
		</UICard>
	)
}
