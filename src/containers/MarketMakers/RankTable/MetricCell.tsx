import type { DisplayMode } from '../constants'
import { formatMarketPct, formatMetricValue, type MetricFormatKind } from '../format'
import type { Metric } from '../types'

interface IProps {
	metric: Metric | null | undefined
	market?: Metric | null
	mode: DisplayMode
	kind: MetricFormatKind
	rowCount: number
}

function roundPct(value: number | null | undefined): string {
	return value == null ? 'N/A' : `${Math.round(value)}%`
}

export function MetricCell({ metric, market, mode, kind }: IProps) {
	if (!metric) return <span className="text-(--text-tertiary)">N/A</span>
	const hasTwin = market != null

	if (mode === 'value') {
		return (
			<span className="flex flex-col items-start">
				<span className="whitespace-nowrap">{formatMetricValue(metric.value, kind)}</span>
				{hasTwin ? (
					<span className="text-xs whitespace-nowrap opacity-70">{formatMarketPct(market!.value)}</span>
				) : null}
			</span>
		)
	}

	const top = mode === 'percentile' ? roundPct(metric.percentile) : metric.rank == null ? 'N/A' : `${metric.rank}`
	const topLabel = hasTwin ? (mode === 'percentile' ? 'Value: ' : 'Value Rank: ') : ''
	const sub = hasTwin
		? mode === 'percentile'
			? `% of Market: ${roundPct(market!.percentile)}`
			: `% of Market: ${market!.rank ?? 'N/A'}`
		: null

	return (
		<span className="flex flex-col items-start">
			<span className="font-medium whitespace-nowrap">
				{topLabel}
				{top}
			</span>
			{sub ? <span className="text-xs whitespace-nowrap opacity-70">{sub}</span> : null}
		</span>
	)
}
