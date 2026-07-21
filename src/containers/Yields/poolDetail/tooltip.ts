import { getTooltipAxisValue, getTooltipRawYValue } from '~/components/ECharts/shared/tooltip'

export interface ChartTooltipItem {
	axisValue: unknown
	data: unknown
	dataIndex: number | null
	dimensionNames?: readonly string[]
	encode?: { x?: readonly (number | string)[]; y?: readonly (number | string)[] }
	marker: string
	name: string
	seriesName: string
	value: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value != null
}

function toTooltipItem(value: unknown): ChartTooltipItem | null {
	if (!isRecord(value)) return null
	const encode = isRecord(value.encode) ? value.encode : undefined

	return {
		axisValue: value.axisValue,
		data: value.data,
		dataIndex: typeof value.dataIndex === 'number' ? value.dataIndex : null,
		dimensionNames: Array.isArray(value.dimensionNames) ? (value.dimensionNames as string[]) : undefined,
		encode: encode
			? {
					x: Array.isArray(encode.x) ? (encode.x as Array<number | string>) : undefined,
					y: Array.isArray(encode.y) ? (encode.y as Array<number | string>) : undefined
				}
			: undefined,
		marker: typeof value.marker === 'string' ? value.marker : '',
		name: typeof value.name === 'string' ? value.name : '',
		seriesName: typeof value.seriesName === 'string' ? value.seriesName : '',
		value: value.value
	}
}

export function getChartTooltipItems(params: unknown): ChartTooltipItem[] {
	const values = Array.isArray(params) ? params : params == null ? [] : [params]
	const items: ChartTooltipItem[] = []

	for (const value of values) {
		const item = toTooltipItem(value)
		if (item) items.push(item)
	}

	return items
}

export function getChartTooltipValue(item: ChartTooltipItem): unknown {
	return getTooltipRawYValue(item, item.seriesName)
}

export function getChartTooltipTimestamp(item: ChartTooltipItem): number {
	return getTooltipAxisValue(item)
}
