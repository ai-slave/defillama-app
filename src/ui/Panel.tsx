import type { ComponentProps, ComponentPropsWithoutRef, ElementType } from 'react'
import { SectionAnchor } from './internal/SectionAnchor'

/* ----------------------------------------------------------------------------
   Panel — the titled chart/table shell. Not for standalone title strips
   (EntityTitleStrip) or inline chart toolbars (ChartPanelToolbar).

   Shell:  bg-surface + border-subtle + 8px radius, the same chrome as Card.
   Header: px-4 py-3 with a subtle bottom divider (divider floor); heading-xs title on
           the left, controls on the right. Every control in a panel header
           is the 32px md size (Button md, Select size="md", segmented
           min-h-8); dense control clusters use a 6px gap. PanelTitle already
           pushes the controls right, so a control group never adds ml-auto:
           a second auto margin centers whatever sits between them
           (`chart-toolbar-auto-margin`).
   Body:   flush; the chart, table or body below the header brings its own
           inset. Any other surface is a Card (./Card.tsx), which has the
           padding steps.

   `className` on Panel places it and lays out its content (col-span, min-h,
   flex-col); it is a box (policy: check-part-classes). PanelHeader and
   PanelTitle take placement only.

   A section a page links to passes `anchor` to its PanelTitle: the id lands on
   the heading, and the whole heading links to it with a link icon on hover. A
   page with the sticky section nav adds `scroll-mt-24` so the jump clears it. A heading outside a panel that links to itself is still a
   PanelTitle with `anchor`; never rebuild the link and icon.
---------------------------------------------------------------------------- */

type PanelProps = Omit<ComponentProps<'div'>, 'className'> & {
	className?: string | undefined
}

export function Panel({ className, ...props }: PanelProps) {
	return (
		<div
			className={`relative flex flex-col rounded-lg border border-subtle bg-surface ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}

export function PanelHeader({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return (
		<div
			className={`flex flex-wrap items-center justify-end gap-x-1.5 gap-y-2 border-b border-subtle px-4 py-3 ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}

type PanelTitleProps<T extends ElementType> = {
	as?: T
	/** Placement only — the type and color come from the recipe. */
	className?: string
	/** The section's id: the heading takes it as its `id` and links to itself (see the header). */
	anchor?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>

export function PanelTitle<T extends ElementType = 'h2'>({
	as,
	className,
	anchor,
	children,
	...props
}: PanelTitleProps<T>) {
	const Component = (as ?? 'h2') as ElementType
	if (!anchor)
		return (
			<Component className={`mr-auto heading-xs ${className ?? ''}`.trim()} {...props}>
				{children}
			</Component>
		)
	return (
		<Component
			id={anchor}
			className={`group relative mr-auto flex min-w-0 items-center gap-1 heading-xs ${className ?? ''}`.trim()}
			{...props}
		>
			{children}
			<SectionAnchor id={anchor} />
		</Component>
	)
}
