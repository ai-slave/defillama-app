import { convertToCumulative } from '../utils'

type BaseSeries = {
	baseType: 'bar' | 'area' | 'line' | undefined
	data: [number, number][]
}

/** Apply cumulative display per series so snapshot lines are never running-summed or restyled. */
export function buildMultiChartSeriesView<T extends BaseSeries>(series: T, showCumulative: boolean) {
	const isCumulativeFlow = showCumulative && series.baseType === 'bar'
	return {
		...series,
		type: (series.baseType === 'bar' && !isCumulativeFlow ? 'bar' : 'line') as 'bar' | 'line',
		data: isCumulativeFlow ? convertToCumulative(series.data) : series.data,
		...(isCumulativeFlow ? { areaStyle: { opacity: 0.2 } } : {})
	}
}

/** Zero-fill an ascending series against ascending timestamps without allocating a lookup map. */
export function alignAscendingSeriesData(data: [number, number][], timestamps: number[]): [number, number][] {
	const aligned = new Array<[number, number]>(timestamps.length)
	let dataIndex = 0
	for (let timestampIndex = 0; timestampIndex < timestamps.length; timestampIndex++) {
		const timestamp = timestamps[timestampIndex]
		let value = 0
		while (dataIndex < data.length && data[dataIndex][0] <= timestamp) {
			const point = data[dataIndex]
			if (point[0] === timestamp) value = point[1]
			dataIndex++
		}
		aligned[timestampIndex] = [timestamp, value]
	}
	return aligned
}
