import { Tooltip } from '~/ui/Tooltip'
import { formatPercent } from '~/utils/numberFormat'
import type { IRWAAssetFlowSummary, RWAChainFlowSummary } from './api.types'
import { definitions } from './definitions'
import {
	formatSignedRWAFlow,
	getRWAFlowTextClass,
	type RWAFlowVsPriceAssetSummary,
	type RWAFlowVsPriceSummary
} from './flows'

/** Coverage below this share of days is flagged amber — flows meaningfully understate reality. */
const LOW_COVERAGE_THRESHOLD = 0.5

export const RWAFlowValueShimmer = ({ label = 'Loading flow value' }: { label?: string }) => (
	<span
		role="status"
		aria-label={label}
		className="inline-block h-3 w-12 animate-pulse rounded-sm bg-tertiary opacity-20"
	/>
)

export const RWAFlowValueUnavailable = () => (
	<Tooltip content="Flow data could not be loaded." className="text-secondary underline decoration-dotted">
		Unavailable
	</Tooltip>
)

/**
 * Chart-toolbar metadata tag for flow data coverage. Deliberately NOT a
 * pill/button shape — it is a data caveat, not a control.
 */
export function RWAFlowCoverageTag({ coverage }: { coverage: number }) {
	const pct = formatPercent(coverage, { input: 'fraction', maximumFractionDigits: 0 })
	const isLow = coverage < LOW_COVERAGE_THRESHOLD

	return (
		<Tooltip
			content={`Flow data is available for ${pct} of days in the selected period. Days without data are excluded from flows${
				isLow ? ', so totals likely understate real activity' : ''
			}.`}
			className={`body-sm underline decoration-dotted ${isLow ? 'text-warning' : 'text-tertiary'}`}
		>
			Data coverage: {pct}
		</Tooltip>
	)
}

export function formatRWAChainFlowSummary(summary: RWAChainFlowSummary): string {
	switch (summary.status) {
		case 'measured': {
			const flow = formatSignedRWAFlow(summary.flow)
			return summary.coverage < 1
				? `${flow} (${formatPercent(summary.coverage, { input: 'fraction', maximumFractionDigits: 0 })} coverage)`
				: flow
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
				<span className="text-secondary">
					Measured on {formatPercent(summary.coverage, { input: 'fraction', maximumFractionDigits: 0 })} of days.
				</span>
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
	tooltip,
	breakdown,
	valueKey
}: {
	label: string
	value: number | null | undefined
	tooltip: string
	breakdown?: RWAFlowVsPriceAssetSummary[]
	valueKey: 'mcapChange' | 'netCapital' | 'price'
}) {
	const content = breakdown?.length ? (
		<span className="flex flex-col gap-2">
			<span>{tooltip}</span>
			<span className="flex flex-col gap-1 border-t border-subtle pt-2">
				{breakdown.map((asset) => (
					<span key={asset.key} className="flex justify-between gap-4">
						<span>{asset.label}</span>
						<span className={`font-jetbrains ${getRWAFlowTextClass(asset.summary[valueKey])}`}>
							{formatSignedRWAFlow(asset.summary[valueKey])}
						</span>
					</span>
				))}
			</span>
		</span>
	) : (
		tooltip
	)

	return (
		<Tooltip content={content} className="inline-flex items-baseline gap-1 whitespace-nowrap">
			<span className="text-secondary underline decoration-dotted">{label}</span>
			<span className={getRWAFlowTextClass(value)}>{formatSignedRWAFlow(value)}</span>
		</Tooltip>
	)
}

/**
 * Totals strip for the Flow vs price decomposition chart: the stacked bars
 * (net capital + price & unattributed) sum to the delta-mcap line, and this
 * reads out those totals with the flow-driven share as the headline.
 */
export function RWAFlowVsPriceStrip({
	summary,
	breakdown
}: {
	summary: RWAFlowVsPriceSummary
	breakdown?: RWAFlowVsPriceAssetSummary[]
}) {
	return (
		<p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-2 pt-2 body-sm">
			{summary.flowDrivenPct != null ? (
				<>
					<Tooltip
						content={`${formatPercent(summary.flowDrivenPct, { input: 'percent', maximumFractionDigits: 0 })} of this asset's growth over this period came from real money entering, not from price going up. The marketcap change always splits into two parts: measured flows, and price plus unmeasured days.`}
						className="font-medium underline decoration-dotted"
					>
						{formatPercent(summary.flowDrivenPct, { input: 'percent', maximumFractionDigits: 0 })} flow-driven
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
				{...(breakdown ? { breakdown } : {})}
				valueKey="mcapChange"
			/>
			<span aria-hidden className="text-tertiary">
				·
			</span>
			<FlowVsPriceStat
				label={definitions.flows.netFlowsStat.label}
				value={summary.netCapital}
				tooltip={definitions.flows.netFlowsStat.description}
				{...(breakdown ? { breakdown } : {})}
				valueKey="netCapital"
			/>
			<span aria-hidden className="text-tertiary">
				·
			</span>
			<FlowVsPriceStat
				label={definitions.flows.priceUnattributed.label}
				value={summary.price}
				tooltip={definitions.flows.priceUnattributed.description}
				{...(breakdown ? { breakdown } : {})}
				valueKey="price"
			/>
		</p>
	)
}
