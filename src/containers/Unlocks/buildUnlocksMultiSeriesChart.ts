import dayjs from 'dayjs'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { isWeeklyRateCalendarEvent, type UnlocksData } from './calendarTypes'
import { COLOR_PALETTE } from './constants'

type UnlocksMultiSeriesChartResult = {
	dataset: MultiSeriesChartDataset
	charts: NonNullable<IMultiSeriesChartProps['charts']>
}

export function buildUnlocksMultiSeriesChartForDateRange({
	dates,
	unlocksData
}: {
	dates: string[]
	unlocksData: UnlocksData
}): UnlocksMultiSeriesChartResult {
	const protocolTotals = new Map<string, number>()

	for (const dateStr of dates) {
		const events = unlocksData[dateStr]?.events
		if (!events) continue

		for (const event of events) {
			if (isWeeklyRateCalendarEvent(event)) continue
			const name = event.protocol
			const value = event.value
			if (value <= 0) continue
			protocolTotals.set(name, (protocolTotals.get(name) ?? 0) + value)
		}
	}

	const sortedProtocols = Array.from(protocolTotals.keys()).sort(
		(a, b) => protocolTotals.get(b)! - protocolTotals.get(a)!
	)

	// Keep rendering behavior consistent with the old BarChart:
	// if there are no protocol series, still render a 0-valued series.
	const hasProtocolSeries = sortedProtocols.length > 0
	const seriesNames: string[] = hasProtocolSeries ? sortedProtocols : ['Unlocks']

	const protocolIndex = new Map(seriesNames.map((name, index) => [name, index + 1]))
	const source: MultiSeriesChartDataset['source'] = dates.map((dateStr) => {
		const parsedDate = dayjs(dateStr)
		const row = new Array<number>(seriesNames.length + 1).fill(0)
		row[0] = parsedDate.unix() * 1e3

		const events = unlocksData[dateStr]?.events
		if (hasProtocolSeries && events) {
			for (const event of events) {
				if (isWeeklyRateCalendarEvent(event)) continue
				const name = event.protocol
				const value = event.value
				if (value <= 0) continue
				const valueIndex = protocolIndex.get(name)
				if (valueIndex != null) row[valueIndex] = row[valueIndex]! + value
			}
		}

		return row
	})

	const dimensions = ['timestamp', ...seriesNames]

	const charts = seriesNames.map((name, i) => ({
		type: 'bar' as const,
		name,
		encode: { x: 0, y: i + 1 },
		stack: 'unlocks',
		color: COLOR_PALETTE[i % COLOR_PALETTE.length]!,
		large: false
	}))

	return {
		dataset: { source, dimensions } satisfies MultiSeriesChartDataset,
		charts
	}
}
