import { readSelectionFromQuery } from '~/components/Select/query'

const CALENDAR_EVENT_TYPES = ['Unlock', 'Close', 'Macro', 'Crypto']

export interface CalendarEvent {
	name: string
	timestamp: number
	type: string
	link?: string
}

/**
 * Upcoming events in date order, filtered by the type picker. The picker offers only types with an upcoming
 * event, and shows only when there is more than one, so a type key in the URL is ignored otherwise.
 */
export function selectCalendarEvents(
	events: Array<CalendarEvent>,
	nowMs: number,
	query: Readonly<Record<string, string | Array<string> | undefined>>
): { typeOptions: Array<string>; rows: Array<CalendarEvent> } {
	const upcoming = events.filter((event) => event.timestamp >= nowMs)
	const typeOptions = CALENDAR_EVENT_TYPES.filter((type) => upcoming.some((event) => event.type === type))
	const selected =
		typeOptions.length > 1 ? new Set(readSelectionFromQuery(query, 'type', 'excludeType', typeOptions)) : null
	const rows = upcoming.filter((event) => !selected || selected.has(event.type))
	rows.sort((a, b) => a.timestamp - b.timestamp)
	return { typeOptions, rows }
}
