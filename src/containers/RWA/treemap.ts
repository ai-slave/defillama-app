import { chartColor, childColors } from '~/constants/colors'
import { roundNumber } from '~/utils/numberFormat'
import type { IRWAAssetsOverview } from './api.types'
import { normalizeRwaAssetGroup } from './assetGroup'
import type { RWAChartMetric, RwaTreemapNestedBy, RwaTreemapParentGrouping } from './chartState'
import { getRwaDisplayedDefiActiveTvlByChain, getRwaDisplayedMetricValue } from './filterState'
import { computeWeightedGroups } from './grouping'
import { rwaSlug } from './rwaSlug'

export type RwaPieChartDatum = { name: string; value: number }
export type RwaTreemapNode = {
	name: string
	path: string
	value: [number, number | null, number | null]
	itemStyle?: { color?: string }
	children?: Array<RwaTreemapNode>
}

type RWAAsset = IRWAAssetsOverview['assets'][number]

export const buildRwaTreemapTreeData = (
	pieData: Array<RwaPieChartDatum>,
	breakdownLabel: string
): Array<RwaTreemapNode> => {
	const totalsByLabel = new Map<string, number>()
	for (const item of pieData) {
		const value = item.value
		if (value <= 0) continue
		const label = sanitizeTreemapLabel(item.name)
		if (!label) continue
		totalsByLabel.set(label, (totalsByLabel.get(label) ?? 0) + value)
	}

	const data: Array<RwaPieChartDatum> = []
	let total = 0
	for (const [name, value] of totalsByLabel.entries()) {
		data.push({ name, value })
		total += value
	}
	data.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
	if (data.length === 0) return []

	const rootLabel = breakdownLabel || 'Breakdown'
	// Assign colors in value-descending order so the biggest block gets the first palette colour.
	const children: Array<RwaTreemapNode> = []
	for (const [index, item] of data.entries()) {
		const sharePct = total > 0 ? roundNumber((item.value / total) * 100, 2) : 0
		children.push({
			name: item.name,
			path: `${rootLabel}/${item.name}`,
			value: [item.value, sharePct, sharePct],
			itemStyle: { color: chartColor(index) }
		})
	}

	return children
}

export function buildCompleteRwaTreemapTreeData({
	nestedTreeData,
	completePieData,
	breakdownLabel
}: {
	nestedTreeData: Array<RwaTreemapNode>
	completePieData: Array<RwaPieChartDatum>
	breakdownLabel: string
}): Array<RwaTreemapNode> {
	return nestedTreeData.length > 0 ? nestedTreeData : buildRwaTreemapTreeData(completePieData, breakdownLabel)
}

export const canBuildRwaNestedTreemap = ({
	parentGrouping,
	childGrouping
}: {
	parentGrouping: RwaTreemapParentGrouping
	childGrouping: RwaTreemapNestedBy
}) => {
	if (childGrouping === 'none') return false
	if (parentGrouping === 'assetClass' && childGrouping === 'assetClass') return false
	if (parentGrouping === 'assetName' && childGrouping === 'assetName') return false
	if (parentGrouping === 'category' && childGrouping === 'category') return false
	return true
}

type RwaMetricByChainRow = { label: string; value: number }

const getRwaMetricBreakdownByChain = (
	asset: RWAAsset,
	metric: RWAChartMetric,
	includeBridgeTvl: boolean
): Array<RwaMetricByChainRow> => {
	const breakdown =
		metric === 'activeMcap'
			? asset.activeMcap?.breakdown
			: metric === 'defiActiveTvl'
				? asset.kind === 'spot'
					? getRwaDisplayedDefiActiveTvlByChain(asset, includeBridgeTvl)
					: undefined
				: asset.onChainMcap?.breakdown
	if (!breakdown || breakdown.length === 0) return []

	const UNKNOWN = 'Unknown'
	const totalsBySlug = new Map<string, RwaMetricByChainRow>()

	for (const [chainRaw, valueRaw] of breakdown) {
		const value = valueRaw
		if (value <= 0) continue

		const label = sanitizeTreemapLabel((chainRaw ?? '').trim()) || UNKNOWN
		const key = rwaSlug(label)
		if (!key) continue

		const prev = totalsBySlug.get(key) ?? { label, value: 0 }
		if (prev.label === UNKNOWN && label !== UNKNOWN) prev.label = label
		prev.value += value
		totalsBySlug.set(key, prev)
	}

	return Array.from(totalsBySlug.values()).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

const normalizeLabels = (values: Array<string | null | undefined>): Array<string> => {
	const out = new Set<string>()
	for (const value of values) {
		const label = typeof value === 'string' ? sanitizeTreemapLabel(value.trim()) : ''
		if (!label) continue
		out.add(label)
	}
	return Array.from(out)
}

const normalizeLabelsBySlug = (values: Array<string | null | undefined>, fallback: string): Array<string> => {
	const bySlug = new Map<string, string>()

	for (const value of values) {
		const label = typeof value === 'string' ? sanitizeTreemapLabel(value.trim()) : ''
		if (!label) continue
		const key = rwaSlug(label)
		if (!key) continue
		const prev = bySlug.get(key)
		if (!prev || (prev === fallback && label !== fallback)) bySlug.set(key, label)
	}

	if (bySlug.size === 0) return [fallback]
	return Array.from(bySlug.values())
}

const getAssetGroupsByGrouping = (
	asset: RWAAsset,
	grouping: RwaTreemapParentGrouping | RwaTreemapNestedBy
): Array<string> => {
	switch (grouping) {
		case 'none':
			return []
		case 'assetName':
			return normalizeLabels([asset.assetName || asset.ticker])
		case 'assetClass':
			return normalizeLabels(asset.assetClass ?? [])
		case 'category':
			return normalizeLabels(asset.category ?? [])
		case 'assetGroup':
			return normalizeLabels([normalizeRwaAssetGroup(asset.assetGroup)])
		case 'platform':
			return normalizeLabelsBySlug([asset.parentPlatform], 'Unknown')
		case 'chain':
		default: {
			if (asset.kind === 'perps') return ['Unknown']

			const chains = [...(asset.chain ?? [])]
			if (asset.primaryChain) chains.push(asset.primaryChain)
			return normalizeLabelsBySlug(chains, 'Unknown')
		}
	}
}

const getWeightedAssetGroupsByGrouping = (
	asset: RWAAsset,
	grouping: RwaTreemapParentGrouping | RwaTreemapNestedBy
): Array<{ label: string; weight: number }> => {
	return computeWeightedGroups(getAssetGroupsByGrouping(asset, grouping)).map(({ value, weight }) => ({
		label: value,
		weight
	}))
}

const sanitizeTreemapLabel = (value: string): string => {
	const trimmed = value.trim()
	if (!trimmed) return ''
	const richWrapperMatch = trimmed.match(/^\{[A-Za-z0-9_]+\|([\s\S]+)\}$/)
	return richWrapperMatch?.[1] ?? trimmed
}

const getRwaTreemapGroupingLabel = (grouping: RwaTreemapParentGrouping): string => {
	if (grouping === 'assetGroup') return 'Asset Group'
	if (grouping === 'assetClass') return 'Asset Class'
	if (grouping === 'assetName') return 'Asset Name'
	if (grouping === 'platform') return 'Asset Platform'
	if (grouping === 'chain') return 'Chain'
	return 'Asset Category'
}

export const buildRwaNestedTreemapTreeData = ({
	assets,
	metric,
	rootLabel,
	parentGrouping,
	childGrouping,
	includeBridgeTvl = true
}: {
	assets: IRWAAssetsOverview['assets']
	metric: RWAChartMetric
	rootLabel: string
	parentGrouping: RwaTreemapParentGrouping
	childGrouping: RwaTreemapNestedBy
	includeBridgeTvl?: boolean
}): Array<RwaTreemapNode> => {
	if (childGrouping === 'none') return []

	const nestedTotals = new Map<string, Map<string, number>>()

	for (const asset of assets) {
		const childGroups = getWeightedAssetGroupsByGrouping(asset, childGrouping)
		if (childGroups.length === 0) continue

		if (parentGrouping === 'chain') {
			const metricByChain = getRwaMetricBreakdownByChain(asset, metric, includeBridgeTvl)
			if (metricByChain.length === 0) continue

			for (const { label: parentGroup, value: metricValue } of metricByChain) {
				const childTotals = nestedTotals.get(parentGroup) ?? new Map<string, number>()
				for (const { label: childGroup, weight: childWeight } of childGroups) {
					childTotals.set(childGroup, (childTotals.get(childGroup) ?? 0) + metricValue * childWeight)
				}
				nestedTotals.set(parentGroup, childTotals)
			}
			continue
		}

		const metricValue = getRwaDisplayedMetricValue(asset, metric, includeBridgeTvl)
		if (metricValue <= 0) continue

		const parentGroups = getWeightedAssetGroupsByGrouping(asset, parentGrouping)
		if (parentGroups.length === 0) continue

		for (const { label: parentGroup, weight: parentWeight } of parentGroups) {
			const childTotals = nestedTotals.get(parentGroup) ?? new Map<string, number>()
			for (const { label: childGroup, weight: childWeight } of childGroups) {
				childTotals.set(childGroup, (childTotals.get(childGroup) ?? 0) + metricValue * parentWeight * childWeight)
			}
			nestedTotals.set(parentGroup, childTotals)
		}
	}

	if (nestedTotals.size === 0) return []

	const parentRows: Array<{ parentLabel: string; parentTotal: number; childRows: Array<[string, number]> }> = []
	for (const [parentLabel, childTotals] of nestedTotals.entries()) {
		const childRows: Array<[string, number]> = []
		let parentTotal = 0
		for (const [childLabel, valueRaw] of childTotals.entries()) {
			const value = valueRaw
			if (value <= 0) continue
			childRows.push([childLabel, value])
			parentTotal += value
		}
		childRows.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		if (parentTotal > 0) {
			parentRows.push({ parentLabel, parentTotal, childRows })
		}
	}
	parentRows.sort((a, b) => b.parentTotal - a.parentTotal || a.parentLabel.localeCompare(b.parentLabel))

	if (parentRows.length === 0) return []

	let total = 0
	for (const row of parentRows) {
		total += row.parentTotal
	}
	if (total <= 0) return []

	const resolvedRootLabel = rootLabel || getRwaTreemapGroupingLabel(parentGrouping)
	const parentNodes: Array<RwaTreemapNode> = parentRows.map((row, parentIndex) => {
		const parentPath = `${resolvedRootLabel}/${row.parentLabel}`
		const parentSharePct = roundNumber((row.parentTotal / total) * 100, 2)
		const parentColor = chartColor(parentIndex)
		const colors = childColors(parentColor, row.childRows.length)
		const childNodes: Array<RwaTreemapNode> = row.childRows.map(([childLabel, childTotal], childIndex) => {
			const childSharePct = roundNumber((childTotal / row.parentTotal) * 100, 2)
			const childShareOfTotalPct = roundNumber((childTotal / total) * 100, 2)
			return {
				name: childLabel,
				path: `${parentPath}/${childLabel}`,
				value: [childTotal, childSharePct, childShareOfTotalPct],
				itemStyle: { color: colors[childIndex] }
			}
		})

		return {
			name: row.parentLabel,
			path: parentPath,
			value: [row.parentTotal, parentSharePct, parentSharePct],
			itemStyle: { color: parentColor },
			children: childNodes
		}
	})

	return parentNodes
}
