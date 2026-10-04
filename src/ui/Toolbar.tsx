import type { ComponentPropsWithoutRef } from 'react'

/** The control row above a table: it owns `justify-end` and the 6px gaps, so callers never pass `justify-*`. */
export function TableToolbar({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`flex flex-wrap items-center justify-end gap-1.5 p-2 ${className ?? ''}`.trim()} {...props} />
}

export function TableToolbarControlGroup({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return (
		<div className={`flex min-w-0 flex-wrap items-center justify-end gap-1.5 ${className ?? ''}`.trim()} {...props} />
	)
}
