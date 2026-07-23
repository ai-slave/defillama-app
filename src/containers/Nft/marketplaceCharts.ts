import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { getNDistinctColors } from '~/utils'
import type { RawNftMarketplaceVolume } from './api.types'

type DailyMarketplaceValues = {
	timestamp: number
	volume: Map<string, number>
	trades: Map<string, number>
	volumeTotal: number
	tradeTotal: number
	upstreamRemainderVolume: number
	upstreamRemainderTrades: number
}

const MAX_MARKETPLACE_SERIES = 30
const REMAINDER_SERIES_NAME = 'Others'

export type NFTMarketplaceChartData = {
	absoluteVolumeDataset: MultiSeriesChartDataset
	absoluteTradesDataset: MultiSeriesChartDataset
	absoluteBarCharts: MultiSeriesChartSeriesConfig[]
	dailyTotals: Array<[volume: number, trades: number]>
	upstreamRemainder: Array<[volume: number, trades: number]>
	availableSeries: string[]
}

export type NFTMarketplaceRelativeChartData = {
	relativeVolumeDataset: MultiSeriesChartDataset
	relativeTradesDataset: MultiSeriesChartDataset
	relativeAreaCharts: MultiSeriesChartSeriesConfig[]
}

function roundToThreeDecimals(value: number): number {
	return +value.toFixed(3)
}

function getNumericDominance(value: number, total: number): number {
	if (!value || !total) return 0
	const ratio = total > 0 ? value / total : 0
	return Math.round(ratio * 10_000) / 100
}

export function buildNFTMarketplaceChartData(volume: RawNftMarketplaceVolume[]): NFTMarketplaceChartData {
	const daysByTimestamp = new Map<number, DailyMarketplaceValues>()
	const marketplaces: string[] = []
	const seenMarketplaces = new Set<string>()
	const volumeByMarketplace = new Map<string, number>()

	for (const entry of volume) {
		const parsedTimestamp = Date.parse(entry.day)
		const volumeValue = entry.sum ?? 0
		// Preserve the legacy second-level dataset timestamp while parsing each API date only once.
		const timestamp = Math.floor(parsedTimestamp / 1_000) * 1_000
		let day = daysByTimestamp.get(timestamp)
		if (!day) {
			day = {
				timestamp,
				volume: new Map(),
				trades: new Map(),
				volumeTotal: 0,
				tradeTotal: 0,
				upstreamRemainderVolume: 0,
				upstreamRemainderTrades: 0
			}
			daysByTimestamp.set(timestamp, day)
		}

		day.volumeTotal += volumeValue
		day.tradeTotal += entry.count
		if (entry.exchangeName === REMAINDER_SERIES_NAME) {
			day.upstreamRemainderVolume += roundToThreeDecimals(volumeValue)
			day.upstreamRemainderTrades += roundToThreeDecimals(entry.count)
			continue
		}
		day.volume.set(entry.exchangeName, (day.volume.get(entry.exchangeName) ?? 0) + roundToThreeDecimals(volumeValue))
		day.trades.set(entry.exchangeName, (day.trades.get(entry.exchangeName) ?? 0) + roundToThreeDecimals(entry.count))
		volumeByMarketplace.set(entry.exchangeName, (volumeByMarketplace.get(entry.exchangeName) ?? 0) + volumeValue)

		if (!seenMarketplaces.has(entry.exchangeName)) {
			seenMarketplaces.add(entry.exchangeName)
			marketplaces.push(entry.exchangeName)
		}
	}
	const days = Array.from(daysByTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp)

	const displayedMarketplaces = marketplaces.sort(
		(a, b) => (volumeByMarketplace.get(b) ?? 0) - (volumeByMarketplace.get(a) ?? 0)
	)

	const dimensions = ['timestamp', ...displayedMarketplaces]
	const absoluteVolumeSource = new Array<MultiSeriesChartDataset['source'][number]>(days.length)
	const absoluteTradesSource = new Array<MultiSeriesChartDataset['source'][number]>(days.length)
	const dailyTotals = new Array<[volume: number, trades: number]>(days.length)
	const upstreamRemainder = new Array<[volume: number, trades: number]>(days.length)

	for (let i = 0; i < days.length; i++) {
		const day = days[i]
		const absoluteVolume = new Array<number>(dimensions.length)
		const absoluteTrades = new Array<number>(dimensions.length)
		absoluteVolume[0] = day.timestamp
		absoluteTrades[0] = day.timestamp
		for (let j = 0; j < displayedMarketplaces.length; j++) {
			const marketplace = displayedMarketplaces[j]
			const volumeValue = day.volume.get(marketplace) ?? 0
			const tradeValue = day.trades.get(marketplace) ?? 0
			absoluteVolume[j + 1] = volumeValue
			absoluteTrades[j + 1] = tradeValue
		}

		absoluteVolumeSource[i] = absoluteVolume
		absoluteTradesSource[i] = absoluteTrades
		dailyTotals[i] = [day.volumeTotal, day.tradeTotal]
		upstreamRemainder[i] = [day.upstreamRemainderVolume, day.upstreamRemainderTrades]
	}

	const colors = getNDistinctColors(displayedMarketplaces.length)
	const absoluteBarCharts = new Array<MultiSeriesChartSeriesConfig>(displayedMarketplaces.length)
	for (let i = 0; i < displayedMarketplaces.length; i++) {
		const name = displayedMarketplaces[i]
		absoluteBarCharts[i] = {
			type: 'bar',
			name,
			encode: { x: 0, y: i + 1 },
			stack: 'stackA',
			color: colors[i],
			large: false
		}
	}

	return {
		absoluteVolumeDataset: { source: absoluteVolumeSource, dimensions },
		absoluteTradesDataset: { source: absoluteTradesSource, dimensions },
		absoluteBarCharts,
		dailyTotals,
		upstreamRemainder,
		availableSeries: displayedMarketplaces
	}
}

export function buildNFTMarketplaceChartPresentation(
	canonical: NFTMarketplaceChartData,
	selectedSeries: readonly string[],
	includeUpstreamRemainder: boolean
): NFTMarketplaceChartData {
	const selected = new Set(selectedSeries)
	const rankedSelection = canonical.availableSeries.filter((name) => selected.has(name))
	const explicitSeries = rankedSelection.slice(0, MAX_MARKETPLACE_SERIES - 1)
	const omittedSeries = rankedSelection.slice(MAX_MARKETPLACE_SERIES - 1)
	const hasUpstreamRemainder =
		includeUpstreamRemainder && canonical.upstreamRemainder.some(([volume, trades]) => volume !== 0 || trades !== 0)
	const hasRemainder = omittedSeries.length > 0 || hasUpstreamRemainder
	const visibleSeries = hasRemainder ? [...explicitSeries, REMAINDER_SERIES_NAME] : explicitSeries
	const canonicalIndex = new Map(canonical.absoluteVolumeDataset.dimensions.map((name, index) => [name, index]))
	const omittedIndexes = omittedSeries.map((name) => canonicalIndex.get(name)!)
	const project = (dataset: MultiSeriesChartDataset, remainderMetricIndex: 0 | 1) => ({
		dimensions: ['timestamp', ...visibleSeries],
		source: dataset.source.map((input, rowIndex) => {
			const row = new Array<number>(visibleSeries.length + 1)
			row[0] = input[0] as number
			for (let index = 0; index < explicitSeries.length; index++) {
				row[index + 1] = (input[canonicalIndex.get(explicitSeries[index])!] as number | undefined) ?? 0
			}
			if (hasRemainder) {
				let others = hasUpstreamRemainder ? canonical.upstreamRemainder[rowIndex][remainderMetricIndex] : 0
				for (const inputIndex of omittedIndexes) others += (input[inputIndex] as number | undefined) ?? 0
				row[row.length - 1] = others
			}
			return row
		})
	})
	const absoluteVolumeDataset = project(canonical.absoluteVolumeDataset, 0)
	const absoluteTradesDataset = project(canonical.absoluteTradesDataset, 1)
	const chartByName = new Map(canonical.absoluteBarCharts.map((chart) => [chart.name, chart]))
	const remainderChart = canonical.absoluteBarCharts[0] ?? {
		type: 'bar' as const,
		name: REMAINDER_SERIES_NAME,
		encode: { x: 0, y: 1 },
		stack: 'stackA',
		large: false
	}
	const absoluteBarCharts = visibleSeries.map((name, index) =>
		name === REMAINDER_SERIES_NAME
			? { ...remainderChart, name, encode: { x: 0, y: index + 1 }, color: '#AAAAAA' }
			: { ...chartByName.get(name)!, encode: { x: 0, y: index + 1 } }
	)
	const dailyTotals =
		includeUpstreamRemainder && rankedSelection.length === canonical.availableSeries.length
			? canonical.dailyTotals
			: absoluteVolumeDataset.source.map((volumeRow, rowIndex) => {
					const tradesRow = absoluteTradesDataset.source[rowIndex]
					let volume = 0
					let trades = 0
					for (let index = 1; index < volumeRow.length; index++) {
						volume += (volumeRow[index] as number | undefined) ?? 0
						trades += (tradesRow[index] as number | undefined) ?? 0
					}
					return [volume, trades] as [number, number]
				})
	return {
		absoluteVolumeDataset,
		absoluteTradesDataset,
		absoluteBarCharts,
		dailyTotals,
		upstreamRemainder: canonical.upstreamRemainder,
		availableSeries: canonical.availableSeries
	}
}

export function buildNFTMarketplaceRelativeChartData(
	absolute: NFTMarketplaceChartData
): NFTMarketplaceRelativeChartData {
	const dimensions = absolute.absoluteVolumeDataset.dimensions
	const relativeVolumeSource = new Array<MultiSeriesChartDataset['source'][number]>(absolute.dailyTotals.length)
	const relativeTradesSource = new Array<MultiSeriesChartDataset['source'][number]>(absolute.dailyTotals.length)

	for (let i = 0; i < absolute.dailyTotals.length; i++) {
		const absoluteVolume = absolute.absoluteVolumeDataset.source[i]
		const absoluteTrades = absolute.absoluteTradesDataset.source[i]
		const totals = absolute.dailyTotals[i]
		const relativeVolume = new Array<number>(dimensions.length)
		const relativeTrades = new Array<number>(dimensions.length)
		relativeVolume[0] = absoluteVolume[0] as number
		relativeTrades[0] = absoluteTrades[0] as number
		for (let j = 1; j < dimensions.length; j++) {
			relativeVolume[j] = getNumericDominance(absoluteVolume[j] as number, totals[0])
			relativeTrades[j] = getNumericDominance(absoluteTrades[j] as number, totals[1])
		}
		relativeVolumeSource[i] = relativeVolume
		relativeTradesSource[i] = relativeTrades
	}

	return {
		relativeVolumeDataset: { source: relativeVolumeSource, dimensions },
		relativeTradesDataset: { source: relativeTradesSource, dimensions },
		relativeAreaCharts: absolute.absoluteBarCharts.map(({ name, encode, color }) => ({
			type: 'line',
			name,
			encode,
			color
		}))
	}
}
