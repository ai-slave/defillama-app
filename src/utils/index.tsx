import { CHART_COLORS } from '~/constants/colors'
import { fetchJson } from './async'
import { formatNumber } from './numberFormat'

interface HSL {
	h: number
	s: number
	l: number
}

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

const distinctColorsCache = new Map<number, ReadonlyArray<string>>()

export function getNDistinctColors(n: number): Array<string> {
	if (n <= 0) {
		return []
	}
	const cached = distinctColorsCache.get(n)
	if (cached) return cached.slice()

	const colors: Array<string> = []
	const usedColors = new Set<string>()
	const usedBuckets = new Map<string, Array<HSL>>()
	const saturationSteps = [60, 68, 76]
	const lightnessSteps = [40, 48, 56]
	const minContrastRatio = 2.5
	const similarityThreshold = 0.16
	const hueBinSize = 24
	const satBinSize = 14
	const lightBinSize = 14
	const hueBinCount = Math.ceil(360 / hueBinSize)

	const getRelativeLuminance = (hex: string): number => {
		const r = parseInt(hex.slice(1, 3), 16)
		const g = parseInt(hex.slice(3, 5), 16)
		const b = parseInt(hex.slice(5, 7), 16)
		const toLinear = (channel: number): number => {
			const value = channel / 255
			return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
		}

		return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
	}

	const hasBalancedContrast = (hex: string): boolean => {
		const luminance = getRelativeLuminance(hex)
		const contrastOnWhite = 1.05 / (luminance + 0.05)
		const contrastOnBlack = (luminance + 0.05) / 0.05
		return contrastOnWhite >= minContrastRatio && contrastOnBlack >= minContrastRatio
	}

	const getColorDistance = (hsl1: HSL, hsl2: HSL): number => {
		const hueDiff = Math.abs(hsl1.h - hsl2.h)
		const hueDistance = (hueDiff > 180 ? 360 - hueDiff : hueDiff) / 180
		const satDistance = Math.abs(hsl1.s - hsl2.s) / 100
		const lightDistance = Math.abs(hsl1.l - hsl2.l) / 100
		return hueDistance * 0.7 + satDistance * 0.2 + lightDistance * 0.1
	}

	const getBucketKey = (hsl: HSL): string => {
		const hBin = Math.floor(hsl.h / hueBinSize) % hueBinCount
		const sBin = Math.floor(hsl.s / satBinSize)
		const lBin = Math.floor(hsl.l / lightBinSize)
		return `${hBin}:${sBin}:${lBin}`
	}

	const addToBuckets = (hsl: HSL): void => {
		const key = getBucketKey(hsl)
		const bucket = usedBuckets.get(key)
		if (bucket) {
			bucket.push(hsl)
		} else {
			usedBuckets.set(key, [hsl])
		}
	}

	const isDistinct = (hsl: HSL): boolean => {
		const centerH = Math.floor(hsl.h / hueBinSize) % hueBinCount
		const centerS = Math.floor(hsl.s / satBinSize)
		const centerL = Math.floor(hsl.l / lightBinSize)

		for (let dh = -1; dh <= 1; dh++) {
			const hBin = (centerH + dh + hueBinCount) % hueBinCount
			for (let ds = -1; ds <= 1; ds++) {
				const sBin = centerS + ds
				if (sBin < 0) continue
				for (let dl = -1; dl <= 1; dl++) {
					const lBin = centerL + dl
					if (lBin < 0) continue
					const bucket = usedBuckets.get(`${hBin}:${sBin}:${lBin}`)
					if (!bucket) continue
					for (const existing of bucket) {
						if (getColorDistance(existing, hsl) < similarityThreshold) {
							return false
						}
					}
				}
			}
		}

		return true
	}

	for (const baseColor of CHART_COLORS) {
		if (colors.length === n) {
			break
		}

		if (usedColors.has(baseColor)) continue
		if (!hasBalancedContrast(baseColor)) continue
		const baseColorHsl = hexToHSL(baseColor)
		if (!isDistinct(baseColorHsl)) continue

		usedColors.add(baseColor)
		colors.push(baseColor)
		addToBuckets(baseColorHsl)
	}

	let i = 0
	let attempts = 0
	const maxAttempts = n * 40

	// Deterministic low-discrepancy sequence with bucketed distance checks.
	while (colors.length < n && attempts < maxAttempts) {
		const hue = (i * 137.508) % 360
		const saturationIndex = Math.floor(i / lightnessSteps.length) % saturationSteps.length
		const saturation = saturationSteps[saturationIndex]!
		const baseLightnessIndex = i % lightnessSteps.length

		for (let lightnessShift = 0; lightnessShift < lightnessSteps.length; lightnessShift++) {
			const lightnessIndex = (baseLightnessIndex + lightnessShift) % lightnessSteps.length
			const lightness = lightnessSteps[lightnessIndex]!
			const candidate = hslToHex(hue, saturation, lightness)
			if (usedColors.has(candidate)) continue
			if (!hasBalancedContrast(candidate)) continue
			const candidateHsl = hexToHSL(candidate)
			if (!isDistinct(candidateHsl)) continue

			usedColors.add(candidate)
			colors.push(candidate)
			addToBuckets(candidateHsl)
			break
		}

		i++
		attempts++
	}

	// Ensure we always return n colors, even for very large n.
	while (colors.length < n) {
		const hue = (i * 137.508) % 360
		const saturation = 68 + (i % 3) * 6
		const lightness = 44 + (i % 3) * 6
		const candidate = hslToHex(hue, saturation, lightness)
		i++
		if (usedColors.has(candidate)) continue
		usedColors.add(candidate)
		colors.push(candidate)
	}

	distinctColorsCache.set(n, colors)
	return colors.slice()
}

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
	txs: boolean = false,
	inflows: boolean = false
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

function hexToHSL(hex: string): HSL {
	const r = parseInt(hex.slice(1, 3), 16) / 255
	const g = parseInt(hex.slice(3, 5), 16) / 255
	const b = parseInt(hex.slice(5, 7), 16) / 255

	const max = Math.max(r, g, b)
	const min = Math.min(r, g, b)
	let h = 0
	let s = 0
	const l = (max + min) / 2

	if (max !== min) {
		const d = max - min
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0)
				break
			case g:
				h = (b - r) / d + 2
				break
			case b:
				h = (r - g) / d + 4
				break
		}
		h /= 6
	}

	return { h: h * 360, s: s * 100, l: l * 100 }
}

function hslToHex(h: number, s: number, l: number): string {
	l /= 100
	const a = (s * Math.min(l, 1 - l)) / 100

	const f = (n: number): string => {
		const k = (n + h / 30) % 12
		const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
		return Math.round(255 * color)
			.toString(16)
			.padStart(2, '0')
	}

	return `#${f(0)}${f(8)}${f(4)}`
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
	batchSize: number = 15
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
