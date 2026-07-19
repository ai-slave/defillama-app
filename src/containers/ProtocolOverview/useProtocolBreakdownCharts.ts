import * as React from 'react'
import { createChartRecord, createChartRow } from '~/components/ECharts/dynamicRow'
import type { IMultiSeriesChart2Props, MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import { preparePieChartData } from '~/components/ECharts/utils'
import type { IProtocolTokenBreakdownChart, IProtocolValueChart } from './api.types'
import { useFetchProtocolChartsByKeys } from './queries.client'

type MultiSeriesCharts = NonNullable<IMultiSeriesChart2Props['charts']>
type MultiSeriesChart = MultiSeriesCharts[number]
type BreakdownPoint = [number, Record<string, number>]
type BreakdownChart = BreakdownPoint[]
type TokenInflowPoint = { timestamp: number } & Record<string, number>
type TokenBreakdownLatest = Record<string, number>
type InflowsDataset = {
	source: Array<{ timestamp: number; 'USD Inflows': number }>
	dimensions: ['timestamp', 'USD Inflows']
}
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
	chainsDataset: MultiSeriesChart2Dataset | null
	chainsCharts: MultiSeriesCharts
	valueDataset: MultiSeriesChart2Dataset | null
	valueCharts: MultiSeriesCharts
	tokenUSDDataset: MultiSeriesChart2Dataset | null
	tokenUSDCharts: MultiSeriesCharts
	tokenRawDataset: MultiSeriesChart2Dataset | null
	tokenRawCharts: MultiSeriesCharts
	tokenBreakdownUSD: BreakdownChart | null
	tokenBreakdownLatest: TokenBreakdownLatest
	tokenBreakdownPieChart: Array<{ name: string; value: number }>
	usdInflowsDataset: InflowsDataset | null
	tokenInflowsDataset: MultiSeriesChart2Dataset | null
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

	const summedByTimestamp = new Map<number, Record<string, number>>()
	const alignment = buildTimestampAlignment(charts)

	for (const [chartIndex, chart] of charts.entries()) {
		if (!chart?.length) continue
		for (const [timestamp, values] of chart) {
			const aligned = alignTimestamp(timestamp, chartIndex, alignment, MAX_BREAKDOWN_TIMESTAMP_ALIGNMENT_DIFF_MS)
			const current = summedByTimestamp.get(aligned) ?? createChartRecord<number>()
			for (const key in values) {
				current[key] = (current[key] ?? 0) + values[key]
			}
			summedByTimestamp.set(aligned, current)
		}
	}

	if (summedByTimestamp.size === 0) return null
	return Array.from(summedByTimestamp.entries()).sort((a, b) => a[0] - b[0])
}

const buildBreakdownKeys = (breakdown: BreakdownChart | null | undefined): string[] => {
	if (!breakdown?.length) return []

	const latestPoint = breakdown[breakdown.length - 1]?.[1] ?? {}
	const allKeys = new Set<string>()

	for (const [, values] of breakdown) {
		for (const key in values) allKeys.add(key)
	}

	return Array.from(allKeys).sort(
		(a, b) =>
			Math.abs(Object.hasOwn(latestPoint, b) ? latestPoint[b] : 0) -
			Math.abs(Object.hasOwn(latestPoint, a) ? latestPoint[a] : 0)
	)
}

const buildBreakdownSource = (breakdown: BreakdownChart | null | undefined) => {
	if (!breakdown?.length) return null

	const source = new Array<TokenInflowPoint>(breakdown.length)
	for (let i = 0; i < breakdown.length; i++) {
		const [timestamp, values] = breakdown[i]
		source[i] = { timestamp, ...values }
	}
	return source
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

const setChartRowValue = (row: Record<string, number>, name: string, value: number) => {
	if (name === '__proto__') {
		Object.defineProperty(row, name, { value, enumerable: true, configurable: true, writable: true })
	} else {
		row[name] = value
	}
}

const getOwnChartValue = (row: Record<string, number>, name: string) =>
	Object.hasOwn(row, name) ? row[name] : undefined

const projectBreakdownSource = (
	source: Array<{ timestamp: number } & Record<string, number>> | null,
	selection: BreakdownSeriesSelection,
	aggregateOthers: boolean
) => {
	if (!source || !selection.aggregatesOthers) return source

	const projected = new Array<TokenInflowPoint>(source.length)
	for (let i = 0; i < source.length; i++) {
		const point = source[i]
		const nextPoint = createChartRow<number>(point.timestamp)
		let others = 0
		let hasOthers = false

		for (const name in point) {
			if (name === 'timestamp' || !Object.hasOwn(point, name)) continue
			if (selection.selectedKeys.has(name)) {
				setChartRowValue(nextPoint, name, point[name])
			} else if (aggregateOthers) {
				others += point[name]
				hasOthers = true
			}
		}

		if (hasOthers) setChartRowValue(nextPoint, OTHERS_SERIES_NAME, others)
		projected[i] = nextPoint
	}

	return projected
}

const buildProjectedBreakdownSource = (
	breakdown: BreakdownChart | null | undefined,
	selection: BreakdownSeriesSelection,
	aggregateOthers: boolean
) => {
	if (!breakdown?.length) return null
	if (!selection.aggregatesOthers) return buildBreakdownSource(breakdown)

	const source = new Array<TokenInflowPoint>(breakdown.length)
	for (let i = 0; i < breakdown.length; i++) {
		const [timestamp, values] = breakdown[i]
		const point = createChartRow<number>(timestamp)
		let others = 0
		let hasOthers = false

		for (const name in values) {
			if (!Object.hasOwn(values, name)) continue
			if (selection.selectedKeys.has(name)) {
				setChartRowValue(point, name, values[name])
			} else if (aggregateOthers) {
				others += values[name]
				hasOthers = true
			}
		}

		if (hasOthers) setChartRowValue(point, OTHERS_SERIES_NAME, others)
		source[i] = point
	}
	return source
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

		const point = createChartRow<number>(timestamp)
		let hasTokenInflows = false
		let usdInflow = 0

		const addTokenInflow = (token: string) => {
			if (!tokensSet.has(token)) return

			const currentAmount = getOwnChartValue(currentRaw, token) ?? 0
			const previousAmount = getOwnChartValue(previousRaw, token) ?? 0
			const amountDiff = currentAmount - previousAmount
			if (amountDiff === 0) return

			let price: number | null = null
			const currentUsdValue = getOwnChartValue(currentUsd, token)
			const previousUsdValue = getOwnChartValue(previousUsd, token)
			if (currentAmount !== 0 && currentUsdValue != null) {
				price = currentUsdValue / currentAmount
			} else if (previousAmount !== 0 && previousUsdValue != null) {
				price = previousUsdValue / previousAmount
			}
			if (price == null) return

			const inflow = amountDiff * price

			setChartRowValue(point, token, inflow)
			usdInflow += inflow
			hasTokenInflows = true
		}

		for (const token in currentRaw) {
			if (Object.hasOwn(currentRaw, token)) addTokenInflow(token)
		}
		for (const token in previousRaw) {
			if (Object.hasOwn(previousRaw, token) && !Object.hasOwn(currentRaw, token)) addTokenInflow(token)
		}

		if (hasTokenInflows) {
			tokenInflows.push(point)
			usdInflows.push([timestamp, usdInflow])
		}
	}

	return tokenInflows.length > 0 ? { tokenInflows, usdInflows } : null
}

const EMPTY_MULTI_SERIES_CHARTS: MultiSeriesCharts = []
const EMPTY_TOKEN_BREAKDOWN_LATEST = createChartRecord<number>()
const EMPTY_PIE_CHART_DATA: Array<{ name: string; value: number }> = []

const buildChartsForKeys = (keys: string[], type: 'line' | 'bar', stack?: string): MultiSeriesCharts => {
	if (keys.length === 0) return EMPTY_MULTI_SERIES_CHARTS

	return keys.map(
		(name): MultiSeriesChart => ({
			type,
			name,
			encode: { x: 'timestamp', y: name },
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
	computeInflows = true
}: {
	tvlCharts: Array<IProtocolValueChart | null | undefined>
	chainBreakdownCharts: Array<BreakdownChart | null | undefined>
	tokenBreakdownUsdCharts: Array<BreakdownChart | null | undefined>
	tokenBreakdownRawCharts: Array<BreakdownChart | null | undefined>
	valueSeriesName: string
	inflows?: boolean
	computeInflows?: boolean
}): IUseProtocolBreakdownChartsComputed => {
	const tvlChart = aggregateValueCharts(tvlCharts)
	const chainBreakdownChart = aggregateBreakdownCharts(chainBreakdownCharts)

	const chainSelection = selectBreakdownSeries(buildBreakdownKeys(chainBreakdownChart))
	const chainsUnique = chainSelection.seriesNames
	const chainSource = buildProjectedBreakdownSource(chainBreakdownChart, chainSelection, true)

	const chainsDataset =
		chainSource && chainsUnique.length > 0
			? {
					source: chainSource,
					dimensions: ['timestamp', ...chainsUnique]
				}
			: null
	const chainsCharts = chainsDataset != null ? buildChartsForKeys(chainsUnique, 'line') : EMPTY_MULTI_SERIES_CHARTS

	let valueDataset: MultiSeriesChart2Dataset | null = null
	if (tvlChart && tvlChart.length > 1) {
		const source: MultiSeriesChart2Dataset['source'] = []
		for (const [timestamp, value] of tvlChart) {
			source.push({ timestamp, [valueSeriesName]: value })
		}
		valueDataset = { source, dimensions: ['timestamp', valueSeriesName] }
	}
	const valueCharts =
		valueDataset != null
			? [
					{
						type: 'line' as const,
						name: valueSeriesName,
						encode: { x: 'timestamp', y: valueSeriesName }
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
	const tokenBreakdown = aggregateBreakdownCharts(tokenBreakdownRawCharts)

	const tokenUsdKeys = buildBreakdownKeys(tokenBreakdownUSD)
	const tokenRawKeys = buildBreakdownKeys(tokenBreakdown)
	const allTokenKeys = tokenUsdKeys.length > 0 ? tokenUsdKeys : tokenRawKeys
	const tokenSeriesSelection = selectBreakdownSeries(allTokenKeys)
	const tokensUnique = tokenSeriesSelection.seriesNames
	const rawTokenSeries = tokenSeriesSelection.aggregatesOthers
		? Array.from(tokenSeriesSelection.selectedKeys)
		: tokensUnique
	const projectedTokenUsdSource = buildProjectedBreakdownSource(tokenBreakdownUSD, tokenSeriesSelection, true)
	// Raw quantities from different tokens cannot be meaningfully summed into an Others series.
	const projectedTokenRawSource = buildProjectedBreakdownSource(tokenBreakdown, tokenSeriesSelection, false)

	const tokenUSDDataset =
		projectedTokenUsdSource && projectedTokenUsdSource.length > 1
			? {
					source: projectedTokenUsdSource,
					dimensions: ['timestamp', ...tokensUnique]
				}
			: null
	const tokenUSDCharts = tokenUSDDataset != null ? buildChartsForKeys(tokensUnique, 'line') : EMPTY_MULTI_SERIES_CHARTS

	const tokenRawDataset =
		projectedTokenRawSource && projectedTokenRawSource.length > 1
			? {
					source: projectedTokenRawSource,
					dimensions: ['timestamp', ...rawTokenSeries]
				}
			: null
	const tokenRawCharts =
		tokenRawDataset != null ? buildChartsForKeys(rawTokenSeries, 'line') : EMPTY_MULTI_SERIES_CHARTS

	let tokenBreakdownLatest = EMPTY_TOKEN_BREAKDOWN_LATEST
	const tokenBreakdownPieSource = createChartRecord<number>()
	let hasTokenBreakdownPieSource = false
	if (tokenBreakdownUSD?.length) {
		const latestTokens = tokenBreakdownUSD[tokenBreakdownUSD.length - 1]?.[1] ?? {}
		const filteredLatestTokens = createChartRecord<number>()
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

	const inflowsResult = buildTokenInflowsFromBreakdowns(tokenBreakdownUSD, tokenBreakdown, allTokenKeys)
	const tokenInflows = inflowsResult?.tokenInflows ?? null
	const usdInflows = inflowsResult?.usdInflows ?? null
	const projectedTokenInflows = projectBreakdownSource(tokenInflows, tokenSeriesSelection, true)

	let usdInflowsDataset: InflowsDataset | null = null
	if (usdInflows?.length) {
		const source: InflowsDataset['source'] = []
		for (const [timestamp, value] of usdInflows) {
			source.push({ timestamp, 'USD Inflows': value })
		}
		usdInflowsDataset = { source, dimensions: ['timestamp', 'USD Inflows'] }
	}

	const tokenInflowsDataset = projectedTokenInflows?.length
		? {
				source: projectedTokenInflows,
				dimensions: ['timestamp', ...tokensUnique]
			}
		: null
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
