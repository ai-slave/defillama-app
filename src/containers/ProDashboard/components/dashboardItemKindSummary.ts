import type { DashboardItemConfig } from '../dashboardItemConfig'
const DASHBOARD_ITEM_KIND_SUMMARY_LABELS = {
	chart: 'charts',
	multi: 'multi-charts',
	'dataset-table': 'tables',
	'unified-table': 'tables',
	text: 'text blocks',
	builder: 'chart builders',
	metric: 'metrics',
	yields: 'yield charts',
	stablecoins: 'stablecoin charts',
	'stablecoin-asset': 'stablecoin charts',
	'advanced-tvl': 'TVL charts',
	'advanced-borrowed': 'borrowed charts',
	'income-statement': 'income statements',
	'unlocks-schedule': 'unlock charts',
	'unlocks-pie': 'unlock charts',
	'llamaai-chart': 'AI charts',
	'rwa-overview': 'RWA charts',
	'rwa-asset': 'RWA charts',
	sql: 'SQL charts'
} satisfies Record<DashboardItemConfig['kind'], string>
export function summarizeDashboardItemKinds(
	items: ReadonlyArray<Pick<DashboardItemConfig, 'kind'> | null | undefined>
) {
	const counts = new Map<string, number>()
	for (const item of items) {
		if (!item) continue
		const label = DASHBOARD_ITEM_KIND_SUMMARY_LABELS[item.kind]
		counts.set(label, (counts.get(label) ?? 0) + 1)
	}
	const summary = Array.from(counts)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 3)
		.map(([label, count]) => `${count} ${label}`)
		.join(', ')
	return counts.size > 3 ? `${summary} +${counts.size - 3} more` : summary
}
