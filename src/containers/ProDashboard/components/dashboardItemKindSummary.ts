import type { DashboardItemConfig } from '../dashboardItemConfig'
export const DASHBOARD_ITEM_KIND_SUMMARY_LABELS = {
	chart: { one: 'chart', other: 'charts' },
	multi: { one: 'multi-chart', other: 'multi-charts' },
	'dataset-table': { one: 'table', other: 'tables' },
	'unified-table': { one: 'table', other: 'tables' },
	text: { one: 'text block', other: 'text blocks' },
	builder: { one: 'chart builder', other: 'chart builders' },
	metric: { one: 'metric', other: 'metrics' },
	yields: { one: 'yield chart', other: 'yield charts' },
	stablecoins: { one: 'stablecoin chart', other: 'stablecoin charts' },
	'stablecoin-asset': { one: 'stablecoin chart', other: 'stablecoin charts' },
	'advanced-tvl': { one: 'TVL chart', other: 'TVL charts' },
	'advanced-borrowed': { one: 'borrowed chart', other: 'borrowed charts' },
	'income-statement': { one: 'income statement', other: 'income statements' },
	'unlocks-schedule': { one: 'unlock chart', other: 'unlock charts' },
	'unlocks-pie': { one: 'unlock chart', other: 'unlock charts' },
	'llamaai-chart': { one: 'AI chart', other: 'AI charts' },
	'rwa-overview': { one: 'RWA chart', other: 'RWA charts' },
	'rwa-asset': { one: 'RWA chart', other: 'RWA charts' },
	sql: { one: 'SQL chart', other: 'SQL charts' },
	section: { one: 'section', other: 'sections' },
	'custom-data': { one: 'custom dataset', other: 'custom datasets' }
} satisfies Record<DashboardItemConfig['kind'], { one: string; other: string }>
export function summarizeDashboardItemKinds(
	items: ReadonlyArray<Pick<DashboardItemConfig, 'kind'> | null | undefined>
) {
	const counts = new Map<string, { labels: { one: string; other: string }; count: number }>()
	for (const item of items) {
		if (!item || item.kind === 'section') continue
		const labels = DASHBOARD_ITEM_KIND_SUMMARY_LABELS[item.kind]
		const entry = counts.get(labels.other)
		if (entry) entry.count += 1
		else counts.set(labels.other, { labels, count: 1 })
	}
	const summary = Array.from(counts.values())
		.sort((a, b) => b.count - a.count)
		.slice(0, 3)
		.map(({ labels, count }) => `${count} ${count === 1 ? labels.one : labels.other}`)
		.join(', ')
	return counts.size > 3 ? `${summary} +${counts.size - 3} more` : summary
}
