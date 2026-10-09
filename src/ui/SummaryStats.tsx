import type { ReactNode } from 'react'
import { Card } from '~/ui/Card'
import { Skeleton } from '~/ui/Skeleton'
import { Tooltip } from '~/ui/Tooltip'
import { formatPercentChange } from '~/utils/numberFormat'

/* ----------------------------------------------------------------------------
   Summary metric cards: the overview card beside a page's main chart.

   <SummaryCardGrid>            page grid: summary card (1 col on xl) + chart
     <SummaryStatsCard>         the stats card; gap="sm" only for dense rows
       <StatItem … />           headline label over a mono-xl value
       <SummaryChange … />      the headline's change beside its StatItem
       <KeyMetricsPanel>…       rows (./KeyMetricsCard.tsx, ./MetricPrimitives.tsx)
     </SummaryStatsCard>
     <ChartPanel className="col-span-2">…                     (route-owned)
   </SummaryCardGrid>

   Three variants; pick one, never a hybrid:
   1. Headline + "Key Metrics" heading + metric rows (chain and protocol
      overviews): StatItem, then KeyMetricsPanel.
   2. Headline + metric rows, no heading (adapter and token overviews):
      StatItem, then MetricRow rows without KeyMetricsPanel.
   3. Stat stack (stablecoins overview): label-md text-secondary over a
      mono-xl headline, then compact rows with label-md text-secondary
      labels and non-bold mono-md values; no heading, no bold rows.
   Every overview card beside a page's chart renders through
   SummaryCardGrid + SummaryStatsCard (chain, protocol, token, equity and
   RWA asset pages included); never hand-roll the grid or the card. A card
   shown only on desktop passes className="max-xl:hidden".
   Titles (h1 + logo) and collapsible bodies stay callsite JSX. A grid of
   stat tiles (KPI rows) is StatTile; never a page-local KpiCard. Every
   headline change renders
   through SummaryChange; never hand-roll the percent and its window.

   Inline summary strips above a table or chart use InlineStatStrip; never
   hand-roll a new strip.
---------------------------------------------------------------------------- */

export function SummaryCardGrid({ className, children }: { className?: string; children: ReactNode }) {
	return (
		<div className={`relative isolate grid grid-cols-2 gap-2 xl:grid-cols-3 ${className ?? ''}`.trim()}>{children}</div>
	)
}

export function SummaryStatsCard({
	padding = 'md',
	gap = 'md',
	className,
	children
}: {
	padding?: 'sm' | 'md'
	/** 'sm' (gap-3) only where rows are dense; default matches the canonical gap-6. */
	gap?: 'sm' | 'md'
	className?: string
	children: ReactNode
}) {
	// No overflow class: any overflow value makes the card a scroll container, and the 44px .touch-target area of a
	// small footer button then pokes past the 8px padding and scrolls the card on touch screens.
	return (
		<Card
			padding={padding}
			className={`col-span-2 flex w-full flex-col ${gap === 'sm' ? 'gap-3' : 'gap-6'} xl:col-span-1 ${className ?? ''}`.trim()}
		>
			{children}
		</Card>
	)
}

interface StatItemProps {
	label: ReactNode
	value: ReactNode
	/** Definition shown in a dotted-underline tooltip on the label. */
	tooltip?: ReactNode
	/** First stat often doubles as the page heading; headings force a div container (invalid inside p). */
	labelAs?: 'span' | 'h1' | 'h2'
	/** Layout-only additions; the type comes from the recipe. */
	className?: string
	/** Single-line value that ellipsizes instead of wrapping (reserves control height). */
	truncate?: boolean
}

/** Headline stat: text-secondary label over a mono-xl value. */
export function StatItem({ label, value, tooltip, labelAs = 'span', className, truncate }: StatItemProps) {
	const Container = labelAs === 'span' ? 'p' : 'div'
	const Label = labelAs

	return (
		<Container className={`flex flex-col ${className ?? ''}`.trim()}>
			{tooltip ? (
				<Tooltip content={tooltip} render={<Label />} className="text-secondary underline decoration-dotted">
					{label}
				</Tooltip>
			) : (
				<Label className="text-secondary">{label}</Label>
			)}
			<span className={`${truncate ? ' min-h-8 truncate' : ''} mono-xl`}>{value}</span>
		</Container>
	)
}

/** A headline's change beside its StatItem: the signed percent colored by direction, then what it is compared against. */
export function SummaryChange({
	percent,
	comparison,
	tooltip
}: {
	percent: number
	/** A comparison window the caller words from the metric's definition: "over 24h", or "vs 24h ago" for a rolling
	    value against its own earlier snapshot. The component never adds "over" itself. */
	comparison: string
	/** The same movement in another unit, such as the dollar change; underlines the percent. */
	tooltip?: string
}) {
	const tone = percent > 0 ? 'text-data-up' : percent < 0 ? 'text-data-down' : 'text-secondary'
	const className = 'relative bottom-0.5 flex flex-nowrap items-center gap-1'
	const children = (
		<>
			<span className={`truncate mono-md ${tone} ${tooltip ? 'underline decoration-dotted' : ''}`.trim()}>
				{formatPercentChange(percent)}
			</span>
			<span className="body-md text-tertiary">{comparison}</span>
		</>
	)

	return tooltip ? (
		<Tooltip content={tooltip} className={className}>
			{children}
		</Tooltip>
	) : (
		<p className={className}>{children}</p>
	)
}

export interface InlineStatStripItem {
	tooltip?: ReactNode
	label: string
	/** Keeps the label for screen readers only, for a self-describing value such as a market name. */
	labelHidden?: boolean
	value: ReactNode
	/** Optional delta text rendered after the value. */
	change?: ReactNode
	/** Tone/color classes for the change (e.g. text-data-up); type comes from the recipe. */
	changeClassName?: string
}

/** Inline stat strip: a full-width Card of `label: value` pairs above a table or chart. One rhythm everywhere: strip
    padding, 14px pairs (body-md secondary labels, label-md values), an optional colored change, 24px item gaps.
    `stacked` puts each label over its value for dense one-row headers. */
export function InlineStatStrip({ items, stacked }: { items: Array<InlineStatStripItem>; stacked?: boolean }) {
	return (
		<Card as="dl" padding="strip" className="flex w-full flex-wrap items-center gap-x-6 gap-y-2">
			{items.map((item) => (
				<div key={item.label} className={stacked ? 'flex flex-col' : 'flex items-baseline gap-1.5'}>
					<dt className={item.labelHidden ? 'sr-only' : 'body-md text-secondary'}>
						{item.tooltip ? (
							<Tooltip
								content={item.tooltip}
								tabIndex={0}
								className="cursor-help underline decoration-dotted underline-offset-4"
							>
								{item.label}
							</Tooltip>
						) : (
							item.label
						)}
					</dt>
					<dd className="label-md">{item.value}</dd>
					{item.change != null ? (
						<dd className={`label-md ${item.changeClassName ?? ''}`.trim()}>{item.change}</dd>
					) : null}
				</div>
			))}
		</Card>
	)
}

/** A stat tile in a grid of tiles (investor dashboards, KPI rows): a Card with a label-sm text-secondary label over a
    mono-xl value, an optional body-sm tertiary line under it, and a definition as a dotted-underline tooltip on the
    label. `change` sits beside the value, coloured by its sign (the data up/down tones). `loading` draws the value's
    Skeleton at the same height, so the grid does not jump. A value that is missing once loaded is "—", which the
    caller passes. Lay tiles out with a grid at the call site. */
export function StatTile({
	label,
	tooltip,
	sub,
	change,
	...state
}: {
	label: string
	tooltip?: ReactNode
	sub?: ReactNode
	/** A signed change and its formatted text, e.g. { value: -3.1, formatted: '-3.1%' }. */
	change?: { value: number; formatted: string }
} & ({ loading: true } | { loading?: false; value: ReactNode })) {
	return (
		<Card padding="md" className="flex min-w-0 flex-col gap-1">
			{tooltip ? (
				<Tooltip
					content={tooltip}
					tabIndex={0}
					className="w-fit cursor-help label-sm text-secondary underline decoration-dotted underline-offset-4"
				>
					{label}
				</Tooltip>
			) : (
				<span className="label-sm text-secondary">{label}</span>
			)}
			{'value' in state ? (
				<span className="flex flex-wrap items-baseline gap-x-2">
					<span className="mono-xl break-words text-primary">{state.value}</span>
					{change ? (
						<span
							className={`label-sm ${change.value > 0 ? 'text-data-up' : change.value < 0 ? 'text-data-down' : 'text-secondary'}`}
						>
							{change.formatted}
						</span>
					) : null}
				</span>
			) : (
				<Skeleton className="h-8 w-24" />
			)}
			{sub ? <span className="body-sm text-tertiary">{sub}</span> : null}
		</Card>
	)
}
