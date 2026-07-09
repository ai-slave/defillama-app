import type { ComponentPropsWithoutRef } from 'react'

export function TableToolbar({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`flex flex-wrap items-center gap-1.5 p-2 ${className ?? ''}`.trim()} {...props} />
}

export function TableToolbarControlGroup({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`flex min-w-0 flex-wrap items-center gap-1.5 ${className ?? ''}`.trim()} {...props} />
}
