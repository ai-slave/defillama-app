import type { MultiSeriesChart2Dataset } from '~/components/ECharts/types'

/** Build a final millisecond dataset in one pass; cumulative is only valid for flow/bar metrics. */
export function buildSingleMetricChartDataset(
	data: readonly [number, number][] | undefined,
	seriesName: string,
	cumulative: boolean
): MultiSeriesChart2Dataset {
	if (!data?.length) return { source: [], dimensions: ['timestamp', seriesName] }

	const source = new Array<Record<string, number>>(data.length)
	let runningTotal = 0
	for (let i = 0; i < data.length; i++) {
		const [timestampSec, value] = data[i]
		if (cumulative) runningTotal += value
		source[i] = {
			timestamp: timestampSec * 1e3,
			[seriesName]: cumulative ? runningTotal : value
		}
	}

	return { source, dimensions: ['timestamp', seriesName] }
}
