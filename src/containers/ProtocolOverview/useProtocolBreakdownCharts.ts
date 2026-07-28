import * as React from 'react'
import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { prepareRuntimePieChartData, type RuntimePieChartData } from '~/components/ECharts/PieChart/data'
import { CHART_COLORS } from '~/constants/colors'
import type { IProtocolTokenBreakdownChart, IProtocolValueChart } from './api.types'
import { useFetchProtocolChartsByKeys } from './queries.client'

type MultiSeriesCharts = NonNullable<IMultiSeriesChartProps['charts']>
type MultiSeriesChart = MultiSeriesCharts[number]
type BreakdownPoint = [number, Record<string, number>]
export type ProtocolBreakdownChart = BreakdownPoint[]
type BreakdownChart = ProtocolBreakdownChart
type InflowsDataset = TimestampDataset
type BuiltTokenInflows = {
	tokenInflows: BreakdownChart
	usdInflows: Array<[number, number]>
}
/** Maximum allowed difference (in milliseconds) between chart latest timestamps for alignment. */
const MAX_BREAKDOWN_TIMESTAMP_ALIGNMENT_DIFF_MS = 24 * 60 * 60 * 1e3
const OTHERS_SERIES_COLOR = '#AAAAAA'

interface IUseProtocolBreakdownChartsParams {
	protocol: string
	keys: string[]
	includeBase?: boolean
	source?: 'tvl' | 'treasury'
	/** Fetch and build token breakdown datasets. */
	inflows?: boolean
	/** Build derived inflow datasets when the page renders them. */
	computeInflows?: boolean
	chainsUnique?: string[]
	tokensToExclude?: string[]
	/** Minimum positive latest USD value included in the token pie. */
	tokenPieMinimumValue?: number
}

type FailedQueryCategory = 'tvl' | 'chain-breakdown' | 'token-breakdown-usd' | 'token-breakdown-raw'

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
	chainBreakdown: BreakdownChart | null
	valueDataset: TimestampDataset | null
	valueCharts: MultiSeriesCharts
	tokenRawBreakdown: BreakdownChart | null
	tokenBreakdownUSD: BreakdownChart | null
	tokenBreakdownPieSeries: RuntimePieChartData
	usdInflowsDataset: InflowsDataset | null
	tokenInflows: BreakdownChart | null
}

type IUseProtocolBreakdownChartsComputed = Omit<IUseProtocolBreakdownChartsResult, 'isLoading' | 'errors'>

const getLatestChartTimestamp = (chart: Array<[number, unknown]>): number | null => {
	if (chart.length === 0) return null
	const lastPoint = chart[chart.length - 1]
	return lastPoint?.[0] ?? null
}

/**
 * Compute per-chart alignment info: for each chart whose latest timestamp is within
 * `maxDiff` of the global most-recent timestamp, we map its latest → mostRecent.
 */
const buildTimestampAlignment = (
	charts: Array<Array<[number, unknown]> | null | undefined>
): { mostRecent: number | null; perChart: Map<number, number> } => {
	const perChart = new Map<number, number>()
	let mostRecent: number | null = null

	for (const [i, chart] of charts.entries()) {
		if (!chart?.length) continue
		const latest = getLatestChartTimestamp(chart)
		if (latest == null) continue
		perChart.set(i, latest)
		if (mostRecent == null || latest > mostRecent) mostRecent = latest
	}

	return { mostRecent, perChart }
}

const alignTimestamp = (
	timestamp: number,
	chartIndex: number,
	alignment: { mostRecent: number | null; perChart: Map<number, number> },
	maxDiff: number
): number => {
	const latest = alignment.perChart.get(chartIndex)
	if (
		latest != null &&
		alignment.mostRecent != null &&
		Math.abs(alignment.mostRecent - latest) <= maxDiff &&
		timestamp === latest
	) {
		return alignment.mostRecent
	}
	return timestamp
}

const aggregateValueCharts = (charts: Array<IProtocolValueChart | null | undefined>): IProtocolValueChart | null => {
	let onlyChart: IProtocolValueChart | null = null
	let chartCount = 0
	for (const chart of charts) {
		if (!chart?.length) continue
		onlyChart = chart
		chartCount++
		if (chartCount > 1) break
	}
	if (chartCount === 0) return null
	if (chartCount === 1) return onlyChart

	const summedByTimestamp = new Map<number, number>()
	const alignment = buildTimestampAlignment(charts)

	for (const [chartIndex, chart] of charts.entries()) {
		if (!chart?.length) continue
		for (const [timestamp, value] of chart) {
			const aligned = alignTimestamp(timestamp, chartIndex, alignment, MAX_BREAKDOWN_TIMESTAMP_ALIGNMENT_DIFF_MS)
			summedByTimestamp.set(aligned, (summedByTimestamp.get(aligned) ?? 0) + value)
		}
	}

	if (summedByTimestamp.size === 0) return null
	return Array.from(summedByTimestamp.entries()).sort((a, b) => a[0] - b[0])
}

const aggregateBreakdownCharts = (charts: Array<BreakdownChart | null | undefined>): BreakdownChart | null => {
	let onlyChart: BreakdownChart | null = null
	let chartCount = 0
	for (const chart of charts) {
		if (!chart?.length) continue
		onlyChart = chart
		chartCount++
		if (chartCount > 1) break
	}
	if (chartCount === 0) return null
	if (chartCount === 1) return onlyChart

	const summedByTimestamp = new Map<number, Map<string, number>>()
	const alignment = buildTimestampAlignment(charts)

	for (const [chartIndex, chart] of charts.entries()) {
		if (!chart?.length) continue
		for (const [timestamp, values] of chart) {
			const aligned = alignTimestamp(timestamp, chartIndex, alignment, MAX_BREAKDOWN_TIMESTAMP_ALIGNMENT_DIFF_MS)
			const current = summedByTimestamp.get(aligned) ?? new Map<string, number>()
			for (const key in values) {
				current.set(key, (current.get(key) ?? 0) + values[key])
			}
			summedByTimestamp.set(aligned, current)
		}
	}

	if (summedByTimestamp.size === 0) return null
	return Array.from(
		summedByTimestamp,
		([timestamp, values]) => [timestamp, Object.fromEntries(values)] as BreakdownPoint
	).sort((a, b) => a[0] - b[0])
}

const buildBreakdownKeys = (breakdown: BreakdownChart | null | undefined): string[] => {
	if (!breakdown?.length) return []

	const latestPoint = breakdown[breakdown.length - 1]?.[1] ?? {}
	const allKeys = new Set<string>()

	for (const [, values] of breakdown) {
		for (const key in values) allKeys.add(key)
	}

	return Array.from(allKeys)
		.filter((name) => name !== OTHERS_SERIES_NAME)
		.sort((a, b) => Math.abs(latestPoint[b] ?? 0) - Math.abs(latestPoint[a] ?? 0))
}

const buildPeakValueKeys = (
	breakdown: BreakdownChart | null | undefined,
	eligibleKeys?: ReadonlySet<string>
): string[] => {
	if (!breakdown?.length) return []
	const peakByKey = new Map<string, number>()
	const order: string[] = []
	for (const [, values] of breakdown) {
		for (const key in values) {
			if (key === OTHERS_SERIES_NAME || (eligibleKeys && !eligibleKeys.has(key))) continue
			const value = Math.abs(values[key])
			const peak = peakByKey.get(key)
			if (peak === undefined) {
				order.push(key)
				peakByKey.set(key, value)
			} else if (value > peak) {
				peakByKey.set(key, value)
			}
		}
	}
	return order.sort((a, b) => (peakByKey.get(b) ?? 0) - (peakByKey.get(a) ?? 0))
}

const buildRawTokenKeysByPeakUsd = (
	rawBreakdown: BreakdownChart | null | undefined,
	usdBreakdown: BreakdownChart | null | undefined
): { available: string[]; defaults: string[] } => {
	if (!rawBreakdown?.length) return { available: [], defaults: [] }
	const rawKeySet = new Set<string>()
	const rawPeakByKey = new Map<string, number>()
	const rawKeys: string[] = []
	for (const [, values] of rawBreakdown) {
		for (const token in values) {
			const value = values[token]
			if (token === OTHERS_SERIES_NAME || token.startsWith('UNKNOWN') || value <= 0) continue
			const peak = rawPeakByKey.get(token)
			if (peak === undefined) {
				rawKeySet.add(token)
				rawKeys.push(token)
				rawPeakByKey.set(token, value)
			} else if (value > peak) {
				rawPeakByKey.set(token, value)
			}
		}
	}
	if (rawKeys.length === 0) return { available: [], defaults: [] }
	rawKeys.sort((left, right) => rawPeakByKey.get(right)! - rawPeakByKey.get(left)!)
	const rankedByUsd = buildPeakValueKeys(usdBreakdown, rawKeySet)
	const defaults = (rankedByUsd.length > 0 ? rankedByUsd : rawKeys).slice(0, MAX_PROTOCOL_BREAKDOWN_SERIES)
	return { available: rawKeys, defaults }
}

export const MAX_PROTOCOL_BREAKDOWN_SERIES = 30
const OTHERS_SERIES_NAME = 'Others'

const hasBreakdownSeries = (breakdown: BreakdownChart, name: string): boolean => {
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
	breakdown: BreakdownChart | null | undefined
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
	for (let i = 0; i < availableSeries.length; i++) canonicalColorIndex.set(availableSeries[i], i)
	const charts = renderedNames.map(
		(name, index): MultiSeriesChart => ({
			type,
			name,
			encode: { x: 0, y: index + 1 },
			color:
				name === OTHERS_SERIES_NAME
					? OTHERS_SERIES_COLOR
					: CHART_COLORS[(canonicalColorIndex.get(name) ?? index) % CHART_COLORS.length],
			...(stack ? { stack } : {})
		})
	)
	return { dataset, charts }
}

const buildProjectedBreakdownDataset = (
	breakdown: BreakdownChart | null | undefined,
	seriesNames: string[],
	remainderNames: readonly string[],
	fillMissingWithZero: boolean
): TimestampDataset | null => {
	if (!breakdown?.length) return null
	const othersSeriesIndex = seriesNames.indexOf(OTHERS_SERIES_NAME)
	const othersIndex = othersSeriesIndex === -1 ? undefined : othersSeriesIndex + 1
	const source = new Array<TimestampDataset['source'][number]>(breakdown.length)
	for (let i = 0; i < breakdown.length; i++) {
		const [timestamp, values] = breakdown[i]
		const point: TimestampDataset['source'][number] = [timestamp]
		point.length = seriesNames.length + 1
		if (fillMissingWithZero) point.fill(0, 1)
		let others = 0
		let hasOthers = false

		for (let seriesIndex = 0; seriesIndex < seriesNames.length; seriesIndex++) {
			const name = seriesNames[seriesIndex]
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
		source[i] = point
	}
	return { source, dimensions: ['timestamp', ...seriesNames] }
}

const buildTokenInflowsFromBreakdowns = (
	tokenBreakdownUSD: IProtocolTokenBreakdownChart | null | undefined,
	tokenBreakdownRaw: IProtocolTokenBreakdownChart | null | undefined
): BuiltTokenInflows | null => {
	if (!tokenBreakdownUSD?.length || !tokenBreakdownRaw?.length) return null

	const usdByTimestamp = new Map<number, Record<string, number>>()
	for (const [timestamp, tokens] of tokenBreakdownUSD) {
		usdByTimestamp.set(timestamp, tokens)
	}

	if (tokenBreakdownRaw.length < 2) return null

	const tokenInflows: BreakdownChart = []
	const usdInflows: Array<[number, number]> = []

	for (let i = 1; i < tokenBreakdownRaw.length; i++) {
		const [timestamp, currentRaw] = tokenBreakdownRaw[i]
		const [previousTimestamp, previousRaw] = tokenBreakdownRaw[i - 1]
		const currentUsd = usdByTimestamp.get(timestamp) ?? {}
		const previousUsd = usdByTimestamp.get(previousTimestamp) ?? {}

		const point: Record<string, number> = {}
		let hasTokenInflows = false
		let usdInflow = 0

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

			point[token] = inflow
			usdInflow += inflow
			hasTokenInflows = true
		}

		for (const token in currentRaw) addTokenInflow(token)
		for (const token in previousRaw) {
			if (currentRaw[token] == null) addTokenInflow(token)
		}

		if (hasTokenInflows) {
			tokenInflows.push([timestamp, point])
			usdInflows.push([timestamp, usdInflow])
		}
	}

	return tokenInflows.length > 0 ? { tokenInflows, usdInflows } : null
}

const buildTokenInflowsFromChartPairs = (
	tokenBreakdownUsdCharts: Array<BreakdownChart | null | undefined>,
	tokenBreakdownRawCharts: Array<BreakdownChart | null | undefined>
): BuiltTokenInflows | null => {
	const pairCount = Math.max(tokenBreakdownUsdCharts.length, tokenBreakdownRawCharts.length)
	if (pairCount <= 1) {
		return buildTokenInflowsFromBreakdowns(tokenBreakdownUsdCharts[0], tokenBreakdownRawCharts[0])
	}

	const tokenInflowsByTimestamp = new Map<number, Map<string, number>>()
	const usdInflowsByTimestamp = new Map<number, number>()
	for (let i = 0; i < pairCount; i++) {
		const result = buildTokenInflowsFromBreakdowns(tokenBreakdownUsdCharts[i], tokenBreakdownRawCharts[i])
		if (!result) continue

		for (const [timestamp, point] of result.tokenInflows) {
			const values = tokenInflowsByTimestamp.get(timestamp) ?? new Map<string, number>()
			for (const token in point) {
				const value = point[token]
				values.set(token, (values.get(token) ?? 0) + value)
			}
			tokenInflowsByTimestamp.set(timestamp, values)
		}
		for (const [timestamp, value] of result.usdInflows) {
			usdInflowsByTimestamp.set(timestamp, (usdInflowsByTimestamp.get(timestamp) ?? 0) + value)
		}
	}

	if (tokenInflowsByTimestamp.size === 0) return null
	const timestamps = Array.from(tokenInflowsByTimestamp.keys()).sort((a, b) => a - b)
	const tokenInflows = new Array<BreakdownPoint>(timestamps.length)
	const usdInflows = new Array<[number, number]>(timestamps.length)
	for (let i = 0; i < timestamps.length; i++) {
		const timestamp = timestamps[i]
		tokenInflows[i] = [timestamp, Object.fromEntries(tokenInflowsByTimestamp.get(timestamp)!)]
		usdInflows[i] = [timestamp, usdInflowsByTimestamp.get(timestamp) ?? 0]
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
	chainBreakdownCharts: Array<BreakdownChart | null | undefined>
	tokenBreakdownUsdCharts: Array<BreakdownChart | null | undefined>
	tokenBreakdownRawCharts: Array<BreakdownChart | null | undefined>
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

	const tokenBreakdownPieSource = {}
	let hasTokenBreakdownPieSource = false
	if (buildTokenPieChart && tokenBreakdownUSD?.length) {
		const latestTokens = tokenBreakdownUSD[tokenBreakdownUSD.length - 1]?.[1] ?? {}
		for (const name in latestTokens) {
			const value = latestTokens[name]
			if (name.startsWith('UNKNOWN') || !value || value <= 0) continue
			if (value >= tokenPieMinimumValue) {
				tokenBreakdownPieSource[name] = value
				hasTokenBreakdownPieSource = true
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
	const tokenInflows = inflowsResult?.tokenInflows ?? null
	const usdInflows = inflowsResult?.usdInflows ?? null
	const inflowTokensUnique = buildPeakValueKeys(tokenInflows)
	const inflowTokenSet = new Set(inflowTokensUnique)
	for (const token of rawTokensUnique) {
		if (!inflowTokenSet.has(token)) inflowTokensUnique.push(token)
	}

	let usdInflowsDataset: InflowsDataset | null = null
	if (usdInflows?.length) {
		const source: InflowsDataset['source'] = []
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
		for (let i = 0; i < queries.length; i++) {
			const query = queries[i]
			if (query.isError && query.error) {
				failed.push({ category, key: keys[i], error: query.error })
			}
		}
	}
	return failed
}

export function useProtocolBreakdownCharts({
	protocol,
	keys,
	includeBase = true,
	source = 'tvl',
	inflows = true,
	computeInflows = inflows,
	chainsUnique: knownChains,
	tokensToExclude,
	tokenPieMinimumValue = 1
}: IUseProtocolBreakdownChartsParams): IUseProtocolBreakdownChartsResult {
	const chainBreakdown = !knownChains || knownChains.length >= 2

	const {
		keysToFetch,
		tvlChartQueries,
		chainBreakdownChartQueries,
		tokenBreakdownUsdQueries,
		tokenBreakdownRawQueries
	} = useFetchProtocolChartsByKeys({
		protocol,
		keys,
		includeBase,
		source,
		inflows,
		chainBreakdown,
		tokensToExclude
	})

	const isNetworkLoading =
		tvlChartQueries.some((query) => query.isLoading) ||
		chainBreakdownChartQueries.some((query) => query.isLoading) ||
		tokenBreakdownUsdQueries.some((query) => query.isLoading) ||
		tokenBreakdownRawQueries.some((query) => query.isLoading)

	const computeSignature = [
		tvlChartQueries.map((query) => query.dataUpdatedAt).join('|'),
		chainBreakdownChartQueries.map((query) => query.dataUpdatedAt).join('|'),
		tokenBreakdownUsdQueries.map((query) => query.dataUpdatedAt).join('|'),
		tokenBreakdownRawQueries.map((query) => query.dataUpdatedAt).join('|'),
		protocol,
		source,
		includeBase ? '1' : '0',
		keys.join('|'),
		computeInflows ? 'inflows' : 'no-inflows',
		tokenPieMinimumValue
	].join('::')

	const latestComputeInputRef = React.useRef<{
		tvlCharts: Array<IProtocolValueChart | null | undefined>
		chainBreakdownCharts: Array<BreakdownChart | null | undefined>
		tokenBreakdownUsdCharts: Array<BreakdownChart | null | undefined>
		tokenBreakdownRawCharts: Array<BreakdownChart | null | undefined>
	}>({
		tvlCharts: [],
		chainBreakdownCharts: [],
		tokenBreakdownUsdCharts: [],
		tokenBreakdownRawCharts: []
	})
	latestComputeInputRef.current = {
		tvlCharts: tvlChartQueries.map((query) => query.data),
		chainBreakdownCharts: chainBreakdownChartQueries.map((query) => query.data),
		tokenBreakdownUsdCharts: tokenBreakdownUsdQueries.map((query) => query.data),
		tokenBreakdownRawCharts: tokenBreakdownRawQueries.map((query) => query.data)
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
