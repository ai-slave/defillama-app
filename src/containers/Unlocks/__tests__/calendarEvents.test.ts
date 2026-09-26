import { expect, test } from 'vitest'
import { getQueryUpdatesFromSelected } from '~/components/Select/query'
import { type CalendarEvent, selectCalendarEvents } from '../calendarEvents'

const NOW = 1000
const event = (name: string, type: string, timestamp: number): CalendarEvent => ({ name, type, timestamp })
const EVENTS = [
	event('Old FOMC', 'Macro', NOW - 1),
	event('Quarter close', 'Close', NOW + 20),
	event('ARB unlock', 'Unlock', NOW + 10)
]
const names = (events: Array<CalendarEvent>, query: Record<string, string | Array<string> | undefined> = {}) =>
	selectCalendarEvents(events, NOW, query).rows.map((row) => row.name)

test('offers only event types with an upcoming event, and lists upcoming events by date', () => {
	expect(selectCalendarEvents(EVENTS, NOW, {}).typeOptions).toEqual(['Unlock', 'Close'])
	expect(names(EVENTS)).toEqual(['ARB unlock', 'Quarter close'])
})

test('shows the event types the type picker selects', () => {
	const options = ['Unlock', 'Close']
	expect(names(EVENTS, getQueryUpdatesFromSelected('type', 'excludeType', options, ['Close']))).toEqual([
		'Quarter close'
	])
})

test('ignores a type in the URL when only one type has upcoming events and the picker is hidden', () => {
	const unlocksOnly = [event('ARB unlock', 'Unlock', NOW + 10)]
	expect(selectCalendarEvents(unlocksOnly, NOW, {}).typeOptions).toEqual(['Unlock'])
	expect(names(unlocksOnly, { type: 'None' })).toEqual(['ARB unlock'])
})
