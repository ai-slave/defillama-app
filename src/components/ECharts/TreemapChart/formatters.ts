import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { escapeHtml } from '../shared/escapeHtml'
import type { TreemapValue } from './types'

/**
 * Keeps treemap labels short and stable: B/M values use one decimal, while K
 * and unscaled values use whole dollars so labels fit inside small nodes.
 */
export function formatTreemapUsd(value: number): string {
	const absoluteValue = Math.abs(value)
	const fractionDigits = absoluteValue >= 1e6 ? 1 : 0
	return formatUsd(value, {
		compact: true,
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	})
}

/** A narrative leaf shows its own name, its return, and its market cap as three rich-text rows. */
export function formatNarrativeTreemapLabel(name: string, value: TreemapValue): string {
	return [
		`{name|${name}}`,
		`Return: {apy| ${formatPercent(value[1] ?? 0, { input: 'percent' })}}`,
		`Market Cap: {mcap| ${formatUsd(value[0], { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}}`
	].join('\n')
}

/**
 * A narrative tooltip shows the hovered token (the second path level below the root) with its return and
 * market cap. Hovering a top-level narrative group shows nothing.
 */
export function formatNarrativeTreemapTooltip(treePathInfo: Array<{ name?: unknown }>, value: TreemapValue): string {
	const treePath: Array<string> = []
	for (let i = 1; i < treePathInfo.length; i++) {
		const name = treePathInfo[i]!.name
		if (typeof name === 'string') treePath.push(name)
	}
	if (treePath.length < 2) return ''
	return [
		`${escapeHtml(treePath[1]!)}<br>`,
		`Return: ${formatPercent(value[1], { input: 'percent' })}<br>`,
		`Market Cap: ${formatUsd(value[0], { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}<br>`
	].join('')
}
