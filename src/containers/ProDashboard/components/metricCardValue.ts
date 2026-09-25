import { formatCompactNumber, formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import type { MetricConfig } from '../types'

export type MetricValueFormat = 'currency' | 'number' | 'percent'

const COUNT_METRIC_TYPES: ReadonlySet<string> = new Set(['activeUsers', 'newUsers', 'txs'])
const PERCENT_OPTIONS = {
	input: 'percent',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	useGrouping: false
} as const
const COMPACT_OPTIONS = { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' } as const

/** A saved format wins; otherwise growth and APY read as percents, counts as numbers, the rest as USD. */
export function getMetricValueFormat(metric: Pick<MetricConfig, 'type' | 'aggregator' | 'format'>): MetricValueFormat {
	const saved = metric.format?.value
	if (saved && saved !== 'auto') return saved
	if (metric.aggregator === 'growth' || metric.type === 'medianApy') return 'percent'
	return COUNT_METRIC_TYPES.has(metric.type) ? 'number' : 'currency'
}

export function formatMetricValue(input: number | null | undefined, format: MetricValueFormat): string {
	if (input == null) return '-'
	if (format === 'currency') return formatUsd(input, COMPACT_OPTIONS)
	if (format === 'number')
		return formatCompactNumber(input, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
	return formatPercent(input, PERCENT_OPTIONS)
}

/**
 * The comparison against the previous window: its direction, and the badge label with its arrow. A change
 * too small to show at two decimals has no label.
 */
export function getMetricDelta(
	delta: number | null | undefined,
	deltaPct: number | null | undefined,
	format: MetricValueFormat,
	compareFormat: 'percent' | 'absolute'
): { direction: 'up' | 'down' | 'flat'; label: string | null } {
	const change = delta ?? deltaPct ?? 0
	const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
	const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : ''
	let text: string | null = null
	if (compareFormat === 'absolute') {
		if (delta != null && Math.abs(delta) >= (format === 'percent' ? 0.005 : 1e-12)) {
			text =
				format === 'currency'
					? formatUsd(delta, COMPACT_OPTIONS)
					: format === 'percent'
						? `${formatNumber(delta)}pp`
						: formatCompactNumber(delta, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
		}
	} else if (deltaPct != null && Math.abs(deltaPct) >= 0.005) {
		text = `${deltaPct > 0 ? '+' : ''}${formatPercent(deltaPct, PERCENT_OPTIONS)}`
	}
	return { direction, label: text === null ? null : `${arrow}${text}` }
}
