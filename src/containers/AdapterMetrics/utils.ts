import type {
	ChartTimeGroupingWithCumulative,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { getBucketTimestampMs } from '~/components/ECharts/shared/timeSeries'
import type { FeeExtraPeriodTotals } from '~/metrics/feeExtras'
import { getNDistinctColors, slug } from '~/utils'
import { parseExcludeParam } from '~/utils/routerQuery'
import type { IAdapterChainMetrics } from './api.types'
import type { ADAPTER_TYPES } from './constants'
import { mergeMetricPeriods, type MetricPeriodFields } from './metricPeriods'
import type { IAdapterByChainPageData, IChainsByAdapterPageData, IProtocol } from './types'

export type BribesData = FeeExtraPeriodTotals
export type OpenInterestData = { total24h: number | null; doublecounted: boolean }
export type ActiveLiquidityData = { total24h: number | null; doublecounted: boolean }
export type NormalizedVolumeData = { total24h: number | null }

type AggregatedProtocol = Omit<
	IAdapterChainMetrics['protocols'][0],
	| 'total24h'
	| 'total48hto24h'
	| 'total7d'
	| 'total14dto7d'
	| 'total30d'
	| 'total60dto30d'
	| 'total7DaysAgo'
	| 'total30DaysAgo'
	| 'total1y'
	| 'annualized1y'
	| 'totalAllTime'
	| 'change_1d'
	| 'change_7d'
	| 'change_1m'
	| 'change_7dover7d'
	| 'change_30dover30d'
> & {
	total24h: number | null
	total48hto24h: number | null
	total7d: number | null
	total14dto7d: number | null
	total30d: number | null
	total60dto30d: number | null
	total7DaysAgo: number | null
	total30DaysAgo: number | null
	total1y: number | null
	annualized1y: number | null
	totalAllTime: number | null
	change_1d: number | null
	change_7d: number | null
	change_1m: number | null
	change_7dover7d: number | null
	change_30dover30d: number | null
}

export function aggregateProtocolVersions(protocolVersions: IAdapterChainMetrics['protocols']): AggregatedProtocol {
	const breakdowns24h: Record<string, Record<string, number>>[] = []
	const breakdowns30d: Record<string, Record<string, number>>[] = []
	let aggregatedRevenue: MetricPeriodFields = {}
	for (const p of protocolVersions) {
		aggregatedRevenue = mergeMetricPeriods(aggregatedRevenue, p)
		if (p.breakdown24h) breakdowns24h.push(p.breakdown24h)
		if (p.breakdown30d) breakdowns30d.push(p.breakdown30d)
	}
	const mergedBreakdown24h = mergeBreakdowns(breakdowns24h)
	const mergedBreakdown30d = mergeBreakdowns(breakdowns30d)

	const parentProtocol = protocolVersions[0]
	const chains = new Set<string>()
	for (const protocol of protocolVersions) {
		for (const chain of protocol.chains) {
			chains.add(chain)
		}
	}

	return {
		...parentProtocol,
		name: parentProtocol.linkedProtocols?.[0] || parentProtocol.parentProtocol || parentProtocol.name,
		displayName: parentProtocol.linkedProtocols?.[0] || parentProtocol.parentProtocol || parentProtocol.displayName,
		slug: slug(parentProtocol.linkedProtocols?.[0] || parentProtocol.parentProtocol || parentProtocol.name),
		...aggregatedRevenue,
		annualized1y: aggregatedRevenue.annualized1y ?? null,
		chains: Array.from(chains),
		breakdown24h: mergedBreakdown24h,
		breakdown30d: mergedBreakdown30d
	}
}

export function mergeBreakdowns(breakdowns: Record<string, Record<string, number>>[]) {
	const merged = {}
	for (const breakdown of breakdowns) {
		if (!breakdown) continue
		for (const chainName in breakdown) {
			const protocolData = breakdown[chainName]
			if (!merged[chainName]) {
				merged[chainName] = {}
			}
			for (const protocolName in protocolData) {
				const value = protocolData[protocolName]
				merged[chainName][protocolName] = (merged[chainName][protocolName] || 0) + value
			}
		}
	}
	return merged
}

export function groupProtocolsByParent<T extends { parentProtocol?: string; defillamaId: string }>(
	protocols: T[]
): Map<string, T[]> {
	const protocolGroups = new Map<string, T[]>()

	for (const protocol of protocols) {
		const parentKey = protocol.parentProtocol || protocol.defillamaId
		if (!protocolGroups.has(parentKey)) {
			protocolGroups.set(parentKey, [])
		}
		protocolGroups.get(parentKey)!.push(protocol)
	}

	return protocolGroups
}

export function processGroupedProtocols<T, R>(
	protocolGroups: Map<string, T[]>,
	processor: (protocolVersions: T[], parentKey: string) => R
): R[] {
	const processedData: R[] = []
	for (const [parentKey, protocolVersions] of protocolGroups) {
		processedData.push(processor(protocolVersions, parentKey))
	}
	return processedData
}

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

export function processRevenueDataForMatching(protocols: IAdapterChainMetrics['protocols']) {
	const protocolGroups = groupProtocolsByParent(protocols)

	return processGroupedProtocols(protocolGroups, (protocolVersions, parentKey) => {
		if (protocolVersions.length === 1) {
			return {
				...protocolVersions[0],
				parentKey,
				groupedName:
					protocolVersions[0].linkedProtocols?.[0] || protocolVersions[0].parentProtocol || protocolVersions[0].name
			}
		} else {
			const aggregatedProtocol = aggregateProtocolVersions(protocolVersions)
			return {
				...aggregatedProtocol,
				parentKey,
				groupedName:
					aggregatedProtocol.linkedProtocols?.[0] || aggregatedProtocol.parentProtocol || aggregatedProtocol.name
			}
		}
	})
}

export function matchRevenueToEarnings(
	revenueData: Array<{
		parentKey: string
		name: string
		displayName: string
		defillamaId: string
		groupedName: string
		total24h: number | null
		total48hto24h?: number | null
		total7d: number | null
		total14dto7d?: number | null
		total30d: number | null
		total60dto30d?: number | null
		total7DaysAgo?: number | null
		total30DaysAgo?: number | null
		total1y: number | null
		totalAllTime: number | null
	}>,
	earningsProtocols: Array<{
		parentProtocol: string
		defillamaId: string
		name: string
		displayName: string
	}>
) {
	const matchedData = {}

	for (const revenueProtocol of revenueData) {
		const matchingEarningsProtocol = earningsProtocols.find((earningsProto) => {
			const earningsParentKey = earningsProto.parentProtocol || earningsProto.defillamaId

			return (
				earningsParentKey === revenueProtocol.parentKey ||
				earningsProto.name === revenueProtocol.name ||
				earningsProto.displayName === revenueProtocol.displayName ||
				earningsProto.defillamaId === revenueProtocol.defillamaId ||
				earningsProto.name === revenueProtocol.groupedName ||
				earningsProto.displayName === revenueProtocol.groupedName
			)
		})

		if (matchingEarningsProtocol) {
			matchedData[matchingEarningsProtocol.name] = {
				total24h: revenueProtocol.total24h ?? null,
				total48hto24h: revenueProtocol.total48hto24h ?? null,
				total7d: revenueProtocol.total7d ?? null,
				total14dto7d: revenueProtocol.total14dto7d ?? null,
				total30d: revenueProtocol.total30d ?? null,
				total60dto30d: revenueProtocol.total60dto30d ?? null,
				total7DaysAgo: revenueProtocol.total7DaysAgo ?? null,
				total30DaysAgo: revenueProtocol.total30DaysAgo ?? null,
				total1y: revenueProtocol.total1y ?? null,
				totalAllTime: revenueProtocol.totalAllTime ?? null
			}
		}
	}

	return matchedData
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
}): MultiSeriesChartDataset {
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

	const source: MultiSeriesChartDataset['source'] = []
	for (const timestamp of sortedTimestamps) {
		if (hasSecondarySeries && secondaryDimensionLabel) {
			source.push([timestamp, primaryDataMap.get(timestamp) ?? null, secondaryDataMap.get(timestamp) ?? null])
			continue
		}

		source.push([timestamp, primaryDataMap.get(timestamp) ?? null])
	}

	return {
		source,
		dimensions: hasSecondarySeries
			? ['timestamp', primaryDimensionLabel, secondaryDimensionLabel as string]
			: ['timestamp', primaryDimensionLabel]
	}
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message)
	}
}

function toChartTimestamp(timestamp: number) {
	return timestamp < 1e12 ? timestamp * 1e3 : timestamp
}

export function mergeSingleDimensionChartDataset({
	chartData,
	extraCharts
}: {
	chartData: MultiSeriesChartDataset
	extraCharts: Array<Array<[number, number]>>
}): MultiSeriesChartDataset {
	assert(chartData.dimensions[0] === 'timestamp', 'Expected timestamp dimension')
	assert(chartData.dimensions.length === 2, 'Expected a single chart dimension')
	if (extraCharts.every((chart) => chart.length === 0)) return chartData

	const dimension = chartData.dimensions[1]
	const rows = new Map<number, number | null>()

	for (const row of chartData.source) {
		rows.set(row[0] as number, (row[1] as number | null | undefined) ?? null)
	}

	for (const extraChart of extraCharts) {
		for (const [timestamp, value] of extraChart) {
			const chartTimestamp = toChartTimestamp(timestamp)
			rows.set(chartTimestamp, (rows.get(chartTimestamp) ?? 0) + value)
		}
	}

	const source: MultiSeriesChartDataset['source'] = []
	const sortedRows = Array.from(rows.entries()).sort((a, b) => a[0] - b[0])
	for (const [timestamp, value] of sortedRows) {
		source.push([timestamp, value])
	}

	return {
		dimensions: ['timestamp', dimension],
		source
	}
}

export function mergeBreakdownCharts({
	chart,
	extraCharts
}: {
	chart: Array<[number, Record<string, number>]>
	extraCharts: Array<Array<[number, Record<string, number>]>>
}): Array<[number, Record<string, number>]> {
	const rows = new Map<number, Record<string, number>>()

	const mergeChart = (input: Array<[number, Record<string, number>]>) => {
		for (const [timestamp, values] of input) {
			const row = rows.get(timestamp) ?? {}
			for (const key in values) {
				row[key] = (row[key] ?? 0) + values[key]
			}
			rows.set(timestamp, row)
		}
	}

	mergeChart(chart)
	for (const extraChart of extraCharts) {
		mergeChart(extraChart)
	}

	return Array.from(rows.entries()).sort((a, b) => a[0] - b[0])
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

	const canonicalRecord = {}
	for (const [seriesName, canonicalName] of Array.from(canonicalBySeriesName.entries()).toSorted((a, b) =>
		a[0].localeCompare(b[0])
	)) {
		canonicalRecord[seriesName] = canonicalName
	}

	const aliasesRecord = {}
	for (const [canonicalName, aliases] of Array.from(aliasesByCanonicalName.entries()).toSorted((a, b) =>
		a[0].localeCompare(b[0])
	)) {
		aliasesRecord[canonicalName] = Array.from(aliases).toSorted((a, b) => a.localeCompare(b))
	}

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
	chartData: MultiSeriesChartDataset
	protocolDimensions: string[]
} {
	const protocolValuesByTimestamp = new Map<number, Map<string, number>>()
	const protocolTotals = new Map<string, number>()

	for (const [timestamp, protocolValues] of chart) {
		const valuesAtTimestamp = new Map<string, number>()

		let hasValues = false
		for (const protocolName in protocolValues) {
			const value = protocolValues[protocolName]
			const canonicalName = normalization.canonicalBySeriesName[protocolName]
			if (!canonicalName) continue

			valuesAtTimestamp.set(canonicalName, (valuesAtTimestamp.get(canonicalName) ?? 0) + value)
			protocolTotals.set(canonicalName, (protocolTotals.get(canonicalName) ?? 0) + value)
			hasValues = true
		}

		if (hasValues) {
			protocolValuesByTimestamp.set(timestamp * 1e3, valuesAtTimestamp)
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

	const source: MultiSeriesChartDataset['source'] = []
	// The endpoint is ascending and sparse. Keep that shape until the final visible series are known.
	for (const [timestamp, valuesAtTimestamp] of protocolValuesByTimestamp) {
		const row = new Array<number | null>(protocolDimensions.length + 1).fill(null)
		row[0] = timestamp
		for (let i = 0; i < protocolDimensions.length; i++) {
			row[i + 1] = valuesAtTimestamp.get(protocolDimensions[i]) ?? null
		}
		source.push(row)
	}

	return {
		chartData: {
			source,
			dimensions: ['timestamp', ...protocolDimensions]
		},
		protocolDimensions
	}
}

export function mergeNamedDimensionChartDataset({
	chartData,
	extraCharts,
	allowedDimensions
}: {
	chartData: MultiSeriesChartDataset
	extraCharts: Array<Array<[number, Record<string, number>]>>
	allowedDimensions?: string[]
}): MultiSeriesChartDataset {
	assert(chartData.dimensions[0] === 'timestamp', 'Expected timestamp dimension')
	if (extraCharts.every((chart) => chart.length === 0)) return chartData

	const dimensions: string[] = []
	for (const dimension of chartData.dimensions) {
		if (dimension !== 'timestamp') dimensions.push(dimension)
	}
	const allowedDimensionSet = allowedDimensions ? new Set(allowedDimensions) : null
	const dimensionByLowercase = new Map<string, string>()
	for (const dimension of dimensions) {
		dimensionByLowercase.set(dimension.toLowerCase(), dimension)
	}
	const rows = new Map<number, Map<string, number | null>>()

	for (const row of chartData.source) {
		const timestamp = row[0] as number
		const nextRow = new Map<string, number | null>()
		for (let i = 0; i < dimensions.length; i++) {
			nextRow.set(dimensions[i], (row[i + 1] as number | null | undefined) ?? null)
		}
		rows.set(timestamp, nextRow)
	}

	const getExtraDimension = (key: string) => {
		const existingDimension = dimensionByLowercase.get(key.toLowerCase())
		if (existingDimension != null) {
			return existingDimension === key ? existingDimension : null
		}
		if (allowedDimensionSet && !allowedDimensionSet.has(key)) {
			return null
		}

		dimensions.push(key)
		dimensionByLowercase.set(key.toLowerCase(), key)
		return key
	}

	for (const extraChart of extraCharts) {
		for (const [timestamp, values] of extraChart) {
			const chartTimestamp = toChartTimestamp(timestamp)
			const row = rows.get(chartTimestamp) ?? new Map<string, number | null>()

			for (const key in values) {
				const dimension = getExtraDimension(key)
				if (!dimension) continue
				row.set(dimension, (row.get(dimension) ?? 0) + values[key])
			}

			rows.set(chartTimestamp, row)
		}
	}

	const source: MultiSeriesChartDataset['source'] = []
	for (const [timestamp, values] of Array.from(rows.entries()).sort((a, b) => a[0] - b[0])) {
		const nextRow = new Array<number | null>(dimensions.length + 1)
		nextRow[0] = timestamp
		for (let i = 0; i < dimensions.length; i++) {
			nextRow[i + 1] = values.get(dimensions[i]) ?? null
		}
		source.push(nextRow)
	}

	return {
		dimensions: ['timestamp', ...dimensions],
		source
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
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesChartSeriesConfig[]
	valueMode: ChainsByAdapterValueMode
	barLayout: ChainsByAdapterBarLayout
	showTotalInTooltip: boolean
	groupBy: ChartTimeGroupingWithCumulative
}

type ChainsByAdapterDominancePresentation = {
	kind: 'dominance'
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesChartSeriesConfig[]
	groupBy: ChartTimeGroupingWithCumulative
}

type ChainsByAdapterTreemapPresentation = {
	kind: 'treemap'
	data: ChainsByAdapterLatestValueDatum[]
}

type ChainsByAdapterHBarPresentation = {
	kind: 'hbar'
	data: ChainsByAdapterLatestValueDatum[]
}

export type ChainsByAdapterChartPresentation =
	| ChainsByAdapterBarPresentation
	| ChainsByAdapterDominancePresentation
	| ChainsByAdapterTreemapPresentation
	| ChainsByAdapterHBarPresentation

type ChainsByAdapterBarState = Extract<ChainsByAdapterChartState, { chartKind: 'bar' }>
type ChainsByAdapterDominanceState = Extract<ChainsByAdapterChartState, { chartKind: 'dominance' }>
type LatestValueSeriesType = 'bar' | 'dominance'

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

function getLatestTimestampMsInDataset(chartData: MultiSeriesChartDataset): number | null {
	const lastRow = chartData.source[chartData.source.length - 1]
	return lastRow ? (lastRow[0] as number) : null
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
	rankingScores
}: {
	chartData: MultiSeriesChartDataset
	selectedNames: string[]
	rankingScores?: Map<string, number>
}) {
	const entityTotals = new Map<string, number>()
	const selectedIndexes = selectedNames.map((name) => chartData.dimensions.indexOf(name))

	for (const row of chartData.source) {
		for (let i = 0; i < selectedNames.length; i++) {
			const entity = selectedNames[i]
			const value = row[selectedIndexes[i]] as number | null | undefined
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
		return b[1] - a[1]
	})
	const topEntityNames: string[] = []
	const otherEntityNames: string[] = []
	for (let i = 0; i < ranked.length; i++) {
		const entity = ranked[i][0]
		if (i < MAX_BREAKDOWN_SERIES) {
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
	const topColorBySeriesName = Object.fromEntries(topSeriesNames.map((name, index) => [name, topColors[index]]))

	return {
		topEntityNames,
		otherEntityNames,
		topSeriesNames,
		topColorBySeriesName
	}
}

function getOrderedSelectedSeriesNames({
	chartData,
	selectedNames
}: {
	chartData: MultiSeriesChartDataset
	selectedNames: string[]
}) {
	const selectedSet = new Set(selectedNames)
	const selectedSeriesNames: string[] = []
	for (const dimension of chartData.dimensions) {
		if (dimension !== 'timestamp' && selectedSet.has(dimension)) {
			selectedSeriesNames.push(dimension)
		}
	}
	return selectedSeriesNames
}

function orderSelectedNamesByRankingScores({
	chartData,
	selectedNames,
	rankingScores
}: {
	chartData: MultiSeriesChartDataset
	selectedNames: string[]
	rankingScores?: Map<string, number>
}) {
	const selectedSeriesNames = getOrderedSelectedSeriesNames({ chartData, selectedNames })
	const totals = new Map<string, number>()
	const selectedIndexes = selectedSeriesNames.map((name) => chartData.dimensions.indexOf(name))
	for (const row of chartData.source) {
		for (let i = 0; i < selectedSeriesNames.length; i++) {
			const value = row[selectedIndexes[i]] as number | null | undefined
			if (value != null) totals.set(selectedSeriesNames[i], (totals.get(selectedSeriesNames[i]) ?? 0) + value)
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

function buildGroupedFlowDataset({
	chartData,
	topEntityNames,
	otherEntityNames,
	seriesNames,
	groupBy,
	relative
}: {
	chartData: MultiSeriesChartDataset
	topEntityNames: string[]
	otherEntityNames: string[]
	seriesNames: string[]
	groupBy: ChartTimeGroupingWithCumulative
	relative: boolean
}): MultiSeriesChartDataset {
	const isDaily = groupBy === 'daily'
	const isCumulative = groupBy === 'cumulative'
	const cumulativeTotals = isCumulative ? new Array<number>(seriesNames.length).fill(0) : null
	const hasCumulativeValue = isCumulative ? new Array<boolean>(seriesNames.length).fill(false) : null
	const otherEntitySet = otherEntityNames.length > 0 ? new Set(otherEntityNames) : null
	const dimensionIndexes = new Map<string, number>()
	for (let i = 1; i < chartData.dimensions.length; i++) dimensionIndexes.set(chartData.dimensions[i], i)
	const topEntityIndexes = topEntityNames.map((name) => dimensionIndexes.get(name)!)
	const otherEntityIndexes = otherEntitySet
		? otherEntityNames.map((name) => dimensionIndexes.get(name)).filter((index): index is number => index != null)
		: []
	const source: MultiSeriesChartDataset['source'] = []
	let bucketTimestamp: number | null = null
	let bucketValues: Array<number | undefined> | null = null

	const pushBucket = () => {
		if (bucketTimestamp == null || !bucketValues) return
		let relativeTotal = 0

		for (let index = 0; index < seriesNames.length; index++) {
			let value = bucketValues[index]
			if (cumulativeTotals) {
				if (value != null) {
					cumulativeTotals[index] += value
					hasCumulativeValue![index] = true
				} else if (!hasCumulativeValue![index]) {
					continue
				}
				value = cumulativeTotals[index]
				bucketValues[index] = cumulativeTotals[index]
			} else if (value == null) {
				continue
			}
			if (relative && value > 0) relativeTotal += value
		}

		const nextRow = new Array<number | null>(seriesNames.length + 1)
		nextRow[0] = bucketTimestamp
		for (let index = 0; index < seriesNames.length; index++) {
			const value = bucketValues[index]
			const finalValue =
				relative && value != null ? (relativeTotal > 0 ? (Math.max(value, 0) / relativeTotal) * 100 : 0) : value
			nextRow[index + 1] = finalValue ?? null
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

	for (const row of chartData.source) {
		const timestamp = row[0] as number
		const nextBucketTimestamp = isDaily || isCumulative ? timestamp : getBucketTimestampMs(timestamp, groupBy)

		for (let index = 0; index < topEntityNames.length; index++) {
			const value = row[topEntityIndexes[index]] as number | null | undefined
			if (value == null) continue
			const values = ensureBucket(nextBucketTimestamp)
			values[index] = isDaily ? value : (values[index] ?? 0) + value
		}

		if (otherEntitySet) {
			let othersValue = 0
			let hasOthersValue = false
			for (const dimensionIndex of otherEntityIndexes) {
				const value = row[dimensionIndex] as number | null | undefined
				if (value == null) continue
				othersValue += value
				hasOthersValue = true
			}
			if (hasOthersValue) {
				const values = ensureBucket(nextBucketTimestamp)
				const othersIndex = seriesNames.length - 1
				values[othersIndex] = (values[othersIndex] ?? 0) + othersValue
			}
		}
	}
	pushBucket()

	return { source, dimensions: ['timestamp', ...seriesNames] }
}

function buildBarPresentation({
	chartData,
	topEntityNames,
	otherEntityNames,
	topSeriesNames,
	topColorBySeriesName,
	state
}: {
	chartData: MultiSeriesChartDataset
	topEntityNames: string[]
	otherEntityNames: string[]
	topSeriesNames: string[]
	topColorBySeriesName: Record<string, string>
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
		dataset: finalDataset,
		charts: topSeriesNames.map((seriesName) => ({
			type: isCumulative ? 'line' : 'bar',
			name: seriesName,
			encode: { x: 'timestamp', y: seriesName },
			...(!isCumulative && state.barLayout === 'stacked' ? { stack: 'chain' as const, large: false } : {}),
			...(isCumulative && topSeriesNames.length > 1 ? { hideAreaStyle: true } : {}),
			color: topColorBySeriesName[seriesName]
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
	chartData: MultiSeriesChartDataset
	topEntityNames: string[]
	otherEntityNames: string[]
	topSeriesNames: string[]
	topColorBySeriesName: Record<string, string>
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
		dataset: relativeDataset,
		charts: topSeriesNames.map((seriesName) => ({
			type: 'line',
			name: seriesName,
			encode: { x: 'timestamp', y: seriesName },
			color: topColorBySeriesName[seriesName],
			stack: 'chain'
		})),
		groupBy: state.groupBy
	}
}

function buildTreemapPresentation({
	selectedNames,
	latestRows
}: {
	selectedNames: string[]
	latestRows: BreakdownLatestValueRow[]
}): ChainsByAdapterLatestValueDatum[] {
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
	if (values.length > MAX_TREEMAP_ITEMS) {
		let othersValue = 0
		for (let index = MAX_TREEMAP_ITEMS - 1; index < values.length; index++) othersValue += values[index].value
		values.length = MAX_TREEMAP_ITEMS - 1
		const existingOthers = values.find((item) => item.name === 'Others')
		if (existingOthers) existingOthers.value += othersValue
		else values.push({ name: 'Others', value: othersValue })
	}

	const colors = getNDistinctColors(values.length || 1)

	const data: ChainsByAdapterLatestValueDatum[] = []
	for (let index = 0; index < values.length; index++) {
		const item = values[index]
		data.push({
			...item,
			share: total > 0 ? (item.value / total) * 100 : 0,
			itemStyle: {
				color: colors[index]
			}
		})
	}

	return data
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
	chartData: MultiSeriesChartDataset
	selectedNames: string[]
}): BreakdownLatestValueRow[] {
	const totals = new Map<string, number>()
	const pointCounts = new Map<string, number>()
	const selectedIndexes = selectedNames.map((name) => chartData.dimensions.indexOf(name))

	for (const row of chartData.source) {
		for (let i = 0; i < selectedNames.length; i++) {
			const name = selectedNames[i]
			const value = row[selectedIndexes[i]] as number | null | undefined
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
	chartData: MultiSeriesChartDataset
	selectedNames: string[]
	groupBy: ChartTimeGroupingWithCumulative
	seriesType: LatestValueSeriesType
}): BreakdownLatestValueRow[] {
	if (groupBy === 'daily') {
		const sourceRow = getEffectiveDailyLatestRow(chartData)
		if (!sourceRow) {
			return buildNullLatestRows(selectedNames)
		}

		const rows: BreakdownLatestValueRow[] = []
		for (const name of selectedNames) {
			const value = sourceRow[chartData.dimensions.indexOf(name)] as number | null | undefined
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
	const selectedIndexes = selectedNames.map((name) => chartData.dimensions.indexOf(name))

	for (let rowIndex = chartData.source.length - 1; rowIndex >= 0; rowIndex--) {
		const row = chartData.source[rowIndex]
		const timestamp = row[0] as number
		if (timestamp < cutoffMs) break
		for (let i = 0; i < selectedNames.length; i++) {
			const name = selectedNames[i]
			const value = row[selectedIndexes[i]] as number | null | undefined
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

function getEffectiveDailyLatestRow(chartData: MultiSeriesChartDataset): MultiSeriesChartDataset['source'][0] | null {
	const source = chartData.source
	const lastTimestampRow = source[source.length - 1]
	if (!lastTimestampRow) return null
	if (source.length === 1) return lastTimestampRow

	// Canonical chart datasets are ascending, so only the final two rows are needed.
	const previousTimestampRow = source[source.length - 2]
	const lastTimestamp = lastTimestampRow[0] as number
	const previousTimestamp = previousTimestampRow[0] as number
	const isUtcMidnight = lastTimestamp % (24 * 60 * 60 * 1000) === 0
	const gapMs = lastTimestamp - previousTimestamp

	return !isUtcMidnight || gapMs < MIN_COMPLETE_DAILY_GAP_MS ? previousTimestampRow : lastTimestampRow
}

function buildHBarPresentation({
	selectedNames,
	latestRows
}: {
	selectedNames: string[]
	latestRows: BreakdownLatestValueRow[]
}): ChainsByAdapterLatestValueDatum[] {
	const rankedValues = buildTreemapPresentation({ selectedNames, latestRows })

	if (rankedValues.length <= MAX_CHAINS_BY_ADAPTER_HBAR_ITEMS) {
		return rankedValues
	}

	const topValues = rankedValues.slice(0, MAX_CHAINS_BY_ADAPTER_HBAR_ITEMS)
	let othersValue = 0
	for (let i = MAX_CHAINS_BY_ADAPTER_HBAR_ITEMS; i < rankedValues.length; i++) {
		othersValue += rankedValues[i].value
	}

	if (othersValue <= 0) {
		return topValues
	}

	const limitedValues = [...topValues, { name: 'Others', value: othersValue }]
	let total = 0
	for (const item of limitedValues) {
		total += item.value
	}
	const colors = getNDistinctColors(limitedValues.length)

	const data: ChainsByAdapterLatestValueDatum[] = []
	for (let index = 0; index < limitedValues.length; index++) {
		const item = limitedValues[index]
		data.push({
			...item,
			share: total > 0 ? (item.value / total) * 100 : 0,
			itemStyle: {
				color: colors[index]
			}
		})
	}

	return data
}

export function buildChainsByAdapterChartPresentation({
	chartData,
	selectedChains,
	state,
	latestValueSeriesType = 'bar'
}: {
	chartData: IChainsByAdapterPageData['chartData']
	selectedChains: string[]
	state: ChainsByAdapterChartState
	latestValueSeriesType?: LatestValueSeriesType
}): ChainsByAdapterChartPresentation {
	switch (state.chartKind) {
		case 'treemap': {
			const latestRows = buildLatestValueRowsFromChartData({
				chartData,
				selectedNames: selectedChains,
				groupBy: state.groupBy,
				seriesType: latestValueSeriesType
			})
			return {
				kind: 'treemap',
				data: buildTreemapPresentation({ selectedNames: selectedChains, latestRows })
			}
		}
		case 'hbar': {
			const latestRows = buildLatestValueRowsFromChartData({
				chartData,
				selectedNames: selectedChains,
				groupBy: state.groupBy,
				seriesType: latestValueSeriesType
			})
			return {
				kind: 'hbar',
				data: buildHBarPresentation({ selectedNames: selectedChains, latestRows })
			}
		}
		case 'dominance': {
			const { topEntityNames, otherEntityNames, topSeriesNames, topColorBySeriesName } = createRankedSeriesUniverse({
				chartData,
				selectedNames: selectedChains
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
			const { topEntityNames, otherEntityNames, topSeriesNames, topColorBySeriesName } = createRankedSeriesUniverse({
				chartData,
				selectedNames: selectedChains
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

export function buildAdapterByChainBreakdownPresentation({
	chartData,
	selectedProtocols,
	state
}: {
	chartData: MultiSeriesChartDataset
	selectedProtocols: string[]
	state: ChainsByAdapterBarState | ChainsByAdapterDominanceState
}): ChainsByAdapterBarPresentation | ChainsByAdapterDominancePresentation {
	const latestRows = buildLatestValueRowsFromChartData({
		chartData,
		selectedNames: selectedProtocols,
		groupBy: state.groupBy,
		seriesType: state.chartKind
	})
	const rankingScores = new Map<string, number>()
	for (const row of latestRows) {
		if (row.total24h != null) {
			rankingScores.set(row.name, row.total24h)
		}
	}

	const orderedSeriesNames = orderSelectedNamesByRankingScores({
		chartData,
		selectedNames: selectedProtocols,
		rankingScores
	})
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
	const renderedSeriesNames = otherEntityNames.length > 0 ? [...topEntityNames, 'Others'] : topEntityNames
	const topColors = getNDistinctColors(renderedSeriesNames.length || 1)
	const topColorBySeriesName = Object.fromEntries(renderedSeriesNames.map((name, index) => [name, topColors[index]]))

	switch (state.chartKind) {
		case 'dominance':
			return buildDominancePresentation({
				chartData,
				topEntityNames,
				otherEntityNames,
				topSeriesNames: renderedSeriesNames,
				topColorBySeriesName,
				state
			})
		case 'bar':
			return buildBarPresentation({
				chartData,
				topEntityNames,
				otherEntityNames,
				topSeriesNames: renderedSeriesNames,
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
	chartData,
	seriesType = 'bar'
}: {
	chartKind: 'treemap' | 'hbar'
	selectedProtocols: string[]
	groupBy: ChartTimeGroupingWithCumulative
	chartData: MultiSeriesChartDataset
	seriesType?: LatestValueSeriesType
}): ChainsByAdapterTreemapPresentation | ChainsByAdapterHBarPresentation {
	const latestRows = buildLatestValueRowsFromChartData({
		chartData,
		selectedNames: selectedProtocols,
		groupBy,
		seriesType
	})

	if (chartKind === 'treemap') {
		return {
			kind: 'treemap',
			data: buildTreemapPresentation({ selectedNames: selectedProtocols, latestRows })
		}
	}

	return {
		kind: 'hbar',
		data: buildHBarPresentation({ selectedNames: selectedProtocols, latestRows })
	}
}
