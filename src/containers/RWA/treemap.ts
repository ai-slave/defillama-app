import { CHART_COLORS } from '~/constants/colors'
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
	children?: RwaTreemapNode[]
}

const TREEMAP_COLORS = CHART_COLORS
type RWAAsset = IRWAAssetsOverview['assets'][number]

export const buildRwaTreemapTreeData = (pieData: RwaPieChartDatum[], breakdownLabel: string): RwaTreemapNode[] => {
	const totalsByLabel = new Map<string, number>()
	for (const item of pieData) {
		const value = item.value
		if (value <= 0) continue
		const label = sanitizeTreemapLabel(item.name)
		if (!label) continue
		totalsByLabel.set(label, (totalsByLabel.get(label) ?? 0) + value)
	}

	const data: RwaPieChartDatum[] = []
	let total = 0
	for (const [name, value] of totalsByLabel.entries()) {
		data.push({ name, value })
		total += value
	}
	data.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
	if (data.length === 0) return []

	const rootLabel = breakdownLabel || 'Breakdown'
	// Assign colors in value-descending order so the biggest block gets CHART_COLORS[0].
	const children: RwaTreemapNode[] = []
	for (const [index, item] of data.entries()) {
		const sharePct = total > 0 ? roundNumber((item.value / total) * 100, 2) : 0
		const color = TREEMAP_COLORS[index] ?? createGeneratedColor(index - TREEMAP_COLORS.length)
		children.push({
			name: item.name,
			path: `${rootLabel}/${item.name}`,
			value: [item.value, sharePct, sharePct],
			itemStyle: { color }
		})
	}

	return children
}

export function buildCompleteRwaTreemapTreeData({
	nestedTreeData,
	completePieData,
	breakdownLabel
}: {
	nestedTreeData: RwaTreemapNode[]
	completePieData: RwaPieChartDatum[]
	breakdownLabel: string
}): RwaTreemapNode[] {
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

const getRwaMetricValue = (asset: RWAAsset, metric: RWAChartMetric, includeBridgeTvl: boolean): number =>
	getRwaDisplayedMetricValue(asset, metric, includeBridgeTvl)

type RwaMetricByChainRow = { label: string; value: number }

const getRwaMetricBreakdownByChain = (
	asset: RWAAsset,
	metric: RWAChartMetric,
	includeBridgeTvl: boolean
): RwaMetricByChainRow[] => {
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

const normalizeLabels = (values: Array<string | null | undefined>): string[] => {
	const out = new Set<string>()
	for (const value of values) {
		const label = typeof value === 'string' ? sanitizeTreemapLabel(value.trim()) : ''
		if (!label) continue
		out.add(label)
	}
	return Array.from(out)
}

const normalizeLabelsBySlug = (values: Array<string | null | undefined>, fallback: string): string[] => {
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
): string[] => {
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

/** Convert HSL values to a hex color (#RRGGBB) so downstream helpers (hexToHsl) can parse it. */
const hslToHex = (h: number, s: number, l: number): string => {
	const sNorm = s / 100
	const lNorm = l / 100
	const a = sNorm * Math.min(lNorm, 1 - lNorm)
	const f = (n: number) => {
		const k = (n + h / 30) % 12
		const c = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
		return Math.round(255 * Math.max(0, Math.min(1, c)))
			.toString(16)
			.padStart(2, '0')
	}
	return `#${f(0)}${f(8)}${f(4)}`
}

const createGeneratedColor = (index: number): string => {
	const hue = (index * 137.508) % 360
	const saturation = 62 + (index % 3) * 8
	// Keep fallback colors away from very light tones (can look white on charts).
	const lightness = 40 + (index % 4) * 4
	return hslToHex(hue, saturation, lightness)
}

/**
 * Build a color map for treemap parent groups with maximally-spaced hues.
 * Uses golden angle stepping (137.508°) so consecutive items (which are the
 * biggest, most visually dominant groups) always land ~137.5° apart on the
 * color wheel — guaranteeing distinct hue families for their child shades.
 */
const buildHueSpacedColorMap = (labels: string[]): Record<string, string> => {
	const unique = Array.from(new Set(labels))
	if (unique.length === 0) return {}

	const colorMap: Record<string, string> = {}
	const startHue = 210
	const saturation = 65
	const lightness = 48

	for (const [i, label] of unique.entries()) {
		const hue = (startHue + i * 137.508) % 360
		colorMap[label] = hslToHex(hue, saturation, lightness)
	}
	return colorMap
}

/** Convert a hex color (#RRGGBB) to [hue 0-360, saturation 0-100, lightness 0-100]. */
const hexToHsl = (hex: string): [number, number, number] => {
	const r = parseInt(hex.slice(1, 3), 16) / 255
	const g = parseInt(hex.slice(3, 5), 16) / 255
	const b = parseInt(hex.slice(5, 7), 16) / 255
	const max = Math.max(r, g, b)
	const min = Math.min(r, g, b)
	let h = 0
	let s = 0
	const l = (max + min) / 2

	if (max !== min) {
		const d = max - min
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
		if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
		else if (max === g) h = ((b - r) / d + 2) / 6
		else h = ((r - g) / d + 4) / 6
	}

	return [h * 360, s * 100, l * 100]
}

/**
 * Derive child shade colors from a parent hex color.
 * Children share the parent's hue family but spread across a wide lightness
 * range with slight hue shifts, producing clearly distinct blocks per group.
 */
const deriveChildShades = (parentHex: string, count: number): string[] => {
	if (count <= 0) return []
	if (count === 1) return [parentHex]

	const [h, s] = hexToHsl(parentHex)

	// Wide lightness spread — from deep shade to medium-light — for maximum
	// visual distinction. Text remains readable via the textBorder outline.
	const minL = 25
	const maxL = 65
	// Keep saturation vivid so the hue stays recognisable at every lightness.
	const childS = Math.max(55, Math.min(85, s))
	const shades: string[] = []

	for (let i = 0; i < count; i++) {
		const ratio = count > 1 ? i / (count - 1) : 0.5
		const childL = minL + ratio * (maxL - minL)
		// Small hue offset per child gives extra distinction when many children.
		const hueOffset = count > 2 ? (i - (count - 1) / 2) * 4 : 0
		const childH = (((h + hueOffset) % 360) + 360) % 360
		shades.push(hslToHex(childH, childS, childL))
	}
	return shades
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
}): RwaTreemapNode[] => {
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

		const metricValue = getRwaMetricValue(asset, metric, includeBridgeTvl)
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
	const parentColorMap = buildHueSpacedColorMap(parentRows.map((row) => row.parentLabel))

	const parentNodes: RwaTreemapNode[] = parentRows.map((row) => {
		const parentPath = `${resolvedRootLabel}/${row.parentLabel}`
		const parentSharePct = roundNumber((row.parentTotal / total) * 100, 2)
		const parentColor = parentColorMap[row.parentLabel] ?? TREEMAP_COLORS[0]
		const childShades = deriveChildShades(parentColor, row.childRows.length)
		const childNodes: RwaTreemapNode[] = row.childRows.map(([childLabel, childTotal], childIndex) => {
			const childSharePct = roundNumber((childTotal / row.parentTotal) * 100, 2)
			const childShareOfTotalPct = roundNumber((childTotal / total) * 100, 2)
			return {
				name: childLabel,
				path: `${parentPath}/${childLabel}`,
				value: [childTotal, childSharePct, childShareOfTotalPct],
				itemStyle: { color: childShades[childIndex] ?? parentColor }
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
