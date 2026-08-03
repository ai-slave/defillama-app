import { normalizeChartBuilderConfig } from '../../chartBuilderCapabilities'
import type { ChartBuilderConfig } from '../../types'
import type { PersistedChartBuilderConfig } from '../persisted'

/**
 * Keeps historical Chart Builder configs compatible at read time. The persisted
 * record is not rewritten: the shared historical filter mode is expanded into
 * the four current dimensions, unsupported additional filters are discarded,
 * and top-N-only producers cannot offer an invented remainder or percentage share.
 */
export function migrateChartBuilder(config: PersistedChartBuilderConfig): ChartBuilderConfig {
	const {
		additionalFilters: _additionalFilters,
		filterMode = 'include',
		chainFilterMode = filterMode,
		categoryFilterMode = filterMode,
		chainCategoryFilterMode = filterMode,
		protocolCategoryFilterMode = filterMode,
		...builderConfig
	} = config.config
	const currentConfig: ChartBuilderConfig['config'] = {
		...builderConfig,
		chainFilterMode,
		categoryFilterMode,
		chainCategoryFilterMode,
		protocolCategoryFilterMode
	}
	return { ...config, config: normalizeChartBuilderConfig(currentConfig) }
}
