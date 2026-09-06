import type { DashboardItemConfig } from './dashboardItemConfig'
import type { UnifiedTableConfig } from './unifiedTable/config/current'
import { sanitizeUnifiedTableRowHeaders } from './unifiedTable/config/layoutPolicy'
import type { ProtocolRowMembership } from './unifiedTable/config/protocolRowMembership'
import type { UnifiedRowHeaderType } from './unifiedTable/config/types'
import type {
	ProtocolBaseMetricFamily,
	ProtocolPointMetric,
	ProtocolSupplementalMetric
} from './unifiedTable/protocolCapabilities'
import { getUnifiedTableQueryIdentity } from './unifiedTableQuery'

export interface UnifiedTableStreamSource {
	config: UnifiedTableConfig
	rowHeaders: Array<UnifiedRowHeaderType>
	baseMetricFamilies: Array<ProtocolBaseMetricFamily>
	pointMetrics: Array<ProtocolPointMetric>
	supplementalMetrics: Array<ProtocolSupplementalMetric>
	needsOracleMembership: boolean
	rowMembership: ProtocolRowMembership
	cacheKey: string
}

export function buildUnifiedTableStreamSourcePlan(
	items: ReadonlyArray<DashboardItemConfig>
): Array<UnifiedTableStreamSource> {
	const sources = new Map<string, UnifiedTableStreamSource>()

	for (const item of items) {
		if (item.kind !== 'unified-table') continue
		const rowHeaders = sanitizeUnifiedTableRowHeaders(item.rowHeaders)
		const identity = getUnifiedTableQueryIdentity(item, rowHeaders)
		const cacheKey = JSON.stringify(identity.queryKey)
		if (sources.has(cacheKey)) continue
		sources.set(cacheKey, {
			config: item,
			rowHeaders: identity.sourceGranularity === 'chain' ? ['chain'] : [],
			baseMetricFamilies: identity.baseMetricFamilies,
			pointMetrics: identity.pointMetrics,
			supplementalMetrics: identity.supplementalMetrics,
			needsOracleMembership: identity.needsOracleMembership,
			rowMembership: identity.rowMembership,
			cacheKey
		})
	}

	return Array.from(sources.values())
}
