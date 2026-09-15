import type { IRWAAssetsOverview, IRWAChartMetricRows, RWAChartMetricKey } from './api.types'
import { normalizeRwaAssetGroup } from './assetGroup'
import {
	appendRwaChartDatasetTotal,
	emptyChartDataset,
	getRwaChartSeriesColorSlots,
	getRwaReservedSeriesColorSlot,
	isRwaTotalSeriesLabel,
	mergeRwaChartDatasets,
	RWA_OPEN_INTEREST_SERIES_LABEL,
	sortRwaChartSeriesLabels,
	type RWAChartDataset,
	type RWAChartRow,
	type RWAPositionalChartDataset
} from './chartDataset'
import { computeWeightedGroups, getPrimaryRwaCategory, UNKNOWN_PLATFORM } from './grouping'
import { RWA_WRAPPER_TYPE } from './wrappers'

export type RWAChartAggregationMode = 'total' | 'category' | 'assetClass' | 'assetName' | 'platform' | 'assetGroup'

function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`)
}

export function getRwaChartTotalLabel(metric: RWAChartMetricKey): string {
	switch (metric) {
		case 'activeMcap':
			return 'Total Active AUM'
		case 'onChainMcap':
			return 'Total Onchain AUM'
		case 'defiActiveTvl':
			return 'Total DeFi Active TVL'
		default:
			return assertNever(metric)
	}
}

export function buildRwaCanonicalMetricDataset(
	dataset: RWAChartDataset,
	metric: RWAChartMetricKey,
	onlyTotal: boolean
): RWAPositionalChartDataset {
	if (dataset.source.length === 0) return { source: [], dimensions: ['timestamp'] }
	const totalLabel = getRwaChartTotalLabel(metric)
	const seriesDimensions = dataset.dimensions.filter(
		(dimension) => dimension !== 'timestamp' && dimension !== 'Total' && !isRwaTotalSeriesLabel(dimension)
	)
	const dimensions: RWAPositionalChartDataset['dimensions'] = onlyTotal
		? ['timestamp', totalLabel]
		: ['timestamp', totalLabel, ...seriesDimensions]
	const source: RWAPositionalChartDataset['source'] = []

	for (const input of dataset.source) {
		const row: RWAPositionalChartDataset['source'][number] = [input.timestamp]
		if (onlyTotal) {
			row.push(input.Total ?? null)
		} else {
			let total = 0
			const values: Array<number | null> = []
			for (const dimension of seriesDimensions) {
				const value = input[dimension]
				total += value ?? 0
				values.push(value ?? null)
			}
			row.push(total, ...values)
		}
		source.push(row)
	}

	return { source, dimensions }
}

function buildAssetGroupMapping(
	assets: IRWAAssetsOverview['assets'],
	mode: RWAChartAggregationMode
): Map<string, Map<string, number>> {
	const assetToGroups = new Map<string, Map<string, number>>()

	for (const asset of assets) {
		if (asset.kind !== 'spot') continue

		const assetKey = asset.canonicalMarketId

		let weightedGroups: ReturnType<typeof computeWeightedGroups>
		switch (mode) {
			case 'total':
				weightedGroups = computeWeightedGroups(['Total'])
				break
			case 'category': {
				const primaryCategory = getPrimaryRwaCategory(asset.category)
				weightedGroups = computeWeightedGroups(primaryCategory ? [primaryCategory] : [])
				break
			}
			case 'assetClass':
				weightedGroups = computeWeightedGroups(asset.assetClass)
				break
			case 'assetName': {
				const name = (asset.assetName || asset.ticker || '').trim()
				weightedGroups = computeWeightedGroups(name ? [name] : [])
				break
			}
			case 'platform':
				weightedGroups = [
					{
						value: asset.parentPlatform?.trim() || UNKNOWN_PLATFORM,
						weight: 1
					}
				]
				break
			case 'assetGroup': {
				weightedGroups = computeWeightedGroups([normalizeRwaAssetGroup(asset.assetGroup)])
				break
			}
			default:
				assertNever(mode)
		}

		if (weightedGroups.length === 0) continue

		const groups = assetToGroups.get(assetKey) ?? new Map<string, number>()
		for (const { value: group, weight } of weightedGroups) {
			groups.set(group, weight)
		}
		assetToGroups.set(assetKey, groups)
	}

	return assetToGroups
}

function aggregateMetricRows(
	rows: Array<RWAChartRow>,
	assetToGroups: Map<string, Map<string, number>>,
	seenGroups: Set<string>
): Array<RWAChartRow> {
	const out: Array<RWAChartRow> = []

	for (const row of rows) {
		const outRow: RWAChartRow = { timestamp: row.timestamp }
		let hasData = false

		for (const assetKey in row) {
			if (assetKey === 'timestamp') continue
			const value = row[assetKey]
			if (value == null) continue

			const groups = assetToGroups.get(assetKey)
			if (!groups || groups.size === 0) continue

			hasData = true
			for (const [group, weight] of groups.entries()) {
				seenGroups.add(group)
				outRow[group] = (outRow[group] ?? 0) + value * weight
			}
		}

		if (hasData) {
			out.push(outRow)
		}
	}

	return out
}

function buildAggregatedRwaDataset(
	rows: IRWAChartMetricRows,
	assetToGroups: Map<string, Map<string, number>>
): RWAChartDataset {
	const seenGroups = new Set<string>()
	const source = aggregateMetricRows(rows, assetToGroups, seenGroups)

	return {
		source,
		dimensions: ['timestamp', ...sortKeysByLatestTimestampValue(source, seenGroups)]
	}
}

export function sortKeysByLatestTimestampValue(rows: Array<RWAChartRow>, keys: Iterable<string>): Array<string> {
	const arr: Array<string> = []
	for (const key of keys) {
		if (key) arr.push(key)
	}
	if (arr.length === 0) return arr

	let latestRow: RWAChartRow | null = null
	let latestTimestamp = Number.NEGATIVE_INFINITY
	for (const row of rows) {
		if (row.timestamp >= latestTimestamp) {
			latestTimestamp = row.timestamp
			latestRow = row
		}
	}

	return arr.sort((a, b) => {
		if (a === 'Others') return 1
		if (b === 'Others') return -1

		const aValueRaw = latestRow?.[a]
		const bValueRaw = latestRow?.[b]
		const aValue = aValueRaw ?? 0
		const bValue = bValueRaw ?? 0
		if (aValue !== bValue) return bValue - aValue
		return a.localeCompare(b)
	})
}
export function aggregateRwaMetricData(
	assets: IRWAAssetsOverview['assets'],
	rows: IRWAChartMetricRows,
	mode: RWAChartAggregationMode
): RWAChartDataset {
	const assetToGroups = buildAssetGroupMapping(assets, mode)
	return buildAggregatedRwaDataset(rows, assetToGroups)
}

/**
 * Apply the same default filters that the client applies when no URL query params exist.
 * This ensures `initialChartDataset` matches the no-filter client view exactly.
 */
export function applyDefaultAssetFilters(
	assets: IRWAAssetsOverview['assets'],
	{
		includeStablecoins,
		includeGovernance,
		includeWrappers
	}: {
		includeStablecoins: boolean
		includeGovernance: boolean
		includeWrappers: boolean
	}
): IRWAAssetsOverview['assets'] {
	return assets.filter((asset) => {
		if (!includeStablecoins && asset.stablecoin) return false
		if (!includeGovernance && asset.governance) return false
		if (!includeWrappers && asset.type === RWA_WRAPPER_TYPE) return false
		return true
	})
}

export {
	appendRwaChartDatasetTotal,
	emptyChartDataset,
	getRwaChartSeriesColorSlots,
	getRwaReservedSeriesColorSlot,
	isRwaTotalSeriesLabel,
	mergeRwaChartDatasets,
	RWA_OPEN_INTEREST_SERIES_LABEL,
	sortRwaChartSeriesLabels
}
export type { RWAChartDataset, RWAChartRow } from './chartDataset'
