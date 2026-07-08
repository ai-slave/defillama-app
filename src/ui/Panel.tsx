import type { ComponentPropsWithoutRef, ElementType } from 'react'

/* ----------------------------------------------------------------------------
   Panel — the design.md chart/table panel recipe (Figma node 6183:148797).

   Shell:  bg-surface + border-subtle + 8px radius.
   Header: px-4 py-3 with a subtle bottom divider (divider floor); heading-xs title on
           the left, controls on the right. Every control in a panel header
           is the 32px md size (Button md, Select size="md", segmented
           min-h-8); dense control clusters use a 6px gap.
   Body:   charts sit flush and keep their own grid padding; non-chart
           content either brings its own padding or uses an explicit Panel
           padding variant for panel-owned content.

   `className` is for LAYOUT PLACEMENT ONLY (col-span, min-h, …), same
   contract as Button/Card.
---------------------------------------------------------------------------- */

type PanelPadding = 'none' | 'sm' | 'md'

type PanelProps = {
	padding?: PanelPadding
} & Omit<ComponentPropsWithoutRef<'div'>, 'className'> & {
		className?: string
	}

const PANEL_PADDING: Record<PanelPadding, string> = {
	none: '',
	sm: ' p-2',
	md: ' p-4'
}

export function Panel({ className, padding = 'none', ...props }: PanelProps) {
	return (
		<div
			className={`relative flex flex-col rounded-[8px] border border-subtle bg-surface${PANEL_PADDING[padding]} ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}

export function PanelHeader({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return (
		<div
			className={`flex flex-wrap items-center gap-x-1.5 gap-y-2 border-b border-subtle px-4 py-3 ${className ?? ''}`.trim()}
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
