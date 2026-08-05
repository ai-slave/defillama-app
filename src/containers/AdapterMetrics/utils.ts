import type { ChartCsvSource } from '~/components/ChartExport/ChartCsvExportButton'
import type {
	MultiSeriesChartDataset,
	ChartTimeGroupingWithCumulative,
	MultiSeriesTimeSeriesDataset,
	MultiSeriesTimeSeriesRow,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { getBucketTimestampMs } from '~/components/ECharts/shared/timeSeries'
import { getNDistinctColors } from '~/utils'
import { formatFixedNumber } from '~/utils/numberFormat'
import { parseExcludeParam } from '~/utils/routerQuery'
import type { ADAPTER_TYPES } from './constants'
import type { IAdapterByChainPageData, IChainsByAdapterPageData, IProtocol } from './types'

export type OpenInterestData = { total24h: number | null; doublecounted: boolean }
export type ActiveLiquidityData = { total24h: number | null; doublecounted: boolean }
export type NormalizedVolumeData = { total24h: number | null }

/** Table/category filter: which protocol rows belong to the selected categories (including child protocols). */
export function getProtocolsByCategory(
	protocols: IAdapterByChainPageData['protocols'],
	categoriesToFilter: Array<string>
): IProtocol[] {
	const final: IProtocol[] = []
	const categorySet = new Set(categoriesToFilter)

	for (const protocol of protocols) {
		if (protocol.childProtocols) {
			const childProtocols: IProtocol[] = []
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

/** Leaf `name`s for breakdown filter: parents with children are omitted; children are included recursively. */
export function leafProtocolNamesFromTableRows(protocols: IProtocol[]): string[] {
	const leafProtocols: IProtocol[] = []
	const walk = (protocol: IProtocol) => {
		if (protocol.childProtocols && protocol.childProtocols.length > 0) {
			for (const childProtocol of protocol.childProtocols) {
				walk(childProtocol)
			}
			return
		}
		leafProtocols.push(protocol)
	}

	for (const protocol of protocols) {
		walk(protocol)
	}
	leafProtocols.sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))

	const names: string[] = []
	for (const protocol of leafProtocols) {
		names.push(protocol.name)
	}
	return names
}

export type CategoryProtocolNameFilter =
	| { kind: 'unrestricted' }
	| { kind: 'no-rows' }
	| { kind: 'restricted'; names: Set<string> }

/**
 * Same category selection rules as the adapter-by-chain table; used to align breakdown chart series with the table.
 */
export function getCategoryProtocolNameFilterForChart({
	categories,
	protocols,
	categoryParam,
	excludeCategoryParam,
	hasCategoryParam
}: {
	categories: string[]
	protocols: IProtocol[]
	categoryParam: string | string[] | undefined
	excludeCategoryParam: string | string[] | undefined
	hasCategoryParam: boolean
}): CategoryProtocolNameFilter {
	const excludeSet = parseExcludeParam(excludeCategoryParam)

	let selectedCategories =
		categories.length > 0 && hasCategoryParam && categoryParam === ''
			? []
			: categoryParam
				? typeof categoryParam === 'string'
					? [categoryParam]
					: categoryParam
				: categories

	if (excludeSet.size > 0) {
		const filteredCategories: string[] = []
		for (const category of selectedCategories) {
			if (!excludeSet.has(category)) filteredCategories.push(category)
		}
		selectedCategories = filteredCategories
	}

	const categoriesToFilter: string[] = []
	for (const category of selectedCategories) {
		const normalizedCategory = category.toLowerCase()
		if (normalizedCategory !== 'all' && normalizedCategory !== 'none') {
			categoriesToFilter.push(category)
		}
	}

	if (categories.length === 0) {
		return { kind: 'unrestricted' }
	}

	if (selectedCategories.length === 0) {
		return { kind: 'no-rows' }
	}

	if (categoriesToFilter.length > 0) {
		const filtered = getProtocolsByCategory(protocols, categoriesToFilter)
		return { kind: 'restricted', names: new Set(leafProtocolNamesFromTableRows(filtered)) }
	}

	return { kind: 'unrestricted' }
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
	const toChartPointMap = (points: Array<[number, number]>) => {
		const map = new Map<number, number>()
		for (const [timestamp, value] of points) {
			map.set(timestamp * 1e3, value)
		}
		return map
	}

	const primaryDataMap = toChartPointMap(primaryChartData)
	const primaryDimensionLabel = metricName

	const secondaryDimensionLabel =
		adapterType === 'derivatives' ? 'Open Interest' : adapterType === 'normalized-volume' ? 'Active Liquidity' : null

	const secondarySourceData =
		adapterType === 'derivatives'
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
	aliasesByCanonicalName: Record<string, string[]>
	signature: string
}

export function buildProtocolBreakdownNormalization(protocols: IProtocol[]): ProtocolBreakdownNormalization {
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
	const aliasEntries: Array<[string, string[]]> = Array.from(aliasesByCanonicalName.entries())
		.toSorted((a, b) => a[0].localeCompare(b[0]))
		.map(([canonicalName, aliases]) => [canonicalName, Array.from(aliases).toSorted((a, b) => a.localeCompare(b))])
	const canonicalRecord: Record<string, string> = Object.fromEntries(canonicalEntries)
	const aliasesRecord: Record<string, string[]> = Object.fromEntries(aliasEntries)

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
	protocolDimensions: string[]
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

	const protocolDimensions: string[] = []
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
	charts: MultiSeriesChartSeriesConfig[]
	valueMode: ChainsByAdapterValueMode
	barLayout: ChainsByAdapterBarLayout
	showTotalInTooltip: boolean
	groupBy: ChartTimeGroupingWithCumulative
}

type ChainsByAdapterDominancePresentation = {
	kind: 'dominance'
	csvSource: ChartCsvSource
	dataset: MultiSeriesTimeSeriesDataset
	charts: MultiSeriesChartSeriesConfig[]
	groupBy: ChartTimeGroupingWithCumulative
}

type ChainsByAdapterTreemapPresentation = {
	kind: 'treemap'
	csvSource: ChartCsvSource
	data: ChainsByAdapterLatestValueDatum[]
}

type ChainsByAdapterHBarPresentation = {
	kind: 'hbar'
	csvSource: ChartCsvSource
	data: ChainsByAdapterLatestValueDatum[]
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
const MAX_BREAKDOWN_SERIES = 10
const MAX_PROTOCOL_BREAKDOWN_SERIES = 30
const MAX_TREEMAP_ITEMS = 100
const MAX_CHAINS_BY_ADAPTER_HBAR_ITEMS = 9
const MIN_COMPLETE_DAILY_GAP_MS = 23 * 60 * 60 * 1000

function getPaletteColor(colors: string[], index: number): string {
	const color = colors[index]
	if (color === undefined) throw new Error(`Generated palette is missing color ${index}`)
	return color
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
	selectedNames: string[]
	rankingScores?: Map<string, number>
	tieBreakByDatasetOrder?: boolean
	canonicalColorBySeriesName?: Map<string, string>
}) {
	const entityTotals = new Map<string, number>()
	const dimensionIndexes = getSeriesDimensionIndexes(chartData)
	const selectedSeriesNames: string[] = []
	const selectedDimensionIndexes: number[] = []
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
	rankedEntityNames: string[],
	canonicalColorBySeriesName?: Map<string, string>
) {
	const topEntityNames: string[] = []
	const otherEntityNames: string[] = []
	for (let index = 0; index < rankedEntityNames.length; index++) {
		const entity = rankedEntityNames[index]
		if (entity === undefined) continue
		if (index < MAX_BREAKDOWN_SERIES) {
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
	const topColors = getNDistinctColors(topSeriesNames.length || 1)
	const topColorBySeriesName = new Map<string, string>()
	for (let index = 0; index < topSeriesNames.length; index++) {
		const name = topSeriesNames[index]
		if (name === undefined) continue
		topColorBySeriesName.set(name, canonicalColorBySeriesName?.get(name) ?? getPaletteColor(topColors, index))
	}

	return {
		rankedEntityNames,
		topEntityNames,
		otherEntityNames,
		topSeriesNames,
		topColorBySeriesName
	}
}

const canonicalSeriesColorsCache = new WeakMap<MultiSeriesTimeSeriesDataset, Map<string, Map<string, string>>>()
const canonicalSeriesOrderCache = new WeakMap<MultiSeriesTimeSeriesDataset, Map<string, string[]>>()

function getCachedCanonicalSeriesColors(chartData: MultiSeriesTimeSeriesDataset, cacheKey: string) {
	return canonicalSeriesColorsCache.get(chartData)?.get(cacheKey)
}

function getCachedCanonicalSeriesOrder(chartData: MultiSeriesTimeSeriesDataset, cacheKey: string) {
	return canonicalSeriesOrderCache.get(chartData)?.get(cacheKey)
}

function cacheCanonicalSeriesColors(
	chartData: MultiSeriesTimeSeriesDataset,
	cacheKey: string,
	rankedEntityNames: string[],
	topColorBySeriesName: Map<string, string>
) {
	const colorBySeriesName = new Map(topColorBySeriesName)
	for (let index = 0; index < rankedEntityNames.length; index++) {
		const name = rankedEntityNames[index]
		if (name === undefined) continue
		// The default top-N retains its authored palette. Overflow peers use a stable
		// rank-derived hue without generating an O(n²) distinct palette for 2k+ series.
		if (!colorBySeriesName.has(name)) {
			colorBySeriesName.set(name, `hsl(${formatFixedNumber((index * 137.508) % 360, 2)}, 68%, 48%)`)
		}
	}
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
	selectedNames: string[]
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
	const canonicalColors = cacheCanonicalSeriesColors(
		chartData,
		cacheKey,
		fullUniverse.rankedEntityNames,
		fullUniverse.topColorBySeriesName
	)
	return hasFullSelection
		? fullUniverse
		: createRankedSeriesUniverse({
				chartData,
				selectedNames,
				tieBreakByDatasetOrder,
				canonicalColorBySeriesName: canonicalColors
			})
}

function hasEveryDatasetSeriesSelected(chartData: MultiSeriesTimeSeriesDataset, selectedNames: string[]): boolean {
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
	selectedNames: string[]
}) {
	const selectedSet = new Set(selectedNames)
	const selectedSeriesNames: string[] = []
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
	selectedNames: string[]
	rankingScores?: Map<string, number>
}) {
	const selectedSeriesNames = getOrderedSelectedSeriesNames({ chartData, selectedNames })
	const totals = new Map<string, number>()
	const dimensionIndexes = getSeriesDimensionIndexes(chartData)
	const namesWithDimensions: string[] = []
	const selectedDimensionIndexes: number[] = []
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
	topEntityNames: string[]
	otherEntityNames: string[]
	seriesNames: string[]
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
	const otherEntityIndexes: number[] = []
	if (otherEntitySet) {
		for (const name of otherEntityNames) {
			const dimensionIndex = dimensionIndexes.get(name)
			if (dimensionIndex !== undefined) otherEntityIndexes.push(dimensionIndex)
		}
	}
	const otherEntityIndexSet = new Set(otherEntityIndexes)
	const complementEntityIndexes: number[] = []
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
export function buildAdapterMetricsCsvDataset({
	chartData,
	state
}: {
	chartData: MultiSeriesTimeSeriesDataset
	state: ChainsByAdapterBarState | ChainsByAdapterDominanceState
}): MultiSeriesTimeSeriesDataset {
	if (state.chartKind === 'bar' && state.groupBy === 'daily' && state.valueMode === 'absolute') return chartData

	const seriesNames = chartData.dimensions.slice(1)
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
	topEntityNames,
	otherEntityNames,
	topSeriesNames,
	topColorBySeriesName,
	state
}: {
	chartData: MultiSeriesTimeSeriesDataset
	topEntityNames: string[]
	otherEntityNames: string[]
	topSeriesNames: string[]
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
			type: 'prepare-dataset',
			prepare: () => buildAdapterMetricsCsvDataset({ chartData, state })
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
	topEntityNames,
	otherEntityNames,
	topSeriesNames,
	topColorBySeriesName,
	state
}: {
	chartData: MultiSeriesTimeSeriesDataset
	topEntityNames: string[]
	otherEntityNames: string[]
	topSeriesNames: string[]
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
			type: 'prepare-dataset',
			prepare: () => buildAdapterMetricsCsvDataset({ chartData, state })
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
	selectedNames: string[]
	latestRows: BreakdownLatestValueRow[]
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
let latestValueColors: string[] | null = null

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
		const colors = (latestValueColors ??= getNDistinctColors(MAX_TREEMAP_ITEMS + 1))
		colorBySeriesName = new Map<string, string>()
		let peerIndex = 0
		for (let dimensionIndex = 1; dimensionIndex < chartData.dimensions.length; dimensionIndex++) {
			const name = chartData.dimensions[dimensionIndex]
			if (name === undefined) continue
			if (name === 'Others') continue
			const colorIndex = peerIndex < MAX_CHAINS_BY_ADAPTER_HBAR_ITEMS ? peerIndex : peerIndex + 1
			colorBySeriesName.set(
				name,
				colors[colorIndex] ?? `hsl(${formatFixedNumber((peerIndex * 137.508) % 360, 2)}, 68%, 48%)`
			)
			peerIndex++
		}
		colorBySeriesName.set('Others', getPaletteColor(colors, MAX_CHAINS_BY_ADAPTER_HBAR_ITEMS))
		datasetCache.set(cacheKey, colorBySeriesName)
	}
	return colorBySeriesName
}

function decorateLatestValues(
	values: Array<{ name: string; value: number }>,
	total: number,
	colorBySeriesName: Map<string, string>
): ChainsByAdapterLatestValueDatum[] {
	const data: ChainsByAdapterLatestValueDatum[] = []
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
	selectedNames: string[]
	latestRows: BreakdownLatestValueRow[]
}): ChainsByAdapterLatestValueDatum[] {
	const { values, total } = buildRankedLatestValues({ selectedNames, latestRows })
	const colorBySeriesName = getLatestValueSeriesColors({ chartData, cacheKey })
	return decorateLatestValues(values, total, colorBySeriesName)
}

function buildNullLatestRows(selectedNames: string[]): BreakdownLatestValueRow[] {
	const rows: BreakdownLatestValueRow[] = []
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
	selectedNames: string[]
}): BreakdownLatestValueRow[] {
	const totals = new Map<string, number>()
	const pointCounts = new Map<string, number>()
	const selectedSeriesNames: string[] = []
	const selectedDimensionIndexes: number[] = []
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

	const rows: BreakdownLatestValueRow[] = []
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
	selectedNames: string[]
	groupBy: ChartTimeGroupingWithCumulative
}): BreakdownLatestValueRow[] {
	if (groupBy === 'daily') {
		const sourceRow = getEffectiveDailyLatestRow(chartData)
		if (!sourceRow) {
			return buildNullLatestRows(selectedNames)
		}

		const rows: BreakdownLatestValueRow[] = []
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
	const selectedSeriesNames: string[] = []
	const selectedDimensionIndexes: number[] = []
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

	const rows: BreakdownLatestValueRow[] = []
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

function buildLatestValuesCsvDataset({
	chartData,
	groupBy,
	entityDimension
}: {
	chartData: MultiSeriesTimeSeriesDataset
	groupBy: ChartTimeGroupingWithCumulative
	entityDimension: 'Chain' | 'Protocol'
}): MultiSeriesChartDataset {
	const names = chartData.dimensions.slice(1)
	const latestRows = buildLatestValueRowsFromChartData({ chartData, selectedNames: names, groupBy })
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
	selectedNames: string[]
	latestRows: BreakdownLatestValueRow[]
}): ChainsByAdapterLatestValueDatum[] {
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
	selectedChains: string[]
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
					type: 'prepare-dataset',
					prepare: () =>
						buildLatestValuesCsvDataset({
							chartData,
							groupBy: state.groupBy,
							entityDimension: 'Chain'
						})
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
					type: 'prepare-dataset',
					prepare: () =>
						buildLatestValuesCsvDataset({
							chartData,
							groupBy: state.groupBy,
							entityDimension: 'Chain'
						})
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
	protocolNames: string[]
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
	orderedSeriesNames: string[],
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
	const topColors = getNDistinctColors(topSeriesNames.length || 1)
	const topColorBySeriesName = new Map<string, string>()
	for (let index = 0; index < topSeriesNames.length; index++) {
		const name = topSeriesNames[index]
		if (name === undefined) continue
		topColorBySeriesName.set(name, canonicalColorBySeriesName?.get(name) ?? getPaletteColor(topColors, index))
	}

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
	protocolNames: string[]
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
	const canonicalColors = cacheCanonicalSeriesColors(
		chartData,
		cacheKey,
		fullUniverse.rankedEntityNames,
		fullUniverse.topColorBySeriesName
	)
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
	selectedProtocols: string[]
	state: ChainsByAdapterBarState | ChainsByAdapterDominanceState
}): ChainsByAdapterBarPresentation | ChainsByAdapterDominancePresentation {
	const { topEntityNames, otherEntityNames, topSeriesNames, topColorBySeriesName } =
		createStableColorProtocolSeriesUniverse({ chartData, protocolNames: selectedProtocols, state })

	switch (state.chartKind) {
		case 'dominance': {
			return buildDominancePresentation({
				chartData,
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
	selectedProtocols: string[]
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
				type: 'prepare-dataset',
				prepare: () => buildLatestValuesCsvDataset({ chartData, groupBy, entityDimension: 'Protocol' })
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
			type: 'prepare-dataset',
			prepare: () => buildLatestValuesCsvDataset({ chartData, groupBy, entityDimension: 'Protocol' })
		},
		data: buildHBarPresentation({
			chartData,
			cacheKey: 'protocols',
			selectedNames: selectedProtocols,
			latestRows
		})
	}
}
