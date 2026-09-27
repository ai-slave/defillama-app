import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { slug } from '~/utils'
import { geckoTokenIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import type { DailyUnlocks, DayInfo } from './calendarTypes'

interface WeekDayColumnProps {
	dayInfo: DayInfo
	unlocksData: {
		[date: string]: DailyUnlocks
	}
	isToday: boolean
}

export function WeekDayColumn({ dayInfo, unlocksData, isToday }: WeekDayColumnProps) {
	const dateStr = dayInfo.date?.format('YYYY-MM-DD')
	const dayData = dateStr ? unlocksData[dateStr] : undefined
	const hasUnlocks = dayData !== undefined && dayData.events.length > 0

	return (
		<div
			key={dateStr}
			className={`flex min-h-48 flex-col bg-surface p-3 ${isToday ? 'ring-1 ring-brand ring-inset' : ''}`}
		>
			<div className="mb-2 flex items-center justify-between border-b border-medium pb-2 text-sm font-medium">
				<span>
					<span className="mr-1.5 text-secondary">{dayInfo.date?.format('ddd')}</span>
					<span className={isToday ? 'font-bold text-link' : ''}>{dayInfo.date?.date()}</span>
				</span>
				{isToday ? <span className="text-xs font-normal text-link">(Today)</span> : null}
			</div>
			<div className="flex grow flex-col gap-1.5 overflow-y-auto">
				{hasUnlocks ? (
					dayData.events.map((event) => (
						<BasicLink
							key={JSON.stringify([event.protocol, event.unit ?? 'once'])}
							href={`/unlocks/${slug(event.protocol)}`}
							target="_blank"
						>
							<div className="rounded-md border border-medium p-2 text-xs hover:bg-hover-row">
								<div className="mb-0.5 flex items-start justify-between gap-1">
									<div className="flex min-w-0 shrink items-center gap-1.5 font-medium">
										<TokenLogo
											name={event.protocol}
											kind="token"
											size={16}
											fallbackSrc={event.geckoId ? geckoTokenIconUrl(event.geckoId) : null}
											alt={`Logo of ${event.protocol}`}
										/>
										<span className="truncate">{event.protocol}</span>
									</div>
									{event.unlockType ? (
										<span className="shrink-0 rounded-full border border-medium bg-page px-1.5 py-0.5 label-xs whitespace-nowrap text-secondary">
											{event.unlockType}
										</span>
									) : null}
								</div>
								<div className="pl-[calc(16px+0.375rem)] text-secondary">
									{formatUsd(event.value, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
									{event.unit === 'week' ? ' / week' : ''}
								</div>
							</div>
						</BasicLink>
					))
				) : (
					<div className="flex grow items-center justify-center text-center text-xs text-secondary opacity-75">
						No unlocks
					</div>
				)}
			</div>
		</div>
	)
}
