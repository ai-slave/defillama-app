import { getPercentChange, keepNeededProperties, slug } from '~/utils'
import { formatUsd, formatFixedNumber } from '~/utils/numberFormat'
import {
	DAY_MS,
	findTimeSeriesPointNear,
	getCompleteTimeSeriesDailyWindow,
	getFreshTimeSeriesCurrentPoint,
	toUnixMsTimestamp
} from '~/utils/timeSeries'
import type { StablecoinChartPoint, StablecoinListAsset, StablecoinPricesResponse } from './api.types'

export interface StablecoinMcapPoint {
	date: string
	Mcap: number
	isSynthetic?: boolean
	[key: string]: number | string | boolean | undefined
}

interface IStablecoinMcapStats {
	totalMcapCurrent: number | null
	totalMcapPrevDay: number | null
	totalMcapPrevWeek: number | null
	totalMcapPrevMonth: number | null
	change1d: string | null
	change7d: string | null
	change30d: string | null
	change1dUsd: number | null
	change7dUsd: number | null
	change30dUsd: number | null
	mcapChartData14d: Array<[number, number]> | null
	dataTimestamp: number | null
	isDataStale: boolean
}

interface IRateChartPoint {
	date?: string | number
	rates?: Record<string, string | number>
}

export interface IFormattedStablecoinChainRow {
	name: string
	circulating: number | null
	mcap: number | null
	unreleased: number | null
	bridgedTo: number | null
	minted: number | null
	mcapPrevDay: number | null
	mcapPrevWeek: number | null
	mcapPrevMonth: number | null
	change_1d: number | null
	change_7d: number | null
	change_1m: number | null
	dominance: { name: string; value: string | number | null } | null
	mcaptvl: number | null
}

type StablecoinDominanceCandidate = {
	mcap?: number | null
}

type StablecoinFormattedAsset = Omit<
	StablecoinListAsset,
	'circulating' | 'circulatingPrevDay' | 'circulatingPrevWeek' | 'circulatingPrevMonth'
> & {
	circulating?: Record<string, number> | number | null
	circulatingPrevDay?: Record<string, number> | number | null
	circulatingPrevWeek?: Record<string, number> | number | null
	circulatingPrevMonth?: Record<string, number> | number | null
	unreleased?: number | null
	mcap?: number | null
	change_1d?: number | null
	change_7d?: number | null
	change_1m?: number | null
	change_1d_nol?: string | null
	change_7d_nol?: string | null
	change_1m_nol?: string | null
	pegDeviation?: number | null
	pegDeviation_1m?: number | null
	pegDeviationInfo?: {
		timestamp: number
		price: number
		priceSource: string | null
	}
}

const peggedAssetPickKeys = [
	'id',
	'circulating',
	'unreleased',
	'mcap',
	'name',
	'symbol',
	'gecko_id',
	'chains',
	'price',
	'pegType',
	'pegMechanism',
	'change_1d',
	'change_7d',
	'change_1m',
	'change_1d_nol',
	'change_7d_nol',
	'change_1m_nol',
	'pegDeviation',
	'pegDeviation_1m',
	'pegDeviationInfo',
	'circulatingPrevDay',
	'circulatingPrevWeek',
	'circulatingPrevMonth',
	'delisted',
	'deprecated',
	'yieldBearing'
] as const

/**
 * The output type of `formatPeggedAssetsData`. `Pick<StablecoinFormattedAsset, …>` carries
 * union types (e.g. `circulating: Record | number`) that are already resolved to narrower
 * concrete types by the formatting logic, so we override those fields here.
 */
export type FormattedStablecoinAsset = Omit<
	Pick<StablecoinFormattedAsset, (typeof peggedAssetPickKeys)[number]>,
	'circulating' | 'circulatingPrevDay' | 'circulatingPrevWeek' | 'circulatingPrevMonth' | 'price'
> & {
	circulating?: number | null
	circulatingPrevDay?: number | null
	circulatingPrevWeek?: number | null
	circulatingPrevMonth?: number | null
	price?: number | null
}

export function buildUniqueStablecoinChartLabels(
	peggedAssets: StablecoinListAsset[],
	preferredLabel: 'name' | 'symbol'
): string[] {
	const labels: string[] = []
	const usedLabels = new Set<string>()
	for (let index = 0; index < peggedAssets.length; index++) {
		const asset = peggedAssets[index]
		const alternateLabel = preferredLabel === 'name' ? asset.symbol : asset.name
		const candidates = [asset[preferredLabel], alternateLabel, asset.gecko_id]
		let label = ''
		for (const candidate of candidates) {
			if (!candidate || usedLabels.has(candidate)) continue
			label = candidate
			break
		}
		if (!label) label = `${asset[preferredLabel]} (${asset.id})`
		const baseLabel = label
		let suffix = index + 1
		while (usedLabels.has(label)) {
			label = `${baseLabel} ${suffix}`
			suffix++
		}
		usedLabels.add(label)
		labels.push(label)
	}
	return labels
}

/**
 * Base constraint for chart data points processed by stablecoin chart builders.
 * Requires a `date` field; other fields are accessed
 * via runtime string keys with `typeof` checks (using allowed `as Record<string, unknown>`
 * cast after `typeof === 'object'` validation).
 */
export type StablecoinChartDataPoint = {
	date: string | number
	isSynthetic?: boolean
	mcap?: number | Record<string, number>
	circulating?: number | Record<string, number>
	totalCirculatingUSD?: Record<string, number>
	totalCirculating?: Record<string, number>
	totalUnreleased?: Record<string, number>
	totalBridgedToUSD?: Record<string, number>
	totalMintedUSD?: Record<string, number>
}

interface IFormatPeggedAssetsDataParams {
	chain?: string
	peggedAssets?: StablecoinFormattedAsset[]
	chartDataByPeggedAsset?: Array<Array<StablecoinChartDataPoint> | null | undefined>
	priceData?: StablecoinPricesResponse
	rateData?: IRateChartPoint[]
	peggedAssetIdToChartDataIndex?: Record<string, number>
	currentTimeMs?: number
}

interface IFormatPeggedChainsDataParams {
	chainList?: string[]
	peggedChartDataByChain?: Array<StablecoinChartPoint[] | null>
	chainDominances?: Record<string, { symbol: string; mcap: number }>
	chainsTVLData?: number[]
	currentTimeMs?: number
}

type StablecoinChartLookupOptions = { currentTimeMs?: number }

const toFiniteNumber = (value: unknown): number | null => {
	const numeric = typeof value === 'number' ? value : Number(value)
	return Number.isFinite(numeric) ? numeric : null
}

export function getFreshStablecoinCurrentPoint<T>(
	series: readonly T[] | null | undefined,
	getTimestamp: (point: T) => string | number,
	currentTimeMs: number = Date.now()
): T | null {
	// Daily stablecoin snapshots can finish after UTC midnight, so the completed prior day remains fresh until today arrives.
	return (
		getFreshTimeSeriesCurrentPoint(series, getTimestamp, { currentTimeMs }) ??
		getFreshTimeSeriesCurrentPoint(series, getTimestamp, { currentTimeMs, currentDayOffset: 1 })
	)
}

function findStablecoinPeriodPreviousPoint<T>(
	series: readonly T[] | null | undefined,
	daysBefore: number,
	getTimestamp: (point: T) => string | number,
	currentTimeMs?: number
): T | null {
	if (!Number.isFinite(daysBefore) || daysBefore <= 0) return null

	const current = getFreshStablecoinCurrentPoint(series, getTimestamp, currentTimeMs)
	if (!current) return null

	return findTimeSeriesPointNear(series, toUnixMsTimestamp(getTimestamp(current)) - daysBefore * DAY_MS, getTimestamp)
}

export interface IBuildStablecoinChartDataParams {
	chartDataByAssetOrChain: Array<Array<StablecoinChartDataPoint> | null | undefined>
	assetsOrChainsList: string[]
	filteredIndexes?: number[]
	issuanceType?: string
	selectedChain?: string | null
	totalChartTooltipLabel?: string
	doublecountedIds?: number[]
	carryForwardAfterSeriesEnd?: boolean
}

export function getPrevStablecoinTotalFromChart(
	chart: Array<StablecoinChartDataPoint> | null | undefined,
	daysBefore: number,
	issuanceType: string,
	pegType: 'bridges',
	options?: StablecoinChartLookupOptions
): unknown
export function getPrevStablecoinTotalFromChart(
	chart: Array<StablecoinChartDataPoint> | null | undefined,
	daysBefore: number,
	issuanceType: string,
	pegType?: string,
	options?: StablecoinChartLookupOptions
): number | null
export function getPrevStablecoinTotalFromChart(
	chart: Array<StablecoinChartDataPoint> | null | undefined,
	daysBefore: number,
	issuanceType: string,
	pegType = '',
	options: StablecoinChartLookupOptions = {}
) {
	if (!chart?.length) return null
	const prevChart =
		daysBefore === 0
			? chart[chart.length - 1]
			: findStablecoinPeriodPreviousPoint(
					chart.filter((point) => point.isSynthetic !== true),
					daysBefore,
					(point) => point.date,
					options.currentTimeMs
				)
	return getStablecoinValueFromPoint(prevChart, issuanceType, pegType)
}

export function getStablecoinValueFromPoint(
	point: StablecoinChartDataPoint | null | undefined,
	issuanceType: string,
	pegType: 'bridges'
): unknown
export function getStablecoinValueFromPoint(
	point: StablecoinChartDataPoint | null | undefined,
	issuanceType: string,
	pegType?: string
): number | null
export function getStablecoinValueFromPoint(
	point: StablecoinChartDataPoint | null | undefined,
	issuanceType: string,
	pegType = ''
) {
	if (!point || typeof point !== 'object') return null

	const chartRecord = point as Record<string, unknown>
	const issuanceTotals = chartRecord[issuanceType]
	if (!pegType) {
		if (typeof issuanceTotals === 'number') {
			return Number.isFinite(issuanceTotals) ? issuanceTotals : null
		}
		if (typeof issuanceTotals === 'string') {
			const numeric = Number(issuanceTotals)
			return Number.isFinite(numeric) ? numeric : null
		}
		if (!issuanceTotals || typeof issuanceTotals !== 'object') return null
		const totalsRecord = issuanceTotals as Record<string, unknown>
		let total = 0
		for (const key in totalsRecord) {
			const value = totalsRecord[key]
			const numeric = typeof value === 'number' ? value : Number(value)
			if (Number.isFinite(numeric)) total += numeric
		}
		return total
	}

	if (!issuanceTotals || typeof issuanceTotals !== 'object') return null
	const totalsRecord = issuanceTotals as Record<string, unknown>
	const target = totalsRecord[pegType]
	if (pegType === 'bridges') return target
	const numeric = typeof target === 'number' ? target : Number(target)
	return Number.isFinite(numeric) ? numeric : null
}

export const getStablecoinDominance = (
	topToken: StablecoinDominanceCandidate | null | undefined,
	totalMcap: number | null | undefined
): string | number | null => {
	const topMcap = topToken?.mcap
	if (!Number.isFinite(topMcap) || !Number.isFinite(totalMcap) || !topMcap || !totalMcap || totalMcap <= 0) {
		return null
	}
	const dominance = (topMcap / totalMcap) * 100.0
	if (!Number.isFinite(dominance) || dominance <= 0) return null
	if (dominance < 100) return formatFixedNumber(dominance, 2)
	return 100
}

export const getStablecoinMcapStatsFromTotals = (
	peggedAreaTotalData: ReadonlyArray<StablecoinMcapPoint> | null | undefined,
	currentTimeMs: number = Date.now()
): IStablecoinMcapStats => {
	const totalMcapCurrent = peggedAreaTotalData?.[peggedAreaTotalData.length - 1]?.Mcap ?? null
	const realTotals = peggedAreaTotalData?.filter((point) => point.isSynthetic !== true)
	const latestRealTotal = realTotals?.[realTotals.length - 1]
	const freshCurrentTotal = getFreshStablecoinCurrentPoint(realTotals, (point) => point.date, currentTimeMs)
	const currentTimestamp = freshCurrentTotal ? toUnixMsTimestamp(freshCurrentTotal.date) : null
	const getPreviousMcap = (daysBefore: number) => {
		if (currentTimestamp == null) return null
		return (
			findTimeSeriesPointNear(realTotals, currentTimestamp - daysBefore * DAY_MS, (point) => point.date)?.Mcap ?? null
		)
	}
	const totalMcapPrevDay = getPreviousMcap(1)
	const totalMcapPrevWeek = getPreviousMcap(7)
	const totalMcapPrevMonth = getPreviousMcap(30)

	return {
		totalMcapCurrent,
		totalMcapPrevDay,
		totalMcapPrevWeek,
		totalMcapPrevMonth,
		change1d: formatFixedNumber(getPercentChange(totalMcapCurrent, totalMcapPrevDay), 2) ?? null,
		change7d: formatFixedNumber(getPercentChange(totalMcapCurrent, totalMcapPrevWeek), 2) ?? null,
		change30d: formatFixedNumber(getPercentChange(totalMcapCurrent, totalMcapPrevMonth), 2) ?? null,
		change1dUsd: totalMcapCurrent != null && totalMcapPrevDay != null ? totalMcapCurrent - totalMcapPrevDay : null,
		change7dUsd: totalMcapCurrent != null && totalMcapPrevWeek != null ? totalMcapCurrent - totalMcapPrevWeek : null,
		change30dUsd: totalMcapCurrent != null && totalMcapPrevMonth != null ? totalMcapCurrent - totalMcapPrevMonth : null,
		mcapChartData14d:
			peggedAreaTotalData && peggedAreaTotalData.length >= 14
				? peggedAreaTotalData.slice(-14).map((p) => [+p.date * 1000, p.Mcap ?? 0] as [number, number])
				: null,
		dataTimestamp: latestRealTotal ? toUnixMsTimestamp(latestRealTotal.date) / 1e3 : null,
		isDataStale: latestRealTotal != null && freshCurrentTotal == null
	}
}

const BACKFILLED_CHAINS = new Set([
	'All',
	'Ethereum',
	'BSC',
	'Avalanche',
	'Arbitrum',
	'Optimism',
	'Fantom',
	'Polygon',
	'Gnosis',
	'Celo',
	'Harmony',
	'Moonriver',
	'Aztec',
	'Loopring',
	'Starknet',
	'ZKsync',
	'Boba',
	'Metis',
	'Moonbeam',
	'Syscoin',
	'OKExChain',
	'IoTeX',
	'Heco'
])

export const isStablecoinChartDateVisible = (selectedChain: string | null | undefined, date: string | number) =>
	Boolean(selectedChain && BACKFILLED_CHAINS.has(selectedChain)) || Number(date) > 1652241600

const getTargetPrice = (
	pegType: string,
	ratesChart: IRateChartPoint[],
	targetTimestampMs: number | null,
	currentTimeMs: number
): number | null => {
	const currencyTicker = pegType.slice(-3)
	if (currencyTicker === 'USD') {
		return 1
	}
	const rates =
		targetTimestampMs == null
			? getFreshTimeSeriesCurrentPoint(ratesChart, (point) => point.date ?? Number.NaN, { currentTimeMs })
			: findTimeSeriesPointNear(ratesChart, targetTimestampMs, (point) => point.date ?? Number.NaN)
	const rate = rates?.rates?.[currencyTicker]
	const numericRate = typeof rate === 'number' ? rate : Number(rate)
	if (!Number.isFinite(numericRate) || numericRate === 0) return null
	return 1 / numericRate
}

export const formatPeggedAssetsData = ({
	chain = '',
	peggedAssets = [],
	chartDataByPeggedAsset = [],
	priceData = [],
	rateData = [],
	peggedAssetIdToChartDataIndex = {},
	currentTimeMs = Date.now()
}: IFormatPeggedAssetsDataParams): FormattedStablecoinAsset[] => {
	let inputAssets = [...peggedAssets]
	const completePriceHistory = getCompleteTimeSeriesDailyWindow(priceData, 31, (point) => point.date, {
		currentTimeMs
	})

	if (chain) {
		const sluggedChain = slug(chain)
		inputAssets = inputAssets.filter(({ chains = [] }) => chains.some((c) => slug(c) === sluggedChain))
	}

	const mappedAssets: FormattedStablecoinAsset[] = inputAssets.map((pegged) => {
		const formattedPegged: StablecoinFormattedAsset = { ...pegged }
		const pegType = formattedPegged.pegType ?? ''
		const peggedGeckoID = formattedPegged.gecko_id
		const rawPrice = formattedPegged.price
		const price = typeof rawPrice === 'number' ? rawPrice : rawPrice != null ? Number(rawPrice) : null
		const priceSource = formattedPegged.priceSource ?? null
		if (chain) {
			const chainCirculating = formattedPegged.chainCirculating?.[chain]
			formattedPegged.circulating = chainCirculating ? (chainCirculating.current?.[pegType] ?? 0) : 0
			formattedPegged.circulatingPrevDay = chainCirculating
				? (chainCirculating.circulatingPrevDay?.[pegType] ?? null)
				: null
			formattedPegged.circulatingPrevWeek = chainCirculating
				? (chainCirculating.circulatingPrevWeek?.[pegType] ?? null)
				: null
			formattedPegged.circulatingPrevMonth = chainCirculating
				? (chainCirculating.circulatingPrevMonth?.[pegType] ?? null)
				: null
		} else {
			const circulatingRaw = formattedPegged.circulating
			const circulatingMap = typeof circulatingRaw === 'object' && circulatingRaw != null ? circulatingRaw : null
			const circulatingPrevDayRaw = formattedPegged.circulatingPrevDay
			const circulatingPrevDayMap =
				typeof circulatingPrevDayRaw === 'object' && circulatingPrevDayRaw != null ? circulatingPrevDayRaw : null
			const circulatingPrevWeekRaw = formattedPegged.circulatingPrevWeek
			const circulatingPrevWeekMap =
				typeof circulatingPrevWeekRaw === 'object' && circulatingPrevWeekRaw != null ? circulatingPrevWeekRaw : null
			const circulatingPrevMonthRaw = formattedPegged.circulatingPrevMonth
			const circulatingPrevMonthMap =
				typeof circulatingPrevMonthRaw === 'object' && circulatingPrevMonthRaw != null ? circulatingPrevMonthRaw : null
			formattedPegged.circulating = circulatingMap?.[pegType] ?? 0
			formattedPegged.circulatingPrevDay = circulatingPrevDayMap?.[pegType] ?? null
			formattedPegged.circulatingPrevWeek = circulatingPrevWeekMap?.[pegType] ?? null
			formattedPegged.circulatingPrevMonth = circulatingPrevMonthMap?.[pegType] ?? null
		}
		const chartIndex = peggedAssetIdToChartDataIndex[formattedPegged.id]
		const chart = chartDataByPeggedAsset[chartIndex] ?? null

		formattedPegged.mcap = getPrevStablecoinTotalFromChart(chart, 0, 'mcap') ?? null
		const mcapPrevDay = getPrevStablecoinTotalFromChart(chart, 1, 'mcap', '', { currentTimeMs }) ?? null
		const mcapPrevWeek = getPrevStablecoinTotalFromChart(chart, 7, 'mcap', '', { currentTimeMs }) ?? null
		const mcapPrevMonth = getPrevStablecoinTotalFromChart(chart, 30, 'mcap', '', { currentTimeMs }) ?? null
		formattedPegged.change_1d = getPercentChange(formattedPegged.mcap, mcapPrevDay)
		formattedPegged.change_7d = getPercentChange(formattedPegged.mcap, mcapPrevWeek)
		formattedPegged.change_1m = getPercentChange(formattedPegged.mcap, mcapPrevMonth)

		const change_1d_nol =
			formattedPegged.mcap != null && mcapPrevDay != null
				? formatUsd(String(Number(formattedPegged.mcap) - Number(mcapPrevDay)), {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})
				: null
		const change_7d_nol =
			formattedPegged.mcap != null && mcapPrevWeek != null
				? formatUsd(String(Number(formattedPegged.mcap) - Number(mcapPrevWeek)), {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})
				: null
		const change_1m_nol =
			formattedPegged.mcap != null && mcapPrevMonth != null
				? formatUsd(String(Number(formattedPegged.mcap) - Number(mcapPrevMonth)), {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})
				: null

		formattedPegged.change_1d_nol = !change_1d_nol
			? null
			: change_1d_nol.startsWith('-')
				? change_1d_nol
				: `+${change_1d_nol}`
		formattedPegged.change_7d_nol = !change_7d_nol
			? null
			: change_7d_nol.startsWith('-')
				? change_7d_nol
				: `+${change_7d_nol}`
		formattedPegged.change_1m_nol = !change_1m_nol
			? null
			: change_1m_nol.startsWith('-')
				? change_1m_nol
				: `+${change_1m_nol}`

		if (pegType !== 'peggedVAR' && price) {
			const targetPrice = getTargetPrice(pegType, rateData, null, currentTimeMs)
			formattedPegged.pegDeviation = getPercentChange(price, targetPrice)
			let greatestDeviation = 0
			let greatestDeviationInfo: StablecoinFormattedAsset['pegDeviationInfo']
			let hasCompleteAssetPriceHistory = completePriceHistory != null && peggedGeckoID != null
			for (const historicalPrices of completePriceHistory ?? []) {
				const historicalTargetPrice = getTargetPrice(
					pegType,
					rateData,
					toUnixMsTimestamp(historicalPrices.date),
					currentTimeMs
				)
				const historicalPrice = peggedGeckoID != null ? toFiniteNumber(historicalPrices?.prices?.[peggedGeckoID]) : null
				if (historicalPrice == null || historicalTargetPrice == null) {
					hasCompleteAssetPriceHistory = false
					break
				}
				const deviation = historicalPrice - historicalTargetPrice
				if (Math.abs(greatestDeviation) < Math.abs(deviation)) {
					greatestDeviation = deviation
					if (0.02 < Math.abs(greatestDeviation)) {
						greatestDeviationInfo = {
							timestamp: historicalPrices.date,
							price: historicalPrice,
							priceSource
						}
					}
				}
			}
			if (
				hasCompleteAssetPriceHistory &&
				targetPrice != null &&
				Math.abs(greatestDeviation) < Math.abs(price - targetPrice)
			) {
				greatestDeviation = price - targetPrice
				if (0.02 < Math.abs(greatestDeviation)) {
					greatestDeviationInfo = {
						timestamp: currentTimeMs / 1000,
						price: price,
						priceSource: priceSource
					}
				}
			}
			formattedPegged.pegDeviation_1m =
				hasCompleteAssetPriceHistory && targetPrice != null
					? getPercentChange(targetPrice + greatestDeviation, targetPrice)
					: null
			formattedPegged.pegDeviationInfo = hasCompleteAssetPriceHistory ? greatestDeviationInfo : undefined
		} else {
			// Avoid leaking stale peg data into filters/table (e.g. when price is missing or peg is variable).
			formattedPegged.pegDeviation = undefined
			formattedPegged.pegDeviation_1m = undefined
			formattedPegged.pegDeviationInfo = undefined
		}
		// Narrow `price` from `string | number | null` to `number | null` (resolved above).
		formattedPegged.price = price
		const picked = keepNeededProperties(formattedPegged, peggedAssetPickKeys)
		// After formatting, circulating/circulatingPrev* are always `number | null`
		// and price is `number | null`. The Pick type is wider because
		// StablecoinFormattedAsset carries the pre-formatting union types.
		// Runtime values are already narrowed; annotate the return.
		return picked as FormattedStablecoinAsset
	})

	if (chain) {
		return mappedAssets.toSorted((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0))
	}

	return mappedAssets
}

export const formatPeggedChainsData = ({
	chainList = [],
	peggedChartDataByChain = [],
	chainDominances = {},
	chainsTVLData = [],
	currentTimeMs = Date.now()
}: IFormatPeggedChainsDataParams): IFormattedStablecoinChainRow[] => {
	const formattedStablecoinChains: IFormattedStablecoinChainRow[] = []
	for (let i = 0; i < peggedChartDataByChain.length; i++) {
		const chart = peggedChartDataByChain[i]
		const chainName = chainList[i]
		const chainDominance = chainDominances[chainName] ?? null

		const latestChainTVL = chainsTVLData?.[i] ?? null

		const mcap = getPrevStablecoinTotalFromChart(chart, 0, 'totalCirculatingUSD')
		const mcapPrevDay = getPrevStablecoinTotalFromChart(chart, 1, 'totalCirculatingUSD', '', { currentTimeMs })
		const mcapPrevWeek = getPrevStablecoinTotalFromChart(chart, 7, 'totalCirculatingUSD', '', { currentTimeMs })
		const mcapPrevMonth = getPrevStablecoinTotalFromChart(chart, 30, 'totalCirculatingUSD', '', { currentTimeMs })
		const circulating = getPrevStablecoinTotalFromChart(chart, 0, 'totalCirculating')
		const unreleased = getPrevStablecoinTotalFromChart(chart, 0, 'totalUnreleased')
		const bridgedTo = getPrevStablecoinTotalFromChart(chart, 0, 'totalBridgedToUSD')
		const minted = getPrevStablecoinTotalFromChart(chart, 0, 'totalMintedUSD')
		const dominance = chainDominance
			? {
					name: chainDominance.symbol,
					value: getStablecoinDominance(chainDominance, mcap)
				}
			: null

		let mcaptvl = mcap && latestChainTVL ? mcap / latestChainTVL : null
		if (mcaptvl === 0) {
			mcaptvl = null
		}

		formattedStablecoinChains.push({
			name: chainName,
			circulating,
			mcap,
			unreleased,
			bridgedTo,
			minted,
			mcapPrevDay,
			mcapPrevWeek,
			mcapPrevMonth,
			change_1d: getPercentChange(mcap, mcapPrevDay),
			change_7d: getPercentChange(mcap, mcapPrevWeek),
			change_1m: getPercentChange(mcap, mcapPrevMonth),
			dominance,
			mcaptvl
		})
	}

	formattedStablecoinChains.sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0))

	return formattedStablecoinChains
}
