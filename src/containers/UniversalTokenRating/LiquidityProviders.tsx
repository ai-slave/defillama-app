import { Panel } from '~/ui/Panel'
import { formatPercent } from '~/utils/numberFormat'
import { UTR_PERCENT_OPTIONS } from './constants'

export function LpPerformanceInsights({
	mmDepthPct,
	mmVolumePct,
	avgSpreadPct
}: {
	mmDepthPct: number | null
	mmVolumePct: number | null
	avgSpreadPct: number | null
}) {
	return (
		<Panel padding="none">
			<div className="border-b border-subtle px-4 py-3">
				<h3 className="label-lg">Performance Insights</h3>
			</div>
			<p className="p-4 body-xl">
				Within all spot exchanges, all market makers represent{' '}
				<span className="text-link">{formatPercent(mmDepthPct, UTR_PERCENT_OPTIONS) ?? 'N/A'}</span> of two-sided
				liquidity, <span className="text-link">{formatPercent(mmVolumePct, UTR_PERCENT_OPTIONS) ?? 'N/A'}</span> of
				total volume, and have maintained average spreads of{' '}
				<span className="text-link">{formatPercent(avgSpreadPct, UTR_PERCENT_OPTIONS) ?? 'N/A'}</span> in the past 30
				days.
			</p>
		</Panel>
	)
}
