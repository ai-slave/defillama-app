import { Card } from '~/ui/Card'
import { Tooltip } from '~/ui/Tooltip'
import { formatDateLabel, formatPnlPercent } from './format'
import type { TimelinePoint } from './types'

export const DailyPnLGrid = ({ timeline }: { timeline: Array<TimelinePoint> }) => {
	if (timeline.length === 0) return null
	const days = timeline.slice(1)
	if (days.length === 0) return null

	const displayDays = days.slice(-90)

	return (
		<Card padding="md" as="section" className="overflow-hidden" aria-label="Daily change grid">
			<div className="mb-3 flex items-center justify-between gap-2">
				<h3 className="label-lg text-primary">Daily Change Grid</h3>
				<p className="body-xs text-secondary">{displayDays.length} days shown</p>
			</div>
			<ul className="flex scrollbar-none max-w-full flex-wrap gap-1.5 pb-1" aria-label="Daily return heat cells">
				{displayDays.map((day) => {
					const isPositive = day.percentChange > 0
					const isZero = day.percentChange === 0
					const alpha = Math.min(0.6, Math.max(0.22, Math.abs(day.percentChange) / 9))
					const backgroundColor = isZero
						? 'rgba(148, 163, 184, 0.22)'
						: isPositive
							? `rgba(16, 185, 129, ${alpha})`
							: `rgba(239, 68, 68, ${alpha})`
					return (
						<li key={day.timestamp}>
							<Tooltip
								placement="top"
								content={`${formatPnlPercent(day.percentChange)} • ${formatDateLabel(day.timestamp)}`}
							>
								<span
									className="flex size-8 shrink-0 items-end justify-center rounded-md border border-medium transition-transform duration-200 hover:scale-[0.99]"
									style={{ background: backgroundColor }}
								>
									<span className="sr-only">{`${formatPnlPercent(day.percentChange)} on ${formatDateLabel(day.timestamp)}`}</span>
								</span>
							</Tooltip>
						</li>
					)
				})}
			</ul>
		</Card>
	)
}
