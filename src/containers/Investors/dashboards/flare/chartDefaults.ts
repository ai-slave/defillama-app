import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'

const THREE_MONTH_DAYS = 90

export function lastNDaysZoom(dataLength: number, days: number = THREE_MONTH_DAYS) {
	if (dataLength <= days) return undefined
	const start = ((dataLength - days) / dataLength) * 100
	return { dataZoom: { start, end: 100 } }
}

export function timeSeriesChartOptions(
	dataLength: number,
	valueSymbol: string
): IMultiSeriesChartProps['chartOptions'] {
	return {
		...createTimeSeriesChartOptions(valueSymbol),
		...(lastNDaysZoom(dataLength) ?? {})
	}
}

export const CSV_ONLY_EXPORT = { csv: true, png: false } as const

export const FLARE_PINK = '#E62058'
export const FLARE_ORANGE = '#FF7A1A'
export const FLARE_BLUE = '#2D63F6'
export const FLARE_GREEN = '#22c55e'
export const FLARE_RED = '#ef4444'
