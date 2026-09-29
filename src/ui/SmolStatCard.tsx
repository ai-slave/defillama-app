import type { ReactElement, ReactNode } from 'react'
import { Card } from '~/ui/Card'
import { Tooltip } from '~/ui/Tooltip'
import { Watermark } from '~/ui/Watermark'

interface SmolStatCardProps {
	title: string
	tooltip: string
	/** The page the title opens, carrying its analytics attributes. */
	link?: ReactElement
	/** The headline; null reads "Unavailable". */
	value: string | null
	/** The window the value covers, such as "24h" or "next 14 days". */
	qualifier?: string
	/** The value's movement and what it is compared against, such as "over 7d" or "vs 24h ago". */
	change?: { text: string; tone: 'text-data-up' | 'text-data-down' | 'text-secondary'; comparison: string }
	/** 'split' puts the chart beside the text on xl, for the short home page row, and drops the mark there to fit. */
	layout?: 'stack' | 'split'
	/** Height classes; the grid decides how tall its cards are. */
	className?: string
	/** The chart or bars under the value line. */
	children: ReactNode
}

/** A small overview card: the title with its definition, the value and its change on one line, then the chart. */
export function SmolStatCard({
	title,
	tooltip,
	link,
	value,
	qualifier,
	change,
	layout = 'stack',
	className,
	children
}: SmolStatCardProps) {
	// Tooltip spreads its props over its default <span>, and taps only toggle it without `render`, so pass it only for a link.
	const heading = (
		<Tooltip {...(link ? { render: link } : null)} className="text-sm font-semibold" content={tooltip}>
			{title}
		</Tooltip>
	)
	const titleRow = (
		<div className="flex items-center justify-between gap-2">
			{heading}
			<Watermark className={layout === 'split' ? 'shrink-0 xl:hidden' : 'shrink-0'} />
		</div>
	)
	const valueLine =
		value == null ? (
			<p className="text-tertiary">Unavailable</p>
		) : (
			// The line wraps between its two groups, never inside one: value + qualifier, change + comparison.
			<p className="flex flex-wrap items-baseline gap-x-1">
				<span className="flex items-baseline gap-1 whitespace-nowrap">
					<span className="text-secondary">{value}</span>
					{qualifier ? <span className="text-tertiary">{qualifier}</span> : null}
				</span>
				{change ? (
					<span className="flex items-baseline gap-1 body-sm whitespace-nowrap">
						<span className={change.tone}>{change.text}</span>
						<span className="text-tertiary">{change.comparison}</span>
					</span>
				) : null}
			</p>
		)

	if (layout === 'split') {
		return (
			<Card
				padding="sm"
				className="col-span-1 flex max-h-[196px] min-h-[119px] flex-col gap-1 xl:min-h-[71px] xl:flex-row xl:flex-nowrap xl:gap-2 xl:*:last:flex-1"
			>
				<div className="flex flex-col gap-1">
					{titleRow}
					{valueLine}
				</div>
				{children}
			</Card>
		)
	}

	return (
		<Card padding="sm" className={`col-span-1 flex flex-col gap-1 ${className ?? ''}`.trim()}>
			{titleRow}
			{valueLine}
			{children}
		</Card>
	)
}
