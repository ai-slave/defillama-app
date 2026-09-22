import type { ReactNode } from 'react'
import { Card } from '~/ui/Card'
import { Tooltip } from '~/ui/Tooltip'

/* ----------------------------------------------------------------------------
   Summary-card layout (design.md → Summary metric cards, variants 1–2).

   <SummaryCardGrid>            page grid: summary card (1 col on xl) + chart
     <SummaryStatsCard>         the stats card
       <StatItem … />           headline label/value stacks
       …MetricRow / children…   rows, toggles, footers stay at the callsite
     </SummaryStatsCard>
     <ChartPanel className="col-span-2">…                     (route-owned)
   </SummaryCardGrid>

   These replace the grid/card/stat strings that were copy-pasted across
   ~19 route files. Titles (h1 + logo) and change badges vary legitimately
   and remain callsite JSX.
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
	return (
		<Card
			padding={padding}
			className={`col-span-2 flex w-full flex-col ${gap === 'sm' ? 'gap-3' : 'gap-6'} overflow-x-auto xl:col-span-1 ${className ?? ''}`.trim()}
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
	className?: string
	/** Layout-only additions; the type comes from the recipe. */
	valueClassName?: string
	/** Single-line value that ellipsizes instead of wrapping (reserves control height). */
	truncate?: boolean
}

/** Headline stat: text-secondary label over a font-jetbrains text-2xl font-semibold value. */
export function StatItem({
	label,
	value,
	tooltip,
	labelAs = 'span',
	className,
	valueClassName,
	truncate
}: StatItemProps) {
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
			<span
				className={`font-jetbrains text-2xl font-semibold ${truncate ? 'min-h-8 truncate' : ''} ${valueClassName ?? ''}`
					.replace(/\s+/g, ' ')
					.trim()}
			>
				{value}
			</span>
		</Container>
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

/** Inline stat strip (design.md → Summary metric cards, inline variant): a
    full-width Card of `label: value` pairs above a table or chart. One rhythm
    everywhere — strip padding, 14px pairs (body-md secondary labels, label-md
    values), 24px item gaps. `stacked` puts each label over its value for
    dense one-row headers. */
export function InlineStatStrip({
	items,
	stacked,
	className
}: {
	items: Array<InlineStatStripItem>
	stacked?: boolean
	className?: string
}) {
	return (
		<Card
			as="dl"
			padding="strip"
			className={`flex w-full flex-wrap items-center gap-x-6 gap-y-2 ${className ?? ''}`.trim()}
		>
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
