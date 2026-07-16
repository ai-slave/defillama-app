export interface ChartTooltipItem {
	axisValue: unknown
	data: unknown
	dataIndex: number | null
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

	return {
		axisValue: value.axisValue,
		data: value.data,
		dataIndex: typeof value.dataIndex === 'number' ? value.dataIndex : null,
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
	return isRecord(item.data) ? item.data[item.seriesName] : item.value
}

export function getChartTooltipTimestamp(item: ChartTooltipItem): number {
	const timestamp = isRecord(item.data) ? item.data.timestamp : item.axisValue
	return Number(timestamp)
}
