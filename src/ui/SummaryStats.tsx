import type { ReactNode } from 'react'
import { Tooltip } from '~/components/Tooltip'
import { Card } from '~/ui/Card'

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
				className={`font-jetbrains text-2xl font-semibold ${
					truncate ? 'min-h-8 overflow-hidden text-ellipsis whitespace-nowrap' : ''
				} ${valueClassName ?? ''}`
					.replace(/\s+/g, ' ')
					.trim()}
			>
				{value}
			</span>
		</Container>
	)
}
