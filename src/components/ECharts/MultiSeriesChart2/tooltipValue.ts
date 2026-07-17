import { isTooltipDataRecord } from '../formatters'

export function getTooltipRawYValue(item: any, seriesName: string): any {
	const data = item?.data

	// Series display names can differ from dataset keys, so prefer the encoded dimension.
	if (isTooltipDataRecord(data)) {
		const yDimensionIndex = item?.encode?.y?.[0]
		const yDimensionName = yDimensionIndex != null ? item?.dimensionNames?.[yDimensionIndex] : undefined
		if (yDimensionName != null && yDimensionName in data) return data[yDimensionName]
	}

	if (isTooltipDataRecord(data) && seriesName in data) return data[seriesName]

	if (Array.isArray(item?.value)) return item.value[1]

	return item?.value
}
