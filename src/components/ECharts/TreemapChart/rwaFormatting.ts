import type { TreemapValue } from '../types'

type TreemapPathInfo = Array<{ name?: unknown }>

function formatPct(value: number | null | undefined): number {
	return value == null ? 0 : Number(value.toFixed(2))
}

function getTreemapPath(treePathInfo: unknown): string[] {
	if (!Array.isArray(treePathInfo)) return []

	const treePath: string[] = []
	for (let i = 1; i < treePathInfo.length; i++) {
		const name = treePathInfo[i]?.name
		if (typeof name === 'string' && name.length > 0) treePath.push(name)
	}

	return treePath
}

function getName(value: unknown): string {
	return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
}

export function formatRwaUpperLabel(params: { name?: unknown }) {
	return getName(params?.name)
}

export function formatRwaTreemapBoxLabel(params: { name?: unknown }) {
	return getName(params?.name)
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
	const shareOfParent = formatPct(value?.[1])
	const shareOfTotal = formatPct(value?.[2])

	if (treePath.length >= 2) {
		const parent = treePath[treePath.length - 2]
		const child = treePath[treePath.length - 1]
		return [
			`Parent: ${parent}<br>`,
			`Child: ${child}<br>`,
			`${valueLabel}: ${metricValue}<br>`,
			`Share of Parent: ${shareOfParent}%<br>`,
			`Share of Total: ${shareOfTotal}%<br>`
		].join('')
	}

	if (treePath.length === 1) {
		return [`${treePath[0]}<br>`, `${valueLabel}: ${metricValue}<br>`, `Share of Total: ${shareOfTotal}%<br>`].join('')
	}

	const rootLabel = getName(info?.name) || 'RWA'
	return [`${rootLabel}<br>`, `${valueLabel}: ${metricValue}<br>`].join('')
}
