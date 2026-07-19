import { createChartRow } from '~/components/ECharts/dynamicRow'
import type { MultiSeriesChart2Dataset, MultiSeriesChart2SeriesConfig } from '~/components/ECharts/types'
import { getNDistinctColors } from '~/utils'
import type { RawNftMarketplaceVolume } from './api.types'

type ChartRow = { timestamp: number } & Record<string, number>

type DailyMarketplaceValues = {
	timestamp: number
	volume: ChartRow
	trades: ChartRow
	volumeTotal: number
	tradeTotal: number
}

const MAX_MARKETPLACE_SERIES = 30

export type NFTMarketplaceChartData = {
	absoluteVolumeDataset: MultiSeriesChart2Dataset
	relativeVolumeDataset: MultiSeriesChart2Dataset
	absoluteTradesDataset: MultiSeriesChart2Dataset
	relativeTradesDataset: MultiSeriesChart2Dataset
	absoluteBarCharts: MultiSeriesChart2SeriesConfig[]
	relativeAreaCharts: MultiSeriesChart2SeriesConfig[]
}

function roundToThreeDecimals(value: number): number {
	return +value.toFixed(3)
}

function getNumericDominance(value: number, total: number): number {
	if (!value || !total) return 0
	const ratio = total > 0 ? value / total : 0
	return Math.round(ratio * 10_000) / 100
}

function setMarketplaceValue(row: ChartRow, name: string, value: number) {
	if (name === '__proto__') {
		Object.defineProperty(row, name, { value, enumerable: true, configurable: true, writable: true })
	} else {
		row[name] = value
	}
}

export function buildNFTMarketplaceChartData(volume: RawNftMarketplaceVolume[]): NFTMarketplaceChartData {
	const days: DailyMarketplaceValues[] = []
	const marketplaces: string[] = []
	const seenMarketplaces = new Set<string>()
	const volumeByMarketplace = new Map<string, number>()

	for (const entry of volume) {
		const parsedTimestamp = Date.parse(entry.day)
		const volumeValue = entry.sum ?? 0
		// Preserve the legacy second-level dataset timestamp while parsing each API date only once.
		const timestamp = Math.floor(parsedTimestamp / 1_000) * 1_000
		let day = days[days.length - 1]
		if (day?.timestamp !== timestamp) {
			day = {
				timestamp,
				volume: createChartRow<number>(timestamp),
				trades: createChartRow<number>(timestamp),
				volumeTotal: 0,
				tradeTotal: 0
			}
			days.push(day)
		}

		day.volumeTotal += volumeValue
		day.tradeTotal += entry.count
		setMarketplaceValue(day.volume, entry.exchangeName, roundToThreeDecimals(volumeValue))
		setMarketplaceValue(day.trades, entry.exchangeName, roundToThreeDecimals(entry.count))
		volumeByMarketplace.set(entry.exchangeName, (volumeByMarketplace.get(entry.exchangeName) ?? 0) + volumeValue)

		if (!seenMarketplaces.has(entry.exchangeName)) {
			seenMarketplaces.add(entry.exchangeName)
			marketplaces.push(entry.exchangeName)
		}
	}

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
	const absoluteVolumeSource = new Array<ChartRow>(days.length)
	const relativeVolumeSource = new Array<ChartRow>(days.length)
	const absoluteTradesSource = new Array<ChartRow>(days.length)
	const relativeTradesSource = new Array<ChartRow>(days.length)

	for (let i = 0; i < days.length; i++) {
		const day = days[i]
		const absoluteVolume = createChartRow<number>(day.timestamp)
		const absoluteTrades = createChartRow<number>(day.timestamp)
		const relativeVolume = createChartRow<number>(day.timestamp)
		const relativeTrades = createChartRow<number>(day.timestamp)
		let otherVolume = 0
		let otherTrades = 0
		if (omittedMarketplaceSet) {
			for (const marketplace in day.volume) {
				if (!omittedMarketplaceSet.has(marketplace)) continue
				otherVolume += day.volume[marketplace]
				otherTrades += day.trades[marketplace] ?? 0
			}
		}

		for (let j = 0; j < displayedMarketplaces.length; j++) {
			const marketplace = displayedMarketplaces[j]
			const volumeValue =
				marketplace === 'Others' && omittedMarketplaceSet ? otherVolume : (day.volume[marketplace] ?? 0)
			const tradeValue =
				marketplace === 'Others' && omittedMarketplaceSet ? otherTrades : (day.trades[marketplace] ?? 0)
			setMarketplaceValue(absoluteVolume, marketplace, volumeValue)
			setMarketplaceValue(absoluteTrades, marketplace, tradeValue)
			setMarketplaceValue(relativeVolume, marketplace, getNumericDominance(volumeValue, day.volumeTotal))
			setMarketplaceValue(relativeTrades, marketplace, getNumericDominance(tradeValue, day.tradeTotal))
		}

		absoluteVolumeSource[i] = absoluteVolume
		relativeVolumeSource[i] = relativeVolume
		absoluteTradesSource[i] = absoluteTrades
		relativeTradesSource[i] = relativeTrades
	}

	const colors = getNDistinctColors(displayedMarketplaces.length)
	const absoluteBarCharts = new Array<MultiSeriesChart2SeriesConfig>(displayedMarketplaces.length)
	const relativeAreaCharts = new Array<MultiSeriesChart2SeriesConfig>(displayedMarketplaces.length)
	for (let i = 0; i < displayedMarketplaces.length; i++) {
		const name = displayedMarketplaces[i]
		const color = name === 'Others' ? '#AAAAAA' : colors[i]
		absoluteBarCharts[i] = {
			type: 'bar',
			name,
			encode: { x: 'timestamp', y: name },
			stack: 'stackA',
			color,
			large: false
		}
		relativeAreaCharts[i] = {
			type: 'line',
			name,
			encode: { x: 'timestamp', y: name },
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
