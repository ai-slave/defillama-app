import type { DashboardItemConfig } from './dashboardItemConfig'
const USES_TIME_PERIOD_BY_ITEM_KIND = {
	chart: true,
	multi: true,
	builder: true,
	yields: true,
	stablecoins: true,
	'stablecoin-asset': true,
	'advanced-tvl': true,
	'advanced-borrowed': true,
	'unlocks-schedule': true,
	'llamaai-chart': true,
	'rwa-overview': true,
	'rwa-asset': true,
	'income-statement': false,
	'unlocks-pie': false,
	metric: false,
	text: false,
	'unified-table': false,
	sql: false,
	section: false,
	'custom-data': false
} satisfies Record<Exclude<DashboardItemConfig['kind'], 'dataset-table'>, boolean>
export function dashboardItemUsesTimePeriod(item: DashboardItemConfig) {
	return item.kind === 'dataset-table' ? item.datasetType === 'cex-analytics' : USES_TIME_PERIOD_BY_ITEM_KIND[item.kind]
}
export function dashboardItemsUseTimePeriod(items: ReadonlyArray<DashboardItemConfig>) {
	return items.some(dashboardItemUsesTimePeriod)
}
