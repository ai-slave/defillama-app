import type { ComponentPropsWithoutRef } from 'react'
import { Panel } from './Panel'

export function ChartPanel({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <Panel padding="none" className={className} {...props} />
}

export function ChartPanelToolbar({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return (
		<div
			className={`flex flex-wrap items-center justify-end gap-1.5 px-2 pt-2 pb-0 ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}

/* Panels in a row stretch to the tallest one, so the body grows with them and its 360px is a
   FLOOR, not a fixed height: a fixed body left dead space under the chart in every panel the grid
   stretched. Pass CHART_FILL to the chart itself so it fills the body it sits in. */
export const CHART_FILL = 'flex-1 min-h-[360px]'

export function ChartPanelBody({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`relative flex min-h-[360px] flex-1 flex-col ${className ?? ''}`.trim()} {...props} />
}

export function ChartPanelBodyFallback({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return (
		<div className={`m-auto flex min-h-[360px] items-center justify-center ${className ?? ''}`.trim()} {...props} />
	)
}

export function ChartPanelExportShellFallback({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`min-h-[400px] ${className ?? ''}`.trim()} {...props} />
}
