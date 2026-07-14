import { getTimeSeriesPeriodPair } from './timeSeries'

export function getPrevTvlFromChart(
	chart: [number, number][] | null | undefined,
	daysBefore: number,
	currentTimeMs: number = Date.now()
): number | null {
	if (!chart?.length) return null

	if (daysBefore === 0) {
		return chart[chart.length - 1]?.[1] ?? null
	}

	const pair = getTimeSeriesPeriodPair(chart, daysBefore, (point) => point[0], { currentTimeMs })
	return pair?.previous[1] ?? null
}
