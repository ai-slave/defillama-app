import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import * as React from 'react'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { slug } from '~/utils'
import { geckoTokenIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import type { DailyUnlocks } from './calendarTypes'

interface UnlocksListViewProps {
	events: Array<{ date: Dayjs; event: DailyUnlocks['events'][0] }>
}

export const UnlocksListView: React.FC<UnlocksListViewProps> = ({ events }) => {
	const groupedEventsEntries = React.useMemo(() => {
		const groupedEvents: { [date: string]: Array<DailyUnlocks['events'][0]> } = {}
		for (const { date, event } of events) {
			const dateStr = date.format('YYYY-MM-DD')
			if (!groupedEvents[dateStr]) {
				groupedEvents[dateStr] = []
			}
			groupedEvents[dateStr].push(event)
		}
		return Object.entries(groupedEvents)
	}, [events])

	if (events.length === 0) {
		return (
			<Card padding="md" className="flex min-h-[200px] items-center justify-center text-center body-sm text-secondary">
				No unlocks found for the next 30 days.
			</Card>
		)
	}

	return (
		<div className="flex flex-col gap-2">
			{groupedEventsEntries.map(([dateStr, dailyEvents]) => (
				<Card key={dateStr} padding="sm" className="flex flex-col gap-2">
					<h3 className="font-semibold">
						{dayjs(dateStr).format('dddd, MMMM D, YYYY')}
						{dayjs(dateStr).isSame(dayjs(), 'day') ? (
							<span className="ml-2 text-xs font-normal text-link">(Today)</span>
						) : null}
					</h3>
					<div className="flex flex-col gap-1">
						{dailyEvents.map((event, index) => (
							<BasicLink
								key={`${event.protocol}-${event.value}-${index}`}
								href={`/unlocks/${slug(event.protocol)}`}
								target="_blank"
							>
								<div className="flex items-center justify-between gap-2 rounded-md border border-medium p-2 hover:bg-hover-row">
									<span className="flex items-center gap-2 text-sm font-medium">
										<TokenLogo
											name={event.protocol}
											kind="token"
											size={20}
											fallbackSrc={event.geckoId ? geckoTokenIconUrl(event.geckoId) : null}
											alt={`Logo of ${event.protocol}`}
										/>
										{event.protocol}
									</span>
									<span className="text-sm font-medium text-secondary">
										{formatUsd(event.value, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}
										{event.unit === 'week' ? ' / week' : ''}
									</span>
								</div>
							</BasicLink>
						))}
					</div>
				</Card>
			))}
		</div>
	)
}
