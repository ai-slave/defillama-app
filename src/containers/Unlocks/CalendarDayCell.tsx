import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { Hovercard } from '~/ui/Hovercard'
import { slug } from '~/utils'
import { formatDate } from '~/utils/dateFormat'
import { geckoTokenIconUrl } from '~/utils/icons'
import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import type { DailyUnlocks, DayInfo } from './calendarTypes'

interface CalendarDayCellProps {
	dayInfo: DayInfo
	unlocksData: {
		[date: string]: DailyUnlocks
	}
	maxUnlockValue: number
	isToday: boolean
}

export function CalendarDayCell({ dayInfo, unlocksData, maxUnlockValue, isToday }: CalendarDayCellProps) {
	// In-month days sit on the card; other days and empty slots recede to the page color. The grid lines between
	// cells are the parent's translucent border color, so a cell without its own background turns gray.
	if (!dayInfo.date) return <div className="h-24 w-full bg-page" />

	const dateStr = dayInfo.date.format('YYYY-MM-DD')
	const dayData = unlocksData[dateStr]
	const hasUnlocks = dayData !== undefined && dayData.events.length > 0
	let weeklyRateValue = 0
	if (dayData) {
		for (const event of dayData.events) {
			if (event.unit === 'week') weeklyRateValue += event.value
		}
	}

	let intensityFactor = 0
	if (hasUnlocks && maxUnlockValue > 0 && dayInfo.isCurrentMonth) {
		const normalizedValue = Math.min(1, dayData.totalValue / maxUnlockValue)
		intensityFactor = Math.log1p(normalizedValue * 9) / Math.log1p(10)
		intensityFactor = Math.min(1, Math.max(0, intensityFactor))
	}

	// Brand blue mixed into the card, so the heat is opaque and follows the mode: a small day is a faint tint, the
	// month's largest is the full brand fill. Days with only weekly rates stay clear.
	const brandShare = intensityFactor > 0 ? Math.round(10 + 90 * intensityFactor) : 0
	const backgroundColor =
		brandShare > 0 ? `color-mix(in oklab, var(--bg-brand) ${brandShare}%, var(--bg-surface))` : undefined
	// In light mode primary text passes AA up to 90% brand and white from 92%; dark mode passes white throughout.
	const onBrand = brandShare > 90

	const cellContent = (
		<div
			className={`relative h-24 w-full ${dayInfo.isCurrentMonth ? 'bg-surface hover:brightness-110' : 'bg-page text-tertiary'} ${onBrand ? 'text-on-brand' : ''}`}
			style={{ backgroundColor }}
		>
			<div className="relative z-10 flex h-full w-full flex-col justify-between p-2">
				{/* Today is a filled brand disc: a brand ring or brand text disappears on the blue unlock tints. */}
				<span
					aria-current={isToday ? 'date' : undefined}
					className={`-m-0.5 flex size-6 items-center justify-center rounded-full label-md ${isToday ? 'bg-brand text-on-brand' : ''}`}
				>
					{dayInfo.date.date()}
				</span>
				{hasUnlocks && dayInfo.isCurrentMonth ? (
					<div className="mt-auto hidden truncate body-sm sm:block">
						{dayData.totalValue > 0
							? `Cliff: ${formatUsd(dayData.totalValue, USD_LOWERCASE_MILLIONS_OPTIONS)}`
							: `Rate: ${formatUsd(weeklyRateValue, USD_LOWERCASE_MILLIONS_OPTIONS)} / week`}
					</div>
				) : null}
			</div>
		</div>
	)

	if (!hasUnlocks) {
		return cellContent
	}

	return (
		<Hovercard
			className="w-full"
			width="md"
			content={
				<div className="flex flex-col gap-2">
					<p className="title-sm text-primary">{formatDate(dateStr)}</p>
					<ul className="flex flex-col gap-1.5">
						{dayData.events.map((event) => (
							<li
								key={JSON.stringify([event.protocol, event.unit ?? 'once'])}
								className="flex items-center justify-between gap-4"
							>
								<BasicLink
									href={`/unlocks/${slug(event.protocol)}`}
									target="_blank"
									className="flex min-w-0 items-center gap-1.5 text-primary hover:underline"
								>
									<TokenLogo
										name={event.protocol}
										kind="token"
										size={16}
										fallbackSrc={event.geckoId ? geckoTokenIconUrl(event.geckoId) : null}
										alt={`Logo of ${event.protocol}`}
									/>
									<span className="truncate">{event.protocol}</span>
								</BasicLink>
								<span className="label-sm whitespace-nowrap text-primary">
									{formatUsd(event.value, USD_LOWERCASE_MILLIONS_OPTIONS)}
									{event.unit === 'week' ? ' / week' : ''}
								</span>
							</li>
						))}
					</ul>
					<div className="flex flex-col gap-1 border-t border-medium pt-2 title-sm text-primary">
						{dayData.totalValue > 0 ? (
							<p className="flex justify-between gap-4">
								<span>Cliff unlocks</span>
								<span>{formatUsd(dayData.totalValue, USD_LOWERCASE_MILLIONS_OPTIONS)}</span>
							</p>
						) : null}
						{weeklyRateValue > 0 ? (
							<p className="flex justify-between gap-4">
								<span>Weekly rate</span>
								<span>{formatUsd(weeklyRateValue, USD_LOWERCASE_MILLIONS_OPTIONS)} / week</span>
							</p>
						) : null}
					</div>
				</div>
			}
		>
			{cellContent}
		</Hovercard>
	)
}
