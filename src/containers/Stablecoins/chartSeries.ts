import { groupMultiSeriesBarChartDataset } from '~/components/ECharts/MultiSeriesChart/groupDataset'
import type {
	ChartTimeGroupingWithCumulative,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_COLORS } from '~/constants/colors'
import { getDominancePercent } from '~/utils'
import { getGroupedBarCharts } from './chartGrouping'
import type { IBuildStablecoinChartDataResult, IBuildStablecoinChartDataParams } from './utils'
import {
	buildStablecoinChartDataWithFlags,
	getStablecoinMcapStatsFromTotals,
	getStablecoinTopTokenFromChartData,
	getStablecoinValueFromPoint,
	getStablecoinDominance
} from './utils'

export const STABLECOIN_CHART_STALE_TIME = 5 * 60 * 1000
export const STABLECOIN_CHART_CACHE_CONTROL = 'public, max-age=300'
export const STABLECOIN_BREAKDOWN_SERIES_LIMIT = 10
export const STABLECOIN_OTHERS_SERIES_NAME = 'Others'

export type StablecoinOverviewChartType = 'totalMcap' | 'tokenMcaps' | 'dominance' | 'usdInflows' | 'tokenInflows'
export type StablecoinChainsChartType = 'totalMcap' | 'chainMcaps' | 'dominance'
export type StablecoinAssetChartType = 'totalCirc' | 'chainMcaps' | 'chainDominance'
export type StablecoinChartSeriesType =
	| StablecoinOverviewChartType
	| StablecoinChainsChartType
	| StablecoinAssetChartType

export type StablecoinChartSummary = {
	totalMcapCurrent: number | null
	change1d: string | null
	change7d: string | null
	change30d: string | null
	change1dUsd: number | null
	change7dUsd: number | null
	change30dUsd: number | null
	topToken: { symbol: string; mcap: number }
	dominance: string | number | null
	dataTimestamp: number | null
	isDataStale: boolean
}

export interface StablecoinChartSeriesPayload {
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesChartSeriesConfig[]
	availableSeries?: string[]
	defaultSeries?: string[]
	valueSymbol?: string
	stacked?: boolean
	showTotalInTooltip?: boolean
	expandTo100Percent?: boolean
	summary?: StablecoinChartSummary
}

export type StablecoinBreakdownSelectionOptions = {
	selectedNames?: string[] | null
	seriesLimit?: number
}

type StablecoinBreakdownSelection = {
	availableSeries: string[]
	defaultSeries: string[]
	explicitSeries: string[]
	omittedSeries: string[]
	visibleSeries: string[]
}

const resolveStablecoinBreakdownSelection = ({
	seriesNames,
	selectedNames,
	seriesLimit,
	getLatestValue
}: StablecoinBreakdownSelectionOptions & {
	seriesNames: string[]
	getLatestValue: (name: string) => number
}): StablecoinBreakdownSelection => {
	if (seriesLimit == null && selectedNames == null) {
		const visibleSeries: string[] = []
		const seen = new Set<string>()
		for (const name of seriesNames) {
			if (!name || seen.has(name)) continue
			seen.add(name)
			visibleSeries.push(name)
		}
		return {
			availableSeries: visibleSeries,
			defaultSeries: visibleSeries,
			explicitSeries: visibleSeries,
			omittedSeries: [],
			visibleSeries
		}
	}

	const uniqueNames: string[] = []
	const seen = new Set<string>()
	let hasReservedOthers = false
	for (const name of seriesNames) {
		if (!name || seen.has(name)) continue
		seen.add(name)
		if (name === STABLECOIN_OTHERS_SERIES_NAME) {
			hasReservedOthers = true
			continue
		}
		uniqueNames.push(name)
	}

	// Ranking once at the presentation boundary keeps the default chart bounded
	// without changing the chronological order of the underlying dataset.
	const originalOrder = new Map(uniqueNames.map((name, index) => [name, index]))
	const availableSeries = [...uniqueNames].sort((a, b) => {
		const valueDifference = getLatestValue(b) - getLatestValue(a)
		return valueDifference || (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0)
	})
	const selectionLimit = Math.min(availableSeries.length, Math.max(0, seriesLimit ?? availableSeries.length))
	const defaultSeries = availableSeries.slice(0, selectionLimit)

	let explicitSeries = defaultSeries
	if (selectedNames != null) {
		const availableSet = new Set(availableSeries)
		const selectedSet = new Set<string>()
		explicitSeries = []
		for (const name of selectedNames) {
			if (explicitSeries.length >= selectionLimit) break
			if (!availableSet.has(name) || selectedSet.has(name)) continue
			selectedSet.add(name)
			explicitSeries.push(name)
		}
	}

	const explicitSet = new Set(explicitSeries)
	const omittedSeries = availableSeries.filter((name) => !explicitSet.has(name))
	if (hasReservedOthers) omittedSeries.push(STABLECOIN_OTHERS_SERIES_NAME)
	const visibleSeries = omittedSeries.length > 0 ? [...explicitSeries, STABLECOIN_OTHERS_SERIES_NAME] : explicitSeries

	return { availableSeries, defaultSeries, explicitSeries, omittedSeries, visibleSeries }
}

const getStablecoinBreakdownSelection = (
	params: IBuildStablecoinChartDataParams,
	seriesNames: string[],
	options?: StablecoinBreakdownSelectionOptions & { includeUnreleased?: boolean },
	collectedLatestValues?: Record<string, number>
): StablecoinBreakdownSelection => {
	if (options?.seriesLimit == null && options?.selectedNames == null) {
		return resolveStablecoinBreakdownSelection({ seriesNames, getLatestValue: () => 0 })
	}
	if (collectedLatestValues && !options?.includeUnreleased) {
		return resolveStablecoinBreakdownSelection({
			seriesNames,
			selectedNames: options?.selectedNames,
			seriesLimit: options?.seriesLimit,
			getLatestValue: (name) => collectedLatestValues[name] ?? 0
		})
	}
	const latestValues = new Map<string, number>()
	const eligibleNames = new Set(seriesNames)
	for (let i = 0; i < params.assetsOrChainsList.length; i++) {
		const name = params.assetsOrChainsList[i]
		if (!eligibleNames.has(name)) continue
		const chart = params.chartDataByAssetOrChain[i]
		if (!chart?.length) continue
		for (let j = chart.length - 1; j >= 0; j--) {
			const value = getStablecoinValueFromPoint(chart[j], params.issuanceType ?? 'mcap')
			if (value == null) continue
			const unreleased = options?.includeUnreleased ? (getStablecoinValueFromPoint(chart[j], 'unreleased') ?? 0) : 0
			latestValues.set(name, value + unreleased)
			break
		}
	}

	return resolveStablecoinBreakdownSelection({
		seriesNames,
		selectedNames: options?.selectedNames,
		seriesLimit: options?.seriesLimit,
		getLatestValue: (name) => latestValues.get(name) ?? 0
	})
}

export type StablecoinBreakdownDatasetPresentation = {
	dataset: MultiSeriesChartDataset
	availableSeries: string[]
	defaultSeries: string[]
	visibleSeries: string[]
}

export const buildStablecoinBreakdownDatasetPresentation = ({
	dataset,
	seriesNames,
	selectedNames,
	seriesLimit = STABLECOIN_BREAKDOWN_SERIES_LIMIT
}: StablecoinBreakdownSelectionOptions & {
	dataset: MultiSeriesChartDataset
	seriesNames: string[]
}): StablecoinBreakdownDatasetPresentation => {
	const latestValues = new Map<string, number>()
	const seriesIndexes = seriesNames.map((name) => dataset.dimensions.indexOf(name))
	for (let i = dataset.source.length - 1; i >= 0 && latestValues.size < seriesNames.length; i--) {
		const row = dataset.source[i]
		for (let seriesIndex = 0; seriesIndex < seriesNames.length; seriesIndex++) {
			const name = seriesNames[seriesIndex]
			if (latestValues.has(name)) continue
			const value = row[seriesIndexes[seriesIndex]] as number | undefined
			if (value !== undefined) latestValues.set(name, value)
		}
	}
	const selection = resolveStablecoinBreakdownSelection({
		seriesNames,
		selectedNames,
		seriesLimit,
		getLatestValue: (name) => latestValues.get(name) ?? 0
	})

	const source: MultiSeriesChartDataset['source'] = []
	const explicitIndexes = selection.explicitSeries.map((name) => dataset.dimensions.indexOf(name))
	const omittedIndexes = selection.omittedSeries.map((name) => dataset.dimensions.indexOf(name))
	for (const inputRow of dataset.source) {
		const row = new Array<number | undefined>(selection.visibleSeries.length + 1)
		row[0] = inputRow[0] as number
		for (let i = 0; i < explicitIndexes.length; i++) {
			row[i + 1] = inputRow[explicitIndexes[i]] as number | undefined
		}
		if (selection.omittedSeries.length > 0) {
			let others = 0
			for (const index of omittedIndexes) others += (inputRow[index] as number | undefined) ?? 0
			row[row.length - 1] = others
		}
		source.push(row)
	}

	return {
		dataset: { source, dimensions: ['timestamp', ...selection.visibleSeries] },
		availableSeries: selection.availableSeries,
		defaultSeries: selection.defaultSeries,
		visibleSeries: selection.visibleSeries
	}
}

export const buildStablecoinBreakdownPayloadPresentation = ({
	payload,
	selectedNames,
	seriesLimit = STABLECOIN_BREAKDOWN_SERIES_LIMIT
}: StablecoinBreakdownSelectionOptions & { payload: StablecoinChartSeriesPayload }): StablecoinChartSeriesPayload => {
	const seriesNames = payload.availableSeries ?? payload.dataset.dimensions.slice(1)
	const presentation = buildStablecoinBreakdownDatasetPresentation({
		dataset: payload.dataset,
		seriesNames,
		selectedNames,
		seriesLimit
	})
	const chartByName = new Map(payload.charts.map((chart) => [chart.name, chart]))
	const fallbackChart = payload.charts[0]
	const charts: MultiSeriesChartSeriesConfig[] = []
	for (let i = 0; i < presentation.visibleSeries.length; i++) {
		const name = presentation.visibleSeries[i]
		const existingChart = chartByName.get(name)
		if (existingChart) {
			charts.push({ ...existingChart, encode: { x: 0, y: i + 1 } })
		} else if (fallbackChart) {
			charts.push({
				...fallbackChart,
				name,
				encode: { x: 0, y: i + 1 },
				color: TOKEN_COLORS[name] ?? CHART_COLORS[i % CHART_COLORS.length]
			})
		}
	}

	return {
		...payload,
		dataset: presentation.dataset,
		charts,
		availableSeries: presentation.availableSeries,
		defaultSeries: presentation.defaultSeries
	}
}

const TOKEN_COLORS: Record<string, string> = {
	USDT: '#009393',
	USDC: '#0B53BF',
	DAI: '#F4B731',
	USDe: '#3A3A3A',
	BUIDL: '#111111',
	USD1: '#D2B48C',
	USDS: '#E67E22',
	PYUSD: '#4A90E2',
	USDTB: '#C0C0C0',
	FDUSD: '#00FF00',
	Others: '#FF1493'
}

const TOTAL_MCAP_CHARTS: MultiSeriesChartSeriesConfig[] = [
	{ type: 'line', name: 'Mcap', encode: { x: 0, y: 1 }, color: CHART_COLORS[0] }
]

const TOTAL_CIRC_CHARTS: MultiSeriesChartSeriesConfig[] = [
	{ type: 'line', name: 'Circulating', encode: { x: 0, y: 1 }, color: CHART_COLORS[0] }
]

const USD_INFLOWS_CHARTS: MultiSeriesChartSeriesConfig[] = [
	{ type: 'bar', name: 'Inflows', encode: { x: 0, y: 1 }, color: CHART_COLORS[0] }
]

const getSeriesNames = (
	assetsOrChainsList: string[],
	filteredIndexes?: number[],
	doublecountedIds?: number[]
): string[] => {
	const names: string[] = []
	const doublecountedSet = doublecountedIds?.length ? new Set(doublecountedIds) : null
	if (!filteredIndexes) {
		for (let i = 0; i < assetsOrChainsList.length; i++) {
			if (doublecountedSet?.has(i)) continue
			const name = assetsOrChainsList[i]
			if (name) names.push(name)
		}
		return names
	}
	for (const index of filteredIndexes) {
		if (doublecountedSet?.has(index)) continue
		const name = assetsOrChainsList[index]
		if (name) names.push(name)
	}
	return names
}

export const getTopStablecoinFromLatestPoints = ({
	chartDataByAssetOrChain,
	assetsOrChainsList,
	filteredIndexes,
	issuanceType = 'mcap',
	doublecountedIds = []
}: Pick<
	IBuildStablecoinChartDataParams,
	'chartDataByAssetOrChain' | 'assetsOrChainsList' | 'filteredIndexes' | 'issuanceType' | 'doublecountedIds'
>): { symbol: string; mcap: number } => {
	const filteredIndexesSet = filteredIndexes ? new Set(filteredIndexes) : null
	const doublecountedSet = doublecountedIds.length ? new Set(doublecountedIds) : null
	let topSymbol = 'USDT'
	let topMcap = 0
	for (let i = 0; i < chartDataByAssetOrChain.length; i++) {
		if (filteredIndexesSet && !filteredIndexesSet.has(i)) continue
		if (doublecountedSet?.has(i)) continue
		const symbol = assetsOrChainsList[i]
		if (!symbol) continue
		const chart = chartDataByAssetOrChain[i]
		const latestPoint = chart?.[chart.length - 1]
		const mcap = getStablecoinValueFromPoint(latestPoint, issuanceType)
		if (mcap == null || mcap <= topMcap) continue
		topMcap = mcap
		topSymbol = symbol
	}
	return { symbol: topSymbol, mcap: topMcap }
}

export const getTopStablecoinFromCollectedValues = ({
	latestValues
}: Pick<IBuildStablecoinChartDataResult, 'latestValues'>): { symbol: string; mcap: number } => {
	let topSymbol = 'USDT'
	let topMcap = 0
	for (const symbol in latestValues) {
		const mcap = latestValues[symbol]
		if (mcap <= topMcap) continue
		topMcap = mcap
		topSymbol = symbol
	}
	return { symbol: topSymbol, mcap: topMcap }
}

export const buildStablecoinChartSummary = (
	peggedAreaTotalData: IBuildStablecoinChartDataResult['peggedAreaTotalData'],
	topToken: { symbol: string; mcap: number }
): StablecoinChartSummary => {
	const stats = getStablecoinMcapStatsFromTotals(peggedAreaTotalData)
	return {
		totalMcapCurrent: stats.totalMcapCurrent,
		change1d: stats.change1d,
		change7d: stats.change7d,
		change30d: stats.change30d,
		change1dUsd: stats.change1dUsd,
		change7dUsd: stats.change7dUsd,
		change30dUsd: stats.change30dUsd,
		topToken,
		dominance: getStablecoinDominance(topToken, stats.totalMcapCurrent),
		dataTimestamp: stats.dataTimestamp,
		isDataStale: stats.isDataStale
	}
}

const buildTotalMcapPayloadFromChartData = (
	chartData: IBuildStablecoinChartDataResult,
	totalName: string,
	summaryTopToken?: { symbol: string; mcap: number }
): StablecoinChartSeriesPayload => {
	const source: MultiSeriesChartDataset['source'] = []
	for (const point of chartData.peggedAreaTotalData) {
		const timestamp = Number(point.date) * 1e3
		const value = totalName === 'Mcap' ? point.Mcap : ((point[totalName] as number | undefined) ?? point.Mcap)
		source.push([timestamp, value ?? 0])
	}

	const charts = totalName === 'Circulating' ? TOTAL_CIRC_CHARTS : TOTAL_MCAP_CHARTS
	const payload: StablecoinChartSeriesPayload = {
		dataset: { source, dimensions: ['timestamp', totalName] },
		charts,
		valueSymbol: totalName === 'Circulating' ? '' : '$',
		stacked: false,
		showTotalInTooltip: false
	}
	if (summaryTopToken) {
		payload.summary = buildStablecoinChartSummary(chartData.peggedAreaTotalData, summaryTopToken)
	}
	return payload
}

export const buildTotalMcapPayload = (
	params: IBuildStablecoinChartDataParams,
	options?: { totalName?: string; summaryTopToken?: { symbol: string; mcap: number }; includeUnreleased?: boolean }
): StablecoinChartSeriesPayload => {
	const totalName = options?.totalName ?? 'Mcap'
	if (options?.includeUnreleased) {
		const { stackedDataset } = buildStablecoinChartDataWithFlags(params, { stacked: true })
		const source: MultiSeriesChartDataset['source'] = []
		for (const [date, values] of stackedDataset) {
			const timestamp = Number(date) * 1e3
			let total = 0
			for (const name in values) {
				const value = values[name]
				total += (value.circulating ?? 0) + (value.unreleased ?? 0)
			}
			source.push([timestamp, total])
		}
		return {
			dataset: { source, dimensions: ['timestamp', totalName] },
			charts: totalName === 'Circulating' ? TOTAL_CIRC_CHARTS : TOTAL_MCAP_CHARTS,
			valueSymbol: totalName === 'Circulating' ? '' : '$',
			stacked: false,
			showTotalInTooltip: false
		}
	}

	const chartData = buildStablecoinChartDataWithFlags({ ...params, totalChartTooltipLabel: totalName }, { total: true })
	return buildTotalMcapPayloadFromChartData(chartData, totalName, options?.summaryTopToken)
}

type StablecoinAreaPayloadOptions = {
	chartNames?: string[]
	fillMissingValues?: boolean
	stackName: string
	stacked?: boolean
	valueSymbol?: string
	summary?: boolean
} & StablecoinBreakdownSelectionOptions

const buildAreaPayloadFromChartData = (
	params: IBuildStablecoinChartDataParams,
	chartData: IBuildStablecoinChartDataResult,
	options: StablecoinAreaPayloadOptions
): StablecoinChartSeriesPayload => {
	const { peggedAreaChartData, peggedAreaTotalData } = chartData
	const allChartNames =
		options.chartNames ?? getSeriesNames(params.assetsOrChainsList, params.filteredIndexes, params.doublecountedIds)
	const selection = getStablecoinBreakdownSelection(params, allChartNames, options, chartData.latestValues)
	const chartNames = selection.visibleSeries
	const stacked = options.stacked ?? false
	const source: MultiSeriesChartDataset['source'] = []
	const hasAlignedTotals = peggedAreaTotalData.length === peggedAreaChartData.length
	for (let pointIndex = 0; pointIndex < peggedAreaChartData.length; pointIndex++) {
		const point = peggedAreaChartData[pointIndex]
		const timestamp = Number(point.date) * 1e3
		const row = new Array<number | undefined>(chartNames.length + 1)
		row[0] = timestamp
		let explicitTotal = 0
		for (let i = 0; i < selection.explicitSeries.length; i++) {
			const name = selection.explicitSeries[i]
			const value = point[name] as number | undefined
			if (value != null || options.fillMissingValues) {
				const resolvedValue = value ?? 0
				row[i + 1] = resolvedValue
				explicitTotal += resolvedValue
			}
		}
		if (selection.omittedSeries.length > 0) {
			let others = hasAlignedTotals ? (peggedAreaTotalData[pointIndex]?.Mcap ?? 0) - explicitTotal : 0
			if (!hasAlignedTotals) {
				for (const name of selection.omittedSeries) others += (point[name] as number | undefined) ?? 0
			}
			row[row.length - 1] = others
		}
		source.push(row)
	}
	const charts = chartNames.map((name, i) => ({
		type: 'line' as const,
		name,
		encode: { x: 0, y: i + 1 },
		color: TOKEN_COLORS[name] ?? CHART_COLORS[i % CHART_COLORS.length],
		...(stacked ? { stack: options.stackName } : {})
	}))

	const payload: StablecoinChartSeriesPayload = {
		dataset: { source, dimensions: ['timestamp', ...chartNames] },
		charts,
		availableSeries: selection.availableSeries,
		defaultSeries: selection.defaultSeries,
		stacked,
		valueSymbol: options.valueSymbol ?? '$',
		showTotalInTooltip: stacked
	}

	if (options.summary) {
		const topToken = getStablecoinTopTokenFromChartData(peggedAreaChartData)
		payload.summary = buildStablecoinChartSummary(peggedAreaTotalData, topToken)
	}

	return payload
}

export const buildAreaPayload = (
	params: IBuildStablecoinChartDataParams,
	options: StablecoinAreaPayloadOptions
): StablecoinChartSeriesPayload => {
	return buildAreaPayloadFromChartData(
		params,
		buildStablecoinChartDataWithFlags(params, { area: true, total: options.summary }),
		options
	)
}

type StablecoinDominancePayloadOptions = {
	chartNames?: string[]
	includeUnreleased?: boolean
	normalizeTo100?: boolean
	stackName?: string
} & StablecoinBreakdownSelectionOptions

const buildDominancePayloadFromChartData = (
	params: IBuildStablecoinChartDataParams,
	chartData: IBuildStablecoinChartDataResult,
	options?: StablecoinDominancePayloadOptions
): StablecoinChartSeriesPayload => {
	const { stackedDataset } = chartData
	const allChartNames =
		options?.chartNames ?? getSeriesNames(params.assetsOrChainsList, params.filteredIndexes, params.doublecountedIds)
	const selection = getStablecoinBreakdownSelection(params, allChartNames, options, chartData.latestValues)
	const chartNames = selection.visibleSeries
	const source: MultiSeriesChartDataset['source'] = []

	if (!options?.includeUnreleased) {
		const hasAlignedTotals = chartData.peggedAreaTotalData.length === chartData.peggedAreaChartData.length
		for (let pointIndex = 0; pointIndex < chartData.peggedAreaChartData.length; pointIndex++) {
			const point = chartData.peggedAreaChartData[pointIndex]
			const dayValues = new Array<number>(chartNames.length).fill(0)
			let explicitTotal = 0
			for (let i = 0; i < selection.explicitSeries.length; i++) {
				const name = selection.explicitSeries[i]
				const value = (point[name] as number | undefined) ?? 0
				dayValues[i] = value
				explicitTotal += value
			}
			let total = explicitTotal
			if (selection.omittedSeries.length > 0) {
				let others = hasAlignedTotals ? (chartData.peggedAreaTotalData[pointIndex]?.Mcap ?? 0) - explicitTotal : 0
				if (!hasAlignedTotals) {
					for (const name of selection.omittedSeries) others += (point[name] as number | undefined) ?? 0
				}
				dayValues[dayValues.length - 1] = others
				total += others
			}

			const row = new Array<number>(chartNames.length + 1)
			row[0] = Number(point.date) * 1e3
			if (options?.normalizeTo100) {
				const percentages = new Array<number>(chartNames.length)
				let roundedTotal = 0
				for (let i = 0; i < chartNames.length; i++) {
					const percentage = getDominancePercent(dayValues[i], total)
					percentages[i] = percentage
					roundedTotal += percentage
				}
				let normalizedTotal = 0
				for (let i = 0; i < chartNames.length; i++) {
					const percentage =
						roundedTotal === 0
							? 0
							: i === chartNames.length - 1
								? 100 - normalizedTotal
								: (percentages[i] / roundedTotal) * 100
					row[i + 1] = percentage
					normalizedTotal += percentage
				}
			} else {
				for (let i = 0; i < chartNames.length; i++) {
					row[i + 1] = getDominancePercent(dayValues[i], total)
				}
			}
			source.push(row)
		}
	} else {
		for (const [date, values] of stackedDataset) {
			const dayValues = new Array<number>(chartNames.length).fill(0)
			let total = 0
			for (let i = 0; i < selection.explicitSeries.length; i++) {
				const name = selection.explicitSeries[i]
				const chainCirculating = values[name]
				const value = (chainCirculating?.circulating ?? 0) + (chainCirculating?.unreleased ?? 0)
				dayValues[i] = value
				total += value
			}
			if (selection.omittedSeries.length > 0) {
				let others = 0
				for (const name of selection.omittedSeries) {
					const seriesValue = values[name]
					others += (seriesValue?.circulating ?? 0) + (seriesValue?.unreleased ?? 0)
				}
				dayValues[dayValues.length - 1] = others
				total += others
			}

			const row = new Array<number>(chartNames.length + 1)
			row[0] = Number(date) * 1e3
			for (let i = 0; i < chartNames.length; i++) {
				row[i + 1] = getDominancePercent(dayValues[i], total)
			}
			source.push(row)
		}
	}

	return {
		dataset: { source, dimensions: ['timestamp', ...chartNames] },
		charts: chartNames.map((name, i) => ({
			type: 'line',
			name,
			encode: { x: 0, y: i + 1 },
			color: TOKEN_COLORS[name] ?? CHART_COLORS[i % CHART_COLORS.length],
			stack: options?.stackName ?? 'dominance'
		})),
		availableSeries: selection.availableSeries,
		defaultSeries: selection.defaultSeries,
		stacked: true,
		expandTo100Percent: true,
		valueSymbol: '%',
		showTotalInTooltip: false
	}
}

export const buildDominancePayload = (
	params: IBuildStablecoinChartDataParams,
	options?: StablecoinDominancePayloadOptions
): StablecoinChartSeriesPayload => {
	return buildDominancePayloadFromChartData(
		params,
		buildStablecoinChartDataWithFlags(params, options?.includeUnreleased ? { stacked: true } : { area: true }),
		options
	)
}

const buildUsdInflowsPayloadFromChartData = (
	chartData: IBuildStablecoinChartDataResult
): StablecoinChartSeriesPayload => {
	const { usdInflows } = chartData
	const source: MultiSeriesChartDataset['source'] = []
	for (const [date, value] of usdInflows) {
		const timestamp = Number(date) * 1e3
		source.push([timestamp, value])
	}
	return {
		dataset: { source, dimensions: ['timestamp', 'Inflows'] },
		charts: USD_INFLOWS_CHARTS,
		stacked: false,
		showTotalInTooltip: false
	}
}

export const buildUsdInflowsPayload = (params: IBuildStablecoinChartDataParams): StablecoinChartSeriesPayload => {
	return buildUsdInflowsPayloadFromChartData(buildStablecoinChartDataWithFlags(params, { usdInflows: true }))
}

const buildTokenInflowsPayloadFromChartData = (
	params: IBuildStablecoinChartDataParams,
	chartData: IBuildStablecoinChartDataResult,
	options?: StablecoinBreakdownSelectionOptions
): StablecoinChartSeriesPayload => {
	const { tokenInflows, tokenInflowNames, usdInflows } = chartData
	const selection = getStablecoinBreakdownSelection(params, tokenInflowNames, options, chartData.latestValues)
	const chartNames = selection.visibleSeries
	const source: MultiSeriesChartDataset['source'] = []
	const hasAlignedUsdInflows = usdInflows.length === tokenInflows.length
	for (let pointIndex = 0; pointIndex < tokenInflows.length; pointIndex++) {
		const point = tokenInflows[pointIndex]
		const timestamp = Number(point.date) * 1e3
		const row = new Array<number | undefined>(chartNames.length + 1)
		row[0] = timestamp
		let explicitTotal = 0
		for (let i = 0; i < selection.explicitSeries.length; i++) {
			const name = selection.explicitSeries[i]
			const value = point[name] as number | undefined
			if (value != null) {
				row[i + 1] = value
				explicitTotal += value
			}
		}
		if (selection.omittedSeries.length > 0) {
			let others = hasAlignedUsdInflows ? (usdInflows[pointIndex]?.[1] ?? 0) - explicitTotal : 0
			if (!hasAlignedUsdInflows) {
				for (const name of selection.omittedSeries) others += (point[name] as number | undefined) ?? 0
			}
			row[row.length - 1] = others
		}
		source.push(row)
	}
	return {
		dataset: { source, dimensions: ['timestamp', ...chartNames] },
		charts: chartNames.map((name, i) => ({
			type: 'bar',
			name,
			encode: { x: 0, y: i + 1 },
			color: TOKEN_COLORS[name] ?? CHART_COLORS[i % CHART_COLORS.length],
			stack: 'tokenInflows',
			large: false
		})),
		availableSeries: selection.availableSeries,
		defaultSeries: selection.defaultSeries,
		stacked: true,
		showTotalInTooltip: true
	}
}

export const buildTokenInflowsPayload = (
	params: IBuildStablecoinChartDataParams,
	options?: StablecoinBreakdownSelectionOptions
): StablecoinChartSeriesPayload => {
	return buildTokenInflowsPayloadFromChartData(
		params,
		buildStablecoinChartDataWithFlags(params, { tokenInflows: true }),
		options
	)
}

export const buildStablecoinOverviewChartData = (
	params: IBuildStablecoinChartDataParams,
	chart: StablecoinOverviewChartType
): IBuildStablecoinChartDataResult => {
	if (chart === 'totalMcap') return buildStablecoinChartDataWithFlags(params, { total: true })
	if (chart === 'tokenMcaps' || chart === 'dominance') {
		return buildStablecoinChartDataWithFlags(params, { area: true, total: true })
	}
	if (chart === 'usdInflows') return buildStablecoinChartDataWithFlags(params, { usdInflows: true, total: true })
	return buildStablecoinChartDataWithFlags(params, { tokenInflows: true, usdInflows: true, total: true })
}

export const buildStablecoinOverviewPayloadFromChartData = (
	params: IBuildStablecoinChartDataParams,
	chart: StablecoinOverviewChartType,
	topToken: { symbol: string; mcap: number },
	chartData: IBuildStablecoinChartDataResult,
	selectionOptions?: StablecoinBreakdownSelectionOptions
): StablecoinChartSeriesPayload => {
	if (chart === 'totalMcap') {
		return buildTotalMcapPayloadFromChartData(chartData, 'Mcap', topToken)
	}
	const summary = buildStablecoinChartSummary(chartData.peggedAreaTotalData, topToken)

	if (chart === 'tokenMcaps') {
		return {
			...buildAreaPayloadFromChartData(params, chartData, {
				stackName: 'tokenMcaps',
				...selectionOptions
			}),
			summary
		}
	}
	if (chart === 'dominance') {
		return {
			...buildDominancePayloadFromChartData(params, chartData, {
				stackName: 'dominance',
				...selectionOptions
			}),
			summary
		}
	}
	if (chart === 'usdInflows') {
		return { ...buildUsdInflowsPayloadFromChartData(chartData), summary }
	}
	return { ...buildTokenInflowsPayloadFromChartData(params, chartData, selectionOptions), summary }
}

export const buildStablecoinOverviewPayload = (
	params: IBuildStablecoinChartDataParams,
	chart: StablecoinOverviewChartType,
	topToken: { symbol: string; mcap: number },
	selectionOptions?: StablecoinBreakdownSelectionOptions
): StablecoinChartSeriesPayload => {
	return buildStablecoinOverviewPayloadFromChartData(
		params,
		chart,
		topToken,
		buildStablecoinOverviewChartData(params, chart),
		selectionOptions
	)
}

export const groupStablecoinBarChartPayload = (
	payload: StablecoinChartSeriesPayload,
	groupBy: ChartTimeGroupingWithCumulative
): StablecoinChartSeriesPayload => {
	if (groupBy === 'daily') return payload

	return {
		...payload,
		dataset: groupMultiSeriesBarChartDataset({ dataset: payload.dataset, groupBy }),
		charts: getGroupedBarCharts(payload.charts, groupBy)
	}
}
