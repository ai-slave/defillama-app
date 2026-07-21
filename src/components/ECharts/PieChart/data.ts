type PieInputRow = Record<string, unknown>

/** Normalize and rank pie slices, folding the tail and any explicit remainder into `Others`. */
export function preparePieChartData({
	data,
	sliceIdentifier = 'name',
	sliceValue = 'value',
	limit
}: {
	data: Record<string, number> | PieInputRow[]
	sliceIdentifier?: string
	sliceValue?: string
	limit?: number
}) {
	const pieData: Array<{ name: string; value: number }> = []
	if (Array.isArray(data)) {
		for (const entry of data) {
			const name = Object.hasOwn(entry, sliceIdentifier) ? entry[sliceIdentifier] : undefined
			const value = Object.hasOwn(entry, sliceValue) ? entry[sliceValue] : undefined
			pieData.push({ name: String(name), value: Number(value) })
		}
	} else {
		for (const name in data) {
			if (Object.hasOwn(data, name)) pieData.push({ name, value: Number(data[name]) })
		}
	}

	pieData.sort((a, b) => b.value - a.value)
	if (!limit) return pieData

	const mainSlices: Array<{ name: string; value: number }> = []
	let othersValue = 0
	for (let i = 0; i < pieData.length; i++) {
		const slice = pieData[i]
		if (i < limit && slice.name !== 'Others') mainSlices.push(slice)
		else othersValue += slice.value
	}
	if (othersValue > 0) mainSlices.push({ name: 'Others', value: othersValue })
	return mainSlices
}
