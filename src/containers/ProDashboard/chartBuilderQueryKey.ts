import type { ChartBuilderConfig } from './types'

export type ChartBuilderFilterMode = 'include' | 'exclude'

export function resolveChartBuilderFilterMode(value?: unknown, fallback?: unknown): ChartBuilderFilterMode {
	// Saved dashboards are external JSON and may contain stale or malformed enum values.
	if (value === 'include' || value === 'exclude') return value
	if (fallback === 'include' || fallback === 'exclude') return fallback
	return 'include'
}

/** This identity is shared by saved cards and server-stream cache seeding. */
export function getChartBuilderQueryKey(config: ChartBuilderConfig['config']): readonly unknown[] {
	return [
		'pro-dashboard',
		'chartBuilder',
		config.mode,
		config.metric,
		config.protocol,
		config.chains,
		config.limit,
		config.categories,
		config.chainCategories,
		config.protocolCategories,
		config.hideOthers,
		config.groupByParent,
		resolveChartBuilderFilterMode(config.chainFilterMode, config.filterMode),
		resolveChartBuilderFilterMode(config.categoryFilterMode, config.filterMode),
		resolveChartBuilderFilterMode(config.chainCategoryFilterMode, config.filterMode),
		resolveChartBuilderFilterMode(config.protocolCategoryFilterMode, config.filterMode)
	]
}
