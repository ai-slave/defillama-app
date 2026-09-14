import type { DashboardItemConfig } from '../dashboardItemConfig'
import { DASHBOARD_ITEM_KIND_SUMMARY_LABELS } from './dashboardItemKindSummary'

export function dashboardItemKindLabel(kind: DashboardItemConfig['kind']): string {
	const label = DASHBOARD_ITEM_KIND_SUMMARY_LABELS[kind].one
	return `${label.charAt(0).toUpperCase()}${label.slice(1)}`
}

function configuredLabel(item: DashboardItemConfig): string | undefined {
	if (item.kind === 'section') return item.title
	if (item.kind === 'text' || item.kind === 'llamaai-chart') return item.title
	if (item.kind === 'multi' || item.kind === 'builder' || item.kind === 'sql') return item.name
	if (item.kind === 'custom-data') return item.name || item.sourceName
	if (item.kind === 'metric') {
		return item.label || (item.subject.itemType === 'chain' ? item.subject.chain : item.subject.protocol)
	}
	if (item.kind === 'chart') return item.subjectType === 'chain' ? item.chain : item.protocol
	if (item.kind === 'yields') return item.poolName
	if (item.kind === 'stablecoins') return item.chain
	if (item.kind === 'stablecoin-asset') return item.stablecoin
	if (
		item.kind === 'advanced-tvl' ||
		item.kind === 'advanced-borrowed' ||
		item.kind === 'income-statement' ||
		item.kind === 'unlocks-schedule' ||
		item.kind === 'unlocks-pie'
	) {
		return item.protocolName
	}
	if (item.kind === 'rwa-asset') return item.assetName
	return undefined
}

export function dashboardItemLabel(item: DashboardItemConfig): string {
	const label = configuredLabel(item)?.trim()
	return label ? label : dashboardItemKindLabel(item.kind)
}
