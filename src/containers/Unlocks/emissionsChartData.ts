import type { EmissionsChartRow, ProtocolEmissionComponentSection } from './api.types'

type Projection = 'tbd' | 'forecast'
type ProjectionSectionMetadata = Pick<ProtocolEmissionComponentSection, 'isTBD' | 'isForecast' | 'colorFrom'>

/**
 * Keep projection metadata attached only to series that the schedule chart can render.
 * Projected series get their own standard-allocation bucket so grouped charts do not
 * merge forecast values into documented values or silently discard them.
 */
export function buildEmissionProjectionModel({
	chartSections,
	categoriesBreakdown,
	sectionMetadata,
	seriesTbdSections,
	seriesForecastSections
}: {
	chartSections: string[]
	categoriesBreakdown: Record<string, string[]> | null
	sectionMetadata: Record<string, ProjectionSectionMetadata> | undefined
	seriesTbdSections: string[]
	seriesForecastSections: string[]
}): {
	categoriesBreakdown: Record<string, string[]> | null
	tbdSections: string[]
	forecastSections: string[]
} {
	const chartSectionByLowerName = new Map<string, string>()
	for (const section of chartSections) chartSectionByLowerName.set(section.toLowerCase(), section)

	let groupedSections: Record<string, string[]> | null = null
	const groupBySection = new Map<string, string>()
	if (categoriesBreakdown) {
		groupedSections = {}
		for (const group in categoriesBreakdown) {
			const sections: string[] = []
			for (const section of categoriesBreakdown[group]!) {
				const chartSection = chartSectionByLowerName.get(section.toLowerCase())
				if (!chartSection) continue
				sections.push(chartSection)
				groupBySection.set(chartSection.toLowerCase(), group)
			}
			if (sections.length > 0) groupedSections[group] = sections
		}
	}

	const tbdSections: string[] = []
	const forecastSections: string[] = []
	const projectionBySection = new Map<string, Projection>()
	for (const section of seriesForecastSections) projectionBySection.set(section.toLowerCase(), 'forecast')
	for (const section of seriesTbdSections) projectionBySection.set(section.toLowerCase(), 'tbd')
	const metadataBySection = new Map<string, ProjectionSectionMetadata>()
	const metadataSections = sectionMetadata ?? {}
	for (const metadataName in metadataSections) {
		const metadata = metadataSections[metadataName]!
		const lowerName = metadataName.toLowerCase()
		metadataBySection.set(lowerName, metadata)
		if (metadata.isTBD) projectionBySection.set(lowerName, 'tbd')
		else if (metadata.isForecast && projectionBySection.get(lowerName) !== 'tbd') {
			projectionBySection.set(lowerName, 'forecast')
		}
	}

	for (const [lowerName, projection] of projectionBySection) {
		const chartSection = chartSectionByLowerName.get(lowerName)
		if (!chartSection) continue
		const metadata = metadataBySection.get(lowerName)
		const projectionSections = projection === 'tbd' ? tbdSections : forecastSections
		projectionSections.push(chartSection)

		if (!groupedSections) continue
		const colorSource = metadata?.colorFrom
		const group =
			groupBySection.get(chartSection.toLowerCase()) ??
			(colorSource ? groupBySection.get(colorSource.toLowerCase()) : undefined)
		if (!group) continue

		const directGroup = groupBySection.get(chartSection.toLowerCase())
		const directGroupSections = directGroup ? groupedSections[directGroup] : undefined
		if (directGroup && directGroupSections) {
			groupedSections[directGroup] = directGroupSections.filter(
				(section) => section.toLowerCase() !== chartSection.toLowerCase()
			)
			if (groupedSections[directGroup]?.length === 0) delete groupedSections[directGroup]
		}

		const suffix = projection === 'tbd' ? 'TBD' : 'forecast'
		const projectedGroup = `${group} (${suffix})`
		;(groupedSections[projectedGroup] ??= []).push(chartSection)
		if (!projectionSections.includes(projectedGroup)) projectionSections.push(projectedGroup)
	}

	return { categoriesBreakdown: groupedSections, tbdSections, forecastSections }
}

export function processGroupedChartData(
	chartData: EmissionsChartRow[],
	categoriesBreakdown: Record<string, string[]>
): EmissionsChartRow[] {
	const result = new Array<EmissionsChartRow>(chartData.length)

	for (let i = 0; i < chartData.length; i++) {
		const entry = chartData[i]!
		const valuesByLowerName = new Map<string, number | null>()
		for (const key in entry) {
			const lowerName = key.toLowerCase()
			const value = entry[key]
			if (!valuesByLowerName.has(lowerName) && value !== undefined) valuesByLowerName.set(lowerName, value)
		}

		const groupedEntry: EmissionsChartRow = { timestamp: entry.timestamp }
		const price = entry.Price
		if (price != null) groupedEntry.Price = price
		const marketCap = entry['Market Cap']
		if (marketCap != null) groupedEntry['Market Cap'] = marketCap

		for (const group in categoriesBreakdown) {
			let total = 0
			for (const category of categoriesBreakdown[group]!) {
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

	const volatility: Record<string, number> = {}
	for (const stack of stacks) {
		let min = Infinity
		let max = -Infinity
		for (const row of chartData) {
			const value = row[stack] ?? 0
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

	return stacks.toSorted((a, b) => volatility[b]! - volatility[a]!)
}
