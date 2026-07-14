import * as echarts from 'echarts/core'
import { normalizeTreemapValue } from './rwaFormatting'

export const visualMin = -100
export const visualMax = 100
export const visualMinBound = -40
export const visualMaxBound = 40

export function normalizeTreemapNodes(nodes: any[]): any[] {
	return (nodes ?? []).map((node) => ({
		...node,
		value: normalizeTreemapValue(node?.value),
		children: node?.children ? normalizeTreemapNodes(node.children) : node?.children
	}))
}

export function addColorGradientField(chartDataTree) {
	let min = Infinity
	let max = -Infinity
	for (let i = 0; i < chartDataTree.length; i++) {
		let node = chartDataTree[i]
		if (node) {
			let value = node.value
			if (value[2] != null && value[2] < min) {
				min = value[2]
			}
			if (value[2] != null && value[2] > max) {
				max = value[2]
			}
		}
	}
	for (let i = 0; i < chartDataTree.length; i++) {
		let node = chartDataTree[i]
		if (node) {
			let value = node.value
			if (value[2] != null && value[2] > 0) {
				value[3] = echarts.number.linearMap(value[2], [0, max], [visualMaxBound, visualMax], true)
			} else if (value[2] != null && value[2] < 0) {
				value[3] = echarts.number.linearMap(value[2], [min, 0], [visualMin, visualMinBound], true)
			} else {
				value[3] = 0
			}

			if (!isFinite(value[3])) {
				value[3] = 0
			}
			if (node.children) {
				addColorGradientField(node.children)
			}
		}
	}
}
