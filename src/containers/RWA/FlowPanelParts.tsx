import { Tooltip } from '~/ui/Tooltip'
import { formatNum } from '~/utils'
import type { IRWAAssetFlowSummary, RWAChainFlowSummary } from './api.types'
import { definitions } from './definitions'
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

export function formatRWAChainFlowSummary(summary: RWAChainFlowSummary): string {
	switch (summary.status) {
		case 'measured': {
			const flow = formatSignedRWAFlow(summary.flow)
			return summary.coverage < 1 ? `${flow} (${formatNum(summary.coverage * 100, 0)}% coverage)` : flow
		}
		case 'notPriced':
			return 'not priced'
		case 'unknown':
			return 'unknown, not zero'
	}
}

export function RWAFlowSummaryTooltip({
	description,
	summary
}: {
	description: string
	summary: IRWAAssetFlowSummary | undefined
}) {
	const chains = summary ? Object.entries(summary.byChain) : []

	return (
		<span className="flex flex-col gap-2">
			<span>{description}</span>
			{summary && summary.coverage < 1 ? (
				<span className="text-secondary">Measured on {formatNum(summary.coverage * 100, 0)}% of days.</span>
			) : null}
			{chains.length > 0 ? (
				<span className="flex flex-col gap-1 border-t border-subtle pt-2">
					{chains.map(([chain, chainSummary]) => (
						<span key={chain} className="flex justify-between gap-4">
							<span>{chain}</span>
							<span className="font-jetbrains">{formatRWAChainFlowSummary(chainSummary)}</span>
						</span>
					))}
				</span>
			) : null}
		</span>
	)
}

function FlowVsPriceStat({
	label,
	value,
	tooltip
}: {
	label: string
	value: number | null | undefined
	tooltip: string
}) {
	return (
		<span className="inline-flex items-baseline gap-1 whitespace-nowrap">
			<Tooltip content={tooltip} className="text-secondary underline decoration-dotted">
				{label}
			</Tooltip>
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
						content={`Measured net flows were ${formatNum(summary.flowDrivenPct, 0)} percent of the marketcap change over this period. The marketcap change always splits into measured flows and price plus unmeasured days.${
							isLowCoverage
								? ` Only ${formatNum(coverage * 100, 0)}% of days have flow data, so this share is based on incomplete data.`
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
			<FlowVsPriceStat
				label={definitions.flows.deltaMcap.label}
				value={summary.mcapChange}
				tooltip={definitions.flows.deltaMcap.description}
			/>
			<span aria-hidden className="text-tertiary">
				·
			</span>
			<FlowVsPriceStat
				label={definitions.flows.netFlowsStat.label}
				value={summary.netCapital}
				tooltip={definitions.flows.netFlowsStat.description}
			/>
			<span aria-hidden className="text-tertiary">
				·
			</span>
			<FlowVsPriceStat
				label={definitions.flows.priceUnattributed.label}
				value={summary.price}
				tooltip={definitions.flows.priceUnattributed.description}
			/>
		</p>
	)
}
