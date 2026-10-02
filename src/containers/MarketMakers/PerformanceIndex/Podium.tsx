import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { formatComposite } from '../format'
import type { AggregatedMetrics } from './data'
import type { PerformanceRow } from './types'

const RIBBON_COLORS = ['#C9971C', '#3B6BCC', '#2D8653']

function RibbonBadge({ place, color }: { place: number; color: string }) {
	return (
		<span className="absolute top-0 right-3 flex h-[42px] w-[32px] items-center justify-center">
			<svg viewBox="0 0 32 42" width={32} height={42} className="absolute inset-0">
				<path d="M0 4C0 1.79086 1.79086 0 4 0H28C30.2091 0 32 1.79086 32 4V42L16 32L0 42V4Z" fill={color} />
			</svg>
			<span className="relative -mt-2 title-md text-on-brand">{place}</span>
		</span>
	)
}

function Stat({ label, value, rank }: { label: string; value: string; rank: number | null }) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="label-sm text-secondary">{label}</span>
			<span className="mono-md">{value}</span>
			<span className="label-sm text-secondary">Rank: {rank ?? '—'}</span>
		</div>
	)
}

function PodiumCard({
	row,
	place,
	aggregated
}: {
	row: PerformanceRow
	place: number
	aggregated: AggregatedMetrics | undefined
}) {
	const depth = aggregated?.bidAskDepth ?? null
	const spread = aggregated?.topOfBookSpread ?? null
	const volume = aggregated?.dailyFillVolume ?? null

	return (
		<Card padding="md" className="relative flex flex-col gap-3">
			<RibbonBadge place={place} color={RIBBON_COLORS[place - 1]} />
			<div className="flex flex-col gap-3 min-[713px]:max-[1119px]:flex-row min-[713px]:max-[1119px]:items-center min-[713px]:max-[1119px]:gap-2 min-[713px]:max-[1119px]:pr-12">
				<div className="flex items-center gap-2 pr-10 min-[713px]:max-[1119px]:flex-1 min-[713px]:max-[1119px]:pr-0">
					<TokenLogo src={row.marketMakerImageUrl} size={32} />
					<div className="flex min-w-0 flex-col">
						<span className="truncate title-lg">{row.marketMakerName}</span>
						<span className="label-sm text-secondary">{row.activeEngagementsCount ?? '—'} active engagements</span>
					</div>
				</div>
				<div className="flex justify-between gap-2 min-[713px]:max-[1119px]:contents">
					<div className="flex flex-col gap-0.5 min-[713px]:max-[1119px]:flex-1">
						<span className="label-sm text-secondary">Composite Score</span>
						<span className="mono-lg">{formatComposite(row.composite)}</span>
					</div>
					<div className="flex flex-col gap-0.5 min-[713px]:max-[1119px]:flex-1">
						<span className="label-sm text-secondary">Median Engagements FDV</span>
						<span className="mono-lg">{formatUsd(row.medianEngagementsFdv, { compact: true }) ?? '—'}</span>
					</div>
				</div>
			</div>
			<div className="border-t border-subtle" />
			<div className="grid grid-cols-3 gap-8 min-[713px]:max-[1119px]:gap-2 min-[713px]:max-[1119px]:pr-12">
				<Stat
					label="Avg 2.00% Depth"
					value={formatUsd(depth?.value, { compact: true }) ?? '—'}
					rank={depth?.rank ?? null}
				/>
				<Stat
					label="Avg Spread"
					value={formatPercent(spread?.value, { input: 'percent' }) ?? '—'}
					rank={spread?.rank ?? null}
				/>
				<Stat
					label="Avg Volume"
					value={formatUsd(volume?.value, { compact: true }) ?? '—'}
					rank={volume?.rank ?? null}
				/>
			</div>
		</Card>
	)
}

export function Podium({
	rows,
	aggregated
}: {
	rows: Array<PerformanceRow>
	aggregated: Record<string, AggregatedMetrics>
}) {
	const top3 = [...rows].sort((a, b) => (b.composite ?? -Infinity) - (a.composite ?? -Infinity)).slice(0, 3)

	if (top3.length === 0) return null

	return (
		<div className="grid grid-cols-1 gap-4 min-[1120px]:grid-cols-3">
			{top3.map((row, index) => (
				<PodiumCard key={row.marketMakerId} row={row} place={index + 1} aggregated={aggregated[row.marketMakerId]} />
			))}
		</div>
	)
}
