import * as React from 'react'
import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { preparePieChartData } from '~/components/ECharts/PieChart/data'
import type { IProtocolTokenBreakdownChart, IProtocolValueChart } from './api.types'
import { useFetchProtocolChartsByKeys } from './queries.client'

type MultiSeriesCharts = NonNullable<IMultiSeriesChartProps['charts']>
type MultiSeriesChart = MultiSeriesCharts[number]
type BreakdownPoint = [number, Record<string, number>]
type BreakdownChart = BreakdownPoint[]
type TokenInflowPoint = [number, Map<string, number>]
type TokenBreakdownLatest = Record<string, number>
type InflowsDataset = TimestampDataset
type BuiltTokenInflows = {
	tokenInflows: TokenInflowPoint[]
	usdInflows: Array<[number, number]>
}
/** Maximum allowed difference (in milliseconds) between chart latest timestamps for alignment. */
const MAX_BREAKDOWN_TIMESTAMP_ALIGNMENT_DIFF_MS = 24 * 60 * 60 * 1e3

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
	chainsDataset: TimestampDataset | null
	chainsCharts: MultiSeriesCharts
	valueDataset: TimestampDataset | null
	valueCharts: MultiSeriesCharts
	tokenUSDDataset: TimestampDataset | null
	tokenUSDCharts: MultiSeriesCharts
	tokenRawDataset: TimestampDataset | null
	tokenRawCharts: MultiSeriesCharts
	tokenBreakdownUSD: BreakdownChart | null
	tokenBreakdownLatest: TokenBreakdownLatest
	tokenBreakdownPieChart: Array<{ name: string; value: number }>
	usdInflowsDataset: InflowsDataset | null
	tokenInflowsDataset: TimestampDataset | null
	tokenInflowsCharts: MultiSeriesCharts
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

	return Array.from(allKeys).sort((a, b) => Math.abs(latestPoint[b] ?? 0) - Math.abs(latestPoint[a] ?? 0))
}

export const MAX_PROTOCOL_BREAKDOWN_SERIES = 30
const OTHERS_SERIES_NAME = 'Others'

type BreakdownSeriesSelection = {
	seriesNames: string[]
	selectedKeys: Set<string>
	aggregatesOthers: boolean
}

const selectBreakdownSeries = (keys: string[]): BreakdownSeriesSelection => {
	if (keys.length <= MAX_PROTOCOL_BREAKDOWN_SERIES) {
		return { seriesNames: keys, selectedKeys: new Set(keys), aggregatesOthers: false }
	}

	const selectedKeys: string[] = []
	for (const key of keys) {
		if (key !== OTHERS_SERIES_NAME) selectedKeys.push(key)
		if (selectedKeys.length === MAX_PROTOCOL_BREAKDOWN_SERIES - 1) break
	}

	return {
		seriesNames: [...selectedKeys, OTHERS_SERIES_NAME],
		selectedKeys: new Set(selectedKeys),
		aggregatesOthers: true
	}
}

const RAW_TOKEN_SIZE_FILTER_THRESHOLD = 100_000_000
const RAW_TOKEN_USD_FILTER_THRESHOLD = 1_000_000

const filterRawBreakdownChartByUsd = (
	rawBreakdown: BreakdownChart | null | undefined,
	usdBreakdown: BreakdownChart | null | undefined
): BreakdownChart | null => {
	if (!rawBreakdown?.length) return null

	const usdByTimestamp = new Map<number, Record<string, number>>()
	for (const [timestamp, values] of usdBreakdown ?? []) usdByTimestamp.set(timestamp, values)
	const hasUsdHistory = usdByTimestamp.size > 0

	const filtered = new Array<BreakdownPoint>(rawBreakdown.length)
	for (let i = 0; i < rawBreakdown.length; i++) {
		const [timestamp, rawValues] = rawBreakdown[i]
		const usdValues = usdByTimestamp.get(timestamp)
		const values = {}
		for (const token in rawValues) {
			const rawValue = rawValues[token]
			if (token.startsWith('UNKNOWN') || rawValue < 1) continue

			// Match V1: raw-only sections remain usable, but once a USD history exists,
			// every raw row and token must have a matching USD value.
			if (hasUsdHistory) {
				if (!usdValues) continue
				const usdValue = usdValues[token]
				if (usdValue == null) continue
				if (rawValue > RAW_TOKEN_SIZE_FILTER_THRESHOLD && usdValue < RAW_TOKEN_USD_FILTER_THRESHOLD) continue
			}
			values[token] = rawValue
		}
		filtered[i] = [timestamp, values]
	}
	return filtered
}

const filterRawBreakdownChartsByUsd = (
	rawBreakdowns: Array<BreakdownChart | null | undefined>,
	usdBreakdowns: Array<BreakdownChart | null | undefined>
): Array<BreakdownChart | null> => {
	const filtered = new Array<BreakdownChart | null>(rawBreakdowns.length)
	for (let i = 0; i < rawBreakdowns.length; i++) {
		filtered[i] = filterRawBreakdownChartByUsd(rawBreakdowns[i], usdBreakdowns[i])
	}
	return filtered
}

const buildProjectedBreakdownDataset = (
	breakdown: BreakdownChart | null | undefined,
	seriesNames: string[],
	aggregateOthers: boolean
): TimestampDataset | null => {
	if (!breakdown?.length) return null
	const outputIndexByName = new Map<string, number>()
	for (let i = 0; i < seriesNames.length; i++) outputIndexByName.set(seriesNames[i], i + 1)
	const othersIndex = outputIndexByName.get(OTHERS_SERIES_NAME)
	const source = new Array<TimestampDataset['source'][number]>(breakdown.length)
	for (let i = 0; i < breakdown.length; i++) {
		const [timestamp, values] = breakdown[i]
		const point = new Array<number | undefined>(seriesNames.length + 1)
		point[0] = timestamp
		let others = 0
		let hasOthers = false

		for (const name in values) {
			const outputIndex = outputIndexByName.get(name)
			if (outputIndex != null && outputIndex !== othersIndex) {
				point[outputIndex] = values[name]
			} else if (aggregateOthers && othersIndex != null) {
				others += values[name]
				hasOthers = true
			}
		}

		if (hasOthers && othersIndex != null) point[othersIndex] = others
		source[i] = point
	}
	return { source, dimensions: ['timestamp', ...seriesNames] }
}

const buildProjectedTokenInflowsDataset = (
	points: TokenInflowPoint[] | null,
	seriesNames: string[],
	aggregateOthers: boolean
): TimestampDataset | null => {
	if (!points?.length) return null
	const outputIndexByName = new Map<string, number>()
	for (let i = 0; i < seriesNames.length; i++) outputIndexByName.set(seriesNames[i], i + 1)
	const othersIndex = outputIndexByName.get(OTHERS_SERIES_NAME)
	const source = new Array<TimestampDataset['source'][number]>(points.length)
	for (let i = 0; i < points.length; i++) {
		const [timestamp, values] = points[i]
		const row = new Array<number | undefined>(seriesNames.length + 1)
		row[0] = timestamp
		let others = 0
		for (const [name, value] of values) {
			const outputIndex = outputIndexByName.get(name)
			if (outputIndex != null && outputIndex !== othersIndex) row[outputIndex] = value
			else if (aggregateOthers && othersIndex != null) others += value
		}
		if (othersIndex != null) row[othersIndex] = others
		source[i] = row
	}
	return { source, dimensions: ['timestamp', ...seriesNames] }
}

const buildTokenInflowsFromBreakdowns = (
	tokenBreakdownUSD: IProtocolTokenBreakdownChart | null | undefined,
	tokenBreakdownRaw: IProtocolTokenBreakdownChart | null | undefined,
	tokensUnique: string[]
): BuiltTokenInflows | null => {
	if (!tokenBreakdownUSD?.length || !tokenBreakdownRaw?.length || tokensUnique.length === 0) return null

	const usdByTimestamp = new Map<number, Record<string, number>>()
	for (const [timestamp, tokens] of tokenBreakdownUSD) {
		usdByTimestamp.set(timestamp, tokens)
	}

	if (tokenBreakdownRaw.length < 2) return null

	const tokensSet = new Set(tokensUnique)
	const tokenInflows: TokenInflowPoint[] = []
	const usdInflows: Array<[number, number]> = []

	for (let i = 1; i < tokenBreakdownRaw.length; i++) {
		const [timestamp, currentRaw] = tokenBreakdownRaw[i]
		const [previousTimestamp, previousRaw] = tokenBreakdownRaw[i - 1]
		const currentUsd = usdByTimestamp.get(timestamp) ?? {}
		const previousUsd = usdByTimestamp.get(previousTimestamp) ?? {}

		const point = new Map<string, number>()
		let hasTokenInflows = false
		let usdInflow = 0

		const addTokenInflow = (token: string) => {
			if (!tokensSet.has(token)) return

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

			point.set(token, inflow)
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
	tokenBreakdownRawCharts: Array<BreakdownChart | null | undefined>,
	tokensUnique: string[]
): BuiltTokenInflows | null => {
	const pairCount = Math.max(tokenBreakdownUsdCharts.length, tokenBreakdownRawCharts.length)
	if (pairCount <= 1) {
		return buildTokenInflowsFromBreakdowns(tokenBreakdownUsdCharts[0], tokenBreakdownRawCharts[0], tokensUnique)
	}

	const tokenInflowsByTimestamp = new Map<number, Map<string, number>>()
	const usdInflowsByTimestamp = new Map<number, number>()
	for (let i = 0; i < pairCount; i++) {
		const result = buildTokenInflowsFromBreakdowns(tokenBreakdownUsdCharts[i], tokenBreakdownRawCharts[i], tokensUnique)
		if (!result) continue

		for (const [timestamp, point] of result.tokenInflows) {
			const values = tokenInflowsByTimestamp.get(timestamp) ?? new Map<string, number>()
			for (const [token, value] of point) {
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
	const tokenInflows = new Array<TokenInflowPoint>(timestamps.length)
	const usdInflows = new Array<[number, number]>(timestamps.length)
	for (let i = 0; i < timestamps.length; i++) {
		const timestamp = timestamps[i]
		tokenInflows[i] = [timestamp, tokenInflowsByTimestamp.get(timestamp)!]
		usdInflows[i] = [timestamp, usdInflowsByTimestamp.get(timestamp) ?? 0]
	}
	return { tokenInflows, usdInflows }
}

const EMPTY_MULTI_SERIES_CHARTS: MultiSeriesCharts = []
const EMPTY_TOKEN_BREAKDOWN_LATEST = {}
const EMPTY_PIE_CHART_DATA: Array<{ name: string; value: number }> = []

const buildChartsForKeys = (keys: string[], type: 'line' | 'bar', stack?: string): MultiSeriesCharts => {
	if (keys.length === 0) return EMPTY_MULTI_SERIES_CHARTS

	return keys.map(
		(name, index): MultiSeriesChart => ({
			type,
			name,
			encode: { x: 0, y: index + 1 },
			...(stack ? { stack } : {})
		})
	)
}

const EMPTY_COMPUTED_RESULT: IUseProtocolBreakdownChartsComputed = {
	chainsUnique: [],
	tokensUnique: [],
	rawTokensUnique: [],
	chainsDataset: null,
	chainsCharts: EMPTY_MULTI_SERIES_CHARTS,
	valueDataset: null,
	valueCharts: EMPTY_MULTI_SERIES_CHARTS,
	tokenUSDDataset: null,
	tokenUSDCharts: EMPTY_MULTI_SERIES_CHARTS,
	tokenRawDataset: null,
	tokenRawCharts: EMPTY_MULTI_SERIES_CHARTS,
	tokenBreakdownUSD: null,
	tokenBreakdownLatest: EMPTY_TOKEN_BREAKDOWN_LATEST,
	tokenBreakdownPieChart: EMPTY_PIE_CHART_DATA,
	usdInflowsDataset: null,
	tokenInflowsDataset: null,
	tokenInflowsCharts: EMPTY_MULTI_SERIES_CHARTS
}

export const buildComputedBreakdownResult = ({
	tvlCharts,
	chainBreakdownCharts,
	tokenBreakdownUsdCharts,
	tokenBreakdownRawCharts,
	valueSeriesName,
	inflows = true,
	computeInflows = true,
	buildTokenUSDDataset = true,
	buildTokenRawDataset = true,
	buildTokenPieChart = true
}: {
	tvlCharts: Array<IProtocolValueChart | null | undefined>
	chainBreakdownCharts: Array<BreakdownChart | null | undefined>
	tokenBreakdownUsdCharts: Array<BreakdownChart | null | undefined>
	tokenBreakdownRawCharts: Array<BreakdownChart | null | undefined>
	valueSeriesName: string
	inflows?: boolean
	computeInflows?: boolean
	buildTokenUSDDataset?: boolean
	buildTokenRawDataset?: boolean
	buildTokenPieChart?: boolean
}): IUseProtocolBreakdownChartsComputed => {
	const tvlChart = aggregateValueCharts(tvlCharts)
	const chainBreakdownChart = aggregateBreakdownCharts(chainBreakdownCharts)

	const chainSelection = selectBreakdownSeries(buildBreakdownKeys(chainBreakdownChart))
	const chainsUnique = chainSelection.seriesNames
	const chainsDataset =
		chainsUnique.length > 0
			? buildProjectedBreakdownDataset(chainBreakdownChart, chainsUnique, chainSelection.aggregatesOthers)
			: null
	const chainsCharts = chainsDataset != null ? buildChartsForKeys(chainsUnique, 'line') : EMPTY_MULTI_SERIES_CHARTS

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
			chainsDataset,
			chainsCharts,
			valueDataset,
			valueCharts,
			tokenUSDDataset: null,
			tokenUSDCharts: EMPTY_MULTI_SERIES_CHARTS,
			tokenRawDataset: null,
			tokenRawCharts: EMPTY_MULTI_SERIES_CHARTS,
			tokenBreakdownUSD: null,
			tokenBreakdownLatest: EMPTY_TOKEN_BREAKDOWN_LATEST,
			tokenBreakdownPieChart: EMPTY_PIE_CHART_DATA,
			usdInflowsDataset: null,
			tokenInflowsDataset: null,
			tokenInflowsCharts: EMPTY_MULTI_SERIES_CHARTS
		}
	}

	const tokenBreakdownUSD = aggregateBreakdownCharts(tokenBreakdownUsdCharts)
	const tokenBreakdown = aggregateBreakdownCharts(
		buildTokenRawDataset
			? filterRawBreakdownChartsByUsd(tokenBreakdownRawCharts, tokenBreakdownUsdCharts)
			: tokenBreakdownRawCharts
	)

	const tokenUsdKeys = buildBreakdownKeys(tokenBreakdownUSD)
	const tokenRawKeys = buildBreakdownKeys(tokenBreakdown)
	const allTokenKeys = tokenUsdKeys.length > 0 ? tokenUsdKeys : tokenRawKeys
	const tokenSeriesSelection = selectBreakdownSeries(allTokenKeys)
	const tokensUnique = tokenSeriesSelection.seriesNames
	const rawTokenCandidates = tokenSeriesSelection.aggregatesOthers
		? Array.from(tokenSeriesSelection.selectedKeys)
		: tokensUnique
	const rawTokenKeys = new Set(tokenRawKeys)
	const rawTokenSeries: string[] = []
	for (const token of rawTokenCandidates) {
		if (rawTokenKeys.has(token)) rawTokenSeries.push(token)
	}
	const projectedTokenUsdDataset = buildTokenUSDDataset
		? buildProjectedBreakdownDataset(tokenBreakdownUSD, tokensUnique, tokenSeriesSelection.aggregatesOthers)
		: null
	// Raw quantities from different tokens cannot be meaningfully summed into an Others series.
	const projectedTokenRawDataset = buildTokenRawDataset
		? buildProjectedBreakdownDataset(tokenBreakdown, rawTokenSeries, false)
		: null

	const tokenUSDDataset =
		projectedTokenUsdDataset && projectedTokenUsdDataset.source.length > 1 ? projectedTokenUsdDataset : null
	const tokenUSDCharts = tokenUSDDataset != null ? buildChartsForKeys(tokensUnique, 'line') : EMPTY_MULTI_SERIES_CHARTS

	const tokenRawDataset =
		projectedTokenRawDataset && projectedTokenRawDataset.source.length > 1 ? projectedTokenRawDataset : null
	const tokenRawCharts =
		tokenRawDataset != null ? buildChartsForKeys(rawTokenSeries, 'line') : EMPTY_MULTI_SERIES_CHARTS

	let tokenBreakdownLatest = EMPTY_TOKEN_BREAKDOWN_LATEST
	const tokenBreakdownPieSource = {}
	let hasTokenBreakdownPieSource = false
	if (buildTokenPieChart && tokenBreakdownUSD?.length) {
		const latestTokens = tokenBreakdownUSD[tokenBreakdownUSD.length - 1]?.[1] ?? {}
		const filteredLatestTokens = {}
		for (const name in latestTokens) {
			const value = latestTokens[name]
			if (name.startsWith('UNKNOWN') || !value || value <= 0) continue
			filteredLatestTokens[name] = value
			if (value >= 1) {
				tokenBreakdownPieSource[name] = value
				hasTokenBreakdownPieSource = true
			}
		}
		tokenBreakdownLatest = filteredLatestTokens
	}

	const tokenBreakdownPieChart =
		tokenBreakdownUSD?.length && hasTokenBreakdownPieSource
			? preparePieChartData({ data: tokenBreakdownPieSource, limit: 15 })
			: EMPTY_PIE_CHART_DATA

	if (!computeInflows) {
		return {
			chainsUnique,
			tokensUnique,
			rawTokensUnique: rawTokenSeries,
			chainsDataset,
			chainsCharts,
			valueDataset,
			valueCharts,
			tokenUSDDataset,
			tokenUSDCharts,
			tokenRawDataset,
			tokenRawCharts,
			tokenBreakdownUSD,
			tokenBreakdownLatest,
			tokenBreakdownPieChart,
			usdInflowsDataset: null,
			tokenInflowsDataset: null,
			tokenInflowsCharts: EMPTY_MULTI_SERIES_CHARTS
		}
	}

	const inflowsResult = buildTokenInflowsFromChartPairs(tokenBreakdownUsdCharts, tokenBreakdownRawCharts, allTokenKeys)
	const tokenInflows = inflowsResult?.tokenInflows ?? null
	const usdInflows = inflowsResult?.usdInflows ?? null
	const tokenInflowsDataset = buildProjectedTokenInflowsDataset(
		tokenInflows,
		tokensUnique,
		tokenSeriesSelection.aggregatesOthers
	)

	let usdInflowsDataset: InflowsDataset | null = null
	if (usdInflows?.length) {
		const source: InflowsDataset['source'] = []
		for (const [timestamp, value] of usdInflows) {
			source.push([timestamp, value])
		}
		usdInflowsDataset = { source, dimensions: ['timestamp', 'USD Inflows'] }
	}

	const tokenInflowsCharts =
		tokenInflowsDataset != null ? buildChartsForKeys(tokensUnique, 'bar', 'tokenInflows') : EMPTY_MULTI_SERIES_CHARTS

	return {
		chainsUnique,
		tokensUnique,
		rawTokensUnique: rawTokenSeries,
		chainsDataset,
		chainsCharts,
		valueDataset,
		valueCharts,
		tokenUSDDataset,
		tokenUSDCharts,
		tokenRawDataset,
		tokenRawCharts,
		tokenBreakdownUSD,
		tokenBreakdownLatest,
		tokenBreakdownPieChart,
		usdInflowsDataset,
		tokenInflowsDataset,
		tokenInflowsCharts
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
	tokensToExclude
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
		computeInflows ? 'inflows' : 'no-inflows'
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
				computeInflows
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
	}, [isNetworkLoading, computeSignature, source, inflows, computeInflows])

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
