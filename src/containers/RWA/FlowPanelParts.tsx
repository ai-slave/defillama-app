import { Tooltip } from '~/components/Tooltip'
import { formatNum } from '~/utils'
import { formatSignedRWAFlow, getRWAFlowTextClass, type RWAFlowVsPriceSummary } from './flows'

/** Coverage below this share of days is flagged amber — flows meaningfully understate reality. */
const LOW_COVERAGE_THRESHOLD = 0.5

/**
 * Chart-toolbar metadata tag for flow data coverage. Deliberately NOT a
 * pill/button shape — it is a data caveat, not a control.
 */
export function RWAFlowCoverageTag({ coverage }: { coverage: number }) {
	const pct = formatNum(coverage * 100, 0)
	const isLow = coverage < LOW_COVERAGE_THRESHOLD

	return (
		<Tooltip
			content={`Flow data is available for ${pct}% of days in the selected period. Days without data are excluded from flows${
				isLow ? ', so totals likely understate real activity' : ''
			}.`}
			className={`body-sm underline decoration-dotted ${isLow ? 'text-amber-700 dark:text-amber-400' : 'text-tertiary'}`}
		>
			Data coverage: {pct}%
		</Tooltip>
	)
}

function FlowVsPriceStat({ label, value }: { label: string; value: number | null | undefined }) {
	return (
		<span className="inline-flex items-baseline gap-1 whitespace-nowrap">
			<span className="text-secondary">{label}</span>
			<span className={getRWAFlowTextClass(value)}>{formatSignedRWAFlow(value)}</span>
		</span>
	)
}

/**
 * Totals strip for the Flow vs price decomposition chart: the stacked bars
 * (net capital + price & unattributed) sum to the delta-mcap line, and this
 * reads out those totals with the flow-driven share as the headline.
 */
export function RWAFlowVsPriceStrip({
	summary,
	coverage
}: {
	summary: RWAFlowVsPriceSummary
	coverage?: number | null
}) {
	const isLowCoverage = coverage != null && coverage < LOW_COVERAGE_THRESHOLD

	return (
		<p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-2 pt-2 body-sm">
			{summary.flowDrivenPct != null ? (
				<>
					<Tooltip
						content={`Change in onchain mcap = measured net flows + a residual that includes price movement and flows on days without data coverage.${
							isLowCoverage
								? ` Only ${formatNum((coverage ?? 0) * 100, 0)}% of days have flow data, so the flow-driven share is likely understated.`
								: ''
						}`}
						className="font-medium underline decoration-dotted"
					>
						{formatNum(summary.flowDrivenPct, 0)}% flow-driven
					</Tooltip>
					<span aria-hidden className="text-tertiary">
						·
					</span>
				</>
			) : null}
			<FlowVsPriceStat label="Δ Onchain Mcap" value={summary.mcapChange} />
			<span aria-hidden className="text-tertiary">
				·
			</span>
			<FlowVsPriceStat label="Net flows" value={summary.netCapital} />
			<span aria-hidden className="text-tertiary">
				·
			</span>
			<FlowVsPriceStat label="Price & unattributed" value={summary.price} />
		</p>
	)
}
