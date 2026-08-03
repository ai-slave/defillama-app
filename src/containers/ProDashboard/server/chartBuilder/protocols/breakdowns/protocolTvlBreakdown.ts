import type { IProtocolChainBreakdownChart } from '~/containers/ProtocolOverview/api.types'
import { BREAKDOWN_COLOR_PALETTE, type ChartSeries } from '~/utils/breakdowns'

export interface ProtocolTvlChainFilter {
	includeChains?: ReadonlySet<string>
	excludeChains?: ReadonlySet<string>
	categoryChains?: ReadonlySet<string> | null
	categoryFilterMode?: 'include' | 'exclude'
}

function includesChain(chain: string, filter: ProtocolTvlChainFilter): boolean {
	if (filter.includeChains && !filter.includeChains.has(chain)) return false
	if (filter.excludeChains?.has(chain)) return false
	if (filter.categoryChains?.size) {
		const matchesCategory = filter.categoryChains.has(chain)
		if (filter.categoryFilterMode === 'exclude' ? matchesCategory : !matchesCategory) return false
	}
	return true
}

/**
 * V2 breakdown timestamps are normalized to milliseconds by the API client, while
 * Chart Builder's tuple contract remains seconds. The response is chronological.
 */
export function sumProtocolTvlBreakdown(
	chart: IProtocolChainBreakdownChart | null,
	filter: ProtocolTvlChainFilter = {}
): [number, number][] {
	if (!chart?.length) return []

	const series = new Array<[number, number]>(chart.length)
	let rowIndex = 0
	for (const [timestamp, values] of chart) {
		let total = 0
		for (const chain in values) {
			if (!includesChain(chain, filter)) continue
			const value = values[chain]
			if (value === undefined) throw new Error(`Missing protocol TVL value for ${chain}`)
			total += value
		}
		series[rowIndex] = [Math.floor(timestamp / 1e3), total]
		rowIndex++
	}
	return series
}

export function buildTopProtocolChainSeries({
	chart,
	topN,
	filter = {}
}: {
	chart: IProtocolChainBreakdownChart | null
	topN: number
	filter?: ProtocolTvlChainFilter
}): {
	series: ChartSeries[]
	chains: string[]
	totalChains: number
	topN: number
	othersCount: number
} {
	if (!chart?.length) return { series: [], chains: [], totalChains: 0, topN: 0, othersCount: 0 }

	// Updating in chronological order leaves each chain's last reported value in the map.
	const latestValues = new Map<string, number>()
	for (const [, values] of chart) {
		for (const chain in values) {
			if (!includesChain(chain, filter)) continue
			const value = values[chain]
			if (value === undefined) throw new Error(`Missing protocol TVL value for ${chain}`)
			latestValues.set(chain, value)
		}
	}

	const rankedChains = Array.from(latestValues.keys())
	rankedChains.sort((a, b) => (latestValues.get(b) ?? 0) - (latestValues.get(a) ?? 0))
	const selectedCount = Math.min(Math.max(0, topN), rankedChains.length)
	const selectedChains = rankedChains.slice(0, selectedCount)
	const selectedSet = new Set(selectedChains)
	const pointsByChain = new Map<string, [number, number][]>()
	for (const chain of selectedChains) pointsByChain.set(chain, new Array(chart.length))

	const othersData = new Array<[number, number]>(chart.length)
	let hasOthersValue = false
	let rowIndex = 0
	for (const [timestamp, values] of chart) {
		const timestampSeconds = Math.floor(timestamp / 1e3)
		let others = 0
		for (const chain in values) {
			if (!includesChain(chain, filter) || selectedSet.has(chain)) continue
			const value = values[chain]
			if (value === undefined) throw new Error(`Missing protocol TVL value for ${chain}`)
			others += value
		}
		if (others > 0) hasOthersValue = true
		othersData[rowIndex] = [timestampSeconds, others]
		for (const chain of selectedChains) {
			const points = pointsByChain.get(chain)
			if (!points) throw new Error(`Missing selected protocol TVL series for ${chain}`)
			points[rowIndex] = [timestampSeconds, values[chain] ?? 0]
		}
		rowIndex++
	}

	const series: ChartSeries[] = []
	let colorIndex = 0
	for (const chain of selectedChains) {
		const data = pointsByChain.get(chain)
		if (!data) throw new Error(`Missing selected protocol TVL series for ${chain}`)
		const color = BREAKDOWN_COLOR_PALETTE[colorIndex % BREAKDOWN_COLOR_PALETTE.length]
		if (color === undefined) throw new Error('Breakdown color palette must not be empty')
		series.push({
			name: chain,
			data,
			color
		})
		colorIndex++
	}

	const othersCount = rankedChains.length - selectedCount
	if (othersCount > 0 && hasOthersValue) {
		series.push({ name: `Others (${othersCount} chains)`, data: othersData, color: '#999999' })
	}

	return {
		series,
		chains: rankedChains,
		totalChains: rankedChains.length,
		topN: selectedCount,
		othersCount
	}
}
