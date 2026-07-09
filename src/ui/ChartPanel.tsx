import type { ComponentPropsWithoutRef } from 'react'
import { Panel } from './Panel'

export function ChartPanel({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <Panel padding="none" className={className} {...props} />
}

export function ChartPanelToolbar({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`flex flex-wrap items-center gap-1.5 px-2 pt-2 pb-0 ${className ?? ''}`.trim()} {...props} />
}

export function ChartPanelBody({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`relative flex min-h-[360px] flex-col ${className ?? ''}`.trim()} {...props} />
}

export function ChartPanelBodyFallback({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return (
		<div className={`m-auto flex min-h-[360px] items-center justify-center ${className ?? ''}`.trim()} {...props} />
	)
}

export function ChartPanelExportShellFallback({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`min-h-[400px] ${className ?? ''}`.trim()} {...props} />
}
