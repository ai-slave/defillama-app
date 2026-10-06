/**
 * Stablecoin totals, history points and chain rows.
 *
 * - Aggregate supply, dominance and inflow totals exclude producer-marked double-counted assets.
 * - Table rows keep a double-counted asset's measured value, muted and labeled as excluded from aggregate market cap.
 * - Chart labels are generated once from the full unfiltered asset universe, so duplicate symbols stay separate after
 *   chain or URL filtering. `Others` is reserved for the chart remainder and never labels a real asset.
 * - History follows the producer's sparse-zero contract: no point is unavailable; a top-level supply metric missing
 *   from a present point is a pruned zero; a null detail measurement (chain issuance, unreleased supply) stays
 *   unavailable; an explicit zero stays zero.
 * - The producer owns lifecycle extension (`deadFrom`). Never carry a series forward past its last producer point:
 *   the frontend cannot tell a delayed active asset from an ended one.
 * - Assets with `deadFrom` or `delisted` keep their history, but their current values and snapshot contributions are
 *   unavailable, never zero. `deprecated` alone does not make current values unavailable.
 * - Filtered pages derive headline totals from the same filtered rows as the chart and table.
 * - Asset supply is in token units with the asset symbol; only explicitly USD-valued metrics use USD.
 * - Enabling unreleased supply never turns an unavailable unreleased measurement into zero or a partial total.
 * - A bridge row represents the full supply only when both compared measurements are present.
 * - Grouped chain rows compute current and comparison totals from the same current-contributing rows. A chain without
 *   current market cap neither erases siblings nor counts toward a prior period; a contributing row missing one
 *   comparison period makes only that period and its change unavailable.
 * - `chains[].totalCirculatingUSD` from the chain list is stablecoin market cap, never DeFi TVL.
 */

import { getPercentChange, slug } from '~/utils'
import { formatUsd, formatFixedNumber } from '~/utils/numberFormat'
import {
	DAY_MS,
	findTimeSeriesPointNear,
	getCompleteTimeSeriesDailyWindow,
	getFreshTimeSeriesCurrentPoint,
	toUnixMsTimestamp
} from '~/utils/timeSeries'
import type {
	StablecoinChartPoint,
	StablecoinChartResponse,
	StablecoinDetailIssuanceAmount,
	StablecoinIssuanceBalances,
	StablecoinListAsset,
	StablecoinPegBalances,
	StablecoinPegType,
	StablecoinPricesResponse,
	StablecoinRateSnapshot,
	StablecoinRawBridgeBreakdown
} from './api.types'

export interface StablecoinMcapPoint {
	date: string
	Mcap: number
	isSynthetic?: boolean
	[key: string]: number | string | boolean | undefined
}

export type StablecoinAggregatePair = [timestamp: number, value: number]

export function sumStablecoinPegBalances(balances: StablecoinPegBalances | undefined): number {
	// Historical chain charts prune zero-valued metrics by omitting the field.
	if (balances === undefined) return 0
	let total = 0
	for (const key in balances) {
		// The API contract is a finite peg-key map; `for...in` widens its key to `string`.
		const value = balances[key as keyof StablecoinPegBalances]
		if (value !== undefined) total += value
	}
	return total
}

export function buildStablecoinAggregatePairs(response: StablecoinChartResponse): Array<StablecoinAggregatePair> {
	const totalsByTimestamp = new Map<number, number>()
	for (const point of response.aggregated) {
		totalsByTimestamp.set(Number(point.date), getStablecoinValueFromPoint(point, 'totalCirculatingUSD') ?? 0)
	}
	for (const assetId of response.doublecountedIds) {
		for (const point of response.breakdown[assetId] ?? []) {
			const timestamp = Number(point.date)
			const aggregateValue = totalsByTimestamp.get(timestamp)
			if (aggregateValue === undefined) continue
			const doublecountedValue = getStablecoinValueFromPoint(point, 'totalCirculatingUSD') ?? 0
			totalsByTimestamp.set(timestamp, aggregateValue - doublecountedValue)
		}
	}
	return Array.from(totalsByTimestamp.entries()).sort((a, b) => a[0] - b[0])
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
}

type StablecoinDominanceCandidate = {
	mcap?: number | null
}

export type StablecoinDeviationInfo = {
	timestamp: number
	price: number
	priceSource: string | null
}

export type FormattedStablecoinAsset = Pick<
	StablecoinListAsset,
	| 'id'
	| 'name'
	| 'symbol'
	| 'gecko_id'
	| 'chains'
	| 'pegType'
	| 'pegMechanism'
	| 'delisted'
	| 'deadFrom'
	| 'deprecated'
	| 'yieldBearing'
> & {
	chartLabel: string
	circulating: number
	circulatingPrevDay: number | null
	circulatingPrevWeek: number | null
	circulatingPrevMonth: number | null
	unreleased: number | null
	mcap: number | null
	price: number | null
	change_1d: number | null
	change_7d: number | null
	change_1m: number | null
	change_1d_nol: string | null
	change_7d_nol: string | null
	change_1m_nol: string | null
	pegDeviation: number | null
	pegDeviation_1m: number | null
	pegDeviationInfo: StablecoinDeviationInfo | null
	doublecounted: boolean
}

export function buildUniqueStablecoinChartLabels(
	peggedAssets: Array<Pick<StablecoinListAsset, 'id' | 'name' | 'symbol' | 'gecko_id'>>,
	preferredLabel: 'name' | 'symbol'
): Array<string> {
	const labels: Array<string> = []
	const usedLabels = new Set<string>(['Others'])
	for (const [index, asset] of peggedAssets.entries()) {
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

export const isInactiveStablecoin = (asset: Pick<StablecoinListAsset, 'deadFrom' | 'delisted'>): boolean =>
	asset.deadFrom !== undefined || asset.delisted === true

export type StablecoinChartDataPoint = {
	date: string | number
	isSynthetic?: boolean
	mcap?: number | StablecoinPegBalances | null
	circulating?: number | StablecoinDetailIssuanceAmount
	unreleased?: number | StablecoinDetailIssuanceAmount
	minted?: number | StablecoinDetailIssuanceAmount
	bridgedTo?: number | StablecoinDetailIssuanceAmount
	totalCirculatingUSD?: StablecoinPegBalances
	totalCirculating?: StablecoinPegBalances
	totalUnreleased?: StablecoinPegBalances
	totalBridgedToUSD?: StablecoinPegBalances
	totalMintedUSD?: StablecoinPegBalances
}

export type StablecoinIssuanceType =
	| 'mcap'
	| 'circulating'
	| 'unreleased'
	| 'minted'
	| 'bridgedTo'
	| 'totalCirculatingUSD'
	| 'totalCirculating'
	| 'totalUnreleased'
	| 'totalBridgedToUSD'
	| 'totalMintedUSD'

interface IFormatPeggedAssetsDataParams {
	chain?: string
	peggedAssets?: Array<StablecoinListAsset>
	chartDataByPeggedAsset?: Array<Array<StablecoinChartDataPoint> | null | undefined>
	priceData?: StablecoinPricesResponse
	rateData?: Array<StablecoinRateSnapshot>
	peggedAssetIdToChartDataIndex?: Record<string, number>
	doublecountedIndexes?: Array<number>
	currentTimeMs: number
}

interface IFormatPeggedChainsDataParams {
	chainList?: Array<string>
	peggedChartDataByChain?: Array<Array<StablecoinChartPoint> | null>
	chainDominances?: Record<string, { symbol: string; mcap: number }>
	currentTimeMs: number
}

type StablecoinChartLookupOptions = { currentTimeMs: number }

export function getFreshStablecoinCurrentPoint<T>(
	series: ReadonlyArray<T> | null | undefined,
	getTimestamp: (point: T) => string | number,
	currentTimeMs: number
): T | null {
	// Daily stablecoin snapshots can finish after UTC midnight, so the completed prior day remains fresh until today arrives.
	return (
		getFreshTimeSeriesCurrentPoint(series, getTimestamp, { currentTimeMs }) ??
		getFreshTimeSeriesCurrentPoint(series, getTimestamp, { currentTimeMs, currentDayOffset: 1 })
	)
}

function findStablecoinPeriodPreviousPoint<T>(
	series: ReadonlyArray<T> | null | undefined,
	daysBefore: number,
	getTimestamp: (point: T) => string | number,
	currentTimeMs: number
): T | null {
	if (daysBefore <= 0) return null

	const current = getFreshStablecoinCurrentPoint(series, getTimestamp, currentTimeMs)
	if (!current) return null

	return findTimeSeriesPointNear(series, toUnixMsTimestamp(getTimestamp(current)) - daysBefore * DAY_MS, getTimestamp)
}

export interface IBuildStablecoinChartDataParams {
	chartDataByAssetOrChain: Array<Array<StablecoinChartDataPoint> | null | undefined>
	assetsOrChainsList: Array<string>
	filteredIndexes?: Array<number>
	issuanceType?: StablecoinIssuanceType
	selectedChain?: string | null
	totalChartTooltipLabel?: string
	doublecountedIds?: Array<number>
}

export function getPrevStablecoinTotalFromChart(
	chart: Array<StablecoinChartDataPoint> | null | undefined,
	daysBefore: number,
	issuanceType: StablecoinIssuanceType,
	pegType: StablecoinPegType | undefined,
	options: StablecoinChartLookupOptions
): number | null {
	if (!chart?.length) return null
	const prevChart = findStablecoinPeriodPreviousPoint(
		chart.filter((point) => point.isSynthetic !== true),
		daysBefore,
		(point) => point.date,
		options.currentTimeMs
	)
	return getStablecoinValueFromPoint(prevChart, issuanceType, pegType)
}

export const getStablecoinBridgesFromChart = (
	chart: Array<StablecoinChartDataPoint> | null | undefined
): StablecoinRawBridgeBreakdown | null => {
	const bridgedTo = chart?.at(-1)?.bridgedTo
	return bridgedTo && typeof bridgedTo !== 'number' ? (bridgedTo.bridges ?? null) : null
}

const sumStablecoinIssuanceBalances = <T extends StablecoinIssuanceBalances>(balances: T): number | null => {
	let total = 0
	for (const key in balances) {
		const value = balances[key]
		if (value === null) return null
		if (typeof value === 'number') total += value
	}
	return total
}

export function getStablecoinValueFromPoint(
	point: StablecoinChartDataPoint | null | undefined,
	issuanceType: StablecoinIssuanceType,
	pegType?: StablecoinPegType
): number | null
export function getStablecoinValueFromPoint(
	point: StablecoinChartDataPoint | null | undefined,
	issuanceType: StablecoinIssuanceType,
	pegType?: StablecoinPegType
): number | null {
	if (!point) return null

	const issuanceTotals = point[issuanceType]
	if (issuanceTotals === undefined) return 0
	if (issuanceTotals === null) return null
	if (!pegType) {
		if (typeof issuanceTotals === 'number') return issuanceTotals
		return sumStablecoinIssuanceBalances(issuanceTotals)
	}

	if (typeof issuanceTotals === 'number') return issuanceTotals
	const value = issuanceTotals[pegType]
	return value === undefined ? 0 : value
}

export const getStablecoinDominance = (
	topToken: StablecoinDominanceCandidate | null | undefined,
	totalMcap: number | null | undefined
): string | number | null => {
	const topMcap = topToken?.mcap
	if (topMcap == null || totalMcap == null || topMcap < 0 || totalMcap <= 0) {
		return null
	}
	const dominance = (topMcap / totalMcap) * 100.0
	if (dominance < 0) return null
	if (dominance < 100) return formatFixedNumber(dominance, 2)
	return 100
}

export const getStablecoinMcapStatsFromTotals = (
	peggedAreaTotalData: ReadonlyArray<StablecoinMcapPoint> | null | undefined,
	currentTimeMs: number
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
	const formatChange = (previous: number | null): string | null => {
		const change = getPercentChange(totalMcapCurrent, previous)
		return change == null ? null : formatFixedNumber(change, 2)
	}

	return {
		totalMcapCurrent,
		totalMcapPrevDay,
		totalMcapPrevWeek,
		totalMcapPrevMonth,
		change1d: formatChange(totalMcapPrevDay),
		change7d: formatChange(totalMcapPrevWeek),
		change30d: formatChange(totalMcapPrevMonth),
		change1dUsd: totalMcapCurrent != null && totalMcapPrevDay != null ? totalMcapCurrent - totalMcapPrevDay : null,
		change7dUsd: totalMcapCurrent != null && totalMcapPrevWeek != null ? totalMcapCurrent - totalMcapPrevWeek : null,
		change30dUsd: totalMcapCurrent != null && totalMcapPrevMonth != null ? totalMcapCurrent - totalMcapPrevMonth : null,
		mcapChartData14d:
			peggedAreaTotalData && peggedAreaTotalData.length >= 14
				? peggedAreaTotalData.slice(-14).map<[number, number]>((p) => [+p.date * 1000, p.Mcap])
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
	Boolean(selectedChain && BACKFILLED_CHAINS.has(selectedChain)) || Number(date) > 1_652_241_600

const getTargetPrice = (
	pegType: StablecoinPegType,
	ratesChart: Array<StablecoinRateSnapshot>,
	targetTimestampMs: number | null,
	currentTimeMs: number
): number | null => {
	const currencyTicker = pegType === 'peggedREAL' ? 'BRL' : pegType.slice(-3)
	if (currencyTicker === 'USD') {
		return 1
	}
	const rates =
		targetTimestampMs == null
			? getFreshStablecoinCurrentPoint(ratesChart, (point) => point.date, currentTimeMs)
			: findTimeSeriesPointNear(ratesChart, targetTimestampMs, (point) => point.date)
	const rate = rates?.rates[currencyTicker]
	if (rate === undefined || rate === 0) return null
	return 1 / rate
}

export const formatPeggedAssetsData = ({
	chain = '',
	peggedAssets = [],
	chartDataByPeggedAsset = [],
	priceData = [],
	rateData = [],
	peggedAssetIdToChartDataIndex = {},
	doublecountedIndexes = [],
	currentTimeMs
}: IFormatPeggedAssetsDataParams): Array<FormattedStablecoinAsset> => {
	const chartLabels = buildUniqueStablecoinChartLabels(peggedAssets, 'symbol')
	const doublecountedIndexSet = new Set(doublecountedIndexes)
	const completePriceHistory = getCompleteTimeSeriesDailyWindow(priceData, 31, (point) => point.date, {
		currentTimeMs
	})
	const sluggedChain = chain ? slug(chain) : null
	const mappedAssets: Array<FormattedStablecoinAsset> = []
	for (const [assetIndex, pegged] of peggedAssets.entries()) {
		if (sluggedChain && !pegged.chains.some((candidate) => slug(candidate) === sluggedChain)) continue
		const chartLabel = chartLabels[assetIndex]
		if (!chartLabel) throw new Error(`Missing stablecoin chart label for asset ${pegged.id}`)
		const pegType = pegged.pegType
		const chainCirculating = chain ? pegged.chainCirculating[chain] : undefined
		const circulating = chain ? (chainCirculating?.current[pegType] ?? 0) : (pegged.circulating[pegType] ?? 0)
		const circulatingPrevDay = chain
			? (chainCirculating?.circulatingPrevDay[pegType] ?? null)
			: (pegged.circulatingPrevDay[pegType] ?? null)
		const circulatingPrevWeek = chain
			? (chainCirculating?.circulatingPrevWeek[pegType] ?? null)
			: (pegged.circulatingPrevWeek[pegType] ?? null)
		const circulatingPrevMonth = chain
			? (chainCirculating?.circulatingPrevMonth[pegType] ?? null)
			: (pegged.circulatingPrevMonth[pegType] ?? null)
		const chartIndex = peggedAssetIdToChartDataIndex[pegged.id]
		const chart = chartIndex === undefined ? null : (chartDataByPeggedAsset[chartIndex] ?? null)
		const mcap = isInactiveStablecoin(pegged) ? null : getStablecoinValueFromPoint(chart?.at(-1), 'mcap')
		const mcapPrevDay = getPrevStablecoinTotalFromChart(chart, 1, 'mcap', undefined, { currentTimeMs }) ?? null
		const mcapPrevWeek = getPrevStablecoinTotalFromChart(chart, 7, 'mcap', undefined, { currentTimeMs }) ?? null
		const mcapPrevMonth = getPrevStablecoinTotalFromChart(chart, 30, 'mcap', undefined, { currentTimeMs }) ?? null
		const change_1d = getPercentChange(mcap, mcapPrevDay)
		const change_7d = getPercentChange(mcap, mcapPrevWeek)
		const change_1m = getPercentChange(mcap, mcapPrevMonth)

		const change_1d_nol =
			mcap != null && mcapPrevDay != null
				? formatUsd(String(mcap - mcapPrevDay), {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})
				: null
		const change_7d_nol =
			mcap != null && mcapPrevWeek != null
				? formatUsd(String(mcap - mcapPrevWeek), {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})
				: null
		const change_1m_nol =
			mcap != null && mcapPrevMonth != null
				? formatUsd(String(mcap - mcapPrevMonth), {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})
				: null

		const signedChange1d = !change_1d_nol ? null : change_1d_nol.startsWith('-') ? change_1d_nol : `+${change_1d_nol}`
		const signedChange7d = !change_7d_nol ? null : change_7d_nol.startsWith('-') ? change_7d_nol : `+${change_7d_nol}`
		const signedChange1m = !change_1m_nol ? null : change_1m_nol.startsWith('-') ? change_1m_nol : `+${change_1m_nol}`

		let pegDeviation: number | null = null
		let pegDeviation1m: number | null = null
		let pegDeviationInfo: StablecoinDeviationInfo | null = null
		if (pegType !== 'peggedVAR' && pegged.price != null) {
			const targetPrice = getTargetPrice(pegType, rateData, null, currentTimeMs)
			pegDeviation = getPercentChange(pegged.price, targetPrice)
			let greatestDeviation = 0
			let greatestDeviationInfo: StablecoinDeviationInfo | null = null
			let hasCompleteAssetPriceHistory = completePriceHistory != null && pegged.gecko_id != null
			for (const historicalPrices of completePriceHistory ?? []) {
				const historicalTargetPrice = getTargetPrice(
					pegType,
					rateData,
					toUnixMsTimestamp(historicalPrices.date),
					currentTimeMs
				)
				const historicalPrice = pegged.gecko_id != null ? (historicalPrices.prices[pegged.gecko_id] ?? null) : null
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
							priceSource: pegged.priceSource ?? null
						}
					}
				}
			}
			if (
				hasCompleteAssetPriceHistory &&
				targetPrice != null &&
				Math.abs(greatestDeviation) < Math.abs(pegged.price - targetPrice)
			) {
				greatestDeviation = pegged.price - targetPrice
				if (0.02 < Math.abs(greatestDeviation)) {
					greatestDeviationInfo = {
						timestamp: currentTimeMs / 1000,
						price: pegged.price,
						priceSource: pegged.priceSource ?? null
					}
				}
			}
			pegDeviation1m =
				hasCompleteAssetPriceHistory && targetPrice != null
					? getPercentChange(targetPrice + greatestDeviation, targetPrice)
					: null
			pegDeviationInfo = hasCompleteAssetPriceHistory ? greatestDeviationInfo : null
		}

		mappedAssets.push({
			id: pegged.id,
			chartLabel,
			name: pegged.name,
			symbol: pegged.symbol,
			gecko_id: pegged.gecko_id,
			chains: pegged.chains,
			pegType,
			pegMechanism: pegged.pegMechanism,
			...(pegged.delisted === true ? { delisted: true } : {}),
			...(pegged.deadFrom !== undefined ? { deadFrom: pegged.deadFrom } : {}),
			...(pegged.deprecated === true ? { deprecated: true } : {}),
			...(pegged.yieldBearing === true ? { yieldBearing: true } : {}),
			circulating,
			circulatingPrevDay,
			circulatingPrevWeek,
			circulatingPrevMonth,
			unreleased: null,
			mcap,
			price: pegged.price,
			change_1d,
			change_7d,
			change_1m,
			change_1d_nol: signedChange1d,
			change_7d_nol: signedChange7d,
			change_1m_nol: signedChange1m,
			pegDeviation,
			pegDeviation_1m: pegDeviation1m,
			pegDeviationInfo,
			doublecounted: chartIndex !== undefined && doublecountedIndexSet.has(chartIndex)
		})
	}

	if (chain) {
		return mappedAssets.toSorted((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0))
	}

	return mappedAssets
}

export const formatPeggedChainsData = ({
	chainList = [],
	peggedChartDataByChain = [],
	chainDominances = {},
	currentTimeMs
}: IFormatPeggedChainsDataParams): Array<IFormattedStablecoinChainRow> => {
	const formattedStablecoinChains: Array<IFormattedStablecoinChainRow> = []
	for (const [i, chainName] of chainList.entries()) {
		const chart = peggedChartDataByChain[i] ?? null
		const chainDominance = chainDominances[chainName] ?? null

		const mcap = getStablecoinValueFromPoint(chart?.at(-1), 'totalCirculatingUSD')
		const mcapPrevDay = getPrevStablecoinTotalFromChart(chart, 1, 'totalCirculatingUSD', undefined, { currentTimeMs })
		const mcapPrevWeek = getPrevStablecoinTotalFromChart(chart, 7, 'totalCirculatingUSD', undefined, { currentTimeMs })
		const mcapPrevMonth = getPrevStablecoinTotalFromChart(chart, 30, 'totalCirculatingUSD', undefined, {
			currentTimeMs
		})
		const circulating = getStablecoinValueFromPoint(chart?.at(-1), 'totalCirculating')
		const unreleased = getStablecoinValueFromPoint(chart?.at(-1), 'totalUnreleased')
		const bridgedTo = getStablecoinValueFromPoint(chart?.at(-1), 'totalBridgedToUSD')
		const minted = getStablecoinValueFromPoint(chart?.at(-1), 'totalMintedUSD')
		const dominance = chainDominance
			? {
					name: chainDominance.symbol,
					value: getStablecoinDominance(chainDominance, mcap)
				}
			: null

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
			dominance
		})
	}

	formattedStablecoinChains.sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0))

	return formattedStablecoinChains
}
