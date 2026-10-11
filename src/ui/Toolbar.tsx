import type { ComponentPropsWithoutRef } from 'react'

/* The control row above a table: it owns `justify-end`, the 8px padding and the 6px gaps, so callers never pass
   `justify-*`, a gap or padding. A row stacked over another row or a table head passes `divided` for the subtle rule
   under it. `className` on both parts is placement only: `mr-auto` on the group that leads the row, a `min-h-*` that
   lines a row up with the one beside it. */
export function TableToolbar({
	divided = false,
	className,
	...props
}: ComponentPropsWithoutRef<'div'> & { divided?: boolean }) {
	return (
		<div
			className={`flex flex-wrap items-center justify-end gap-1.5 p-2 ${divided ? 'border-b border-subtle' : ''} ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}

export function TableToolbarControlGroup({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return (
		<div className={`flex min-w-0 flex-wrap items-center justify-end gap-1.5 ${className ?? ''}`.trim()} {...props} />
	)
}
