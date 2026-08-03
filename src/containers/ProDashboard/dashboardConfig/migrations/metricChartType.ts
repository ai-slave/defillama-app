import type { MetricConfig } from '../../types'
import { createMetricConfig } from '../classicChartConfig'
import type { PersistedLegacyMetricConfig } from '../persisted'
import { migrateClassicChartType } from './classicChartType'

/** Converts the historical boolean display flag to the canonical metric chart type. */
export function migrateMetricChartType(config: PersistedLegacyMetricConfig): MetricConfig | null {
	const { showSparkline, subject, type, ...metric } = config
	const migratedBase = {
		...metric,
		chartType: metric.chartType ?? (showSparkline === false ? 'none' : 'sparkline')
	}
	return createMetricConfig({ ...migratedBase, subject, type: migrateClassicChartType(type) })
}
