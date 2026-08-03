import type { ChartConfig } from '../../types'
import { createChartConfig } from '../classicChartConfig'
import type { PersistedChartConfig } from '../persisted'
import { migrateClassicChartType } from './classicChartType'

/**
 * Converts the historical implicit chart subject into the current discriminated subject.
 * Protocol charts used to carry `chain: ''`; the empty chain was only a type-system sentinel
 * and never part of the protocol chart's meaning.
 */
export function migrateChartSubject(config: PersistedChartConfig): ChartConfig | null {
	const type = migrateClassicChartType(config.type)
	if ('subjectType' in config) {
		return createChartConfig({ ...config, type })
	}

	const { chain, protocol, ...chart } = config
	if (protocol) {
		return createChartConfig({
			...chart,
			type,
			subjectType: 'protocol',
			protocol
		})
	}
	return createChartConfig({ ...chart, type, subjectType: 'chain', chain })
}
