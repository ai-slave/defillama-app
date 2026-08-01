import * as React from 'react'
import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { prepareRuntimePieChartData, type RuntimePieChartData } from '~/components/ECharts/PieChart/data'
import { CHART_COLORS } from '~/constants/colors'
import type { IProtocolValueChart, ProtocolTreasuryKey } from './api.types'
import { useFetchProtocolChartsByKeys, type IFetchProtocolChartsByKeysParams } from './queries.client'
import type { ProtocolExtraTvlKey } from './tvlChart'
import { canonicalizeTokensToExclude } from './valueChartSources'

type MultiSeriesCharts = NonNullable<IMultiSeriesChartProps['charts']>
type BreakdownPoint = [number, Record<string, number>]
export type ProtocolBreakdownChart = BreakdownPoint[]
type AggregatedValueChart = Array<[number, number | null]>
type BuiltTokenInflows = {
	tokenInflows: ProtocolBreakdownChart
	usdInflows: Array<[number, number]>
}
/** Maximum allowed difference (in milliseconds) between chart latest timestamps for alignment. */
const MAX_BREAKDOWN_TIMESTAMP_ALIGNMENT_DIFF_MS = 24 * 60 * 60 * 1e3
const OTHERS_SERIES_COLOR = '#AAAAAA'

interface IUseProtocolBreakdownChartsCommonParams {
	protocol: string
	includeBase?: boolean
	/** Fetch and build token breakdown datasets. */
	inflows?: boolean
	/** Build derived inflow datasets when the page renders them. */
	computeInflows?: boolean
	chainsUnique?: string[]
	/** Minimum positive latest USD value included in the token pie. */
	tokenPieMinimumValue?: number
}

type ProtocolTreasuryExtraKey = Extract<ProtocolTreasuryKey, 'OwnTokens'>
type IUseProtocolBreakdownChartsParams = IUseProtocolBreakdownChartsCommonParams &
	(
		| { source?: 'tvl'; keys: ProtocolExtraTvlKey[]; tokensToExclude?: string[] }
		| { source: 'treasury'; keys: ProtocolTreasuryExtraKey[]; tokensToExclude?: never }
	)

export type FailedQueryCategory = 'tvl' | 'chain-breakdown' | 'token-breakdown-usd' | 'token-breakdown-raw'

interface IFailedChartQuery {
	category: FailedQueryCategory
	/** The key parameter for this query (`undefined` = base/aggregate) */
	key: string | undefined
	error: Error
}

interface IUseProtocolBreakdownChartsResult {
	isLoading: boolean
	errors: IFailedChartQuery[]
	chainsUnique: string[]
	tokensUnique: string[]
	rawTokensUnique: string[]
	inflowTokensUnique: string[]
	defaultRawTokens: string[]
	chainBreakdown: ProtocolBreakdownChart | null
	valueDataset: TimestampDataset | null
	valueCharts: MultiSeriesCharts
	tokenRawBreakdown: ProtocolBreakdownChart | null
	tokenBreakdownUSD: ProtocolBreakdownChart | null
	tokenBreakdownPieSeries: RuntimePieChartData
	usdInflowsDataset: TimestampDataset | null
	tokenInflows: ProtocolBreakdownChart | null
}

type IUseProtocolBreakdownChartsComputed = Omit<IUseProtocolBreakdownChartsResult, 'isLoading' | 'errors'>

const getLatestChartTimestamp = <T>(chart: Array<[number, T]>): number | null => {
	return chart.at(-1)?.[0] ?? null
}

type PreparedExtraChart<T> = {
	latestTimestamp: number | null
	valuesByTimestamp: Map<number, T>
}

const prepareExtraCharts = <T>(
	charts: Array<Array<[number, T]> | null | undefined>,
	baseLatestTimestamp: number | null
): { charts: PreparedExtraChart<T>[]; alignedLatestTimestamp: number | null } | null => {
	const prepared: PreparedExtraChart<T>[] = []
	let alignedLatestTimestamp = baseLatestTimestamp
	for (const chart of charts) {
		if (chart == null) return null
		const latestTimestamp = getLatestChartTimestamp(chart)
		const valuesByTimestamp = new Map(chart)
		prepared.push({ latestTimestamp, valuesByTimestamp })
		if (
			baseLatestTimestamp != null &&
			latestTimestamp != null &&
			Math.abs(latestTimestamp - baseLatestTimestamp) <= MAX_BREAKDOWN_TIMESTAMP_ALIGNMENT_DIFF_MS &&
			(alignedLatestTimestamp == null || latestTimestamp > alignedLatestTimestamp)
		) {
			alignedLatestTimestamp = latestTimestamp
		}
	}
	return { charts: prepared, alignedLatestTimestamp }
}

const getAnchoredExtraValue = <T>(
	extra: PreparedExtraChart<T>,
	baseTimestamp: number,
	baseLatestTimestamp: number | null
): { found: false } | { found: true; timestamp: number; value: T } => {
	if (extra.latestTimestamp == null) return { found: false }
	if (extra.valuesByTimestamp.has(baseTimestamp)) {
		const value = extra.valuesByTimestamp.get(baseTimestamp)
		if (value === undefined) throw new Error('Missing indexed protocol chart value')
		return { found: true, timestamp: baseTimestamp, value }
	}
	if (
		baseLatestTimestamp != null &&
		baseTimestamp === baseLatestTimestamp &&
		Math.abs(extra.latestTimestamp - baseLatestTimestamp) <= MAX_BREAKDOWN_TIMESTAMP_ALIGNMENT_DIFF_MS
	) {
		const value = extra.valuesByTimestamp.get(extra.latestTimestamp)
		if (value === undefined) throw new Error('Missing latest protocol chart value')
		return { found: true, timestamp: extra.latestTimestamp, value }
	}
	return { found: false }
}

const aggregateValueCharts = (charts: Array<IProtocolValueChart | null | undefined>): AggregatedValueChart | null => {
	if (charts.length === 0) return null
	const base = charts[0]
	if (base == null) return null
	const baseLatestTimestamp = getLatestChartTimestamp(base)
	const prepared = prepareExtraCharts(charts.slice(1), baseLatestTimestamp)
	if (!prepared) return null
	if (prepared.charts.every((chart) => chart.latestTimestamp == null)) return base

	const result: AggregatedValueChart = []
	for (const [timestamp, baseValue] of base) {
		let value: number | null = baseValue
		for (const extra of prepared.charts) {
			if (extra.latestTimestamp == null) continue
			const extraPoint = getAnchoredExtraValue(extra, timestamp, baseLatestTimestamp)
			if (!extraPoint.found) {
				value = null
				break
			}
			value += extraPoint.value
		}
		const alignedTimestamp =
			timestamp === baseLatestTimestamp && prepared.alignedLatestTimestamp != null
				? prepared.alignedLatestTimestamp
				: timestamp
		result.push([alignedTimestamp, value])
	}
	return result
}

const aggregateBreakdownCharts = (
	charts: Array<ProtocolBreakdownChart | null | undefined>
): ProtocolBreakdownChart | null => {
	if (charts.length === 0) return null
	const base = charts[0]
	if (base == null) return null
	const baseLatestTimestamp = getLatestChartTimestamp(base)
	const prepared = prepareExtraCharts(charts.slice(1), baseLatestTimestamp)
	if (!prepared) return null
	if (prepared.charts.every((chart) => chart.latestTimestamp == null)) return base

	const result: ProtocolBreakdownChart = []
	for (const [timestamp, baseValues] of base) {
		const values: Record<string, number> = {}
		for (const key in baseValues) {
			const value = baseValues[key]
			if (value !== undefined) values[key] = value
		}

		let hasEveryRequiredPoint = true
		for (const extra of prepared.charts) {
			if (extra.latestTimestamp == null) continue
			const extraPoint = getAnchoredExtraValue(extra, timestamp, baseLatestTimestamp)
			if (!extraPoint.found) {
				hasEveryRequiredPoint = false
				break
			}
			for (const key in extraPoint.value) {
				const value = extraPoint.value[key]
				if (value !== undefined) values[key] = (values[key] ?? 0) + value
			}
		}
		if (!hasEveryRequiredPoint) continue

		const alignedTimestamp =
			timestamp === baseLatestTimestamp && prepared.alignedLatestTimestamp != null
				? prepared.alignedLatestTimestamp
				: timestamp
		result.push([alignedTimestamp, values])
	}
	return result
}

const buildBreakdownKeys = (breakdown: ProtocolBreakdownChart | null | undefined): string[] => {
	if (!breakdown?.length) return []

	let latestPoint: Record<string, number> | null = null
	const allKeys = new Set<string>()

	for (const [, values] of breakdown) {
		latestPoint = values
		for (const key in values) allKeys.add(key)
	}
	if (!latestPoint) return []

	return Array.from(allKeys)
		.filter((name) => name !== OTHERS_SERIES_NAME)
		.sort((a, b) => Math.abs(latestPoint[b] ?? 0) - Math.abs(latestPoint[a] ?? 0))
}

const buildPeakValueKeys = (
	breakdown: ProtocolBreakdownChart | null | undefined,
	eligibleKeys?: ReadonlySet<string>
): string[] => {
	if (!breakdown?.length) return []
	const peakByKey = new Map<string, number>()
	const order: string[] = []
	for (const [, values] of breakdown) {
		for (const key in values) {
			const rawValue = values[key]
			if (rawValue === undefined) continue
			if (key === OTHERS_SERIES_NAME || (eligibleKeys && !eligibleKeys.has(key))) continue
			const value = Math.abs(rawValue)
			const peak = peakByKey.get(key)
			if (peak === undefined) {
				order.push(key)
				peakByKey.set(key, value)
			} else if (value > peak) {
				peakByKey.set(key, value)
			}
		}
	}
	return order.sort((a, b) => {
		const aPeak = peakByKey.get(a)
		const bPeak = peakByKey.get(b)
		if (aPeak === undefined || bPeak === undefined) throw new Error('Missing breakdown peak')
		return bPeak - aPeak
	})
}

const buildRawTokenKeysByPeakUsd = (
	rawBreakdown: ProtocolBreakdownChart | null | undefined,
	usdBreakdown: ProtocolBreakdownChart | null | undefined
): { available: string[]; defaults: string[] } => {
	if (!rawBreakdown?.length) return { available: [], defaults: [] }
	const rawPeakByKey = new Map<string, number>()
	for (const [, values] of rawBreakdown) {
		for (const token in values) {
			const value = values[token]
			if (value === undefined) continue
			if (token === OTHERS_SERIES_NAME || token.startsWith('UNKNOWN') || value <= 0) continue
			const peak = rawPeakByKey.get(token)
			if (peak === undefined) {
				rawPeakByKey.set(token, value)
			} else if (value > peak) {
				rawPeakByKey.set(token, value)
			}
		}
	}
	const rawKeys = Array.from(rawPeakByKey.keys())
	rawKeys.sort((left, right) => {
		const leftPeak = rawPeakByKey.get(left)
		const rightPeak = rawPeakByKey.get(right)
		if (leftPeak === undefined || rightPeak === undefined) throw new Error('Missing raw token peak')
		return rightPeak - leftPeak
	})
	if (rawKeys.length === 0) return { available: [], defaults: [] }
	const rawKeySet = new Set(rawKeys)
	const rankedByUsd = buildPeakValueKeys(usdBreakdown, rawKeySet)
	const defaults = (rankedByUsd.length > 0 ? rankedByUsd : rawKeys).slice(0, MAX_PROTOCOL_BREAKDOWN_SERIES)
	return { available: rawKeys, defaults }
}

export const MAX_PROTOCOL_BREAKDOWN_SERIES = 30
const OTHERS_SERIES_NAME = 'Others'

const hasBreakdownSeries = (breakdown: ProtocolBreakdownChart, name: string): boolean => {
	for (const [, values] of breakdown) {
		if (values[name] != null) return true
	}
	return false
}

export const buildProtocolBreakdownPresentation = ({
	breakdown,
	availableSeries,
	activeSeries,
	aggregateOthers,
	includeUpstreamOthers = false,
	fillMissingWithZero = false,
	type,
	stack
}: {
	breakdown: ProtocolBreakdownChart | null | undefined
	availableSeries: readonly string[]
	activeSeries: readonly string[]
	aggregateOthers: boolean
	includeUpstreamOthers?: boolean
	fillMissingWithZero?: boolean
	type: 'line' | 'bar'
	stack?: string
}): { dataset: TimestampDataset | null; charts: MultiSeriesCharts } => {
	if (!breakdown?.length) {
		return { dataset: null, charts: EMPTY_MULTI_SERIES_CHARTS }
	}
	const includesUpstreamOthers = includeUpstreamOthers && hasBreakdownSeries(breakdown, OTHERS_SERIES_NAME)
	if (activeSeries.length === 0 && !includesUpstreamOthers) {
		return {
			dataset: { source: breakdown.map(([timestamp]) => [timestamp]), dimensions: ['timestamp'] },
			charts: EMPTY_MULTI_SERIES_CHARTS
		}
	}

	const active = new Set(activeSeries)
	const orderedActive = availableSeries.filter((name) => active.has(name))
	if (orderedActive.length === 0 && !includesUpstreamOthers) {
		return {
			dataset: { source: breakdown.map(([timestamp]) => [timestamp]), dimensions: ['timestamp'] },
			charts: EMPTY_MULTI_SERIES_CHARTS
		}
	}
	const needsRemainder =
		aggregateOthers && (orderedActive.length > MAX_PROTOCOL_BREAKDOWN_SERIES || includesUpstreamOthers)
	const namedLimit = MAX_PROTOCOL_BREAKDOWN_SERIES
	const renderedNames = orderedActive.slice(0, namedLimit)
	if (needsRemainder) renderedNames.push(OTHERS_SERIES_NAME)

	const remainderNames = orderedActive.slice(namedLimit)
	if (includesUpstreamOthers) remainderNames.push(OTHERS_SERIES_NAME)
	const dataset = buildProjectedBreakdownDataset(breakdown, renderedNames, remainderNames, fillMissingWithZero)
	if (!dataset) return { dataset: null, charts: EMPTY_MULTI_SERIES_CHARTS }

	const canonicalColorIndex = new Map<string, number>()
	for (const [index, name] of availableSeries.entries()) canonicalColorIndex.set(name, index)
	const charts: MultiSeriesCharts = []
	for (const [index, name] of renderedNames.entries()) {
		let color = OTHERS_SERIES_COLOR
		if (name !== OTHERS_SERIES_NAME) {
			const canonicalIndex = canonicalColorIndex.get(name)
			if (canonicalIndex === undefined) throw new Error(`Missing canonical color index for ${name}`)
			const colorIndex = canonicalIndex % CHART_COLORS.length
			const paletteColor = CHART_COLORS[colorIndex]
			if (paletteColor === undefined) throw new Error(`Missing chart color at index ${colorIndex}`)
			color = paletteColor
		}
		charts.push({
			type,
			name,
			encode: { x: 0, y: index + 1 },
			color,
			...(stack ? { stack } : {})
		})
	}
	return { dataset, charts }
}

const buildProjectedBreakdownDataset = (
	breakdown: ProtocolBreakdownChart | null | undefined,
	seriesNames: string[],
	remainderNames: readonly string[],
	fillMissingWithZero: boolean
): TimestampDataset | null => {
	if (!breakdown?.length) return null
	const othersSeriesIndex = seriesNames.indexOf(OTHERS_SERIES_NAME)
	const othersIndex = othersSeriesIndex === -1 ? undefined : othersSeriesIndex + 1
	const source = new Array<TimestampDataset['source'][number]>(breakdown.length)
	for (const [rowIndex, [timestamp, values]] of breakdown.entries()) {
		const point: TimestampDataset['source'][number] = [timestamp]
		point.length = seriesNames.length + 1
		if (fillMissingWithZero) point.fill(0, 1)
		let others = 0
		let hasOthers = false

		for (const [seriesIndex, name] of seriesNames.entries()) {
			if (name === OTHERS_SERIES_NAME) continue
			const value = values[name]
			if (value != null) point[seriesIndex + 1] = value
		}
		if (othersIndex != null) {
			for (const name of remainderNames) {
				const value = values[name]
				if (value == null) continue
				others += value
				hasOthers = true
			}
		}

		if (hasOthers && othersIndex != null) point[othersIndex] = others
		source[rowIndex] = point
	}
	return { source, dimensions: ['timestamp', ...seriesNames] }
}

const buildTokenInflowPoint = ({
	currentRaw,
	previousRaw,
	currentUsd,
	previousUsd
}: {
	currentRaw: Record<string, number>
	previousRaw: Record<string, number>
	currentUsd: Record<string, number>
	previousUsd: Record<string, number>
}): { tokenValues: Record<string, number>; usdValue: number } => {
	const tokenValues: Record<string, number> = {}
	let usdValue = 0

	const addTokenInflow = (token: string) => {
		// Backend Others is an aggregate of changing token composition. Treating it as
		// one raw token would infer a meaningless price and manufacture false flows.
		if (token === OTHERS_SERIES_NAME || token.startsWith('UNKNOWN')) return
		const currentAmount = currentRaw[token] ?? 0
		const previousAmount = previousRaw[token] ?? 0
		const amountDiff = currentAmount - previousAmount
		if (amountDiff === 0) return

		let price: number | null = null
		let referenceUsd = 0
		const currentUsdValue = currentUsd[token]
		const previousUsdValue = previousUsd[token]
		if (currentAmount > 0 && currentUsdValue != null) {
			price = currentUsdValue / currentAmount
			referenceUsd = currentUsdValue
		}
		if (previousAmount > 0 && previousUsdValue != null && (price == null || previousUsdValue > referenceUsd)) {
			price = previousUsdValue / previousAmount
			referenceUsd = previousUsdValue
		}
		if (price == null) return

		const inflow = amountDiff * price
		if (Math.abs(inflow) > 2 * referenceUsd) return

		tokenValues[token] = inflow
		usdValue += inflow
	}

	for (const token in currentRaw) addTokenInflow(token)
	for (const token in previousRaw) {
		if (currentRaw[token] == null) addTokenInflow(token)
	}

	return { tokenValues, usdValue }
}

type PreparedTokenInflowSource = {
	isSuccessfulEmpty: boolean
	raw: PreparedExtraChart<Record<string, number>>
	usd: PreparedExtraChart<Record<string, number>>
}

const buildTokenInflowsFromChartPairs = (
	tokenBreakdownUsdCharts: Array<ProtocolBreakdownChart | null | undefined>,
	tokenBreakdownRawCharts: Array<ProtocolBreakdownChart | null | undefined>
): BuiltTokenInflows | null => {
	const pairCount = Math.max(tokenBreakdownUsdCharts.length, tokenBreakdownRawCharts.length)
	if (pairCount === 0) return null

	const sources: PreparedTokenInflowSource[] = []
	for (let i = 0; i < pairCount; i++) {
		const usdChart = tokenBreakdownUsdCharts[i]
		const rawChart = tokenBreakdownRawCharts[i]
		if (usdChart == null || rawChart == null) return null
		sources.push({
			isSuccessfulEmpty: usdChart.length === 0 && rawChart.length === 0,
			raw: { latestTimestamp: getLatestChartTimestamp(rawChart), valuesByTimestamp: new Map(rawChart) },
			usd: { latestTimestamp: getLatestChartTimestamp(usdChart), valuesByTimestamp: new Map(usdChart) }
		})
	}

	const baseRawChart = tokenBreakdownRawCharts[0]
	if (!baseRawChart || baseRawChart.length < 2) return { tokenInflows: [], usdInflows: [] }
	const baseLatestTimestamp = getLatestChartTimestamp(baseRawChart)
	if (baseLatestTimestamp == null) return { tokenInflows: [], usdInflows: [] }

	const tokenInflows: ProtocolBreakdownChart = []
	const usdInflows: Array<[number, number]> = []
	for (let rowIndex = 1; rowIndex < baseRawChart.length; rowIndex++) {
		const previousBasePoint = baseRawChart[rowIndex - 1]
		const currentBasePoint = baseRawChart[rowIndex]
		if (!previousBasePoint || !currentBasePoint) throw new Error('Missing base protocol chart interval endpoint')
		const previousBaseTimestamp = previousBasePoint[0]
		const currentBaseTimestamp = currentBasePoint[0]
		const baseIntervalDuration = currentBaseTimestamp - previousBaseTimestamp
		if (baseIntervalDuration <= 0 || baseIntervalDuration > MAX_BREAKDOWN_TIMESTAMP_ALIGNMENT_DIFF_MS) continue
		const tokenValues: Record<string, number> = {}
		let usdValue = 0
		let alignedTimestamp = currentBaseTimestamp
		let hasEveryRequiredEndpoint = true

		for (const source of sources) {
			if (source.isSuccessfulEmpty) continue
			const previousRaw = getAnchoredExtraValue(source.raw, previousBaseTimestamp, baseLatestTimestamp)
			const currentRaw = getAnchoredExtraValue(source.raw, currentBaseTimestamp, baseLatestTimestamp)
			const previousUsd = getAnchoredExtraValue(source.usd, previousBaseTimestamp, baseLatestTimestamp)
			const currentUsd = getAnchoredExtraValue(source.usd, currentBaseTimestamp, baseLatestTimestamp)
			if (!previousRaw.found || !currentRaw.found || !previousUsd.found || !currentUsd.found) {
				hasEveryRequiredEndpoint = false
				break
			}
			const sourceRawIntervalDuration = currentRaw.timestamp - previousRaw.timestamp
			if (
				sourceRawIntervalDuration <= 0 ||
				sourceRawIntervalDuration > MAX_BREAKDOWN_TIMESTAMP_ALIGNMENT_DIFF_MS ||
				previousRaw.timestamp !== previousUsd.timestamp ||
				currentRaw.timestamp !== currentUsd.timestamp
			) {
				hasEveryRequiredEndpoint = false
				break
			}

			const sourceInflow = buildTokenInflowPoint({
				currentRaw: currentRaw.value,
				previousRaw: previousRaw.value,
				currentUsd: currentUsd.value,
				previousUsd: previousUsd.value
			})
			for (const token in sourceInflow.tokenValues) {
				const value = sourceInflow.tokenValues[token]
				if (value !== undefined) tokenValues[token] = (tokenValues[token] ?? 0) + value
			}
			usdValue += sourceInflow.usdValue
			if (currentRaw.timestamp > alignedTimestamp) alignedTimestamp = currentRaw.timestamp
			if (currentUsd.timestamp > alignedTimestamp) alignedTimestamp = currentUsd.timestamp
		}

		if (!hasEveryRequiredEndpoint) continue
		let hasVisibleTokenFlow = false
		for (const token in tokenValues) {
			const value = tokenValues[token]
			if (value !== undefined && value !== 0) {
				hasVisibleTokenFlow = true
				break
			}
		}
		if (!hasVisibleTokenFlow && usdValue === 0) continue
		tokenInflows.push([alignedTimestamp, tokenValues])
		usdInflows.push([alignedTimestamp, usdValue])
	}
	return { tokenInflows, usdInflows }
}

const EMPTY_MULTI_SERIES_CHARTS: MultiSeriesCharts = []
const EMPTY_RUNTIME_PIE_SERIES: RuntimePieChartData = { peers: [], limit: 15, upstreamOthersValue: 0 }

const EMPTY_COMPUTED_RESULT: IUseProtocolBreakdownChartsComputed = {
	chainsUnique: [],
	tokensUnique: [],
	rawTokensUnique: [],
	inflowTokensUnique: [],
	defaultRawTokens: [],
	chainBreakdown: null,
	valueDataset: null,
	valueCharts: EMPTY_MULTI_SERIES_CHARTS,
	tokenRawBreakdown: null,
	tokenBreakdownUSD: null,
	tokenBreakdownPieSeries: EMPTY_RUNTIME_PIE_SERIES,
	usdInflowsDataset: null,
	tokenInflows: null
}

export const buildComputedBreakdownResult = ({
	tvlCharts,
	chainBreakdownCharts,
	tokenBreakdownUsdCharts,
	tokenBreakdownRawCharts,
	valueSeriesName,
	inflows = true,
	computeInflows = true,
	buildTokenRawBreakdown = true,
	buildTokenPieChart = true,
	tokenPieMinimumValue = 1
}: {
	tvlCharts: Array<IProtocolValueChart | null | undefined>
	chainBreakdownCharts: Array<ProtocolBreakdownChart | null | undefined>
	tokenBreakdownUsdCharts: Array<ProtocolBreakdownChart | null | undefined>
	tokenBreakdownRawCharts: Array<ProtocolBreakdownChart | null | undefined>
	valueSeriesName: string
	inflows?: boolean
	computeInflows?: boolean
	buildTokenRawBreakdown?: boolean
	buildTokenPieChart?: boolean
	tokenPieMinimumValue?: number
}): IUseProtocolBreakdownChartsComputed => {
	const tvlChart = aggregateValueCharts(tvlCharts)
	const chainBreakdownChart = aggregateBreakdownCharts(chainBreakdownCharts)

	const chainsUnique = buildBreakdownKeys(chainBreakdownChart)

	let valueDataset: TimestampDataset | null = null
	if (tvlChart && tvlChart.length > 1) {
		const source: TimestampDataset['source'] = []
		for (const [timestamp, value] of tvlChart) {
			source.push([timestamp, value])
		}
		valueDataset = { source, dimensions: ['timestamp', valueSeriesName] }
	}
	const valueCharts =
		valueDataset != null
			? [
					{
						type: 'line' as const,
						name: valueSeriesName,
						encode: { x: 0, y: 1 }
					}
				]
			: EMPTY_MULTI_SERIES_CHARTS

	if (!inflows) {
		return {
			chainsUnique,
			tokensUnique: [],
			rawTokensUnique: [],
			inflowTokensUnique: [],
			defaultRawTokens: [],
			chainBreakdown: chainBreakdownChart,
			valueDataset,
			valueCharts,
			tokenRawBreakdown: null,
			tokenBreakdownUSD: null,
			tokenBreakdownPieSeries: EMPTY_RUNTIME_PIE_SERIES,
			usdInflowsDataset: null,
			tokenInflows: null
		}
	}

	const tokenBreakdownUSD = aggregateBreakdownCharts(tokenBreakdownUsdCharts)
	const tokenBreakdown = buildTokenRawBreakdown ? aggregateBreakdownCharts(tokenBreakdownRawCharts) : null

	const tokenUsdKeys = buildBreakdownKeys(tokenBreakdownUSD)
	const tokensUnique = tokenUsdKeys
	const rawTokenSeries = buildTokenRawBreakdown
		? buildRawTokenKeysByPeakUsd(tokenBreakdown, tokenBreakdownUSD)
		: { available: [], defaults: [] }
	const rawTokensUnique = rawTokenSeries.available
	const defaultRawTokens = rawTokenSeries.defaults

	const tokenBreakdownPieSource: Record<string, number> = {}
	let hasTokenBreakdownPieSource = false
	if (buildTokenPieChart && tokenBreakdownUSD?.length) {
		const latestPoint = tokenBreakdownUSD.at(-1)
		if (latestPoint) {
			const latestTokens = latestPoint[1]
			for (const name in latestTokens) {
				const value = latestTokens[name]
				if (name.startsWith('UNKNOWN') || !value || value <= 0) continue
				if (value >= tokenPieMinimumValue) {
					tokenBreakdownPieSource[name] = value
					hasTokenBreakdownPieSource = true
				}
			}
		}
	}

	const tokenBreakdownPieSeries =
		tokenBreakdownUSD?.length && hasTokenBreakdownPieSource
			? prepareRuntimePieChartData({ data: tokenBreakdownPieSource, limit: 15 })
			: EMPTY_RUNTIME_PIE_SERIES

	if (!computeInflows) {
		return {
			chainsUnique,
			tokensUnique,
			rawTokensUnique,
			inflowTokensUnique: [],
			defaultRawTokens,
			chainBreakdown: chainBreakdownChart,
			valueDataset,
			valueCharts,
			tokenRawBreakdown: tokenBreakdown,
			tokenBreakdownUSD,
			tokenBreakdownPieSeries,
			usdInflowsDataset: null,
			tokenInflows: null
		}
	}

	const inflowsResult = buildTokenInflowsFromChartPairs(tokenBreakdownUsdCharts, tokenBreakdownRawCharts)
	const tokenInflows = inflowsResult?.tokenInflows.length ? inflowsResult.tokenInflows : null
	const usdInflows = inflowsResult?.usdInflows.length ? inflowsResult.usdInflows : null
	const inflowTokensUnique = buildPeakValueKeys(tokenInflows)
	const inflowTokenSet = new Set(inflowTokensUnique)
	for (const token of rawTokensUnique) {
		if (!inflowTokenSet.has(token)) inflowTokensUnique.push(token)
	}

	let usdInflowsDataset: TimestampDataset | null = null
	if (usdInflows?.length) {
		const source: TimestampDataset['source'] = []
		for (const [timestamp, value] of usdInflows) {
			source.push([timestamp, value])
		}
		usdInflowsDataset = { source, dimensions: ['timestamp', 'USD Inflows'] }
	}

	return {
		chainsUnique,
		tokensUnique,
		rawTokensUnique,
		inflowTokensUnique,
		defaultRawTokens,
		chainBreakdown: chainBreakdownChart,
		valueDataset,
		valueCharts,
		tokenRawBreakdown: tokenBreakdown,
		tokenBreakdownUSD,
		tokenBreakdownPieSeries,
		usdInflowsDataset,
		tokenInflows
	}
}

const collectFailedQueries = (
	queryGroups: Array<{
		category: FailedQueryCategory
		queries: Array<{ isError: boolean; error: Error | null }>
		keys: Array<string | undefined>
	}>
): IFailedChartQuery[] => {
	const failed: IFailedChartQuery[] = []
	for (const { category, queries, keys } of queryGroups) {
		for (const [index, query] of queries.entries()) {
			if (query.isError && query.error) {
				failed.push({ category, key: keys[index], error: query.error })
			}
		}
	}
	return failed
}

export function useProtocolBreakdownCharts(
	params: IUseProtocolBreakdownChartsParams
): IUseProtocolBreakdownChartsResult {
	const {
		protocol,
		keys,
		includeBase = true,
		inflows = true,
		computeInflows = inflows,
		chainsUnique: knownChains,
		tokenPieMinimumValue = 1
	} = params
	const source = params.source ?? 'tvl'
	const chainBreakdown = !knownChains || knownChains.length >= 2
	const chartQueryParams: IFetchProtocolChartsByKeysParams =
		params.source === 'treasury'
			? { protocol, keys: params.keys, includeBase, source: 'treasury', inflows, chainBreakdown }
			: {
					protocol,
					keys: params.keys,
					includeBase,
					source: 'tvl',
					inflows,
					chainBreakdown,
					...(params.tokensToExclude !== undefined ? { tokensToExclude: params.tokensToExclude } : {})
				}

	const {
		keysToFetch,
		tvlChartQueries,
		chainBreakdownChartQueries,
		tokenBreakdownUsdQueries,
		tokenBreakdownRawQueries
	} = useFetchProtocolChartsByKeys(chartQueryParams)

	const isNetworkLoading =
		tvlChartQueries.some((query) => query.isLoading) ||
		chainBreakdownChartQueries.some((query) => query.isLoading) ||
		tokenBreakdownUsdQueries.some((query) => query.isLoading) ||
		tokenBreakdownRawQueries.some((query) => query.isLoading)
	const tokenExclusionSignature =
		params.source === 'treasury' ? '' : (canonicalizeTokensToExclude(params.tokensToExclude)?.queryValue ?? '')

	const computeSignature = [
		tvlChartQueries
			.map((query) => `${query.dataUpdatedAt}:${query.data === undefined ? 'absent' : 'present'}`)
			.join('|'),
		chainBreakdownChartQueries
			.map((query) => `${query.dataUpdatedAt}:${query.data === undefined ? 'absent' : 'present'}`)
			.join('|'),
		tokenBreakdownUsdQueries
			.map((query) => `${query.dataUpdatedAt}:${query.data === undefined ? 'absent' : 'present'}`)
			.join('|'),
		tokenBreakdownRawQueries
			.map((query) => `${query.dataUpdatedAt}:${query.data === undefined ? 'absent' : 'present'}`)
			.join('|'),
		protocol,
		source,
		includeBase ? '1' : '0',
		keys.join('|'),
		tokenExclusionSignature,
		inflows ? 'with-breakdowns' : 'without-breakdowns',
		computeInflows ? 'inflows' : 'no-inflows',
		tokenPieMinimumValue
	].join('::')

	const latestComputeInputRef = React.useRef<{
		tvlCharts: Array<IProtocolValueChart | null | undefined>
		chainBreakdownCharts: Array<ProtocolBreakdownChart | null | undefined>
		tokenBreakdownUsdCharts: Array<ProtocolBreakdownChart | null | undefined>
		tokenBreakdownRawCharts: Array<ProtocolBreakdownChart | null | undefined>
	}>({
		tvlCharts: [],
		chainBreakdownCharts: [],
		tokenBreakdownUsdCharts: [],
		tokenBreakdownRawCharts: []
	})
	latestComputeInputRef.current = {
		tvlCharts: tvlChartQueries.some((query) => query.isError && query.data === undefined)
			? []
			: tvlChartQueries.map((query) => query.data),
		chainBreakdownCharts: chainBreakdownChartQueries.some((query) => query.isError && query.data === undefined)
			? []
			: chainBreakdownChartQueries.map((query) => query.data),
		tokenBreakdownUsdCharts: tokenBreakdownUsdQueries.some((query) => query.isError && query.data === undefined)
			? []
			: tokenBreakdownUsdQueries.map((query) => query.data),
		tokenBreakdownRawCharts: tokenBreakdownRawQueries.some((query) => query.isError && query.data === undefined)
			? []
			: tokenBreakdownRawQueries.map((query) => query.data)
	}

	const [computed, setComputed] = React.useState<IUseProtocolBreakdownChartsComputed>(EMPTY_COMPUTED_RESULT)
	const [isComputing, setIsComputing] = React.useState(false)
	const computeRunIdRef = React.useRef(0)

	React.useEffect(() => {
		if (isNetworkLoading) {
			setIsComputing(false)
			return
		}

		let cancelled = false
		const runId = ++computeRunIdRef.current
		setIsComputing(true)

		const runComputation = () => {
			if (cancelled || runId !== computeRunIdRef.current) return

			const next = buildComputedBreakdownResult({
				...latestComputeInputRef.current,
				valueSeriesName: source === 'treasury' ? 'Treasury' : 'Total',
				inflows,
				computeInflows,
				tokenPieMinimumValue
			})

			if (cancelled || runId !== computeRunIdRef.current) return
			setComputed(next)
			setIsComputing(false)
		}

		let timeoutId: number | undefined
		let idleCallbackId: number | undefined

		if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
			idleCallbackId = window.requestIdleCallback(runComputation, { timeout: 250 })
		} else {
			timeoutId = window.setTimeout(runComputation, 0)
		}

		return () => {
			cancelled = true
			if (
				idleCallbackId !== undefined &&
				typeof window !== 'undefined' &&
				typeof window.cancelIdleCallback === 'function'
			) {
				window.cancelIdleCallback(idleCallbackId)
			}
			if (timeoutId !== undefined) {
				window.clearTimeout(timeoutId)
			}
		}
	}, [isNetworkLoading, computeSignature, source, inflows, computeInflows, tokenPieMinimumValue])

	const errors = React.useMemo(
		() =>
			collectFailedQueries([
				{ category: 'tvl', queries: tvlChartQueries, keys: keysToFetch },
				{ category: 'chain-breakdown', queries: chainBreakdownChartQueries, keys: keysToFetch },
				{ category: 'token-breakdown-usd', queries: tokenBreakdownUsdQueries, keys: keysToFetch },
				{ category: 'token-breakdown-raw', queries: tokenBreakdownRawQueries, keys: keysToFetch }
			]),
		[tvlChartQueries, chainBreakdownChartQueries, tokenBreakdownUsdQueries, tokenBreakdownRawQueries, keysToFetch]
	)

	return {
		isLoading: isNetworkLoading || isComputing,
		errors,
		...computed
	}
}
