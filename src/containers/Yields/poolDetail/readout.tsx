// The strip between a chart panel's header and its plot. One rhythm for both measured charts: every
// item is a label over a value, figures and controls alike, so the row reads as a single ledger
// instead of a stat block with a form bolted to the end.

import type { ReactNode } from 'react'
import { Tooltip } from '~/ui/Tooltip'
import { tw } from '~/ui/tw'

export const readoutBlockStyles = tw`border-b border-subtle px-4 py-2.5`
export const readoutCellsStyles = tw`flex flex-wrap items-baseline gap-x-7 gap-y-3`

// A colour key belongs ON the plot, not in the strip above it: in the strip it describes something
// it is not next to, and it has to take a tier of its own to do it. Over the plot it is read where
// the colours are and costs no height. Only the keys themselves take pointer events, so the box
// never swallows the chart's own hover.
export const readoutKeysStyles = tw`pointer-events-none absolute top-1.5 right-3 z-10 flex flex-wrap justify-end gap-x-3.5 gap-y-1 rounded-md px-2 py-1 body-xs text-tertiary`

/** Enough surface to stay legible over a dense plot without hiding it. */
export const READOUT_KEYS_BACKDROP = 'color-mix(in srgb, var(--bg-surface) 82%, transparent)'

/** Stands in for a figure a pool cannot state, so the row keeps its baseline. */
export const READOUT_ABSENT = '—'

/**
 * A cell's mark when it names something plotted, matching how that series is drawn: a rule for a
 * line, a block for a fill. Keeping the key in the same object as the figure is what stops the two
 * drifting apart.
 */
export function SeriesMark({ color, shape = 'line' }: { color: string; shape?: 'line' | 'block' }) {
	return (
		<span
			aria-hidden
			className={shape === 'line' ? 'h-0.5 w-2.5 shrink-0 rounded-full' : 'size-2.5 shrink-0 rounded-xs'}
			style={{ backgroundColor: color, opacity: shape === 'block' ? 0.5 : 1 }}
		/>
	)
}

/** One entry in the small-print key: a mark, what it means, and its count where it has one. */
export function ReadoutKey({ color, children, hint }: { color: string; children: ReactNode; hint?: string }) {
	const body = (
		<span className={`pointer-events-auto flex items-center gap-1.5${hint ? ' underline decoration-dotted' : ''}`}>
			<SeriesMark color={color} shape="block" />
			{children}
		</span>
	)
	return hint ? <Tooltip content={hint}>{body}</Tooltip> : body
}

export function ReadoutCell({
	label,
	hint,
	className,
	children
}: {
	label: ReactNode
	/** Renders the label as a dotted-underline tooltip trigger, the convention across this page. */
	hint?: string
	className?: string
	children: ReactNode
}) {
	return (
		<div className={`flex flex-col gap-1 ${className ?? ''}`.trim()}>
			{hint ? (
				<Tooltip content={hint}>
					<span className="flex items-center gap-1.5 label-sm text-tertiary underline decoration-dotted">{label}</span>
				</Tooltip>
			) : (
				<span className="flex items-center gap-1.5 label-sm text-tertiary">{label}</span>
			)}
			<span className="flex flex-wrap items-baseline gap-x-2">{children}</span>
		</div>
	)
}

// An editable value wears no box at rest: it looks like the figures beside it and draws an underline
// only when reached for. A box here is the heaviest object in the panel, sitting on the least
// important thing in it.
export const readoutInputStyles = tw`border-0 border-b border-b-transparent bg-transparent p-0 mono-sm text-primary transition-colors hover:border-b-(--border-strong) focus:border-b-(--yield-positive-text) focus:outline-hidden`
