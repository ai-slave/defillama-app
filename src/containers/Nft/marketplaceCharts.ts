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
type NFTMarketplaceDatasetRow = [timestamp: number, ...values: number[]]
type NFTMarketplaceDataset = Omit<MultiSeriesChartDataset, 'source'> & { source: NFTMarketplaceDatasetRow[] }

export type NFTMarketplaceChartData = {
	absoluteVolumeDataset: NFTMarketplaceDataset
	absoluteTradesDataset: NFTMarketplaceDataset
	absoluteBarCharts: MultiSeriesChartSeriesConfig[]
	dailyTotals: Array<[volume: number, trades: number]>
	upstreamRemainder: Array<[volume: number, trades: number]>
	availableSeries: string[]
}

export type NFTMarketplaceRelativeChartData = {
	relativeVolumeDataset: NFTMarketplaceDataset
	relativeTradesDataset: NFTMarketplaceDataset
	relativeAreaCharts: MultiSeriesChartSeriesConfig[]
}

export type NFTMarketplaceCsvMetric = 'volume' | 'trades'

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
			day.upstreamRemainderVolume += volumeValue
			day.upstreamRemainderTrades += entry.count
			continue
		}
		day.volume.set(entry.exchangeName, (day.volume.get(entry.exchangeName) ?? 0) + volumeValue)
		day.trades.set(entry.exchangeName, (day.trades.get(entry.exchangeName) ?? 0) + entry.count)
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
	const absoluteVolumeSource = new Array<NFTMarketplaceDatasetRow>(days.length)
	const absoluteTradesSource = new Array<NFTMarketplaceDatasetRow>(days.length)
	const dailyTotals = new Array<[volume: number, trades: number]>(days.length)
	const upstreamRemainder = new Array<[volume: number, trades: number]>(days.length)

	for (let i = 0; i < days.length; i++) {
		const day = days[i]
		const absoluteVolume: NFTMarketplaceDatasetRow = [day.timestamp]
		const absoluteTrades: NFTMarketplaceDatasetRow = [day.timestamp]
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
	const omittedIndexes: number[] = []
	for (const name of omittedSeries) {
		const index = canonicalIndex.get(name)
		if (index === undefined) throw new Error(`Missing NFT marketplace dimension: ${name}`)
		omittedIndexes.push(index)
	}
	const project = (dataset: NFTMarketplaceDataset, remainderMetricIndex: 0 | 1): NFTMarketplaceDataset => ({
		dimensions: ['timestamp', ...visibleSeries],
		source: dataset.source.map((input, rowIndex) => {
			const row: NFTMarketplaceDatasetRow = [input[0]]
			for (let index = 0; index < explicitSeries.length; index++) {
				const name = explicitSeries[index]!
				const inputIndex = canonicalIndex.get(name)
				if (inputIndex === undefined) throw new Error(`Missing NFT marketplace dimension: ${name}`)
				row.push(input[inputIndex] ?? 0)
			}
			if (hasRemainder) {
				let others = hasUpstreamRemainder ? (canonical.upstreamRemainder[rowIndex]?.[remainderMetricIndex] ?? 0) : 0
				for (const inputIndex of omittedIndexes) others += input[inputIndex] ?? 0
				row.push(others)
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
						volume += volumeRow[index] ?? 0
						trades += tradesRow[index] ?? 0
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
	const relativeVolumeSource = new Array<NFTMarketplaceDatasetRow>(absolute.dailyTotals.length)
	const relativeTradesSource = new Array<NFTMarketplaceDatasetRow>(absolute.dailyTotals.length)

	for (let i = 0; i < absolute.dailyTotals.length; i++) {
		const absoluteVolume = absolute.absoluteVolumeDataset.source[i]
		const absoluteTrades = absolute.absoluteTradesDataset.source[i]
		const totals = absolute.dailyTotals[i]
		const relativeVolume: NFTMarketplaceDatasetRow = [absoluteVolume[0]]
		const relativeTrades: NFTMarketplaceDatasetRow = [absoluteTrades[0]]
		for (let j = 1; j < dimensions.length; j++) {
			relativeVolume.push(getNumericDominance(absoluteVolume[j] ?? 0, totals[0]))
			relativeTrades.push(getNumericDominance(absoluteTrades[j] ?? 0, totals[1]))
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

/** Export every marketplace plus the irreducible upstream remainder, independent of legend state. */
export function buildNFTMarketplaceCsvDataset({
	canonical,
	metric,
	relative
}: {
	canonical: NFTMarketplaceChartData
	metric: NFTMarketplaceCsvMetric
	relative: boolean
}): MultiSeriesChartDataset {
	const metricIndex = metric === 'volume' ? 0 : 1
	const dataset = metric === 'volume' ? canonical.absoluteVolumeDataset : canonical.absoluteTradesDataset
	const includeUpstreamRemainder = canonical.upstreamRemainder.some((values) => values[metricIndex] !== 0)
	if (!relative && !includeUpstreamRemainder) return dataset

	const dimensions = includeUpstreamRemainder ? [...dataset.dimensions, REMAINDER_SERIES_NAME] : dataset.dimensions
	const source = new Array<MultiSeriesChartDataset['source'][number]>(dataset.source.length)
	for (let rowIndex = 0; rowIndex < dataset.source.length; rowIndex++) {
		const input = dataset.source[rowIndex]
		const total = canonical.dailyTotals[rowIndex][metricIndex]
		const row: NFTMarketplaceDatasetRow = [input[0]]
		for (let valueIndex = 1; valueIndex < dataset.dimensions.length; valueIndex++) {
			const value = input[valueIndex] ?? 0
			row.push(relative ? getNumericDominance(value, total) : value)
		}
		if (includeUpstreamRemainder) {
			const value = canonical.upstreamRemainder[rowIndex]?.[metricIndex] ?? 0
			row.push(relative ? getNumericDominance(value, total) : value)
		}
		source[rowIndex] = row
	}
	return { dimensions, source }
}
