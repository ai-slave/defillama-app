import type { ClassifiedColumn } from './columnKind'

export type ChartType =
	| 'line'
	| 'bar'
	| 'area'
	| 'areaStacked'
	| 'areaPct'
	| 'hbar'
	| 'scatter'
	| 'bubble'
	| 'pie'
	| 'donut'
	| 'treemap'
	| 'histogram'
	| 'candlestick'

export type StackMode = 'off' | 'stacked' | 'expand'
export type NumberFormat = 'auto' | 'humanized' | 'currency' | 'percent'

export interface CandlestickMapping {
	ts: string
	open: string
	close: string
	low: string
	high: string
	volume?: string
}

export interface ChartConfig {
	chartType: ChartType
	xCol: string | null
	yCols: Array<string>
	splitByCol: string | null
	stackMode: StackMode
	rightAxisCols: Array<string>
	seriesKinds: Record<string, 'line' | 'bar'>
	seriesColors: Record<string, string>
	numberFormat: NumberFormat
	candlestick?: CandlestickMapping
	bubble?: { sizeCol: string | null }
	histogram?: { valueCol: string; binCount: number }
}

export const MAX_AUTO_SERIES = 8
export const SPLIT_TOP_N = 20
const BAR_CATEGORY_THRESHOLD = 12

export function chooseDefaultChartType(classified: Array<ClassifiedColumn>): ChartType {
	const dates = classified.filter((c) => c.coarse === 'date')
	const numbers = classified.filter((c) => c.coarse === 'number')
	const categories = classified.filter((c) => c.coarse === 'category')

	if (dates.length > 0 && numbers.length > 0) return 'line'
	if (categories.length > 0 && numbers.length > 0) {
		return categories.length > BAR_CATEGORY_THRESHOLD ? 'hbar' : 'bar'
	}
	if (numbers.length >= 2 && categories.length === 0 && dates.length === 0) return 'scatter'
	if (numbers.length === 1) return 'histogram'
	return 'bar'
}

export function canUseChartType(type: ChartType, classified: Array<ClassifiedColumn>): boolean {
	const numbers = classified.filter((c) => c.coarse === 'number').length
	const categories = classified.filter((c) => c.coarse === 'category').length
	const dates = classified.filter((c) => c.coarse === 'date').length

	switch (type) {
		case 'line':
		case 'area':
		case 'areaStacked':
		case 'areaPct':
			return numbers >= 1 && (dates >= 1 || categories >= 1)
		case 'bar':
		case 'hbar':
			return numbers >= 1 && (categories >= 1 || dates >= 1)
		case 'pie':
		case 'donut':
		case 'treemap':
			return numbers >= 1 && categories >= 1
		case 'scatter':
			return numbers >= 2
		case 'bubble':
			return numbers >= 3
		case 'histogram':
			return numbers >= 1
		case 'candlestick':
			return numbers >= 4 && dates >= 1
	}
}

const OHLC_NAMES = {
	open: /^open|opening_price$/i,
	close: /^close|closing_price$/i,
	high: /^high|highest_price$/i,
	low: /^low|lowest_price$/i,
	volume: /^volume|vol$/i
}

function guessCandlestickMapping(classified: Array<ClassifiedColumn>): CandlestickMapping | undefined {
	const dates = classified.filter((c) => c.coarse === 'date')
	const numbers = classified.filter((c) => c.coarse === 'number')
	if (dates.length === 0 || numbers.length < 4) return undefined
	const byName = (re: RegExp) => numbers.find((c) => re.test(c.name))?.name
	const open = byName(OHLC_NAMES.open) ?? numbers[0].name
	const close = byName(OHLC_NAMES.close) ?? numbers[1]?.name ?? open
	const high = byName(OHLC_NAMES.high) ?? numbers[2]?.name ?? close
	const low = byName(OHLC_NAMES.low) ?? numbers[3]?.name ?? high
	const volume = byName(OHLC_NAMES.volume)
	return { ts: dates[0].name, open, close, low, high, volume }
}

export function defaultChartConfig(classified: Array<ClassifiedColumn>): ChartConfig {
	const chartType = chooseDefaultChartType(classified)
	const firstDate = classified.find((c) => c.coarse === 'date')
	const firstCategory = classified.find((c) => c.coarse === 'category')
	const numbers = classified.filter((c) => c.coarse === 'number')

	const xCol = firstDate?.name ?? firstCategory?.name ?? null
	const yCols = numbers
		.filter((c) => c.name !== xCol)
		.slice(0, MAX_AUTO_SERIES)
		.map((c) => c.name)

	return {
		chartType,
		xCol,
		yCols,
		splitByCol: null,
		stackMode: 'off',
		rightAxisCols: [],
		seriesKinds: {},
		seriesColors: {},
		numberFormat: 'auto',
		candlestick: chartType === 'candlestick' ? guessCandlestickMapping(classified) : undefined,
		bubble: chartType === 'bubble' ? { sizeCol: numbers[2]?.name ?? null } : undefined,
		histogram: chartType === 'histogram' ? { valueCol: numbers[0]?.name ?? '', binCount: 30 } : undefined
	}
}

export function migrateChartConfig(prev: ChartConfig, classified: Array<ClassifiedColumn>): ChartConfig {
	const names = new Set(classified.map((c) => c.name))
	const pickIfExists = (n: string | null) => (n && names.has(n) ? n : null)
	const filterExisting = (xs: Array<string>) => xs.filter((n) => names.has(n))

	const stillValid =
		canUseChartType(prev.chartType, classified) &&
		(prev.xCol == null || names.has(prev.xCol)) &&
		prev.yCols.every((n) => names.has(n))

	if (!stillValid) return defaultChartConfig(classified)

	const yCols = filterExisting(prev.yCols).slice(0, MAX_AUTO_SERIES)
	const firstNumber = classified.find((c) => c.coarse === 'number')

	return {
		...prev,
		xCol: pickIfExists(prev.xCol),
		yCols,
		splitByCol: pickIfExists(prev.splitByCol),
		rightAxisCols: filterExisting(prev.rightAxisCols),
		seriesKinds: Object.fromEntries(Object.entries(prev.seriesKinds).filter(([k]) => names.has(k))),
		seriesColors: Object.fromEntries(Object.entries(prev.seriesColors).filter(([k]) => names.has(k))),
		candlestick:
			prev.candlestick && Object.values(prev.candlestick).every((v) => !v || names.has(v))
				? prev.candlestick
				: undefined,
		bubble:
			prev.bubble?.sizeCol && names.has(prev.bubble.sizeCol)
				? prev.bubble
				: prev.chartType === 'bubble'
					? { sizeCol: null }
					: prev.bubble,
		histogram:
			prev.histogram && names.has(prev.histogram.valueCol)
				? prev.histogram
				: prev.chartType === 'histogram' && firstNumber
					? { valueCol: firstNumber.name, binCount: prev.histogram?.binCount ?? 30 }
					: prev.histogram
	}
}
