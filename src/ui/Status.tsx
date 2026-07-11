import type { ReactNode } from 'react'
import { LoadingDots } from './Loaders'
import { Panel } from './Panel'

export type StatusVariant = 'loading' | 'empty' | 'error'

const STATUS_TEXT = {
	loading: 'text-tertiary',
	empty: 'text-tertiary',
	error: 'text-data-down'
} as const

type PanelStatusProps = {
	children: ReactNode
	variant: StatusVariant
	className?: string
	textClassName?: string
}

export function PanelStatus({ children, variant, className, textClassName }: PanelStatusProps) {
	const role = variant === 'error' ? 'alert' : 'status'

	return (
		<Panel padding="sm" className={`min-h-[360px] flex-1 items-center justify-center ${className ?? ''}`.trim()}>
			<p
				role={role}
				aria-live={variant === 'error' ? undefined : 'polite'}
				className={`text-center body-sm ${STATUS_TEXT[variant]} ${textClassName ?? ''}`.trim()}
			>
				{children}
			</p>
		</Panel>
	)
}

/** Default in-panel loading indicator (design.md → Status states): quiet
    tertiary text matching the empty/error copy. The pulsing-logo LocalLoader
    is reserved for route-level full-page loads — one per viewport, never per
    card/panel. */
export function LoadingIndicator() {
	return (
		<span className="flex items-center gap-1 body-sm text-tertiary">
			Loading
			<LoadingDots />
		</span>
	)
}

type PanelLoadingStatusProps = {
	children?: ReactNode
	label?: string
	className?: string
}

export function PanelLoadingStatus({ children, label = 'Loading', className }: PanelLoadingStatusProps) {
	return (
		<Panel padding="sm" className={`min-h-[360px] flex-1 items-center justify-center ${className ?? ''}`.trim()}>
			<div role="status" aria-live="polite" className="flex items-center justify-center">
				{children ?? <LoadingIndicator />}
				{children != null ? <span className="sr-only">{label}</span> : null}
			</div>
		</Panel>
	)
}

type SurfaceBodyStatusProps = {
	children: ReactNode
	variant: StatusVariant
	className?: string
	contentClassName?: string
	textClassName?: string
}

export function SurfaceBodyStatus({
	children,
	variant,
	className,
	contentClassName,
	textClassName
}: SurfaceBodyStatusProps) {
	const role = variant === 'error' ? 'alert' : 'status'
	const statusTextClassName = textClassName ?? `body-sm ${STATUS_TEXT[variant]}`

	return (
		<div className={`flex min-h-[360px] flex-1 items-center justify-center ${className ?? ''}`.trim()}>
			<div
				role={role}
				aria-live={variant === 'error' ? undefined : 'polite'}
				className={`text-center ${statusTextClassName} ${contentClassName ?? ''}`.trim()}
			>
				{children}
			</div>
		</div>
	)
}

type SurfaceBodyLoadingStatusProps = {
	children?: ReactNode
	label?: string
	className?: string
	contentClassName?: string
}

export function SurfaceBodyLoadingStatus({
	children,
	label = 'Loading',
	className,
	contentClassName
}: SurfaceBodyLoadingStatusProps) {
	return (
		<div className={`flex min-h-[360px] flex-1 items-center justify-center ${className ?? ''}`.trim()}>
			<div
				role="status"
				aria-live="polite"
				className={`flex items-center justify-center ${contentClassName ?? ''}`.trim()}
			>
				{children ?? <LoadingIndicator />}
				{children != null ? <span className="sr-only">{label}</span> : null}
			</div>
		</div>
	)
}
