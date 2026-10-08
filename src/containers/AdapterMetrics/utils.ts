import type { ParsedUrlQuery } from 'node:querystring'
import type { ChartCsvSource } from '~/components/ChartExport/ChartCsvExportButton'
import type {
	MultiSeriesChartDataset,
	ChartTimeGroupingWithCumulative,
	MultiSeriesTimeSeriesDataset,
	MultiSeriesTimeSeriesRow,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { getBucketTimestampMs } from '~/components/ECharts/shared/timeSeries'
import { readSelectionFromQuery } from '~/components/Select/query'
import { CHART_COLORS, CHART_SERIES_LIMIT, chartColor, OTHERS_COLOR } from '~/constants/colors'
import type { ADAPTER_TYPES } from './constants'
import type { IAdapterByChainPageData, IChainsByAdapterPageData, IProtocol } from './types'

export type OpenInterestData = { total24h: number | null; doublecounted: boolean }
export type ActiveLiquidityData = { total24h: number | null; doublecounted: boolean }
export type NormalizedVolumeData = { total24h: number | null }

/** Table/category filter: which protocol rows belong to the selected categories (including child protocols). */
/** The protocol rows the page URL's category selection keeps. Pages without categories ignore it. */
export function filterProtocolsByCategoryQuery(
	protocols: IAdapterByChainPageData['protocols'],
	categories: Array<string>,
	query: ParsedUrlQuery
): Array<IProtocol> {
	if (categories.length === 0) return protocols
	const selectedCategories = readSelectionFromQuery(query, 'category', 'excludeCategory', categories)
	return selectedCategories.length === 0 ? [] : getProtocolsByCategory(protocols, selectedCategories)
}

export function getProtocolsByCategory(
	protocols: IAdapterByChainPageData['protocols'],
	categoriesToFilter: Array<string>
): Array<IProtocol> {
	const final: Array<IProtocol> = []
	const categorySet = new Set(categoriesToFilter)

	for (const protocol of protocols) {
		if (protocol.childProtocols) {
			const childProtocols: Array<IProtocol> = []
			for (const childProtocol of protocol.childProtocols) {
				if (childProtocol.category && categorySet.has(childProtocol.category)) {
					childProtocols.push(childProtocol)
				}
			}

			if (childProtocols.length === protocol.childProtocols.length) {
				final.push(protocol)
			} else {
				for (const childProtocol of childProtocols) {
					final.push(childProtocol)
				}
			}

			continue
		}

		if (protocol.category && categorySet.has(protocol.category)) {
			final.push(protocol)
			continue
		}
	}

	return final
}

const toChartPointMap = (points: Array<[number, number]>) => {
	const map = new Map<number, number>()
	for (const [timestamp, value] of points) {
		map.set(timestamp * 1e3, value)
	}
	return map
}

export function buildAdapterByChainChartDataset({
	adapterType,
	metricName,
	primaryChartData,
	openInterestChartData,
	activeLiquidityChartData
}: {
	adapterType: `${ADAPTER_TYPES}`
	metricName: string
	primaryChartData: Array<[number, number]>
	openInterestChartData: Array<[number, number]>
	activeLiquidityChartData: Array<[number, number]>
}): MultiSeriesTimeSeriesDataset {
	const primaryDataMap = toChartPointMap(primaryChartData)
	const primaryDimensionLabel = metricName

	const hasOpenInterestSeries = adapterType === 'derivatives' || adapterType === 'options'
	const secondaryDimensionLabel =
		adapterType === 'options'
			? 'Notional OI'
			: hasOpenInterestSeries
				? 'Open Interest'
				: adapterType === 'normalized-volume'
					? 'Active Liquidity'
					: null

	const secondarySourceData = hasOpenInterestSeries
		? openInterestChartData
		: adapterType === 'normalized-volume'
			? activeLiquidityChartData
			: []

	const secondaryDataMap = toChartPointMap(secondarySourceData)
	const hasSecondarySeries = secondaryDataMap.size > 0

	const allTimestamps = new Set<number>()
	for (const timestamp of primaryDataMap.keys()) {
		allTimestamps.add(timestamp)
	}
	for (const timestamp of secondaryDataMap.keys()) {
		allTimestamps.add(timestamp)
	}
	const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b)

	const source: MultiSeriesTimeSeriesDataset['source'] = []
	for (const timestamp of sortedTimestamps) {
		if (hasSecondarySeries && secondaryDimensionLabel) {
			source.push([timestamp, primaryDataMap.get(timestamp) ?? null, secondaryDataMap.get(timestamp) ?? null])
			continue
		}

		source.push([timestamp, primaryDataMap.get(timestamp) ?? null])
	}

	return {
		source,
		dimensions:
			hasSecondarySeries && secondaryDimensionLabel
				? ['timestamp', primaryDimensionLabel, secondaryDimensionLabel]
				: ['timestamp', primaryDimensionLabel]
	}
}

export type ProtocolBreakdownNormalization = {
	canonicalBySeriesName: Record<string, string>
	aliasesByCanonicalName: Record<string, Array<string>>
	signature: string
}

export function buildProtocolBreakdownNormalization(protocols: Array<IProtocol>): ProtocolBreakdownNormalization {
	const canonicalBySeriesName = new Map<string, string>()
	const aliasesByCanonicalName = new Map<string, Set<string>>()

	const addAlias = (seriesName: string, canonicalName: string) => {
		canonicalBySeriesName.set(seriesName, canonicalName)
		const aliases = aliasesByCanonicalName.get(canonicalName) ?? new Set<string>()
		aliases.add(seriesName)
		aliasesByCanonicalName.set(canonicalName, aliases)
	}

	const walk = (protocol: IProtocol, canonicalName = protocol.name) => {
		addAlias(protocol.name, canonicalName)
		for (const alias of protocol.breakdownAliases ?? []) {
			addAlias(alias, canonicalName)
		}
		for (const childProtocol of protocol.childProtocols ?? []) {
			walk(childProtocol, canonicalName)
		}
	}

	for (const protocol of protocols) {
		walk(protocol)
	}

	const canonicalEntries = Array.from(canonicalBySeriesName.entries()).toSorted((a, b) => a[0].localeCompare(b[0]))
	const aliasEntries: Array<[string, Array<string>]> = Array.from(aliasesByCanonicalName.entries())
		.toSorted((a, b) => a[0].localeCompare(b[0]))
		.map(([canonicalName, aliases]) => [canonicalName, Array.from(aliases).toSorted((a, b) => a.localeCompare(b))])
	const canonicalRecord: Record<string, string> = Object.fromEntries(canonicalEntries)
	const aliasesRecord: Record<string, Array<string>> = Object.fromEntries(aliasEntries)

	return {
		canonicalBySeriesName: canonicalRecord,
		aliasesByCanonicalName: aliasesRecord,
		signature: JSON.stringify(canonicalRecord)
	}
}

export function normalizeProtocolBreakdownChartData({
	chart,
	normalization
}: {
	chart: Array<[number, Record<string, number>]>
	normalization: ProtocolBreakdownNormalization
}): {
	chartData: MultiSeriesTimeSeriesDataset
	protocolDimensions: Array<string>
} {
	const protocolTotals = new Map<string, number>()

	for (const [, protocolValues] of chart) {
		for (const protocolName in protocolValues) {
			const value = protocolValues[protocolName]
			const canonicalName = normalization.canonicalBySeriesName[protocolName]
			if (value === undefined || !canonicalName) continue

			protocolTotals.set(canonicalName, (protocolTotals.get(canonicalName) ?? 0) + value)
		}
	}

	const protocolDimensions: Array<string> = []
	for (const [name] of Array.from(protocolTotals.entries()).toSorted((a, b) => b[1] - a[1])) {
		protocolDimensions.push(name)
	}

	if (protocolDimensions.length === 0) {
		return {
			chartData: { source: [], dimensions: ['timestamp'] },
			protocolDimensions: []
		}
	}

	const protocolDimensionIndexes = new Map<string, number>()
	for (let index = 0; index < protocolDimensions.length; index++) {
		const name = protocolDimensions[index]
		if (name !== undefined) protocolDimensionIndexes.set(name, index + 1)
	}

	const source: MultiSeriesTimeSeriesDataset['source'] = []
	// The endpoint is ascending and sparse. Build directly from it after ranking the final dimensions.
	for (const [timestamp, protocolValues] of chart) {
		const row: MultiSeriesTimeSeriesRow = [timestamp * 1e3]
		row.length = protocolDimensions.length + 1
		row.fill(null, 1)
		let hasValues = false
		for (const protocolName in protocolValues) {
			const value = protocolValues[protocolName]
			const canonicalName = normalization.canonicalBySeriesName[protocolName]
			if (value === undefined || !canonicalName) continue
			const dimensionIndex = protocolDimensionIndexes.get(canonicalName)
			if (dimensionIndex === undefined) continue
			row[dimensionIndex] = (row[dimensionIndex] ?? 0) + value
			hasValues = true
		}
		if (hasValues) source.push(row)
	}

	return {
		chartData: {
			source,
			dimensions: ['timestamp', ...protocolDimensions]
		},
		protocolDimensions
	}
}

// Chain-native fee and revenue rankings have no chart panel; the app-level fee rankings do.
const FEES_CHART_PAGE_TYPES = new Set(['Holders Revenue', 'App Fees', 'App Revenue'])

export function showsChainsByAdapterChart(adapterType: `${ADAPTER_TYPES}`, pageType: string): boolean {
	return adapterType !== 'fees' || FEES_CHART_PAGE_TYPES.has(pageType)
}

export type ChainsByAdapterChartKind = 'bar' | 'dominance' | 'treemap' | 'hbar'
export type ChainsByAdapterValueMode = 'absolute' | 'relative'
export type ChainsByAdapterBarLayout = 'stacked' | 'separate'

export type ChainsByAdapterChartState =
	| {
			chartKind: 'bar'
			valueMode: ChainsByAdapterValueMode
			barLayout: ChainsByAdapterBarLayout
			groupBy: ChartTimeGroupingWithCumulative
	  }
	| {
			chartKind: 'dominance'
			groupBy: ChartTimeGroupingWithCumulative
	  }
	| {
			chartKind: 'treemap'
			groupBy: ChartTimeGroupingWithCumulative
	  }
	| {
			chartKind: 'hbar'
			groupBy: ChartTimeGroupingWithCumulative
	  }

export type ChainsByAdapterLatestValueDatum = {
	name: string
	value: number
	share: number
	itemStyle: { color: string }
}

type BreakdownLatestValueRow = {
	name: string
	total24h: number | null
}

type ChainsByAdapterBarPresentation = {
	kind: 'bar'
	csvSource: ChartCsvSource
	dataset: MultiSeriesTimeSeriesDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	valueMode: ChainsByAdapterValueMode
	barLayout: ChainsByAdapterBarLayout
	showTotalInTooltip: boolean
	groupBy: ChartTimeGroupingWithCumulative
}

type ChainsByAdapterDominancePresentation = {
	kind: 'dominance'
	csvSource: ChartCsvSource
	dataset: MultiSeriesTimeSeriesDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	groupBy: ChartTimeGroupingWithCumulative
}

type ChainsByAdapterTreemapPresentation = {
	kind: 'treemap'
	csvSource: ChartCsvSource
	data: Array<ChainsByAdapterLatestValueDatum>
}

type ChainsByAdapterHBarPresentation = {
	kind: 'hbar'
	csvSource: ChartCsvSource
	data: Array<ChainsByAdapterLatestValueDatum>
}

export type ChainsByAdapterChartPresentation =
	| ChainsByAdapterBarPresentation
	| ChainsByAdapterDominancePresentation
	| ChainsByAdapterTreemapPresentation
	| ChainsByAdapterHBarPresentation

type ChainsByAdapterBarState = Extract<ChainsByAdapterChartState, { chartKind: 'bar' }>
type ChainsByAdapterDominanceState = Extract<ChainsByAdapterChartState, { chartKind: 'dominance' }>

const DEFAULT_CHAINS_BY_ADAPTER_GROUP_BY: ChartTimeGroupingWithCumulative = 'daily'
const VALID_GROUPINGS = new Set<ChartTimeGroupingWithCumulative>([
	'daily',
	'weekly',
	'monthly',
	'quarterly',
	'yearly',
	'cumulative'
])
const MAX_PROTOCOL_BREAKDOWN_SERIES = CHART_SERIES_LIMIT
const MAX_CHAINS_BY_ADAPTER_HBAR_ITEMS = 9
const MIN_COMPLETE_DAILY_GAP_MS = 23 * 60 * 60 * 1000

/**
 * Palette colours for the series a chart draws, in rank order. A series keeps its canonical colour (its colour in the
 * unfiltered chart), so colours hold while the picker changes; the rest take the colours left free, by rank. "Others"
 * is always grey. A picker chart drawing more than ten series repeats colours.
 */
function getSeriesColors(
	names: ReadonlyArray<string>,
	canonicalColors?: ReadonlyMap<string, string>
): Map<string, string> {
	const colors = new Map<string, string>()
	const used = new Set<string>()
	for (const name of names) {
		const color = name === 'Others' ? OTHERS_COLOR : canonicalColors?.get(name)
		if (color === undefined) continue
		colors.set(name, color)
		used.add(color)
	}
	let paletteIndex = 0
	for (const name of names) {
		if (colors.has(name)) continue
		while (paletteIndex < CHART_COLORS.length && used.has(chartColor(paletteIndex))) paletteIndex++
		colors.set(name, chartColor(paletteIndex))
		paletteIndex++
	}
	return colors
}

/** The canonical colours: the top ranked series of the unfiltered chart, one palette colour each. */
function getCanonicalSeriesColors(rankedNames: ReadonlyArray<string>): Map<string, string> {
	const topNames: Array<string> = []
	for (const name of rankedNames) {
		if (topNames.length === CHART_SERIES_LIMIT) break
		if (name !== 'Others') topNames.push(name)
	}
	return getSeriesColors(topNames)
}

function getSeriesColor(colors: Map<string, string>, seriesName: string): string {
	const color = colors.get(seriesName)
	if (color === undefined) throw new Error(`Chart series is missing a color: ${seriesName}`)
	return color
}

/** Rolling window length for treemap/hbar "latest value" when groupBy is not daily/cumulative (from latest row in dataset). */
function getRollingWindowMsForTreemapGrouping(groupBy: 'weekly' | 'monthly' | 'quarterly' | 'yearly'): number {
	const dayMs = 24 * 60 * 60 * 1000
	switch (groupBy) {
		case 'weekly':
			return 7 * dayMs
		case 'monthly':
			return 30 * dayMs
		case 'quarterly':
			return 90 * dayMs
		case 'yearly':
			return 365 * dayMs
	}
}

function getLatestTimestampMsInDataset(chartData: MultiSeriesTimeSeriesDataset): number | null {
	const lastRow = chartData.source[chartData.source.length - 1]
	return lastRow?.[0] ?? null
}

function assertNever(value: never): never {
	throw new Error(`Unhandled chains by adapter chart state: ${JSON.stringify(value)}`)
}

function toValidChartGrouping(value: string | undefined | null): ChartTimeGroupingWithCumulative | null {
	if (!value) return null
	return VALID_GROUPINGS.has(value as ChartTimeGroupingWithCumulative)
		? (value as ChartTimeGroupingWithCumulative)
		: null
}

export function normalizeChainsByAdapterChartState({
	chartKindParam,
	valueModeParam,
	barLayoutParam,
	groupByParam,
	legacyChartTypeParam
}: {
	chartKindParam?: string | null
	valueModeParam?: string | null
	barLayoutParam?: string | null
	groupByParam?: string | null
	legacyChartTypeParam?: string | null
}): ChainsByAdapterChartState {
	const normalizedGroupBy = groupByParam?.toLowerCase()

	const normalizedChartKind = chartKindParam?.toLowerCase()
	if (normalizedChartKind === 'dominance' || normalizedChartKind === 'line') {
		return {
			chartKind: 'dominance',
			groupBy: toValidChartGrouping(normalizedGroupBy) ?? DEFAULT_CHAINS_BY_ADAPTER_GROUP_BY
		}
	}
	if (normalizedChartKind === 'treemap') {
		return {
			chartKind: 'treemap',
			groupBy: toValidChartGrouping(normalizedGroupBy) ?? DEFAULT_CHAINS_BY_ADAPTER_GROUP_BY
		}
	}
	if (normalizedChartKind === 'hbar') {
		return { chartKind: 'hbar', groupBy: toValidChartGrouping(normalizedGroupBy) ?? DEFAULT_CHAINS_BY_ADAPTER_GROUP_BY }
	}
	if (legacyChartTypeParam?.toLowerCase() === 'dominance') {
		return {
			chartKind: 'dominance',
			groupBy: toValidChartGrouping(normalizedGroupBy) ?? DEFAULT_CHAINS_BY_ADAPTER_GROUP_BY
		}
	}

	return {
		chartKind: 'bar',
		valueMode: valueModeParam?.toLowerCase() === 'relative' ? 'relative' : 'absolute',
		barLayout: barLayoutParam?.toLowerCase() === 'separate' ? 'separate' : 'stacked',
		groupBy: toValidChartGrouping(normalizedGroupBy) ?? DEFAULT_CHAINS_BY_ADAPTER_GROUP_BY
	}
}

function createRankedSeriesUniverse({
	chartData,
	selectedNames,
	rankingScores,
	tieBreakByDatasetOrder = false,
	canonicalColorBySeriesName
}: {
	chartData: MultiSeriesTimeSeriesDataset
	selectedNames: Array<string>
	rankingScores?: Map<string, number>
	tieBreakByDatasetOrder?: boolean
	canonicalColorBySeriesName?: Map<string, string>
}) {
	const entityTotals = new Map<string, number>()
	const dimensionIndexes = getSeriesDimensionIndexes(chartData)
	const selectedSeriesNames: Array<string> = []
	const selectedDimensionIndexes: Array<number> = []
	for (const name of selectedNames) {
		const dimensionIndex = dimensionIndexes.get(name)
		if (dimensionIndex === undefined) continue
		selectedSeriesNames.push(name)
		selectedDimensionIndexes.push(dimensionIndex)
	}

	for (const row of chartData.source) {
		for (let seriesIndex = 0; seriesIndex < selectedSeriesNames.length; seriesIndex++) {
			const entity = selectedSeriesNames[seriesIndex]
			const dimensionIndex = selectedDimensionIndexes[seriesIndex]
			if (entity === undefined || dimensionIndex === undefined) continue
			const value = row[dimensionIndex]
			if (value != null) {
				entityTotals.set(entity, (entityTotals.get(entity) ?? 0) + value)
			}
		}
	}

	const getRankingScore = (entity: string) => rankingScores?.get(entity) ?? Number.NEGATIVE_INFINITY
	const ranked = Array.from(entityTotals.entries()).toSorted((a, b) => {
		const aScore = getRankingScore(a[0])
		const bScore = getRankingScore(b[0])
		if (aScore !== bScore) {
			return bScore > aScore ? 1 : -1
		}
		return (
			b[1] - a[1] ||
			(tieBreakByDatasetOrder
				? (dimensionIndexes.get(a[0]) ?? Number.MAX_SAFE_INTEGER) -
					(dimensionIndexes.get(b[0]) ?? Number.MAX_SAFE_INTEGER)
				: 0)
		)
	})
	return createChainSeriesUniverseFromRankedNames(
		ranked.map(([name]) => name),
		canonicalColorBySeriesName
	)
}

function createChainSeriesUniverseFromRankedNames(
	rankedEntityNames: Array<string>,
	canonicalColorBySeriesName?: Map<string, string>
) {
	const topEntityNames: Array<string> = []
	const otherEntityNames: Array<string> = []
	for (let index = 0; index < rankedEntityNames.length; index++) {
		const entity = rankedEntityNames[index]
		if (entity === undefined) continue
		if (index < CHART_SERIES_LIMIT) {
			topEntityNames.push(entity)
		} else {
			otherEntityNames.push(entity)
		}
	}
	// A real series named "Others" belongs in the aggregate instead of colliding with its output dimension.
	const existingOthersIndex = topEntityNames.indexOf('Others')
	if (existingOthersIndex >= 0 && otherEntityNames.length > 0) {
		topEntityNames.splice(existingOthersIndex, 1)
		otherEntityNames.unshift('Others')
	}

	const topSeriesNames = otherEntityNames.length > 0 ? [...topEntityNames, 'Others'] : topEntityNames
	const topColorBySeriesName = getSeriesColors(topSeriesNames, canonicalColorBySeriesName)

	return {
		rankedEntityNames,
		topEntityNames,
		otherEntityNames,
		topSeriesNames,
		topColorBySeriesName
	}
}

const canonicalSeriesColorsCache = new WeakMap<MultiSeriesTimeSeriesDataset, Map<string, Map<string, string>>>()
const canonicalSeriesOrderCache = new WeakMap<MultiSeriesTimeSeriesDataset, Map<string, Array<string>>>()

function getCachedCanonicalSeriesColors(chartData: MultiSeriesTimeSeriesDataset, cacheKey: string) {
	return canonicalSeriesColorsCache.get(chartData)?.get(cacheKey)
}

function getCachedCanonicalSeriesOrder(chartData: MultiSeriesTimeSeriesDataset, cacheKey: string) {
	return canonicalSeriesOrderCache.get(chartData)?.get(cacheKey)
}

function cacheCanonicalSeriesColors(
	chartData: MultiSeriesTimeSeriesDataset,
	cacheKey: string,
	rankedEntityNames: Array<string>
) {
	const colorBySeriesName = getCanonicalSeriesColors(rankedEntityNames)
	let datasetCache = canonicalSeriesColorsCache.get(chartData)
	if (!datasetCache) {
		datasetCache = new Map()
		canonicalSeriesColorsCache.set(chartData, datasetCache)
	}
	datasetCache.set(cacheKey, colorBySeriesName)
	let orderCache = canonicalSeriesOrderCache.get(chartData)
	if (!orderCache) {
		orderCache = new Map()
		canonicalSeriesOrderCache.set(chartData, orderCache)
	}
	orderCache.set(cacheKey, rankedEntityNames)
	return colorBySeriesName
}

function createStableColorChainSeriesUniverse({
	chartData,
	selectedNames,
	tieBreakByDatasetOrder = false
}: {
	chartData: MultiSeriesTimeSeriesDataset
	selectedNames: Array<string>
	tieBreakByDatasetOrder?: boolean
}) {
	const cacheKey = tieBreakByDatasetOrder ? 'chains:dataset-order' : 'chains:totals-order'
	const cachedColors = getCachedCanonicalSeriesColors(chartData, cacheKey)
	const cachedOrder = getCachedCanonicalSeriesOrder(chartData, cacheKey)
	if (cachedColors && cachedOrder) {
		const selectedSet = new Set(selectedNames)
		return createChainSeriesUniverseFromRankedNames(
			cachedOrder.filter((name) => selectedSet.has(name)),
			cachedColors
		)
	}

	const hasFullSelection = hasEveryDatasetSeriesSelected(chartData, selectedNames)
	const fullUniverse = createRankedSeriesUniverse({
		chartData,
		selectedNames: hasFullSelection ? selectedNames : chartData.dimensions.slice(1),
		tieBreakByDatasetOrder
	})
	const canonicalColors = cacheCanonicalSeriesColors(chartData, cacheKey, fullUniverse.rankedEntityNames)
	return hasFullSelection
		? fullUniverse
		: createRankedSeriesUniverse({
				chartData,
				selectedNames,
				tieBreakByDatasetOrder,
				canonicalColorBySeriesName: canonicalColors
			})
}

function hasEveryDatasetSeriesSelected(chartData: MultiSeriesTimeSeriesDataset, selectedNames: Array<string>): boolean {
	const selectedSet = new Set(selectedNames)
	for (let index = 1; index < chartData.dimensions.length; index++) {
		const dimension = chartData.dimensions[index]
		if (dimension === undefined || !selectedSet.has(dimension)) return false
	}
	return true
}

function getOrderedSelectedSeriesNames({
	chartData,
	selectedNames
}: {
	chartData: MultiSeriesTimeSeriesDataset
	selectedNames: Array<string>
}) {
	const selectedSet = new Set(selectedNames)
	const selectedSeriesNames: Array<string> = []
	for (let index = 1; index < chartData.dimensions.length; index++) {
		const dimension = chartData.dimensions[index]
		if (dimension !== undefined && selectedSet.has(dimension)) selectedSeriesNames.push(dimension)
	}
	return selectedSeriesNames
}

function getSeriesDimensionIndexes(chartData: MultiSeriesTimeSeriesDataset): Map<string, number> {
	const dimensionIndexes = new Map<string, number>()
	for (let index = 1; index < chartData.dimensions.length; index++) {
		const dimension = chartData.dimensions[index]
		if (dimension !== undefined && !dimensionIndexes.has(dimension)) dimensionIndexes.set(dimension, index)
	}
	return dimensionIndexes
}

function orderSelectedNamesByRankingScores({
	chartData,
	selectedNames,
	rankingScores
}: {
	chartData: MultiSeriesTimeSeriesDataset
	selectedNames: Array<string>
	rankingScores?: Map<string, number>
}) {
	const selectedSeriesNames = getOrderedSelectedSeriesNames({ chartData, selectedNames })
	const totals = new Map<string, number>()
	const dimensionIndexes = getSeriesDimensionIndexes(chartData)
	const namesWithDimensions: Array<string> = []
	const selectedDimensionIndexes: Array<number> = []
	for (const name of selectedSeriesNames) {
		const dimensionIndex = dimensionIndexes.get(name)
		if (dimensionIndex === undefined) continue
		namesWithDimensions.push(name)
		selectedDimensionIndexes.push(dimensionIndex)
	}
	for (const row of chartData.source) {
		for (let seriesIndex = 0; seriesIndex < namesWithDimensions.length; seriesIndex++) {
			const name = namesWithDimensions[seriesIndex]
			const dimensionIndex = selectedDimensionIndexes[seriesIndex]
			if (name === undefined || dimensionIndex === undefined) continue
			const value = row[dimensionIndex]
			if (value != null) totals.set(name, (totals.get(name) ?? 0) + value)
		}
	}

	const getRankingScore = (seriesName: string) => rankingScores?.get(seriesName) ?? Number.NEGATIVE_INFINITY

	return selectedSeriesNames.toSorted((a, b) => {
		const aScore = getRankingScore(a)
		const bScore = getRankingScore(b)
		if (aScore !== bScore) {
			return bScore > aScore ? 1 : -1
		}

		return (totals.get(b) ?? 0) - (totals.get(a) ?? 0)
	})
}

type CanonicalRowTotals = { totals: Float64Array; corrections: Float64Array; valueCounts: Uint32Array }
const canonicalRowTotalsCache = new WeakMap<MultiSeriesTimeSeriesDataset, CanonicalRowTotals>()

function getCanonicalRowTotals(chartData: MultiSeriesTimeSeriesDataset): CanonicalRowTotals {
	const cached = canonicalRowTotalsCache.get(chartData)
	if (cached) return cached
	const totals = new Float64Array(chartData.source.length)
	const corrections = new Float64Array(chartData.source.length)
	const valueCounts = new Uint32Array(chartData.source.length)
	for (let rowIndex = 0; rowIndex < chartData.source.length; rowIndex++) {
		const row = chartData.source[rowIndex]
		if (row === undefined) continue
		let total = 0
		let correction = 0
		let valueCount = 0
		for (let dimensionIndex = 1; dimensionIndex < row.length; dimensionIndex++) {
			const value = row[dimensionIndex]
			if (value == null) continue
			const nextTotal = total + value
			correction += Math.abs(total) >= Math.abs(value) ? total - nextTotal + value : value - nextTotal + total
			total = nextTotal
			valueCount++
		}
		totals[rowIndex] = total
		corrections[rowIndex] = correction
		valueCounts[rowIndex] = valueCount
	}
	const result = { totals, corrections, valueCounts }
	canonicalRowTotalsCache.set(chartData, result)
	return result
}

function buildGroupedFlowDataset({
	chartData,
	topEntityNames,
	otherEntityNames,
	seriesNames,
	groupBy,
	relative
}: {
	chartData: MultiSeriesTimeSeriesDataset
	topEntityNames: Array<string>
	otherEntityNames: Array<string>
	seriesNames: Array<string>
	groupBy: ChartTimeGroupingWithCumulative
	relative: boolean
}): MultiSeriesTimeSeriesDataset {
	const isDaily = groupBy === 'daily'
	const isCumulative = groupBy === 'cumulative'
	const cumulativeTotals = isCumulative ? new Array<number>(seriesNames.length).fill(0) : null
	const hasCumulativeValue = isCumulative ? new Array<boolean>(seriesNames.length).fill(false) : null
	const otherEntitySet = otherEntityNames.length > 0 ? new Set(otherEntityNames) : null
	const dimensionIndexes = getSeriesDimensionIndexes(chartData)
	const topEntityIndexes: Array<[outputIndex: number, dimensionIndex: number]> = []
	for (let outputIndex = 0; outputIndex < topEntityNames.length; outputIndex++) {
		const name = topEntityNames[outputIndex]
		if (name === undefined) continue
		const dimensionIndex = dimensionIndexes.get(name)
		if (dimensionIndex !== undefined) topEntityIndexes.push([outputIndex, dimensionIndex])
	}
	const otherEntityIndexes: Array<number> = []
	if (otherEntitySet) {
		for (const name of otherEntityNames) {
			const dimensionIndex = dimensionIndexes.get(name)
			if (dimensionIndex !== undefined) otherEntityIndexes.push(dimensionIndex)
		}
	}
	const otherEntityIndexSet = new Set(otherEntityIndexes)
	const complementEntityIndexes: Array<number> = []
	for (let index = 1; index < chartData.dimensions.length; index++) {
		if (!otherEntityIndexSet.has(index)) complementEntityIndexes.push(index)
	}
	const useCanonicalRemainder = otherEntityIndexes.length > complementEntityIndexes.length
	const canonicalRows = useCanonicalRemainder ? getCanonicalRowTotals(chartData) : null
	const source: MultiSeriesTimeSeriesDataset['source'] = []
	let bucketTimestamp: number | null = null
	let bucketValues: Array<number | undefined> | null = null

	const pushBucket = () => {
		if (bucketTimestamp == null || !bucketValues) return
		let relativeTotal = 0

		for (let index = 0; index < seriesNames.length; index++) {
			let value = bucketValues[index]
			if (cumulativeTotals && hasCumulativeValue) {
				if (value != null) {
					const cumulativeValue = (cumulativeTotals[index] ?? 0) + value
					cumulativeTotals[index] = cumulativeValue
					hasCumulativeValue[index] = true
				} else if (!hasCumulativeValue[index]) {
					continue
				}
				value = cumulativeTotals[index] ?? 0
				bucketValues[index] = value
			} else if (value == null) {
				continue
			}
			if (relative && value > 0) relativeTotal += value
		}

		const nextRow: MultiSeriesTimeSeriesRow = [bucketTimestamp]
		for (let index = 0; index < seriesNames.length; index++) {
			const value = bucketValues[index]
			const finalValue =
				relative && value != null ? (relativeTotal > 0 ? (Math.max(value, 0) / relativeTotal) * 100 : 0) : value
			nextRow.push(finalValue ?? null)
		}
		source.push(nextRow)
	}
	const ensureBucket = (nextBucketTimestamp: number) => {
		if (bucketTimestamp === nextBucketTimestamp && bucketValues) return bucketValues
		pushBucket()
		bucketTimestamp = nextBucketTimestamp
		bucketValues = []
		return bucketValues
	}

	for (let rowIndex = 0; rowIndex < chartData.source.length; rowIndex++) {
		const row = chartData.source[rowIndex]
		if (row === undefined) continue
		const timestamp = row[0]
		const nextBucketTimestamp = isDaily || isCumulative ? timestamp : getBucketTimestampMs(timestamp, groupBy)

		for (const [outputIndex, dimensionIndex] of topEntityIndexes) {
			const value = row[dimensionIndex]
			if (value == null) continue
			const values = ensureBucket(nextBucketTimestamp)
			values[outputIndex] = isDaily ? value : (values[outputIndex] ?? 0) + value
		}

		if (otherEntitySet) {
			let othersValue = canonicalRows?.totals[rowIndex] ?? 0
			let othersCorrection = canonicalRows?.corrections[rowIndex] ?? 0
			let othersValueCount = canonicalRows?.valueCounts[rowIndex] ?? 0
			const indexesToSubtractOrAdd = canonicalRows ? complementEntityIndexes : otherEntityIndexes
			for (const dimensionIndex of indexesToSubtractOrAdd) {
				const value = row[dimensionIndex]
				if (value == null) continue
				const nextValue = canonicalRows ? -value : value
				const nextOthersValue = othersValue + nextValue
				if (canonicalRows) {
					othersCorrection +=
						Math.abs(othersValue) >= Math.abs(nextValue)
							? othersValue - nextOthersValue + nextValue
							: nextValue - nextOthersValue + othersValue
				}
				othersValue = nextOthersValue
				othersValueCount += canonicalRows ? -1 : 1
			}
			if (othersValueCount > 0) {
				othersValue += othersCorrection
				const values = ensureBucket(nextBucketTimestamp)
				const othersIndex = seriesNames.length - 1
				if (othersIndex >= 0) values[othersIndex] = (values[othersIndex] ?? 0) + othersValue
			}
		}
	}
	pushBucket()

	return { source, dimensions: ['timestamp', ...seriesNames] }
}

/** Build the complete chart metric for CSV without visual selection or overflow grouping. */
/** Exports every series the picker selected, in dataset order, without the chart's top-N "Others" grouping. */
export function buildAdapterMetricsCsvDataset({
	chartData,
	state,
	selectedNames
}: {
	chartData: MultiSeriesTimeSeriesDataset
	state: ChainsByAdapterBarState | ChainsByAdapterDominanceState
	selectedNames: Array<string>
}): MultiSeriesTimeSeriesDataset {
	const selected = new Set(selectedNames)
	const seriesNames = chartData.dimensions.slice(1).filter((name) => selected.has(name))
	const isEverySeries = seriesNames.length === chartData.dimensions.length - 1
	if (isEverySeries && state.chartKind === 'bar' && state.groupBy === 'daily' && state.valueMode === 'absolute') {
		return chartData
	}

	return buildGroupedFlowDataset({
		chartData,
		topEntityNames: seriesNames,
		otherEntityNames: [],
		seriesNames,
		groupBy: state.groupBy,
		relative: state.chartKind === 'dominance' || state.valueMode === 'relative'
	})
}

function buildBarPresentation({
	chartData,
	selectedNames,
	topEntityNames,
	otherEntityNames,
	topSeriesNames,
	topColorBySeriesName,
	state
}: {
	chartData: MultiSeriesTimeSeriesDataset
	/** The picker's selection; the ranked names below leave out series with no values, which the export keeps. */
	selectedNames: Array<string>
	topEntityNames: Array<string>
	otherEntityNames: Array<string>
	topSeriesNames: Array<string>
	topColorBySeriesName: Map<string, string>
	state: ChainsByAdapterBarState
}): ChainsByAdapterBarPresentation {
	const finalDataset = buildGroupedFlowDataset({
		chartData,
		topEntityNames,
		otherEntityNames,
		seriesNames: topSeriesNames,
		groupBy: state.groupBy,
		relative: state.valueMode === 'relative'
	})
	const isCumulative = state.groupBy === 'cumulative'

	return {
		kind: 'bar',
		csvSource: {
			type: 'dataset',
			prepare: () => ({
				...buildAdapterMetricsCsvDataset({ chartData, state, selectedNames }),
				groupBy: state.groupBy
			})
		},
		dataset: finalDataset,
		charts: topSeriesNames.map((seriesName, index) => ({
			type: isCumulative ? 'line' : 'bar',
			name: seriesName,
			encode: { x: 0, y: index + 1 },
			...(!isCumulative && state.barLayout === 'stacked' ? { stack: 'chain' as const, large: false } : {}),
			...(isCumulative && topSeriesNames.length > 1 ? { hideAreaStyle: true } : {}),
			color: getSeriesColor(topColorBySeriesName, seriesName)
		})),
		valueMode: state.valueMode,
		barLayout: state.barLayout,
		showTotalInTooltip: state.valueMode === 'absolute' && state.barLayout === 'stacked',
		groupBy: state.groupBy
	}
}

function buildDominancePresentation({
	chartData,
	selectedNames,
	topEntityNames,
	otherEntityNames,
	topSeriesNames,
	topColorBySeriesName,
	state
}: {
	chartData: MultiSeriesTimeSeriesDataset
	selectedNames: Array<string>
	topEntityNames: Array<string>
	otherEntityNames: Array<string>
	topSeriesNames: Array<string>
	topColorBySeriesName: Map<string, string>
	state: ChainsByAdapterDominanceState
}): ChainsByAdapterDominancePresentation {
	const relativeDataset = buildGroupedFlowDataset({
		chartData,
		topEntityNames,
		otherEntityNames,
		seriesNames: topSeriesNames,
		groupBy: state.groupBy,
		relative: true
	})

	return {
		kind: 'dominance',
		csvSource: {
			type: 'dataset',
			prepare: () => ({
				...buildAdapterMetricsCsvDataset({ chartData, state, selectedNames }),
				groupBy: state.groupBy
			})
		},
		dataset: relativeDataset,
		charts: topSeriesNames.map((seriesName, index) => ({
			type: 'line',
			name: seriesName,
			encode: { x: 0, y: index + 1 },
			color: getSeriesColor(topColorBySeriesName, seriesName),
			stack: 'chain'
		})),
		groupBy: state.groupBy
	}
}

function buildRankedLatestValues({
	selectedNames,
	latestRows
}: {
	selectedNames: Array<string>
	latestRows: Array<BreakdownLatestValueRow>
}) {
	const latestValuesByName = new Map<string, number>()
	for (const row of latestRows) {
		const value = row.total24h
		if (value != null) {
			latestValuesByName.set(row.name, value)
		}
	}

	const values: Array<{ name: string; value: number }> = []
	let total = 0
	for (const name of selectedNames) {
		const rawValue = latestValuesByName.get(name) ?? 0
		if (rawValue <= 0) continue
		values.push({ name, value: rawValue })
		total += rawValue
	}
	values.sort((a, b) => b.value - a.value)
	return { values, total }
}

const latestValueSeriesColorsCache = new WeakMap<MultiSeriesTimeSeriesDataset, Map<string, Map<string, string>>>()

function getLatestValueSeriesColors({
	chartData,
	cacheKey
}: {
	chartData: MultiSeriesTimeSeriesDataset
	cacheKey: string
}) {
	let datasetCache = latestValueSeriesColorsCache.get(chartData)
	if (!datasetCache) {
		datasetCache = new Map()
		latestValueSeriesColorsCache.set(chartData, datasetCache)
	}
	let colorBySeriesName = datasetCache.get(cacheKey)
	if (!colorBySeriesName) {
		colorBySeriesName = getCanonicalSeriesColors(chartData.dimensions.slice(1))
		datasetCache.set(cacheKey, colorBySeriesName)
	}
	return colorBySeriesName
}

function decorateLatestValues(
	values: Array<{ name: string; value: number }>,
	total: number,
	canonicalColors: Map<string, string>
): Array<ChainsByAdapterLatestValueDatum> {
	const colorBySeriesName = getSeriesColors(
		values.map((item) => item.name),
		canonicalColors
	)
	const data: Array<ChainsByAdapterLatestValueDatum> = []
	for (const item of values) {
		data.push({
			...item,
			share: total > 0 ? (item.value / total) * 100 : 0,
			itemStyle: {
				color: getSeriesColor(colorBySeriesName, item.name)
			}
		})
	}
	return data
}

function buildTreemapPresentation({
	chartData,
	cacheKey,
	selectedNames,
	latestRows
}: {
	chartData: MultiSeriesTimeSeriesDataset
	cacheKey: string
	selectedNames: Array<string>
	latestRows: Array<BreakdownLatestValueRow>
}): Array<ChainsByAdapterLatestValueDatum> {
	const { values, total } = buildRankedLatestValues({ selectedNames, latestRows })
	const colorBySeriesName = getLatestValueSeriesColors({ chartData, cacheKey })
	return decorateLatestValues(values, total, colorBySeriesName)
}

function buildNullLatestRows(selectedNames: Array<string>): Array<BreakdownLatestValueRow> {
	const rows: Array<BreakdownLatestValueRow> = []
	for (const name of selectedNames) {
		rows.push({ name, total24h: null })
	}
	return rows
}

function buildCumulativeLatestValueRowsFromChartData({
	chartData,
	selectedNames
}: {
	chartData: MultiSeriesTimeSeriesDataset
	selectedNames: Array<string>
}): Array<BreakdownLatestValueRow> {
	const totals = new Map<string, number>()
	const pointCounts = new Map<string, number>()
	const selectedSeriesNames: Array<string> = []
	const selectedDimensionIndexes: Array<number> = []
	const dimensionIndexes = getSeriesDimensionIndexes(chartData)
	for (const name of selectedNames) {
		const dimensionIndex = dimensionIndexes.get(name)
		if (dimensionIndex === undefined) continue
		selectedSeriesNames.push(name)
		selectedDimensionIndexes.push(dimensionIndex)
	}

	for (const row of chartData.source) {
		for (let seriesIndex = 0; seriesIndex < selectedSeriesNames.length; seriesIndex++) {
			const name = selectedSeriesNames[seriesIndex]
			const dimensionIndex = selectedDimensionIndexes[seriesIndex]
			if (name === undefined || dimensionIndex === undefined) continue
			const value = row[dimensionIndex]
			if (value == null) continue
			totals.set(name, (totals.get(name) ?? 0) + value)
			pointCounts.set(name, (pointCounts.get(name) ?? 0) + 1)
		}
	}

	const rows: Array<BreakdownLatestValueRow> = []
	for (const name of selectedNames) {
		rows.push({
			name,
			total24h: (pointCounts.get(name) ?? 0) === 0 ? null : (totals.get(name) ?? 0)
		})
	}
	return rows
}

function buildLatestValueRowsFromChartData({
	chartData,
	selectedNames,
	groupBy
}: {
	chartData: MultiSeriesTimeSeriesDataset
	selectedNames: Array<string>
	groupBy: ChartTimeGroupingWithCumulative
}): Array<BreakdownLatestValueRow> {
	if (groupBy === 'daily') {
		const sourceRow = getEffectiveDailyLatestRow(chartData)
		if (!sourceRow) {
			return buildNullLatestRows(selectedNames)
		}

		const rows: Array<BreakdownLatestValueRow> = []
		const dimensionIndexes = getSeriesDimensionIndexes(chartData)
		for (const name of selectedNames) {
			const dimensionIndex = dimensionIndexes.get(name)
			const value = dimensionIndex === undefined ? undefined : sourceRow[dimensionIndex]
			rows.push({
				name,
				total24h: value ?? null
			})
		}
		return rows
	}

	if (groupBy === 'cumulative') {
		// Mirrors the final point from formatBarChart(..., groupBy: 'cumulative', denominationPriceHistory: null).
		return buildCumulativeLatestValueRowsFromChartData({ chartData, selectedNames })
	}

	const latestTsMs = getLatestTimestampMsInDataset(chartData)
	if (latestTsMs == null) {
		return buildNullLatestRows(selectedNames)
	}

	const windowMs = getRollingWindowMsForTreemapGrouping(groupBy)
	const cutoffMs = latestTsMs - windowMs
	const sums = new Map<string, number>()
	const pointCounts = new Map<string, number>()
	const selectedSeriesNames: Array<string> = []
	const selectedDimensionIndexes: Array<number> = []
	const dimensionIndexes = getSeriesDimensionIndexes(chartData)
	for (const name of selectedNames) {
		const dimensionIndex = dimensionIndexes.get(name)
		if (dimensionIndex === undefined) continue
		selectedSeriesNames.push(name)
		selectedDimensionIndexes.push(dimensionIndex)
	}

	for (let rowIndex = chartData.source.length - 1; rowIndex >= 0; rowIndex--) {
		const row = chartData.source[rowIndex]
		if (!row) continue
		const timestamp = row[0]
		if (timestamp < cutoffMs) break
		for (let seriesIndex = 0; seriesIndex < selectedSeriesNames.length; seriesIndex++) {
			const name = selectedSeriesNames[seriesIndex]
			const dimensionIndex = selectedDimensionIndexes[seriesIndex]
			if (name === undefined || dimensionIndex === undefined) continue
			const value = row[dimensionIndex]
			if (value == null) continue
			sums.set(name, (sums.get(name) ?? 0) + value)
			pointCounts.set(name, (pointCounts.get(name) ?? 0) + 1)
		}
	}

	const rows: Array<BreakdownLatestValueRow> = []
	for (const name of selectedNames) {
		rows.push({
			name,
			total24h: (pointCounts.get(name) ?? 0) === 0 ? null : (sums.get(name) ?? 0)
		})
	}
	return rows
}

function getEffectiveDailyLatestRow(chartData: MultiSeriesTimeSeriesDataset): MultiSeriesTimeSeriesRow | null {
	const source = chartData.source
	const lastTimestampRow = source[source.length - 1]
	if (!lastTimestampRow) return null
	if (source.length === 1) return lastTimestampRow

	// Canonical chart datasets are ascending, so only the final two rows are needed.
	const previousTimestampRow = source[source.length - 2]
	if (!previousTimestampRow) return lastTimestampRow
	const lastTimestamp = lastTimestampRow[0]
	const previousTimestamp = previousTimestampRow[0]
	const isUtcMidnight = lastTimestamp % (24 * 60 * 60 * 1000) === 0
	const gapMs = lastTimestamp - previousTimestamp

	return !isUtcMidnight || gapMs < MIN_COMPLETE_DAILY_GAP_MS ? previousTimestampRow : lastTimestampRow
}

/** Exports the latest value of every series the picker selected, without the chart's top-N grouping. */
function buildLatestValuesCsvDataset({
	latestRows,
	entityDimension
}: {
	latestRows: Array<BreakdownLatestValueRow>
	entityDimension: 'Chain' | 'Protocol'
}): MultiSeriesChartDataset {
	const source = new Array<MultiSeriesChartDataset['source'][number]>(latestRows.length)
	for (let index = 0; index < latestRows.length; index++) {
		const row = latestRows[index]!
		source[index] = [row.name, row.total24h]
	}
	return {
		dimensions: [entityDimension, 'Value'],
		source
	}
}

function buildHBarPresentation({
	chartData,
	cacheKey,
	selectedNames,
	latestRows
}: {
	chartData: MultiSeriesTimeSeriesDataset
	cacheKey: string
	selectedNames: Array<string>
	latestRows: Array<BreakdownLatestValueRow>
}): Array<ChainsByAdapterLatestValueDatum> {
	const { values: rankedValues, total } = buildRankedLatestValues({ selectedNames, latestRows })

	if (rankedValues.length <= MAX_CHAINS_BY_ADAPTER_HBAR_ITEMS) {
		const colorBySeriesName = getLatestValueSeriesColors({ chartData, cacheKey })
		return decorateLatestValues(rankedValues, total, colorBySeriesName)
	}

	const topValues: Array<{ name: string; value: number }> = []
	let othersValue = 0
	for (const item of rankedValues) {
		if (item.name !== 'Others' && topValues.length < MAX_CHAINS_BY_ADAPTER_HBAR_ITEMS) topValues.push(item)
		else othersValue += item.value
	}
	if (othersValue > 0) topValues.push({ name: 'Others', value: othersValue })
	const colorBySeriesName = getLatestValueSeriesColors({ chartData, cacheKey })
	return decorateLatestValues(topValues, total, colorBySeriesName)
}

export function buildChainsByAdapterChartPresentation({
	chartData,
	selectedChains,
	state
}: {
	chartData: IChainsByAdapterPageData['chartData']
	selectedChains: Array<string>
	state: ChainsByAdapterChartState
}): ChainsByAdapterChartPresentation {
	switch (state.chartKind) {
		case 'treemap': {
			const latestRows = buildLatestValueRowsFromChartData({
				chartData,
				selectedNames: selectedChains,
				groupBy: state.groupBy
			})
			return {
				kind: 'treemap',
				csvSource: {
					type: 'dataset',
					prepare: () => buildLatestValuesCsvDataset({ latestRows, entityDimension: 'Chain' })
				},
				data: buildTreemapPresentation({
					chartData,
					cacheKey: 'chains',
					selectedNames: selectedChains,
					latestRows
				})
			}
		}
		case 'hbar': {
			const latestRows = buildLatestValueRowsFromChartData({
				chartData,
				selectedNames: selectedChains,
				groupBy: state.groupBy
			})
			return {
				kind: 'hbar',
				csvSource: {
					type: 'dataset',
					prepare: () => buildLatestValuesCsvDataset({ latestRows, entityDimension: 'Chain' })
				},
				data: buildHBarPresentation({
					chartData,
					cacheKey: 'chains',
					selectedNames: selectedChains,
					latestRows
				})
			}
		}
		case 'dominance': {
			const { topEntityNames, otherEntityNames, topSeriesNames, topColorBySeriesName } =
				createStableColorChainSeriesUniverse({
					chartData,
					selectedNames: selectedChains,
					tieBreakByDatasetOrder: true
				})
			return buildDominancePresentation({
				chartData,
				selectedNames: selectedChains,
				topEntityNames,
				otherEntityNames,
				topSeriesNames,
				topColorBySeriesName,
				state
			})
		}
		case 'bar': {
			const { topEntityNames, otherEntityNames, topSeriesNames, topColorBySeriesName } =
				createStableColorChainSeriesUniverse({
					chartData,
					selectedNames: selectedChains,
					tieBreakByDatasetOrder: true
				})
			return buildBarPresentation({
				chartData,
				selectedNames: selectedChains,
				topEntityNames,
				otherEntityNames,
				topSeriesNames,
				topColorBySeriesName,
				state
			})
		}
		default:
			return assertNever(state)
	}
}

function createProtocolBreakdownSeriesUniverse({
	chartData,
	protocolNames,
	state,
	canonicalColorBySeriesName
}: {
	chartData: MultiSeriesTimeSeriesDataset
	protocolNames: Array<string>
	state: ChainsByAdapterBarState | ChainsByAdapterDominanceState
	canonicalColorBySeriesName?: Map<string, string>
}) {
	const latestRows = buildLatestValueRowsFromChartData({
		chartData,
		selectedNames: protocolNames,
		groupBy: state.groupBy
	})
	const rankingScores = new Map<string, number>()
	for (const row of latestRows) {
		if (row.total24h != null) rankingScores.set(row.name, row.total24h)
	}

	const orderedSeriesNames = orderSelectedNamesByRankingScores({
		chartData,
		selectedNames: protocolNames,
		rankingScores
	})
	return createProtocolSeriesUniverseFromRankedNames(orderedSeriesNames, canonicalColorBySeriesName)
}

function createProtocolSeriesUniverseFromRankedNames(
	orderedSeriesNames: Array<string>,
	canonicalColorBySeriesName?: Map<string, string>
) {
	const shouldAggregateOthers = orderedSeriesNames.length > MAX_PROTOCOL_BREAKDOWN_SERIES
	const topEntityNames = shouldAggregateOthers
		? orderedSeriesNames.slice(0, MAX_PROTOCOL_BREAKDOWN_SERIES - 1)
		: orderedSeriesNames
	const otherEntityNames = shouldAggregateOthers ? orderedSeriesNames.slice(MAX_PROTOCOL_BREAKDOWN_SERIES - 1) : []
	// A real series named "Others" belongs in the aggregate instead of colliding with its output dimension.
	const existingOthersIndex = topEntityNames.indexOf('Others')
	if (existingOthersIndex >= 0 && otherEntityNames.length > 0) {
		topEntityNames.splice(existingOthersIndex, 1)
		otherEntityNames.unshift('Others')
	}
	const topSeriesNames = otherEntityNames.length > 0 ? [...topEntityNames, 'Others'] : topEntityNames
	const topColorBySeriesName = getSeriesColors(topSeriesNames, canonicalColorBySeriesName)

	return {
		rankedEntityNames: orderedSeriesNames,
		topEntityNames,
		otherEntityNames,
		topSeriesNames,
		topColorBySeriesName
	}
}

function createStableColorProtocolSeriesUniverse({
	chartData,
	protocolNames,
	state
}: {
	chartData: MultiSeriesTimeSeriesDataset
	protocolNames: Array<string>
	state: ChainsByAdapterBarState | ChainsByAdapterDominanceState
}) {
	const cacheKey = `protocols:${state.chartKind}:${state.groupBy}`
	const cachedColors = getCachedCanonicalSeriesColors(chartData, cacheKey)
	const cachedOrder = getCachedCanonicalSeriesOrder(chartData, cacheKey)
	if (cachedColors && cachedOrder) {
		const selectedSet = new Set(protocolNames)
		return createProtocolSeriesUniverseFromRankedNames(
			cachedOrder.filter((name) => selectedSet.has(name)),
			cachedColors
		)
	}

	const hasFullSelection = hasEveryDatasetSeriesSelected(chartData, protocolNames)
	const fullUniverse = createProtocolBreakdownSeriesUniverse({
		chartData,
		protocolNames: hasFullSelection ? protocolNames : chartData.dimensions.slice(1),
		state
	})
	const canonicalColors = cacheCanonicalSeriesColors(chartData, cacheKey, fullUniverse.rankedEntityNames)
	return hasFullSelection
		? fullUniverse
		: createProtocolBreakdownSeriesUniverse({
				chartData,
				protocolNames,
				state,
				canonicalColorBySeriesName: canonicalColors
			})
}

export function buildAdapterByChainBreakdownPresentation({
	chartData,
	selectedProtocols,
	state
}: {
	chartData: MultiSeriesTimeSeriesDataset
	selectedProtocols: Array<string>
	state: ChainsByAdapterBarState | ChainsByAdapterDominanceState
}): ChainsByAdapterBarPresentation | ChainsByAdapterDominancePresentation {
	const { topEntityNames, otherEntityNames, topSeriesNames, topColorBySeriesName } =
		createStableColorProtocolSeriesUniverse({ chartData, protocolNames: selectedProtocols, state })

	switch (state.chartKind) {
		case 'dominance': {
			return buildDominancePresentation({
				chartData,
				selectedNames: selectedProtocols,
				topEntityNames,
				otherEntityNames,
				topSeriesNames,
				topColorBySeriesName,
				state
			})
		}
		case 'bar':
			return buildBarPresentation({
				chartData,
				selectedNames: selectedProtocols,
				topEntityNames,
				otherEntityNames,
				topSeriesNames,
				topColorBySeriesName,
				state
			})
		default:
			return assertNever(state)
	}
}

export function buildAdapterByChainLatestValuePresentation({
	chartKind,
	selectedProtocols,
	groupBy,
	chartData
}: {
	chartKind: 'treemap' | 'hbar'
	selectedProtocols: Array<string>
	groupBy: ChartTimeGroupingWithCumulative
	chartData: MultiSeriesTimeSeriesDataset
}): ChainsByAdapterTreemapPresentation | ChainsByAdapterHBarPresentation {
	const latestRows = buildLatestValueRowsFromChartData({
		chartData,
		selectedNames: selectedProtocols,
		groupBy
	})

	if (chartKind === 'treemap') {
		return {
			kind: 'treemap',
			csvSource: {
				type: 'dataset',
				prepare: () => buildLatestValuesCsvDataset({ latestRows, entityDimension: 'Protocol' })
			},
			data: buildTreemapPresentation({
				chartData,
				cacheKey: 'protocols',
				selectedNames: selectedProtocols,
				latestRows
			})
		}
	}

	return {
		kind: 'hbar',
		csvSource: {
			type: 'dataset',
			prepare: () => buildLatestValuesCsvDataset({ latestRows, entityDimension: 'Protocol' })
		},
		data: buildHBarPresentation({
			chartData,
			cacheKey: 'protocols',
			selectedNames: selectedProtocols,
			latestRows
		})
	}
}
