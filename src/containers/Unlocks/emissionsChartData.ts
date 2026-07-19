import { createChartRecord, createChartRow } from '~/components/ECharts/dynamicRow'
import type { EmissionsChartRow } from './api.types'

export function processGroupedChartData(
	chartData: EmissionsChartRow[],
	categoriesBreakdown: Record<string, string[]>
): EmissionsChartRow[] {
	const result = new Array<EmissionsChartRow>(chartData.length)

	for (let i = 0; i < chartData.length; i++) {
		const entry = chartData[i]
		const valuesByLowerName = new Map<string, number | null>()
		for (const key in entry) {
			const lowerName = key.toLowerCase()
			if (!valuesByLowerName.has(lowerName)) valuesByLowerName.set(lowerName, entry[key])
		}

		const groupedEntry = createChartRow<number | null>(entry.timestamp)
		const price = entry.Price
		if (price != null) groupedEntry.Price = price
		const marketCap = entry['Market Cap']
		if (marketCap != null) groupedEntry['Market Cap'] = marketCap

		for (const group in categoriesBreakdown) {
			let total = 0
			for (const category of categoriesBreakdown[group]) {
				total += valuesByLowerName.get(category.toLowerCase()) ?? 0
			}
			groupedEntry[group] = total
		}

		result[i] = groupedEntry
	}

	return result
}

export function sortStacksByVolatility(stacks: string[], chartData: EmissionsChartRow[]): string[] {
	if (chartData.length < 2) return stacks

	const volatility = createChartRecord<number>()
	for (const stack of stacks) {
		let min = Infinity
		let max = -Infinity
		for (const row of chartData) {
			const value = Object.hasOwn(row, stack) ? (row[stack] ?? 0) : 0
			if (Number.isNaN(value)) {
				min = Number.NaN
				max = Number.NaN
				break
			}
			if (value < min) min = value
			if (value > max) max = value
		}
		volatility[stack] = max - min
	}

	return stacks.toSorted((a, b) => volatility[b] - volatility[a])
}
