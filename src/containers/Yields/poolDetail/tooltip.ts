import { getTooltipRawYValue } from '~/components/ECharts/shared/tooltip'

export interface ChartTooltipItem {
	axisValue: unknown
	data: unknown
	dataIndex?: number
	dimensionNames?: ReadonlyArray<string>
	encode?: { x?: ReadonlyArray<number | string>; y?: ReadonlyArray<number | string> }
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
		...(typeof value.dataIndex === 'number' ? { dataIndex: value.dataIndex } : {}),
		...(Array.isArray(value.dimensionNames) ? { dimensionNames: value.dimensionNames as Array<string> } : {}),
		...(encode
			? {
					encode: {
						...(Array.isArray(encode.x) ? { x: encode.x as Array<number | string> } : {}),
						...(Array.isArray(encode.y) ? { y: encode.y as Array<number | string> } : {})
					}
				}
			: {}),
		marker: typeof value.marker === 'string' ? value.marker : '',
		name: typeof value.name === 'string' ? value.name : '',
		seriesName: typeof value.seriesName === 'string' ? value.seriesName : '',
		value: value.value
	}
}

export function getChartTooltipItems(params: unknown): Array<ChartTooltipItem> {
	const values = Array.isArray(params) ? params : params == null ? [] : [params]
	const items: Array<ChartTooltipItem> = []

	for (const value of values) {
		const item = toTooltipItem(value)
		if (item) items.push(item)
	}

	return items
}

export function getChartTooltipValue(item: ChartTooltipItem): unknown {
	return getTooltipRawYValue(item, item.seriesName)
}
