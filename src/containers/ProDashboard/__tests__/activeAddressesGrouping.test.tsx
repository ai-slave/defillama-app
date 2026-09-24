import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import type { ChartConfig } from '../types'

type Select = (data: Array<[number, number]>) => Array<[number, number]>
const captured: { select: Select | null } = { select: null }
vi.mock('@tanstack/react-query', async (importOriginal) => ({
	...(await importOriginal<typeof import('@tanstack/react-query')>()),
	useQuery: (options: { select: Select }) => {
		captured.select = options.select
		return { data: undefined, isLoading: true, isError: false }
	}
}))

import { useChartData } from '../queries'

// Mon Sep 14, 2026 in seconds; Sep 15 has no observation and Sep 16 is a real zero.
const day = (offset: number) => Date.UTC(2026, 8, 14 + offset) / 1e3
const daily: Array<[number, number]> = [
	[day(0), 90],
	[day(2), 0],
	[day(3), 30],
	[day(7), 50]
]

function project(chart: ChartConfig) {
	function Probe() {
		useChartData(chart, { status: 'ready' }, new Map(), 'all')
		return null
	}
	renderToStaticMarkup(<Probe />)
	return captured.select!(daily)
}

const chart = (type: string, grouping: ChartConfig['grouping']) =>
	({ id: 'c', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type, grouping }) as ChartConfig

test('averages the observed days of each period for active addresses', () => {
	expect(project(chart('activeUsers', 'week'))).toEqual([
		[Date.UTC(2026, 8, 20) / 1e3, 40],
		// The current week so far has one observed day.
		[Date.UTC(2026, 8, 27) / 1e3, 50]
	])
})

test('keeps summing metrics that add up across days', () => {
	expect(project(chart('newUsers', 'week'))).toEqual([
		[Date.UTC(2026, 8, 20) / 1e3, 120],
		[Date.UTC(2026, 8, 27) / 1e3, 50]
	])
})

test('leaves daily active addresses as they are', () => {
	expect(project(chart('activeUsers', 'day'))).toEqual(daily)
})
