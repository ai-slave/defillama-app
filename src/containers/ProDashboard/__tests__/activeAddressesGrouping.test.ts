import dayjs from 'dayjs'
import { expect, test } from 'vitest'
import { projectChartData } from '../queries'
import type { ChartConfig } from '../types'

// Mon Sep 14, 2026 in seconds; Sep 15 has no observation and Sep 16 is a real zero.
const day = (offset: number) => Date.UTC(2026, 8, 14 + offset) / 1e3
const daily: Array<[number, number]> = [
	[day(0), 90],
	[day(2), 0],
	[day(3), 30],
	[day(7), 50]
]
const now = dayjs(Date.UTC(2026, 8, 24))

const project = (type: ChartConfig['type'], grouping: ChartConfig['grouping']) =>
	projectChartData(daily, { type, grouping }, 'all', null, now)

test('averages the observed days of each period for active addresses', () => {
	expect(project('activeUsers', 'week')).toEqual([
		[Date.UTC(2026, 8, 20) / 1e3, 40],
		// The current week so far has one observed day.
		[Date.UTC(2026, 8, 27) / 1e3, 50]
	])
})

test('keeps summing metrics that add up across days', () => {
	expect(project('newUsers', 'week')).toEqual([
		[Date.UTC(2026, 8, 20) / 1e3, 120],
		[Date.UTC(2026, 8, 27) / 1e3, 50]
	])
})
