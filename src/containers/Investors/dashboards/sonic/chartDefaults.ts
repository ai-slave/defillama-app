import { createTimeSeriesChartOptions } from '~/components/ECharts/timeSeriesChartOptions'
import type {
	IMultiSeriesChart2Props,
	IMultiSeriesChartProps,
	MultiSeriesChart2SeriesConfig
} from '~/components/ECharts/types'

const THREE_MONTH_DAYS = 90

export const CSV_ONLY_EXPORT = { csv: true, png: false } as const

type TimeSeries = { name: string }

export function multiSeriesCharts(
	series: readonly TimeSeries[],
	type: MultiSeriesChart2SeriesConfig['type'],
	stack?: string,
	colors?: Record<string, string>
): MultiSeriesChart2SeriesConfig[] {
	return series.map((item, index) => {
		const color = colors?.[item.name]
		return {
			type,
			name: item.name,
			encode: { x: 'timestamp', y: item.name },
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
): IMultiSeriesChart2Props['chartOptions'] | undefined {
	if (dataLength <= days) return undefined
	const start = ((dataLength - days) / dataLength) * 100
	return { dataZoom: { start, end: 100 } }
}

export function datasetChartOptions(dataLength: number, valueSymbol: string): IMultiSeriesChart2Props['chartOptions'] {
	return {
		...createTimeSeriesChartOptions(valueSymbol),
		...(lastNDaysDatasetZoom(dataLength) ?? {})
	}
}

export const STACKED_UNITLESS_TIME_CHART_OPTIONS = createTimeSeriesChartOptions('')
