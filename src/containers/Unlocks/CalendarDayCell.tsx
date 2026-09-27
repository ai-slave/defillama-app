import dayjs from 'dayjs'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useIsClient } from '~/hooks/useIsClient'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { geckoTokenIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import type { DailyUnlocks, DayInfo } from './calendarTypes'
import { interpolateColor } from './colorUtils'

interface CalendarDayCellProps {
	dayInfo: DayInfo
	unlocksData: {
		[date: string]: DailyUnlocks
	}
	maxUnlockValue: number
}

export function CalendarDayCell({ dayInfo, unlocksData, maxUnlockValue }: CalendarDayCellProps) {
	const [isDarkMode] = useDarkModeManager()
	const isClient = useIsClient()

	if (!dayInfo.date) return <div className="h-24 w-full bg-surface opacity-40" />

	const dateStr = dayInfo.date.format('YYYY-MM-DD')
	const dayData = unlocksData[dateStr]
	const hasUnlocks = dayData !== undefined && dayData.events.length > 0
	let weeklyRateValue = 0
	if (dayData) {
		for (const event of dayData.events) {
			if (event.unit === 'week') weeklyRateValue += event.value
		}
	}
	// Today is the visitor's local day, which the server cannot know, so it is marked after mount.
	const isToday = isClient && dayInfo.date.isSame(dayjs(), 'day')

	let intensityFactor = 0
	if (hasUnlocks && maxUnlockValue > 0 && dayInfo.isCurrentMonth) {
		const normalizedValue = Math.min(1, dayData.totalValue / maxUnlockValue)
		intensityFactor = Math.log1p(normalizedValue * 9) / Math.log1p(10)
		intensityFactor = Math.min(1, Math.max(0, intensityFactor))
	}

	const baseColorRgb = [243, 244, 246]
	const darkModeBaseColorRgb = [30, 41, 59]
	const highlightColorRgb = [59, 130, 246]
	let interpolatedColorRgb = baseColorRgb
	if (dayInfo.isCurrentMonth && intensityFactor > 0) {
		const baseColor = isDarkMode ? darkModeBaseColorRgb : baseColorRgb
		interpolatedColorRgb = interpolateColor(baseColor, highlightColorRgb, intensityFactor)
	}

	const cellStyle: React.CSSProperties = {}
	if (dayInfo.isCurrentMonth && hasUnlocks) {
		cellStyle.backgroundColor = `rgb(${interpolatedColorRgb.join(', ')})`
	}

	const cellContent = (
		<div
			className={`relative h-24 w-full ${isToday ? 'ring-1 ring-brand ring-inset' : ''} ${
				dayInfo.isCurrentMonth ? 'hover:brightness-110' : 'bg-surface opacity-60 hover:opacity-80'
			}`}
			style={cellStyle}
		>
			<div className="relative z-10 flex h-full w-full flex-col justify-between p-2">
				<span className={`text-sm font-medium ${isToday ? 'font-bold text-link' : ''}`}>{dayInfo.date.date()}</span>
				{hasUnlocks && dayInfo.isCurrentMonth ? (
					<div className="mt-auto hidden truncate text-xs sm:block">
						{dayData.totalValue > 0 ? 'Cliff: ' : 'Rate: '}
						{formatUsd(dayData.totalValue > 0 ? dayData.totalValue : weeklyRateValue, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
						{dayData.totalValue > 0 ? '' : ' / week'}
					</div>
				) : null}
			</div>
		</div>
	)

	if (!hasUnlocks) {
		return cellContent
	}

	return (
		<Tooltip
			content={
				<div className="flex max-w-xs flex-col gap-2 p-2">
					{dayData.totalValue > 0 ? (
						<div className="text-sm font-semibold">
							Cliff Unlock Value:{' '}
							{formatUsd(dayData.totalValue, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						</div>
					) : null}
					{weeklyRateValue > 0 ? (
						<div className="text-sm font-semibold">
							Weekly Rate Value:{' '}
							{formatUsd(weeklyRateValue, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}{' '}
							/ week
						</div>
					) : null}
					{dayData.events.length > 0 ? (
						<>
							<div className="-mx-2 border-t border-medium" />
							<div className="flex flex-col gap-1.5">
								{dayData.events.map((event) => (
									<div
										key={JSON.stringify([event.protocol, event.unit ?? 'once'])}
										className="flex items-center justify-between gap-4"
									>
										<BasicLink
											href={`/unlocks/${slug(event.protocol)}`}
											target="_blank"
											className="group flex min-w-0 shrink items-center gap-1.5 text-sm font-medium hover:underline"
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
										<span className="text-sm font-medium whitespace-nowrap text-secondary">
											{formatUsd(event.value, {
												compact: true,
												minimumCompactValue: 1_000_000,
												compactSuffix: 'lowercase'
											})}
											{event.unit === 'week' ? ' / week' : ''}
										</span>
									</div>
								))}
							</div>
						</>
					) : null}
				</div>
			}
		>
			{cellContent}
		</Tooltip>
	)
}
