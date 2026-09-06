import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'

const THREE_MONTH_DAYS = 90

export const CSV_ONLY_EXPORT = { csv: true, png: false } as const

type TimeSeries = { name: string }

export function multiSeriesCharts(
	series: ReadonlyArray<TimeSeries>,
	type: MultiSeriesChartSeriesConfig['type'],
	stack?: string,
	colors?: Record<string, string>
): Array<MultiSeriesChartSeriesConfig> {
	return series.map((item, index) => {
		const color = colors?.[item.name]
		return {
			type,
			name: item.name,
			encode: { x: 0, y: index + 1 },
			...(stack ? { stack } : {}),
			...(color ? { color } : {}),
			...(type === 'line' && !stack && index > 0 && !color ? { hideAreaStyle: true } : {})
		}
	})
}

export function lastNDaysZoom(
	dataLength: number,
	days: number = THREE_MONTH_DAYS
): IMultiSeriesChartProps['chartOptions'] | undefined {
	if (dataLength <= days) return undefined
	const start = ((dataLength - days) / dataLength) * 100
	return {
		dataZoom: [
			{ start, end: 100 },
			{ start, end: 100 }
		]
	}
}

export function lastNDaysDatasetZoom(
	dataLength: number,
	days: number = THREE_MONTH_DAYS
): IMultiSeriesChartProps['chartOptions'] | undefined {
	if (dataLength <= days) return undefined
	const start = ((dataLength - days) / dataLength) * 100
	return { dataZoom: { start, end: 100 } }
}

export function datasetChartOptions(dataLength: number, valueSymbol: string): IMultiSeriesChartProps['chartOptions'] {
	return {
		...createTimeSeriesChartOptions(valueSymbol),
		...lastNDaysDatasetZoom(dataLength)
	}
}

export const STACKED_UNITLESS_TIME_CHART_OPTIONS = createTimeSeriesChartOptions('')
