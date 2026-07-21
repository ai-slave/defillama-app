import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { getNDistinctColors } from '~/utils'
import type { RawNftMarketplaceVolume } from './api.types'

type DailyMarketplaceValues = {
	timestamp: number
	volume: Map<string, number>
	trades: Map<string, number>
	volumeTotal: number
	tradeTotal: number
}

const MAX_MARKETPLACE_SERIES = 30

export type NFTMarketplaceChartData = {
	absoluteVolumeDataset: MultiSeriesChartDataset
	relativeVolumeDataset: MultiSeriesChartDataset
	absoluteTradesDataset: MultiSeriesChartDataset
	relativeTradesDataset: MultiSeriesChartDataset
	absoluteBarCharts: MultiSeriesChartSeriesConfig[]
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
				tradeTotal: 0
			}
			daysByTimestamp.set(timestamp, day)
		}

		day.volumeTotal += volumeValue
		day.tradeTotal += entry.count
		day.volume.set(entry.exchangeName, (day.volume.get(entry.exchangeName) ?? 0) + roundToThreeDecimals(volumeValue))
		day.trades.set(entry.exchangeName, (day.trades.get(entry.exchangeName) ?? 0) + roundToThreeDecimals(entry.count))
		volumeByMarketplace.set(entry.exchangeName, (volumeByMarketplace.get(entry.exchangeName) ?? 0) + volumeValue)

		if (!seenMarketplaces.has(entry.exchangeName)) {
			seenMarketplaces.add(entry.exchangeName)
			marketplaces.push(entry.exchangeName)
		}
	}
	const days = Array.from(daysByTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp)

	let displayedMarketplaces = marketplaces
	let omittedMarketplaceSet: Set<string> | null = null
	if (marketplaces.length > MAX_MARKETPLACE_SERIES) {
		const rankedMarketplaces = marketplaces.filter((name) => name !== 'Others')
		rankedMarketplaces.sort((a, b) => (volumeByMarketplace.get(b) ?? 0) - (volumeByMarketplace.get(a) ?? 0))
		const displayedSet = new Set(rankedMarketplaces.slice(0, MAX_MARKETPLACE_SERIES - 1))
		displayedMarketplaces = marketplaces.filter((name) => displayedSet.has(name))
		displayedMarketplaces.push('Others')
		omittedMarketplaceSet = new Set(marketplaces.filter((name) => !displayedSet.has(name)))
	}

	const dimensions = ['timestamp', ...displayedMarketplaces]
	const absoluteVolumeSource = new Array<MultiSeriesChartDataset['source'][number]>(days.length)
	const relativeVolumeSource = new Array<MultiSeriesChartDataset['source'][number]>(days.length)
	const absoluteTradesSource = new Array<MultiSeriesChartDataset['source'][number]>(days.length)
	const relativeTradesSource = new Array<MultiSeriesChartDataset['source'][number]>(days.length)

	for (let i = 0; i < days.length; i++) {
		const day = days[i]
		const absoluteVolume = new Array<number>(dimensions.length)
		const absoluteTrades = new Array<number>(dimensions.length)
		const relativeVolume = new Array<number>(dimensions.length)
		const relativeTrades = new Array<number>(dimensions.length)
		absoluteVolume[0] = day.timestamp
		absoluteTrades[0] = day.timestamp
		relativeVolume[0] = day.timestamp
		relativeTrades[0] = day.timestamp
		let otherVolume = 0
		let otherTrades = 0
		if (omittedMarketplaceSet) {
			for (const [marketplace, volumeValue] of day.volume) {
				if (!omittedMarketplaceSet.has(marketplace)) continue
				otherVolume += volumeValue
				otherTrades += day.trades.get(marketplace) ?? 0
			}
		}

		for (let j = 0; j < displayedMarketplaces.length; j++) {
			const marketplace = displayedMarketplaces[j]
			const volumeValue =
				marketplace === 'Others' && omittedMarketplaceSet ? otherVolume : (day.volume.get(marketplace) ?? 0)
			const tradeValue =
				marketplace === 'Others' && omittedMarketplaceSet ? otherTrades : (day.trades.get(marketplace) ?? 0)
			absoluteVolume[j + 1] = volumeValue
			absoluteTrades[j + 1] = tradeValue
			relativeVolume[j + 1] = getNumericDominance(volumeValue, day.volumeTotal)
			relativeTrades[j + 1] = getNumericDominance(tradeValue, day.tradeTotal)
		}

		absoluteVolumeSource[i] = absoluteVolume
		relativeVolumeSource[i] = relativeVolume
		absoluteTradesSource[i] = absoluteTrades
		relativeTradesSource[i] = relativeTrades
	}

	const colors = getNDistinctColors(displayedMarketplaces.length)
	const absoluteBarCharts = new Array<MultiSeriesChartSeriesConfig>(displayedMarketplaces.length)
	const relativeAreaCharts = new Array<MultiSeriesChartSeriesConfig>(displayedMarketplaces.length)
	for (let i = 0; i < displayedMarketplaces.length; i++) {
		const name = displayedMarketplaces[i]
		const color = name === 'Others' ? '#AAAAAA' : colors[i]
		absoluteBarCharts[i] = {
			type: 'bar',
			name,
			encode: { x: 0, y: i + 1 },
			stack: 'stackA',
			color,
			large: false
		}
		relativeAreaCharts[i] = {
			type: 'line',
			name,
			encode: { x: 0, y: i + 1 },
			color
		}
	}

	return {
		absoluteVolumeDataset: { source: absoluteVolumeSource, dimensions },
		relativeVolumeDataset: { source: relativeVolumeSource, dimensions },
		absoluteTradesDataset: { source: absoluteTradesSource, dimensions },
		relativeTradesDataset: { source: relativeTradesSource, dimensions },
		absoluteBarCharts,
		relativeAreaCharts
	}
}
