import { changeTone, formatChange } from '~/ui/Change'
import { formatPercent } from '~/utils/numberFormat'
import { escapeHtml } from '../shared/escapeHtml'
import type { TreemapValue } from './types'

type TreemapPathInfo = Array<{ name?: unknown }>

function getTreemapPath(treePathInfo: unknown): Array<string> {
	if (!Array.isArray(treePathInfo)) return []

	const treePath: Array<string> = []
	for (let i = 1; i < treePathInfo.length; i++) {
		const name = treePathInfo[i]?.name
		if (typeof name === 'string' && name.length > 0) treePath.push(name)
	}

	return treePath
}

function getName(value: unknown): string {
	return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
}

export function formatRwaTreemapTooltip({
	info,
	valueLabel,
	formatMetricValue
}: {
	info: { treePathInfo?: TreemapPathInfo; value?: TreemapValue; name?: unknown }
	valueLabel: string
	formatMetricValue: (value: number) => string
}) {
	const treePath = getTreemapPath(info?.treePathInfo)
	const value = info.value
	const metricValue = formatMetricValue(value?.[0] ?? 0)
	const shareOfParent = formatPercent(value?.[1] ?? 0, { input: 'percent' })
	const shareOfTotal = formatPercent(value?.[2] ?? 0, { input: 'percent' })
	const change =
		value?.[3] == null ? '' : `1D return: <span class="${changeTone(value[3])}">${formatChange(value[3])}</span><br>`

	if (treePath.length >= 2) {
		const parent = treePath[treePath.length - 2]
		const child = treePath[treePath.length - 1]
		return [
			`${escapeHtml(child!)}<br>`,
			`${escapeHtml(valueLabel)}: ${escapeHtml(metricValue)}<br>`,
			`Share of ${escapeHtml(parent!)}: ${shareOfParent}<br>`,
			`Share of total: ${shareOfTotal}<br>`,
			change
		].join('')
	}

	if (treePath.length === 1) {
		return [
			`${escapeHtml(treePath[0]!)}<br>`,
			`${escapeHtml(valueLabel)}: ${escapeHtml(metricValue)}<br>`,
			`Share of total: ${shareOfTotal}<br>`,
			change
		].join('')
	}

	const rootLabel = getName(info?.name) || 'RWA'
	return [`${escapeHtml(rootLabel)}<br>`, `${escapeHtml(valueLabel)}: ${escapeHtml(metricValue)}<br>`].join('')
}
