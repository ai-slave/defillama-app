import type { ComponentPropsWithoutRef } from 'react'

export const chartPanelToolbarStyles = 'flex flex-wrap items-center gap-1.5 px-2 pt-2 pb-0'
export const chartPanelControlGroupStyles = 'flex flex-wrap items-center gap-1.5'
export const chartPanelToolbarActionsStyles = 'ml-auto flex flex-wrap items-center justify-end gap-1.5'

export const tableToolbarStyles = 'flex flex-wrap items-center gap-1.5 p-2'
export const tableToolbarControlGroupStyles = 'flex min-w-0 flex-wrap items-center gap-1.5'

export function ChartPanelToolbar({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`${chartPanelToolbarStyles} ${className ?? ''}`.trim()} {...props} />
}

export function ChartPanelControlGroup({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`${chartPanelControlGroupStyles} ${className ?? ''}`.trim()} {...props} />
}

export function TableToolbar({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`${tableToolbarStyles} ${className ?? ''}`.trim()} {...props} />
}

export function TableToolbarControlGroup({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`${tableToolbarControlGroupStyles} ${className ?? ''}`.trim()} {...props} />
}
