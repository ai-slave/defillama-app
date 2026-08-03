import { toInternalSlug } from '~/utils/chainNormalizer'
import type { UnifiedTableConfig } from './unifiedTable/config/current'
import { getProtocolRowMembership, getProtocolRowMembershipKey } from './unifiedTable/config/protocolRowMembership'
import type { UnifiedRowHeaderType } from './unifiedTable/config/types'
import { getProtocolMetricCapabilities } from './unifiedTable/protocolCapabilities'

export function getUnifiedTableQueryIdentity(config: UnifiedTableConfig, rowHeaders: UnifiedRowHeaderType[]) {
	const chains = new Set<string>()
	for (const chain of config.params?.chains ?? []) {
		const trimmed = chain.trim()
		if (!trimmed || trimmed.toLowerCase() === 'all') continue
		chains.add(toInternalSlug(trimmed))
	}

	const paramsKey = JSON.stringify({
		chains: Array.from(chains).sort(),
		category: config.params?.category?.trim() || null
	})
	const sourceGranularity = rowHeaders.includes('chain') || chains.size > 0 ? 'chain' : 'aggregate'
	const rowMembership = getProtocolRowMembership(config)
	const rowMembershipKey = getProtocolRowMembershipKey(rowMembership)
	const { baseMetricFamilies, requestedRatioDependencies, pointMetrics, supplementalMetrics, needsOracleMembership } =
		getProtocolMetricCapabilities(config)
	const baseMetricFamiliesKey = baseMetricFamilies.join('|')
	const pointMetricsKey = pointMetrics.join('|')
	const supplementalMetricsKey = supplementalMetrics.join('|')

	return {
		paramsKey,
		sourceGranularity,
		baseMetricFamilies,
		requestedRatioDependencies,
		pointMetrics,
		supplementalMetrics,
		needsOracleMembership,
		rowMembership,
		rowMembershipKey,
		queryKey: [
			'pro-dashboard',
			'unified-table',
			config.strategy,
			paramsKey,
			sourceGranularity,
			rowMembershipKey,
			baseMetricFamiliesKey,
			pointMetricsKey,
			supplementalMetricsKey,
			needsOracleMembership
		] as const
	}
}

export function buildUnifiedTableQueryString(config: UnifiedTableConfig, rowHeaders: UnifiedRowHeaderType[]): string {
	const params = new URLSearchParams()
	const { baseMetricFamilies, pointMetrics, supplementalMetrics, needsOracleMembership, rowMembershipKey } =
		getUnifiedTableQueryIdentity(config, rowHeaders)

	for (const header of rowHeaders) params.append('rowHeaders[]', header)
	for (const chain of config.params?.chains ?? []) params.append('chains[]', chain)
	if (config.params?.category) params.set('category', config.params.category)
	for (const family of baseMetricFamilies) params.append('baseMetricFamilies[]', family)
	for (const metric of pointMetrics) params.append('pointMetrics[]', metric)
	for (const metric of supplementalMetrics) params.append('supplementalMetrics[]', metric)
	if (needsOracleMembership) params.set('oracleMembership', 'true')
	params.set('rowMembership', rowMembershipKey)

	return params.toString()
}
