import type { ChartBuilderConfig } from './types'
import { PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS } from './utils/breakdownMetrics'

type ChartBuilderSeriesScope = Pick<
	ChartBuilderConfig['config'],
	'metric' | 'mode' | 'protocol' | 'chains' | 'chainCategories'
>

/** Whether the producer returns an exact remainder for percentage and "All" views. */
export function chartBuilderHasExactRemainder({
	metric,
	mode,
	protocol,
	chains,
	chainCategories
}: ChartBuilderSeriesScope): boolean {
	if (mode !== 'protocol') return true
	if (protocol && protocol.toLowerCase() !== 'all') return true
	if (metric === 'stablecoins') return true
	return metric === 'tvl' && chains.length === 0 && (!chainCategories || chainCategories.length === 0)
}

/** Keeps editor and persisted Chart Builder state within the producer's exact capabilities. */
export function normalizeChartBuilderConfig(config: ChartBuilderConfig['config']): ChartBuilderConfig['config'] {
	let normalized = config
	if (normalized.mode === 'chains' && PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS.has(normalized.metric)) {
		normalized = { ...normalized, metric: 'tvl', chartType: 'stackedArea' }
	}
	if (
		normalized.mode === 'protocol' &&
		PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS.has(normalized.metric) &&
		normalized.protocol
	) {
		const { protocol: _protocol, ...withoutProtocol } = normalized
		normalized = withoutProtocol
	}
	if (normalized.mode !== 'protocol') return normalized

	const hasExactRemainder = chartBuilderHasExactRemainder(normalized)
	const forceHideOthers =
		!hasExactRemainder || Boolean(normalized.chainCategories?.length) || Boolean(normalized.protocolCategories?.length)
	if ((!forceHideOthers || normalized.hideOthers) && (hasExactRemainder || normalized.displayAs !== 'percentage')) {
		return normalized
	}
	return {
		...normalized,
		...(forceHideOthers ? { hideOthers: true } : {}),
		...(!hasExactRemainder && normalized.displayAs === 'percentage' ? { displayAs: 'timeSeries' } : {})
	}
}
