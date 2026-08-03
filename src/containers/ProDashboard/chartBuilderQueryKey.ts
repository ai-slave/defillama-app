import type { ChartBuilderConfig } from './types'

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
		config.chainFilterMode,
		config.categoryFilterMode,
		config.chainCategoryFilterMode,
		config.protocolCategoryFilterMode
	]
}
