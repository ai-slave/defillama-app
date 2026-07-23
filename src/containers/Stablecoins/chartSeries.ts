import { groupMultiSeriesBarChartDataset } from '~/components/ECharts/MultiSeriesChart/groupDataset'
import type {
	ChartTimeGroupingWithCumulative,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_COLORS } from '~/constants/colors'
import { getDominancePercent } from '~/utils'
import { getGroupedBarCharts } from './chartGrouping'
import type { IBuildStablecoinChartDataParams, StablecoinMcapPoint } from './utils'
import {
	getStablecoinMcapStatsFromTotals,
	getStablecoinValueFromPoint,
	getStablecoinDominance,
	isStablecoinChartDateVisible
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

export interface StablecoinRuntimeSeries {
	selectableSeries: string[]
	renderedSelectableSeries: string[]
	fixedRemainderSeries: string[]
	alwaysVisibleSeries: string[]
}

export function getStablecoinRuntimeSeries(payload: StablecoinChartSeriesPayload): StablecoinRuntimeSeries {
	const configuredSeries = payload.charts.map((chart) => chart.name)
	const fixedRemainderSeries = configuredSeries.filter((name) => name === STABLECOIN_OTHERS_SERIES_NAME)
	if (!payload.availableSeries) {
		return {
			selectableSeries: configuredSeries.filter((name) => name !== STABLECOIN_OTHERS_SERIES_NAME),
			renderedSelectableSeries: configuredSeries.filter((name) => name !== STABLECOIN_OTHERS_SERIES_NAME),
			fixedRemainderSeries,
			alwaysVisibleSeries: []
		}
	}

	const availableSet = new Set(payload.availableSeries)
	return {
		selectableSeries: payload.availableSeries.filter((name) => name !== STABLECOIN_OTHERS_SERIES_NAME),
		renderedSelectableSeries: configuredSeries.filter(
			(name) => name !== STABLECOIN_OTHERS_SERIES_NAME && availableSet.has(name)
		),
		fixedRemainderSeries,
		alwaysVisibleSeries: configuredSeries.filter(
			(name) => name !== STABLECOIN_OTHERS_SERIES_NAME && !availableSet.has(name)
		)
	}
}

export type StablecoinBreakdownSelectionOptions = {
	selectedNames?: string[] | null
	excludedNames?: string[] | null
	seriesLimit?: number
}

export type StablecoinSeriesSelectionIntent =
	| { mode: 'include'; names: string[] }
	| { mode: 'exclude'; names: string[] }
	| null

type StablecoinBreakdownSelection = {
	availableSeries: string[]
	defaultSeries: string[]
	explicitSeries: string[]
	omittedSeries: string[]
	visibleSeries: string[]
	includesAllSeries: boolean
	excludedSeries: string[]
}

const resolveStablecoinBreakdownSelection = ({
	seriesNames,
	selectedNames,
	excludedNames,
	seriesLimit,
	getLatestValue
}: StablecoinBreakdownSelectionOptions & {
	seriesNames: string[]
	getLatestValue: (name: string) => number
}): StablecoinBreakdownSelection => {
	const hasExclusions = excludedNames != null && excludedNames.length > 0
	if (seriesLimit == null && selectedNames == null && !hasExclusions) {
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
			visibleSeries,
			includesAllSeries: true,
			excludedSeries: []
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
	let omittedSeries = availableSeries.slice(selectionLimit)
	let excludedSeries: string[] = []
	if (hasExclusions) {
		const excludedSet = new Set(excludedNames)
		excludedSeries = availableSeries.filter((name) => excludedSet.has(name))
		const includedSeries = availableSeries.filter((name) => !excludedSet.has(name))
		explicitSeries = includedSeries.slice(0, selectionLimit)
		omittedSeries = includedSeries.length > selectionLimit ? [STABLECOIN_OTHERS_SERIES_NAME] : []
	} else if (selectedNames != null) {
		const selectedSet = new Set(selectedNames)
		const validSelectedSeries = availableSeries.filter((name) => selectedSet.has(name))
		explicitSeries = validSelectedSeries.slice(0, selectionLimit)
		omittedSeries = validSelectedSeries.slice(selectionLimit)
	}

	if (selectedNames == null && !hasExclusions && hasReservedOthers) {
		omittedSeries.push(STABLECOIN_OTHERS_SERIES_NAME)
	}
	const visibleSeries = omittedSeries.length > 0 ? [...explicitSeries, STABLECOIN_OTHERS_SERIES_NAME] : explicitSeries

	return {
		availableSeries,
		defaultSeries,
		explicitSeries,
		omittedSeries,
		visibleSeries,
		includesAllSeries: selectedNames == null && !hasExclusions,
		excludedSeries
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
	Others: '#AAAAAA'
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

export type StablecoinCanonicalSeries = {
	name: string
	latestValue: number
	latestVisibleTimestamp: number | null
	latestVisibleValue: number
	offset: number
	length: number
	carryAfterTimestamp: number | null
	carryValue: number
}

export type StablecoinCanonicalHistory = {
	timestamps: number[]
	totals: number[]
	series: StablecoinCanonicalSeries[]
	seriesTimestamps: Float64Array
	seriesValues: Float64Array
	totalPoints: StablecoinMcapPoint[]
	topToken: { symbol: string; mcap: number }
}

type StablecoinTailCarry = { timestamp: number; value: number }

const applyStablecoinTailCarry = (
	timestamps: number[],
	totalByTimestamp: Map<number, number>,
	carryPoints: StablecoinTailCarry[]
): void => {
	for (const carry of carryPoints) {
		let low = 0
		let high = timestamps.length
		while (low < high) {
			const middle = (low + high) >>> 1
			if (timestamps[middle] <= carry.timestamp) low = middle + 1
			else high = middle
		}
		for (let index = low; index < timestamps.length; index++) {
			const timestamp = timestamps[index]
			totalByTimestamp.set(timestamp, (totalByTimestamp.get(timestamp) ?? 0) + carry.value)
		}
	}
}

const getEligibleStablecoinIndexes = ({
	chartDataByAssetOrChain,
	filteredIndexes,
	doublecountedIds = []
}: IBuildStablecoinChartDataParams): number[] => {
	const included = filteredIndexes ? new Set(filteredIndexes) : null
	const excluded = doublecountedIds.length ? new Set(doublecountedIds) : null
	const indexes: number[] = []
	for (let index = 0; index < chartDataByAssetOrChain.length; index++) {
		if (included && !included.has(index)) continue
		if (excluded?.has(index)) continue
		indexes.push(index)
	}
	return indexes
}

export const collectCanonicalStablecoinArea = (
	params: IBuildStablecoinChartDataParams,
	options: {
		totalName?: string
		includeSummary?: boolean
		includeUnreleased?: boolean
		seriesMode?: 'none' | 'latest' | 'history'
	} = {}
): StablecoinCanonicalHistory => {
	if (params.selectedChain === null) {
		return {
			timestamps: [],
			totals: [],
			series: [],
			seriesTimestamps: new Float64Array(),
			seriesValues: new Float64Array(),
			totalPoints: [],
			topToken: { symbol: 'USDT', mcap: 0 }
		}
	}

	const issuanceType = params.issuanceType ?? 'mcap'
	const totalName = options.totalName ?? 'Mcap'
	const totalByTimestamp = new Map<number, number>()
	const realTimestamps = options.includeSummary ? new Set<number>() : null
	const seriesMode = options.seriesMode ?? 'none'
	let topToken = { symbol: 'USDT', mcap: 0 }
	const seriesByName = new Map<string, StablecoinCanonicalSeries>()
	const carryPoints: StablecoinTailCarry[] = []
	const eligibleIndexes = getEligibleStablecoinIndexes(params)
	let seriesCapacity = 0
	if (seriesMode !== 'none') {
		if (seriesMode === 'history') {
			for (const index of eligibleIndexes) seriesCapacity += params.chartDataByAssetOrChain[index]?.length ?? 0
		}
		for (const name of getSeriesNames(params.assetsOrChainsList, params.filteredIndexes, params.doublecountedIds)) {
			if (!seriesByName.has(name)) {
				seriesByName.set(name, {
					name,
					latestValue: 0,
					latestVisibleTimestamp: null,
					latestVisibleValue: 0,
					offset: 0,
					length: 0,
					carryAfterTimestamp: null,
					carryValue: 0
				})
			}
		}
	}
	const seriesTimestamps = new Float64Array(seriesCapacity)
	const seriesValues = new Float64Array(seriesCapacity)
	let writeIndex = 0

	for (const index of eligibleIndexes) {
		const inputChart = params.chartDataByAssetOrChain[index]
		const name = params.assetsOrChainsList[index]
		if (!inputChart?.length || !name) continue
		const canonicalSeries = seriesByName.get(name)
		if (canonicalSeries && seriesMode === 'history') canonicalSeries.offset = writeIndex
		let latestTimestamp: number | null = null
		let latestValue = 0
		for (const point of inputChart) {
			const circulating = getStablecoinValueFromPoint(point, issuanceType)
			if (circulating == null) continue
			const value = options.includeUnreleased
				? circulating + (getStablecoinValueFromPoint(point, 'unreleased') ?? 0)
				: circulating
			if (canonicalSeries) canonicalSeries.latestValue = value
			latestTimestamp = Number(point.date) * 1e3
			latestValue = value
			if (!isStablecoinChartDateVisible(params.selectedChain, point.date)) continue
			const timestamp = latestTimestamp
			if (canonicalSeries) {
				canonicalSeries.latestVisibleTimestamp = timestamp
				canonicalSeries.latestVisibleValue = value
			}
			totalByTimestamp.set(timestamp, (totalByTimestamp.get(timestamp) ?? 0) + value)
			if (point.isSynthetic !== true) realTimestamps?.add(timestamp)
			if (canonicalSeries && seriesMode === 'history') {
				const priorIndex = writeIndex - 1
				if (canonicalSeries.length > 0 && seriesTimestamps[priorIndex] === timestamp) seriesValues[priorIndex] = value
				else {
					seriesTimestamps[writeIndex] = timestamp
					seriesValues[writeIndex] = value
					writeIndex++
					canonicalSeries.length++
				}
			}
		}
		if (params.carryForwardAfterSeriesEnd && latestTimestamp != null) {
			carryPoints.push({ timestamp: latestTimestamp, value: latestValue })
			if (canonicalSeries) {
				canonicalSeries.carryAfterTimestamp = latestTimestamp
				canonicalSeries.carryValue = latestValue
			}
		}
		if (canonicalSeries && canonicalSeries.latestValue > topToken.mcap) {
			topToken = { symbol: name, mcap: canonicalSeries.latestValue }
		}
	}

	// Each API series is ascending, but independently timed series interleave in the shared map.
	const timestamps = Array.from(totalByTimestamp.keys()).sort((a, b) => a - b)
	if (params.carryForwardAfterSeriesEnd) applyStablecoinTailCarry(timestamps, totalByTimestamp, carryPoints)
	const latestTimelineTimestamp = timestamps[timestamps.length - 1]
	if (latestTimelineTimestamp != null) {
		for (const series of seriesByName.values()) {
			if (series.carryAfterTimestamp != null && series.carryAfterTimestamp < latestTimelineTimestamp) {
				series.latestVisibleTimestamp = latestTimelineTimestamp
				series.latestVisibleValue = series.carryValue
			}
		}
	}
	const totals = new Array<number>(timestamps.length)
	const totalPoints: StablecoinMcapPoint[] = []
	for (let index = 0; index < timestamps.length; index++) {
		const timestamp = timestamps[index]
		const total = totalByTimestamp.get(timestamp) ?? 0
		totals[index] = total
		if (options.includeSummary) {
			totalPoints.push({
				date: String(timestamp / 1e3),
				Mcap: total,
				[totalName]: total,
				...(!realTimestamps?.has(timestamp) ? { isSynthetic: true } : {})
			})
		}
	}

	return {
		timestamps,
		totals,
		series: Array.from(seriesByName.values()),
		seriesTimestamps,
		seriesValues,
		totalPoints,
		topToken
	}
}

const collectCanonicalStablecoinInflowHistory = (
	params: IBuildStablecoinChartDataParams,
	includeSummary: boolean
): StablecoinCanonicalHistory => {
	if (params.selectedChain === null) {
		return {
			timestamps: [],
			totals: [],
			series: [],
			seriesTimestamps: new Float64Array(),
			seriesValues: new Float64Array(),
			totalPoints: [],
			topToken: { symbol: 'USDT', mcap: 0 }
		}
	}
	const totalInflowsByTimestamp = new Map<number, number>()
	const totalByTimestamp = new Map<number, number>()
	const realTimestamps = includeSummary ? new Set<number>() : null
	const series: StablecoinCanonicalSeries[] = []
	const carryPoints: StablecoinTailCarry[] = []
	let topToken = { symbol: 'USDT', mcap: 0 }
	const eligibleIndexes = getEligibleStablecoinIndexes(params)
	let seriesCapacity = 0
	for (const index of eligibleIndexes) seriesCapacity += params.chartDataByAssetOrChain[index]?.length ?? 0
	const seriesTimestamps = new Float64Array(seriesCapacity)
	const seriesValues = new Float64Array(seriesCapacity)
	let writeIndex = 0

	for (const index of eligibleIndexes) {
		const inputChart = params.chartDataByAssetOrChain[index]
		const name = params.assetsOrChainsList[index]
		if (!inputChart?.length || !name) continue
		let previousValue: number | null = null
		let hasInflows = false
		let priorAdjustedTimestamp = Number.NEGATIVE_INFINITY
		let priorContribution = 0
		let latestValue = 0
		let latestTimestamp: number | null = null
		let latestVisibleTimestamp: number | null = null
		let latestVisibleValue = 0
		const offset = writeIndex
		let length = 0
		for (const point of inputChart) {
			const value = getStablecoinValueFromPoint(point, params.issuanceType ?? 'mcap')
			const priorValue = previousValue
			previousValue = value
			if (value == null) continue
			latestValue = value
			latestTimestamp = Number(point.date) * 1e3
			if (!isStablecoinChartDateVisible(params.selectedChain, point.date)) continue
			const timestamp = latestTimestamp
			latestVisibleTimestamp = timestamp
			latestVisibleValue = value
			if (includeSummary) {
				totalByTimestamp.set(timestamp, (totalByTimestamp.get(timestamp) ?? 0) + value)
				if (point.isSynthetic !== true) realTimestamps?.add(timestamp)
			}
			const difference = value - (priorValue ?? 0)
			if (hasInflows) {
				const adjustedTimestamp = timestamp - 86_400_000
				const previousContribution = priorAdjustedTimestamp === adjustedTimestamp ? priorContribution : 0
				priorAdjustedTimestamp = adjustedTimestamp
				priorContribution = difference
				totalInflowsByTimestamp.set(
					adjustedTimestamp,
					(totalInflowsByTimestamp.get(adjustedTimestamp) ?? 0) + difference - previousContribution
				)
				const priorIndex = writeIndex - 1
				if (length > 0 && seriesTimestamps[priorIndex] === adjustedTimestamp) seriesValues[priorIndex] = difference
				else {
					seriesTimestamps[writeIndex] = adjustedTimestamp
					seriesValues[writeIndex] = difference
					writeIndex++
					length++
				}
			}
			if (difference) hasInflows = true
		}
		if (latestValue > topToken.mcap) topToken = { symbol: name, mcap: latestValue }
		if (params.carryForwardAfterSeriesEnd && latestTimestamp != null) {
			carryPoints.push({ timestamp: latestTimestamp, value: latestValue })
		}
		if (length) {
			series.push({
				name,
				latestValue,
				latestVisibleTimestamp,
				latestVisibleValue,
				offset,
				length,
				carryAfterTimestamp: null,
				carryValue: 0
			})
		}
	}

	// Each API series is ascending, but independently timed series interleave in the shared map.
	const timestamps = Array.from(totalInflowsByTimestamp.keys()).sort((a, b) => a - b)
	const totals = timestamps.map((timestamp) => totalInflowsByTimestamp.get(timestamp) ?? 0)
	const totalTimestamps = includeSummary ? Array.from(totalByTimestamp.keys()).sort((a, b) => a - b) : []
	if (includeSummary && params.carryForwardAfterSeriesEnd) {
		applyStablecoinTailCarry(totalTimestamps, totalByTimestamp, carryPoints)
	}
	const totalPoints = totalTimestamps.map((timestamp) => ({
		date: String(timestamp / 1e3),
		Mcap: totalByTimestamp.get(timestamp) ?? 0,
		...(!realTimestamps?.has(timestamp) ? { isSynthetic: true } : {})
	}))
	return { timestamps, totals, series, seriesTimestamps, seriesValues, totalPoints, topToken }
}

const buildStablecoinBreakdownDatasetFromCollection = ({
	collection,
	selection,
	fillMissingValues = false
}: {
	collection: StablecoinCanonicalHistory
	selection: StablecoinBreakdownSelection
	fillMissingValues?: boolean
}): MultiSeriesChartDataset => {
	const dimensions = ['timestamp', ...selection.visibleSeries]
	const source: Array<Array<number | undefined>> = collection.timestamps.map((timestamp) => {
		const row = new Array<number | undefined>(dimensions.length)
		row[0] = timestamp
		return row
	})
	const seriesByName = new Map(collection.series.map((series) => [series.name, series]))
	for (let seriesIndex = 0; seriesIndex < selection.explicitSeries.length; seriesIndex++) {
		const series = seriesByName.get(selection.explicitSeries[seriesIndex])
		if (!series) continue
		let pointIndex = 0
		for (let rowIndex = 0; rowIndex < collection.timestamps.length && pointIndex < series.length; rowIndex++) {
			const timestamp = collection.timestamps[rowIndex]
			while (pointIndex < series.length && collection.seriesTimestamps[series.offset + pointIndex] < timestamp) {
				pointIndex++
			}
			if (pointIndex < series.length && collection.seriesTimestamps[series.offset + pointIndex] === timestamp) {
				source[rowIndex][seriesIndex + 1] = collection.seriesValues[series.offset + pointIndex]
			}
		}
		if (series.carryAfterTimestamp != null) {
			for (let rowIndex = 0; rowIndex < collection.timestamps.length; rowIndex++) {
				if (collection.timestamps[rowIndex] > series.carryAfterTimestamp) {
					source[rowIndex][seriesIndex + 1] = series.carryValue
				}
			}
		}
	}
	const othersIndex = selection.omittedSeries.length ? dimensions.length - 1 : -1
	const accumulateSeries = (names: readonly string[]): Float64Array | null => {
		if (names.length === 0) return null
		const totals = new Float64Array(source.length)
		for (const name of names) {
			const series = seriesByName.get(name)
			if (!series) continue
			let pointIndex = 0
			for (let rowIndex = 0; rowIndex < collection.timestamps.length && pointIndex < series.length; rowIndex++) {
				const timestamp = collection.timestamps[rowIndex]
				while (pointIndex < series.length && collection.seriesTimestamps[series.offset + pointIndex] < timestamp)
					pointIndex++
				if (pointIndex < series.length && collection.seriesTimestamps[series.offset + pointIndex] === timestamp) {
					totals[rowIndex] += collection.seriesValues[series.offset + pointIndex]
				}
			}
			if (series.carryAfterTimestamp != null) {
				for (let rowIndex = 0; rowIndex < collection.timestamps.length; rowIndex++) {
					if (collection.timestamps[rowIndex] > series.carryAfterTimestamp) totals[rowIndex] += series.carryValue
				}
			}
		}
		return totals
	}
	const omittedTotals =
		!selection.includesAllSeries && selection.excludedSeries.length === 0
			? accumulateSeries(selection.omittedSeries)
			: null
	const excludedTotals = accumulateSeries(selection.excludedSeries)
	for (let rowIndex = 0; rowIndex < source.length; rowIndex++) {
		const row = source[rowIndex]
		if (othersIndex >= 0) {
			let explicitTotal = 0
			for (let index = 1; index < othersIndex; index++) explicitTotal += row[index] ?? 0
			row[othersIndex] = omittedTotals
				? omittedTotals[rowIndex]
				: collection.totals[rowIndex] - explicitTotal - (excludedTotals?.[rowIndex] ?? 0)
		}
		if (fillMissingValues) {
			for (let index = 1; index < row.length; index++) row[index] ??= 0
		}
	}
	return { dimensions, source }
}

const getStablecoinSelectionFromCollection = (
	collection: StablecoinCanonicalHistory,
	options?: StablecoinBreakdownSelectionOptions,
	seriesNames: string[] = collection.series.map((series) => series.name)
) => {
	const latestValues = new Map(collection.series.map((series) => [series.name, series.latestValue]))
	return resolveStablecoinBreakdownSelection({
		seriesNames,
		selectedNames: options?.selectedNames,
		excludedNames: options?.excludedNames,
		seriesLimit: options?.seriesLimit,
		getLatestValue: (name) => latestValues.get(name) ?? 0
	})
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

export const buildStablecoinChartSummary = (
	peggedAreaTotalData: StablecoinMcapPoint[],
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

export const buildStablecoinMcapSummary = (params: IBuildStablecoinChartDataParams) => {
	const collected = collectCanonicalStablecoinArea(params, { includeSummary: true, seriesMode: 'latest' })
	const latestTimestamp = collected.timestamps[collected.timestamps.length - 1]
	let topToken = { symbol: 'USDT', mcap: 0 }
	for (const series of collected.series) {
		if (series.latestVisibleTimestamp !== latestTimestamp || series.latestVisibleValue <= topToken.mcap) continue
		topToken = { symbol: series.name, mcap: series.latestVisibleValue }
	}
	return {
		mcapStats: getStablecoinMcapStatsFromTotals(collected.totalPoints),
		topToken
	}
}

export const buildTotalMcapPayload = (
	params: IBuildStablecoinChartDataParams,
	options?: { totalName?: string; summaryTopToken?: { symbol: string; mcap: number }; includeUnreleased?: boolean }
): StablecoinChartSeriesPayload => {
	const totalName = options?.totalName ?? 'Mcap'
	const collected = collectCanonicalStablecoinArea(params, {
		totalName,
		includeSummary: options?.summaryTopToken != null,
		includeUnreleased: options?.includeUnreleased
	})
	const payload: StablecoinChartSeriesPayload = {
		dataset: {
			dimensions: ['timestamp', totalName],
			source: collected.timestamps.map((timestamp, index) => [timestamp, collected.totals[index]])
		},
		charts: totalName === 'Circulating' ? TOTAL_CIRC_CHARTS : TOTAL_MCAP_CHARTS,
		valueSymbol: totalName === 'Circulating' ? '' : '$',
		stacked: false,
		showTotalInTooltip: false
	}
	if (options?.summaryTopToken) {
		payload.summary = buildStablecoinChartSummary(collected.totalPoints, options.summaryTopToken)
	}
	return payload
}

type StablecoinAreaPayloadOptions = {
	chartNames?: string[]
	fillMissingValues?: boolean
	stackName: string
	stacked?: boolean
	valueSymbol?: string
	summary?: boolean
	summaryTopToken?: { symbol: string; mcap: number }
} & StablecoinBreakdownSelectionOptions

export const buildAreaPayloadFromCollection = (
	collected: StablecoinCanonicalHistory,
	options: StablecoinAreaPayloadOptions
): StablecoinChartSeriesPayload => {
	const selection = getStablecoinSelectionFromCollection(collected, options, options.chartNames)
	const canonicalColorIndex = new Map(selection.availableSeries.map((name, index) => [name, index]))
	const stacked = options.stacked ?? false
	const payload: StablecoinChartSeriesPayload = {
		dataset: buildStablecoinBreakdownDatasetFromCollection({
			collection: collected,
			selection,
			fillMissingValues: options.fillMissingValues
		}),
		charts: selection.visibleSeries.map((name, index) => ({
			type: 'line',
			name,
			encode: { x: 0, y: index + 1 },
			color: TOKEN_COLORS[name] ?? CHART_COLORS[(canonicalColorIndex.get(name) ?? index) % CHART_COLORS.length],
			...(stacked ? { stack: options.stackName } : {})
		})),
		availableSeries: selection.availableSeries,
		defaultSeries: selection.defaultSeries,
		stacked,
		valueSymbol: options.valueSymbol ?? '$',
		showTotalInTooltip: stacked
	}
	if (options.summary || options.summaryTopToken) {
		payload.summary = buildStablecoinChartSummary(collected.totalPoints, options.summaryTopToken ?? collected.topToken)
	}
	return payload
}

export const buildAreaPayload = (
	params: IBuildStablecoinChartDataParams,
	options: StablecoinAreaPayloadOptions
): StablecoinChartSeriesPayload => {
	const collected = collectCanonicalStablecoinArea(params, {
		includeSummary: Boolean(options.summary || options.summaryTopToken),
		seriesMode: 'history'
	})
	return buildAreaPayloadFromCollection(collected, options)
}

type StablecoinDominancePayloadOptions = {
	chartNames?: string[]
	includeUnreleased?: boolean
	stackName?: string
	summaryTopToken?: { symbol: string; mcap: number }
} & StablecoinBreakdownSelectionOptions

export const buildDominancePayloadFromCollection = (
	collected: StablecoinCanonicalHistory,
	options?: StablecoinDominancePayloadOptions
): StablecoinChartSeriesPayload => {
	const selection = getStablecoinSelectionFromCollection(collected, options, options?.chartNames)
	const canonicalColorIndex = new Map(selection.availableSeries.map((name, index) => [name, index]))
	const baseDataset = buildStablecoinBreakdownDatasetFromCollection({ collection: collected, selection })
	const source: MultiSeriesChartDataset['source'] = []
	for (const inputRow of baseDataset.source) {
		const row = new Array<number>(inputRow.length)
		row[0] = inputRow[0] as number
		let total = 0
		for (let index = 1; index < inputRow.length; index++) total += (inputRow[index] as number | undefined) ?? 0
		let lastPositiveIndex = -1
		for (let index = 1; index < inputRow.length; index++) {
			const percentage = getDominancePercent((inputRow[index] as number | undefined) ?? 0, total)
			row[index] = percentage
			if (percentage > 0) lastPositiveIndex = index
		}
		if (lastPositiveIndex !== -1) {
			let otherSeriesTotal = 0
			for (let index = 1; index < inputRow.length; index++) {
				if (index !== lastPositiveIndex) otherSeriesTotal += row[index]
			}
			row[lastPositiveIndex] = 100 - otherSeriesTotal
		}
		source.push(row)
	}
	const payload: StablecoinChartSeriesPayload = {
		dataset: { dimensions: baseDataset.dimensions, source },
		charts: selection.visibleSeries.map((name, index) => ({
			type: 'line',
			name,
			encode: { x: 0, y: index + 1 },
			color: TOKEN_COLORS[name] ?? CHART_COLORS[(canonicalColorIndex.get(name) ?? index) % CHART_COLORS.length],
			stack: options?.stackName ?? 'dominance'
		})),
		availableSeries: selection.availableSeries,
		defaultSeries: selection.defaultSeries,
		stacked: true,
		expandTo100Percent: true,
		valueSymbol: '%',
		showTotalInTooltip: false
	}
	if (options?.summaryTopToken) {
		payload.summary = buildStablecoinChartSummary(collected.totalPoints, options.summaryTopToken)
	}
	return payload
}

export const buildDominancePayload = (
	params: IBuildStablecoinChartDataParams,
	options?: StablecoinDominancePayloadOptions
): StablecoinChartSeriesPayload => {
	const collected = collectCanonicalStablecoinArea(params, {
		includeSummary: options?.summaryTopToken != null,
		includeUnreleased: options?.includeUnreleased,
		seriesMode: 'history'
	})
	return buildDominancePayloadFromCollection(collected, options)
}

const buildUsdInflowsPayloadFromCollection = (
	collected: StablecoinCanonicalHistory,
	options?: { summaryTopToken?: { symbol: string; mcap: number }; seriesName?: string }
): StablecoinChartSeriesPayload => {
	const seriesName = options?.seriesName ?? 'Inflows'
	const useFallback = collected.timestamps.length === 0 || collected.totals.every((value) => value === 0)
	const payload: StablecoinChartSeriesPayload = {
		dataset: {
			dimensions: ['timestamp', seriesName],
			source: useFallback
				? [[1652486400 * 1e3, 0]]
				: collected.timestamps.map((timestamp, index) => [timestamp, collected.totals[index]])
		},
		charts:
			seriesName === 'Inflows'
				? USD_INFLOWS_CHARTS
				: [{ ...USD_INFLOWS_CHARTS[0], name: seriesName, encode: { x: 0, y: 1 } }],
		stacked: false,
		showTotalInTooltip: false
	}
	if (options?.summaryTopToken) {
		payload.summary = buildStablecoinChartSummary(collected.totalPoints, options.summaryTopToken)
	}
	return payload
}

export const buildUsdInflowsPayload = (
	params: IBuildStablecoinChartDataParams,
	options?: { summaryTopToken?: { symbol: string; mcap: number }; seriesName?: string }
): StablecoinChartSeriesPayload => {
	return buildUsdInflowsPayloadFromCollection(
		collectCanonicalStablecoinInflowHistory(params, options?.summaryTopToken != null),
		options
	)
}

const buildTokenInflowsPayloadFromCollection = (
	inputCollection: StablecoinCanonicalHistory,
	options?: StablecoinBreakdownSelectionOptions & { summaryTopToken?: { symbol: string; mcap: number } }
): StablecoinChartSeriesPayload => {
	let collected = inputCollection
	if (collected.series.length === 0) {
		collected = {
			...collected,
			timestamps: [1652486400 * 1e3],
			totals: [0],
			series: [
				{
					name: 'USDT',
					latestValue: 0,
					latestVisibleTimestamp: 1652486400 * 1e3,
					latestVisibleValue: 0,
					offset: 0,
					length: 1,
					carryAfterTimestamp: null,
					carryValue: 0
				}
			],
			seriesTimestamps: new Float64Array([1652486400 * 1e3]),
			seriesValues: new Float64Array([0]),
			topToken: { symbol: 'USDT', mcap: 0 }
		}
	}
	const selection = getStablecoinSelectionFromCollection(collected, options)
	const canonicalColorIndex = new Map(selection.availableSeries.map((name, index) => [name, index]))
	const payload: StablecoinChartSeriesPayload = {
		dataset: buildStablecoinBreakdownDatasetFromCollection({ collection: collected, selection }),
		charts: selection.visibleSeries.map((name, index) => ({
			type: 'bar',
			name,
			encode: { x: 0, y: index + 1 },
			color: TOKEN_COLORS[name] ?? CHART_COLORS[(canonicalColorIndex.get(name) ?? index) % CHART_COLORS.length],
			stack: 'tokenInflows',
			large: false
		})),
		availableSeries: selection.availableSeries,
		defaultSeries: selection.defaultSeries,
		stacked: true,
		showTotalInTooltip: true
	}
	if (options?.summaryTopToken) {
		payload.summary = buildStablecoinChartSummary(collected.totalPoints, options.summaryTopToken)
	}
	return payload
}

export const buildTokenInflowsPayload = (
	params: IBuildStablecoinChartDataParams,
	options?: StablecoinBreakdownSelectionOptions & { summaryTopToken?: { symbol: string; mcap: number } }
): StablecoinChartSeriesPayload => {
	return buildTokenInflowsPayloadFromCollection(
		collectCanonicalStablecoinInflowHistory(params, options?.summaryTopToken != null),
		options
	)
}

export type StablecoinSelectableOverviewChartType = Extract<
	StablecoinOverviewChartType,
	'tokenMcaps' | 'dominance' | 'tokenInflows'
>

export type StablecoinOverviewChartCollection = {
	chart: StablecoinSelectableOverviewChartType
	history: StablecoinCanonicalHistory
	topToken: { symbol: string; mcap: number }
}

export const collectStablecoinOverviewChart = (
	params: IBuildStablecoinChartDataParams,
	chart: StablecoinSelectableOverviewChartType,
	topToken?: { symbol: string; mcap: number }
): StablecoinOverviewChartCollection => {
	const history =
		chart === 'tokenInflows'
			? collectCanonicalStablecoinInflowHistory(params, true)
			: collectCanonicalStablecoinArea(params, { includeSummary: true, seriesMode: 'history' })
	return { chart, history, topToken: topToken ?? history.topToken }
}

export const buildStablecoinOverviewPayloadFromCollection = (
	collection: StablecoinOverviewChartCollection,
	selectionOptions?: StablecoinBreakdownSelectionOptions
): StablecoinChartSeriesPayload => {
	if (collection.chart === 'tokenMcaps') {
		return buildAreaPayloadFromCollection(collection.history, {
			stackName: 'tokenMcaps',
			...selectionOptions,
			summaryTopToken: collection.topToken
		})
	}
	if (collection.chart === 'dominance') {
		return buildDominancePayloadFromCollection(collection.history, {
			stackName: 'dominance',
			...selectionOptions,
			summaryTopToken: collection.topToken
		})
	}
	return buildTokenInflowsPayloadFromCollection(collection.history, {
		...selectionOptions,
		summaryTopToken: collection.topToken
	})
}

export const buildStablecoinOverviewPayload = (
	params: IBuildStablecoinChartDataParams,
	chart: StablecoinOverviewChartType,
	topToken: { symbol: string; mcap: number },
	selectionOptions?: StablecoinBreakdownSelectionOptions & { usdInflowsName?: string }
): StablecoinChartSeriesPayload => {
	if (chart === 'totalMcap') {
		return buildTotalMcapPayload(params, { summaryTopToken: topToken })
	}
	if (chart === 'usdInflows') {
		return buildUsdInflowsPayload(params, {
			summaryTopToken: topToken,
			seriesName: selectionOptions?.usdInflowsName
		})
	}
	return buildStablecoinOverviewPayloadFromCollection(
		collectStablecoinOverviewChart(params, chart, topToken),
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
