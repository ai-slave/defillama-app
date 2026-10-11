// Shared pieces of the rows around a chart panel's plot: keys, cells and fields.

import type { ReactNode } from 'react'
import { Definition } from '~/ui/Tooltip'
import { tw } from '~/ui/tw'

export const readoutKeysStyles = tw`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 body-sm text-secondary`

/**
 * A cell's mark when it names something plotted, matching how that series is drawn: a rule for a
 * line, a block for a fill. Keeping the key in the same object as the figure is what stops the two
 * drifting apart.
 */
export function SeriesMark({
	color,
	shape = 'line',
	opacity
}: {
	color: string
	shape?: 'line' | 'block'
	/** A block defaults to half strength to match a translucent band; a key passes 1 so it stays legible. */
	opacity?: number
}) {
	const resolvedOpacity = opacity === undefined ? (shape === 'block' ? 0.5 : 1) : opacity
	return (
		<span
			aria-hidden
			className={shape === 'line' ? 'h-0.5 w-2.5 shrink-0 rounded-full' : 'size-2.5 shrink-0 rounded-xs'}
			style={{ backgroundColor: color, opacity: resolvedOpacity }}
		/>
	)
}

/** One entry in the small-print key: a mark, what it means, and its count where it has one. */
export function ReadoutKey({ color, children, hint }: { color: string; children: ReactNode; hint?: string }) {
	return (
		<Definition content={hint} className="gap-1.5">
			<SeriesMark color={color} shape="block" opacity={1} />
			{children}
		</Definition>
	)
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
		<div className={`flex min-w-0 flex-col gap-1 ${className ?? ''}`.trim()}>
			<Definition content={hint} className="gap-1.5 label-md text-secondary">
				{label}
			</Definition>
			{/* One value-line height for every cell, so the row cannot change height. */}
			<span className="flex min-h-5 flex-wrap items-baseline gap-x-2">{children}</span>
		</div>
	)
}

export const readoutFieldStyles = tw`h-8 rounded-md border border-medium bg-surface px-3 mono-md text-primary focus-within:border-brand focus:outline-hidden`
