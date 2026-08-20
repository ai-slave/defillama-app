import { Panel } from '~/ui/Panel'

export function LpPerformanceInsights({
	mmDepthPct,
	mmVolumePct,
	avgSpreadPct
}: {
	mmDepthPct: number | null
	mmVolumePct: number | null
	avgSpreadPct: number | null
}) {
	const fmt = (value: number | null) => (value == null ? 'N/A' : `${value.toFixed(2)}%`)
	return (
		<Panel padding="none">
			<div className="border-b border-subtle px-4 py-3">
				<h3 className="label-lg">Performance Insights</h3>
			</div>
			<p className="p-4 text-xl leading-relaxed">
				Within all spot exchanges, all market makers represent <span className="text-link">{fmt(mmDepthPct)}</span> of
				two-sided liquidity, <span className="text-link">{fmt(mmVolumePct)}</span> of total volume, and have maintained
				average spreads of <span className="text-link">{fmt(avgSpreadPct)}</span> in the past 30 days.
			</p>
		</Panel>
	)
}
