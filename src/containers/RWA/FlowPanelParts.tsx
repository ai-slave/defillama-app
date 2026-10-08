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

export function RWAFlowValueShimmer({ label = 'Loading flow value' }: { label?: string }) {
	return (
		<span
			role="status"
			aria-label={label}
			className="inline-block h-3 w-12 animate-pulse rounded-sm bg-surface-elevated-2"
		/>
	)
}

export function RWAFlowValueUnavailable() {
	return (
		<Tooltip content="Flow data could not be loaded." className="text-secondary underline decoration-dotted">
			Unavailable
		</Tooltip>
	)
}

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

export function getRWAFlowDrivenCopy(summary: RWAFlowVsPriceSummary): { label: string; tooltip: string } | null {
	if (summary.flowDrivenPct == null) return null

	const percentage = formatPercent(Math.abs(summary.flowDrivenPct), {
		input: 'percent',
		maximumFractionDigits: 0
	})
	const decomposition = 'The market-cap change is split into measured flows and the price-and-unattributed remainder.'

	if (summary.netCapital === 0) {
		return {
			label: `${percentage} flow-driven`,
			tooltip: `Measured capital flows did not contribute to this asset's market-cap change over this period. ${decomposition}`
		}
	}

	const isGrowth = summary.mcapChange > 0
	const isInflow = summary.netCapital > 0
	const move = isGrowth ? 'growth' : 'decline'

	if (isGrowth === isInflow) {
		return {
			label: `${percentage} ${isInflow ? 'inflow' : 'outflow'}-driven`,
			tooltip: `${percentage} of this asset's ${move} over this period came from capital ${
				isInflow ? 'entering' : 'exiting'
			}. ${decomposition}`
		}
	}

	return {
		label: `${percentage} ${isInflow ? 'inflow' : 'outflow'} offset`,
		tooltip: `Capital ${isInflow ? 'inflows' : 'outflows'} offset this asset's ${move} by an amount equal to ${percentage} of its net market-cap ${
			isGrowth ? 'increase' : 'decrease'
		}. ${decomposition}`
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
	breakdown?: Array<RWAFlowVsPriceAssetSummary>
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
		<Tooltip content={content} render={<span className="inline-flex items-baseline gap-1 whitespace-nowrap" />}>
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
	breakdown?: Array<RWAFlowVsPriceAssetSummary>
}) {
	const flowDrivenCopy = getRWAFlowDrivenCopy(summary)

	return (
		<p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-2 pt-2 body-sm">
			{flowDrivenCopy ? (
				<>
					<Tooltip content={flowDrivenCopy.tooltip} className="font-medium underline decoration-dotted">
						{flowDrivenCopy.label}
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
