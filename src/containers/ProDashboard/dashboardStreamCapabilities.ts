import type { DashboardItemConfig } from './dashboardItemConfig'

const NEEDS_PROTOCOL_CATALOG_BY_ITEM_KIND = {
	chart: true,
	multi: true,
	metric: true,
	builder: true,
	'advanced-tvl': true,
	'advanced-borrowed': true,
	'income-statement': true,
	'dataset-table': false,
	text: false,
	yields: false,
	stablecoins: false,
	'stablecoin-asset': false,
	'unified-table': false,
	'llamaai-chart': false,
	'unlocks-schedule': false,
	'unlocks-pie': false,
	'rwa-overview': false,
	'rwa-asset': false,
	sql: false,
	section: false,
	'custom-data': false
} satisfies Record<DashboardItemConfig['kind'], boolean>

export function dashboardStreamNeedsProtocolCatalog(items: ReadonlyArray<DashboardItemConfig>): boolean {
	for (const item of items) {
		if (NEEDS_PROTOCOL_CATALOG_BY_ITEM_KIND[item.kind]) return true
	}
	return false
}

const HAS_STREAM_SOURCES_BY_ITEM_KIND = {
	chart: true,
	multi: true,
	metric: true,
	builder: true,
	'advanced-tvl': true,
	'advanced-borrowed': true,
	'income-statement': true,
	'dataset-table': true,
	text: false,
	yields: true,
	stablecoins: true,
	'stablecoin-asset': true,
	'unified-table': true,
	'llamaai-chart': false,
	'unlocks-schedule': true,
	'unlocks-pie': true,
	'rwa-overview': true,
	'rwa-asset': true,
	sql: false,
	section: false,
	'custom-data': false
} satisfies Record<DashboardItemConfig['kind'], boolean>

export function dashboardItemHasStreamSources(item: Pick<DashboardItemConfig, 'kind'>): boolean {
	return HAS_STREAM_SOURCES_BY_ITEM_KIND[item.kind]
}
