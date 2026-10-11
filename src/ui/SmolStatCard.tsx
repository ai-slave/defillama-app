import type { ReactElement, ReactNode } from 'react'
import { Card } from '~/ui/Card'
import { Change, type ChangeData } from '~/ui/Change'
import { SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { Watermark } from '~/ui/Watermark'
import type { QueryRetry } from '~/utils/query'

interface SmolStatCardProps {
	title: string
	tooltip: string
	/** The page the title opens, carrying its analytics attributes. */
	link?: ReactElement
	/** The headline; null reads "Unavailable". */
	value: string | null
	/** The card's data is still loading: the state takes the value line and the chart, so a pending card never reads
	    "Unavailable". */
	isLoading?: boolean
	/** The read behind the card failed: its error and Try again take the value line and the chart, so a failed card
	    never reads like one with no data. */
	failedRead?: QueryRetry | null
	/** The window the value covers, such as "24h" or "next 14 days". */
	qualifier?: string
	/** The value's movement and its window, such as "over 7d" or "vs 24h ago". */
	change?: ChangeData
	/** 'split' puts the chart beside the text on xl, for the short home page row, and drops the mark there to fit. */
	layout?: 'stack' | 'split'
	/** Height classes; the grid decides how tall its cards are. */
	className?: string
	/** The chart or bars under the value line. */
	children: ReactNode
}

/** A small chart-forward stat card: a title-md title with its definition and the DefiLlama mark, one value line, then
    the chart. The line reads value → qualifier → change → comparison: the value is text-secondary, the signed change
    a body-sm Change, and qualifiers bare tertiary spans one tier below what they qualify, with no parentheses. A
    missing value reads a tertiary "Unavailable"; a pending or failed request takes the value line and the chart with
    the Status copy instead. The line wraps only between its two groups (value + qualifier,
    change + comparison) and never truncates the value. */
export function SmolStatCard({
	title,
	tooltip,
	link,
	value,
	isLoading,
	failedRead,
	qualifier,
	change,
	layout = 'stack',
	className,
	children
}: SmolStatCardProps) {
	// Tooltip spreads its props over its default <span>, and taps only toggle it without `render`, so pass it only for a link.
	const heading = (
		<Tooltip {...(link ? { render: link } : null)} className="title-md" content={tooltip}>
			{title}
		</Tooltip>
	)
	const titleRow = (
		<div className="flex items-center justify-between gap-2">
			{heading}
			<Watermark className={layout === 'split' ? 'shrink-0 xl:hidden' : 'shrink-0'} />
		</div>
	)
	// min-h-0 drops the parts' 360px panel floor: the grid sets the card's height.
	const body = failedRead ? (
		<SurfaceBodyStatus variant="error" retry={failedRead} className="min-h-0">
			Couldn&apos;t load card data.
		</SurfaceBodyStatus>
	) : isLoading ? (
		<SurfaceBodyLoadingStatus className="min-h-0" />
	) : null
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
					<span className="flex items-baseline gap-1 body-sm whitespace-nowrap text-secondary">
						<Change value={change.value} unit={change.unit} tooltip={change.tooltip} />
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
					{body ? null : valueLine}
				</div>
				{body ?? children}
			</Card>
		)
	}

	return (
		<Card padding="sm" className={`col-span-1 flex flex-col gap-1 ${className ?? ''}`.trim()}>
			{titleRow}
			{body ?? (
				<>
					{valueLine}
					{children}
				</>
			)}
		</Card>
	)
}
