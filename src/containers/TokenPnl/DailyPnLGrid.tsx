import { HEAT_DOWN, HEAT_UP, OTHERS_COLOR } from '~/constants/colors'
import { Card } from '~/ui/Card'
import { Tooltip } from '~/ui/Tooltip'
import { formatDateLabel, formatPnlPercent } from './format'
import type { TimelinePoint } from './types'

export function DailyPnLGrid({ timeline }: { timeline: Array<TimelinePoint> }) {
	if (timeline.length === 0) return null
	const days = timeline.slice(1)
	if (days.length === 0) return null

	const displayDays = days.slice(-90)

	return (
		<Card padding="md" as="section" className="overflow-hidden" aria-label="Daily change grid">
			<div className="mb-3 flex items-center justify-between gap-2">
				<h3 className="heading-xs">Daily Change Grid</h3>
				<p className="body-xs text-secondary">{displayDays.length} days shown</p>
			</div>
			<ul className="flex scrollbar-none max-w-full flex-wrap gap-1.5 pb-1" aria-label="Daily return heat cells">
				{displayDays.map((day) => {
					const isPositive = day.percentChange > 0
					const isZero = day.percentChange === 0
					const alpha = Math.min(60, Math.max(22, (Math.abs(day.percentChange) / 9) * 100))
					// Up, down and Others colours at an alpha, so the cell follows the card in both modes.
					const backgroundColor = isZero
						? `color-mix(in srgb, ${OTHERS_COLOR} 22%, transparent)`
						: `color-mix(in srgb, ${isPositive ? HEAT_UP : HEAT_DOWN} ${alpha}%, transparent)`
					return (
						<li key={day.timestamp}>
							<Tooltip
								placement="top"
								content={`${formatPnlPercent(day.percentChange)} • ${formatDateLabel(day.timestamp)}`}
							>
								<span
									className="flex size-8 shrink-0 items-end justify-center rounded-md border border-medium"
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
