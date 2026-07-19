import { CHART_COLORS } from '~/constants/colors'

export type TokenUsageTreemapNode = {
	name: string
	path: string
	value: [number, number, number]
	itemStyle?: { color?: string }
	children?: TokenUsageTreemapNode[]
}

export interface TokenUsageTreemapRow {
	name: string
	amountUsd: number
	category?: string
}

const UNCATEGORIZED_LABEL = 'Other'

function toShare(value: number, total: number): number {
	return Number(((value / total) * 100).toFixed(2))
}

function hexToRgb(hex: string): [red: number, green: number, blue: number] {
	const normalized = hex.replace('#', '')
	const expanded =
		normalized.length === 3
			? normalized
					.split('')
					.map((char) => `${char}${char}`)
					.join('')
			: normalized
	const int = Number.parseInt(expanded, 16)
	return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

const CHART_COLOR_RGB = new Array<[number, number, number] | undefined>(CHART_COLORS.length)

function deriveChildColors(parentColor: string, [red, green, blue]: [number, number, number], count: number): string[] {
	if (count <= 1) return [parentColor]

	const colors = new Array<string>(count)
	for (let index = 0; index < count; index++) {
		const ratio = 0.12 + (index / (count - 1)) * 0.34
		const mixedRed = Math.round(red + (255 - red) * ratio)
		const mixedGreen = Math.round(green + (255 - green) * ratio)
		const mixedBlue = Math.round(blue + (255 - blue) * ratio)
		colors[index] = `rgb(${mixedRed}, ${mixedGreen}, ${mixedBlue})`
	}
	return colors
}

// Builds a category -> protocol treemap tree from token usage rows.
// Parent nodes are categories; children are the protocols within each category.
export function buildTokenUsageTreemapTreeData(
	rows: TokenUsageTreemapRow[],
	rootLabel = 'Token Usage'
): TokenUsageTreemapNode[] {
	if (!rows.length) return []

	const parentToChildTotals = new Map<string, Map<string, number>>()

	for (const row of rows) {
		const value = row.amountUsd
		if (value <= 0) continue

		const parentLabel = row.category?.trim() || UNCATEGORIZED_LABEL
		const childLabel = row.name

		let childTotals = parentToChildTotals.get(parentLabel)
		if (!childTotals) {
			childTotals = new Map()
			parentToChildTotals.set(parentLabel, childTotals)
		}
		childTotals.set(childLabel, (childTotals.get(childLabel) ?? 0) + value)
	}

	const parentRows: Array<{
		parentLabel: string
		parentTotal: number
		childRows: Array<[name: string, value: number]>
	}> = []
	for (const [parentLabel, childTotals] of parentToChildTotals) {
		const childRows = Array.from(childTotals)
		childRows.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

		let parentTotal = 0
		for (const childRow of childRows) parentTotal += childRow[1]
		parentRows.push({ parentLabel, parentTotal, childRows })
	}
	parentRows.sort((a, b) => b.parentTotal - a.parentTotal || a.parentLabel.localeCompare(b.parentLabel))

	let total = 0
	for (const row of parentRows) total += row.parentTotal

	const treeData = new Array<TokenUsageTreemapNode>(parentRows.length)
	for (let parentIndex = 0; parentIndex < parentRows.length; parentIndex++) {
		const row = parentRows[parentIndex]
		const colorIndex = parentIndex % CHART_COLORS.length
		const parentColor = CHART_COLORS[colorIndex]
		const parentRgb = CHART_COLOR_RGB[colorIndex] ?? (CHART_COLOR_RGB[colorIndex] = hexToRgb(parentColor))
		const childColors = deriveChildColors(parentColor, parentRgb, row.childRows.length)
		const parentPath = `${rootLabel}/${row.parentLabel}`
		const parentShare = toShare(row.parentTotal, total)

		const children = new Array<TokenUsageTreemapNode>(row.childRows.length)
		for (let childIndex = 0; childIndex < row.childRows.length; childIndex++) {
			const [childLabel, childValue] = row.childRows[childIndex]
			children[childIndex] = {
				name: childLabel,
				path: `${parentPath}/${childLabel}`,
				value: [childValue, toShare(childValue, row.parentTotal), toShare(childValue, total)],
				itemStyle: { color: childColors[childIndex] }
			}
		}

		treeData[parentIndex] = {
			name: row.parentLabel,
			path: parentPath,
			value: [row.parentTotal, parentShare, parentShare],
			itemStyle: { color: parentColor },
			children
		}
	}

	return treeData
}
