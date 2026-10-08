import { fetchJson } from './async'
import { formatNumber } from './numberFormat'

interface VolumeChartEntry {
	Deposits: number
	Withdrawals: number
	txs: number
	volume: number
	[key: string]: unknown
}

export function keepNeededProperties<T extends object, K extends keyof T & string>(
	protocol: T,
	propertiesToKeep: ReadonlyArray<K>
): Pick<T, K>
export function keepNeededProperties(protocol: object, propertiesToKeep: ReadonlyArray<string>): Record<string, unknown>
export function keepNeededProperties(
	protocol: object,
	propertiesToKeep: ReadonlyArray<string>
): Record<string, unknown> {
	const obj = protocol as Record<string, unknown>
	const result: Record<string, unknown> = {}
	for (const prop of propertiesToKeep) {
		const value = obj[prop]
		if (value !== undefined) {
			result[prop] = value
		}
	}
	return result
}

/**
 * get standard percent change between two values
 */
export const getPercentChange = (valueNow: unknown, value24HoursAgo: unknown): number | null => {
	const adjustedPercentChange =
		((parseFloat(String(valueNow)) - parseFloat(String(value24HoursAgo))) / parseFloat(String(value24HoursAgo))) * 100
	if (Number.isNaN(adjustedPercentChange) || !isFinite(adjustedPercentChange)) {
		return null
	}
	return adjustedPercentChange
}

export const capitalizeFirstLetter = (word: unknown): string =>
	typeof word === 'string' ? word.charAt(0).toUpperCase() + word.slice(1) : ''

export const slug = (name: unknown = ''): string =>
	String(name ?? '')
		.toLowerCase()
		.replace(/ /g, '-')
		.replace(/'/g, '')

export const getDominancePercent = (value: unknown, total: unknown): number => {
	const numValue = Number(value)
	const numTotal = Number(total)
	if (!numValue || !numTotal) {
		return 0
	}

	const ratio = numTotal > 0 ? numValue / numTotal : 0

	return Math.round(ratio * 10_000) / 100
}

export const getTokenDominance = (
	topToken: { tvl?: number | null; [key: string]: unknown },
	totalVolume: number | null | undefined
): string | number | null => {
	const dominance = topToken.tvl && totalVolume && (topToken.tvl / totalVolume) * 100.0
	if (!dominance) return null
	if (dominance < 100) {
		return formatNumber(dominance)
	}
	return 100
}

export const getPrevVolumeFromChart = (
	chart: Array<VolumeChartEntry> | null | undefined,
	daysBefore: number,
	txs = false,
	inflows = false
): number | null => {
	if (!chart) return null
	const prevChart = chart[chart.length - 1 - daysBefore]
	if (!prevChart) return null
	if (inflows) {
		return prevChart.Deposits - prevChart.Withdrawals
	}
	return txs ? prevChart.txs : prevChart.volume
}

export function firstDayOfMonth(utcTimestamp: number): number {
	const date = new Date(utcTimestamp * 1000)
	return Math.trunc(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000)
}

export function firstDayOfQuarter(utcTimestamp: number): number {
	const date = new Date(utcTimestamp * 1000)
	const month = date.getUTCMonth()
	const quarterStartMonth = Math.floor(month / 3) * 3
	return Math.trunc(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1) / 1000)
}

export function firstDayOfYear(utcTimestamp: number): number {
	const date = new Date(utcTimestamp * 1000)
	return Math.trunc(Date.UTC(date.getUTCFullYear(), 0, 1) / 1000)
}

export function lastDayOfWeek(utcTimestamp: number): number {
	const date = new Date(utcTimestamp * 1000)
	const weekDay = date.getUTCDay()
	const daysToAdd = weekDay === 0 ? 0 : 7 - weekDay
	const lastDayDate = new Date(date.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
	lastDayDate.setUTCHours(0, 0, 0, 0)
	return Math.trunc(lastDayDate.getTime() / 1000)
}

interface BatchHistoricalPrice {
	price: number
	timestamp: number
	[key: string]: unknown
}

interface BatchHistoricalCoin {
	prices?: Array<BatchHistoricalPrice>
	[key: string]: unknown
}

interface BatchHistoricalResponse {
	coins: Record<string, BatchHistoricalCoin>
}

export async function batchFetchHistoricalPrices(
	priceReqs: Record<string, number | Array<number>>,
	batchSize = 15
): Promise<{ results: Record<string, BatchHistoricalCoin> }> {
	const results: Record<string, BatchHistoricalCoin> = {}
	let batchReqs: Record<string, number | Array<number>> = {}
	let batchCount = 0

	for (const [coin, request] of Object.entries(priceReqs)) {
		batchReqs[coin] = request
		batchCount++
		if (batchCount < batchSize) continue

		const response = await fetchJson<BatchHistoricalResponse>(
			`https://coins.llama.fi/batchHistorical?coins=${JSON.stringify(batchReqs)}&searchWidth=6h`
		)

		Object.assign(results, response.coins)
		batchReqs = {}
		batchCount = 0
	}

	if (batchCount > 0) {
		const response = await fetchJson<BatchHistoricalResponse>(
			`https://coins.llama.fi/batchHistorical?coins=${JSON.stringify(batchReqs)}&searchWidth=6h`
		)

		Object.assign(results, response.coins)
	}

	return { results }
}

export function roundToNearestHalfHour(timestamp: number): number {
	return Math.floor(timestamp / 1800) * 1800
}

export const getMarketCapToAnnualizedMetricRatio = (marketCap?: number | null, annualizedMetric?: number | null) => {
	if (marketCap == null || annualizedMetric == null || annualizedMetric === 0) {
		return null
	}
	return marketCap / annualizedMetric
}

/** 0x1234ab...cdef display form; returns short values unchanged. */
export function truncateAddress(address: string): string {
	return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address
}
