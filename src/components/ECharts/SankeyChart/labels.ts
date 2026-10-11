import type { LabelLayoutOptionCallbackParams } from 'echarts'
import type { ISankeyChartProps } from './types'

const MOBILE_LABEL_PADDING = 6
const MOBILE_LABEL_GAP = 4

type LabelRect = Pick<LabelLayoutOptionCallbackParams['labelRect'], 'x' | 'y' | 'width' | 'height'>
type LabelLayoutParams = Pick<LabelLayoutOptionCallbackParams, 'dataIndex' | 'dataType'> & { labelRect: LabelRect }

export interface SankeyNodeMetadata {
	descriptions: Record<string, string>
	displayValues: Record<string, number | string>
	percentageLabels: Record<string, string>
}

export function buildSankeyNodeMetadata(nodes: ISankeyChartProps['nodes']): SankeyNodeMetadata {
	const descriptions: Record<string, string> = {}
	const displayValues: Record<string, number | string> = {}
	const percentageLabels: Record<string, string> = {}
	for (const node of nodes) {
		if (node.description) {
			descriptions[node.name] = node.description
		}
		if (node.displayValue !== undefined) {
			displayValues[node.name] = node.displayValue
		}
		if (node.percentageLabel) {
			percentageLabels[node.name] = node.percentageLabel
		}
	}
	return { descriptions, displayValues, percentageLabels }
}

/** A node's own display value wins over the flow ECharts computed; a percentage label follows it. */
export function formatSankeyNodeValue(
	name: string,
	value: number,
	metadata: SankeyNodeMetadata,
	formatValue: (value: number) => string
): string {
	const displayValue = metadata.displayValues[name]
	const formattedValue =
		displayValue !== undefined
			? typeof displayValue === 'string'
				? displayValue
				: formatValue(displayValue)
			: formatValue(value)
	const percentageLabel = metadata.percentageLabels[name]
	return percentageLabel ? `${formattedValue} (${percentageLabel})` : formattedValue
}

/** Desktop labels carry a truncated description line; mobile labels stay one full name and value. */
export function formatSankeyNodeLabel(
	name: string,
	value: number,
	metadata: SankeyNodeMetadata,
	formatValue: (value: number) => string,
	showDescription: boolean
): string {
	const valueWithPercent = formatSankeyNodeValue(name, value, metadata, formatValue)
	const description = metadata.descriptions[name]
	if (description && showDescription) {
		const truncatedDesc = description.length > 50 ? `${description.slice(0, 49)}…` : description
		return `{name|${name}: ${valueWithPercent}}\n{desc|${truncatedDesc}}`
	}
	return `${name}: ${valueWithPercent}`
}

function labelsOverlap(a: LabelRect, b: LabelRect) {
	return (
		a.x < b.x + b.width + MOBILE_LABEL_GAP &&
		a.x + a.width + MOBILE_LABEL_GAP > b.x &&
		a.y < b.y + b.height + MOBILE_LABEL_GAP &&
		a.y + a.height + MOBILE_LABEL_GAP > b.y
	)
}

/**
 * Mobile labels never hide on overlap. Each node label keeps its x (clamped into the chart) and moves up
 * or down by whole label heights to the level with the fewest collisions, alternating direction by depth
 * so neighboring columns spread apart. Seeing a node index again means ECharts started a new layout pass.
 */
export function createMobileLabelLayout(
	nodes: ISankeyChartProps['nodes'],
	getChartSize: () => { width: number; height: number }
) {
	let placedLabels: Array<LabelRect> = []
	const seenNodeIndexes = new Set<number>()

	return (params: LabelLayoutParams) => {
		if (params.dataType !== 'node' || params.dataIndex == null) return { hideOverlap: false }

		if (seenNodeIndexes.has(params.dataIndex)) {
			seenNodeIndexes.clear()
			placedLabels = []
		}
		seenNodeIndexes.add(params.dataIndex)

		const { width: chartWidth, height: chartHeight } = getChartSize()
		const labelRect = params.labelRect
		const maxLeft = Math.max(MOBILE_LABEL_PADDING, chartWidth - labelRect.width - MOBILE_LABEL_PADDING)
		const left = Math.min(Math.max(labelRect.x, MOBILE_LABEL_PADDING), maxLeft)
		const maxTop = Math.max(MOBILE_LABEL_PADDING, chartHeight - labelRect.height - MOBILE_LABEL_PADDING)
		const originalTop = Math.min(Math.max(labelRect.y, MOBILE_LABEL_PADDING), maxTop)
		const levelHeight = labelRect.height + MOBILE_LABEL_GAP
		const depth = nodes[params.dataIndex]?.depth ?? params.dataIndex
		const direction = depth % 2 === 0 ? 1 : -1
		const startingLevel = (depth % 3) - 1
		const levelCount = Math.ceil(chartHeight / Math.max(levelHeight, 1)) + 2
		const levels = [startingLevel, 0]

		for (let level = 1; level <= levelCount; level += 1) {
			levels.push(startingLevel + level * direction, startingLevel - level * direction)
		}

		let selectedTop = originalTop
		let fewestCollisions = Number.POSITIVE_INFINITY
		const checkedTops = new Set<number>()

		for (const level of levels) {
			const top = Math.min(Math.max(originalTop + level * levelHeight, MOBILE_LABEL_PADDING), maxTop)
			if (checkedTops.has(top)) continue
			checkedTops.add(top)

			const candidate = { x: left, y: top, width: labelRect.width, height: labelRect.height }
			const collisions = placedLabels.reduce((count, placed) => count + Number(labelsOverlap(candidate, placed)), 0)
			if (collisions === 0) {
				selectedTop = top
				break
			}
			if (collisions < fewestCollisions) {
				fewestCollisions = collisions
				selectedTop = top
			}
		}

		placedLabels.push({ x: left, y: selectedTop, width: labelRect.width, height: labelRect.height })

		return {
			x: left,
			y: selectedTop + labelRect.height / 2,
			align: 'left' as const,
			verticalAlign: 'middle' as const,
			hideOverlap: false
		}
	}
}
