import type { ComponentProps, ComponentPropsWithoutRef, ElementType } from 'react'

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

   `className` is for LAYOUT PLACEMENT ONLY (col-span, min-h, …), same
   contract as Button/Card.
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
	/** Layout placement only — the type/color comes from the recipe. */
	className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>

export function PanelTitle<T extends ElementType = 'h2'>({ as, className, ...props }: PanelTitleProps<T>) {
	const Component = (as ?? 'h2') as ElementType
	return <Component className={`mr-auto heading-xs ${className ?? ''}`.trim()} {...props} />
}
