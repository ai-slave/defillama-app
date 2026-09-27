import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Panel } from './Panel'

export function ChartPanel({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <Panel padding="none" className={className} {...props} />
}

type ChartPanelToolbarProps = ComponentPropsWithoutRef<'div'> & {
	/** What the chart shows: a title, a view switch, or the metric picker and its chips. It stays on the
	    left as one group; every other child hugs the right, and both wrap without swapping sides. */
	leading?: ReactNode
}

export function ChartPanelToolbar({ leading, className, children, ...props }: ChartPanelToolbarProps) {
	return (
		<div
			className={`flex flex-wrap items-center justify-end gap-1.5 px-2 pt-2 pb-0 ${className ?? ''}`.trim()}
			{...props}
		>
			{leading ? <div className="mr-auto flex min-w-0 flex-wrap items-center gap-1.5">{leading}</div> : null}
			{children}
		</div>
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
