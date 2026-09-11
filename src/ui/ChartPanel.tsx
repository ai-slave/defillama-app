import type { ComponentPropsWithoutRef } from 'react'
import { Panel } from './Panel'

export function ChartPanel({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <Panel padding="none" className={className} {...props} />
}

export function ChartPanelToolbar({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`flex flex-wrap items-center gap-1.5 px-2 pt-2 pb-0 ${className ?? ''}`.trim()} {...props} />
}

/* A panel showing a supporting chart alongside a primary one runs shorter, so the pair reads as
   secondary at a glance. Kept as a recipe variant rather than a `min-h-*` override: both values are
   arbitrary Tailwind utilities, so a className override would depend on stylesheet order to win. */
type ChartPanelBodySize = 'default' | 'compact'

const CHART_PANEL_BODY_HEIGHT: Record<ChartPanelBodySize, string> = {
	default: 'min-h-[360px]',
	compact: 'min-h-[248px]'
}

/* Panels in a row stretch to the tallest one, so the body grows with them and the size above is a
   FLOOR, not a fixed height: a fixed body left dead space under the chart in every panel the grid
   stretched. Pass the matching class below to the chart itself so it fills the body it sits in;
   both literals live here so Tailwind sees them (an interpolated arbitrary value is not scanned). */
export const CHART_FILL: Record<ChartPanelBodySize, string> = {
	default: 'flex-1 min-h-[360px]',
	compact: 'flex-1 min-h-[248px]'
}

type ChartPanelBodyProps = ComponentPropsWithoutRef<'div'> & { size?: ChartPanelBodySize }

export function ChartPanelBody({ className, size = 'default', ...props }: ChartPanelBodyProps) {
	return (
		<div
			className={`relative flex flex-1 ${CHART_PANEL_BODY_HEIGHT[size]} flex-col ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}

export function ChartPanelBodyFallback({ className, size = 'default', ...props }: ChartPanelBodyProps) {
	return (
		<div
			className={`m-auto flex ${CHART_PANEL_BODY_HEIGHT[size]} items-center justify-center ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}

export function ChartPanelExportShellFallback({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`min-h-[400px] ${className ?? ''}`.trim()} {...props} />
}
