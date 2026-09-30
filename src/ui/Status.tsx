import type { ReactNode } from 'react'
import { LoadingDots, LoadingSpinner } from './Loaders'
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
}

export function PanelStatus({ children, variant, className }: PanelStatusProps) {
	const role = variant === 'error' ? 'alert' : 'status'

	return (
		<Panel padding="sm" className={`min-h-[360px] flex-1 items-center justify-center ${className ?? ''}`.trim()}>
			<p
				role={role}
				aria-live={variant === 'error' ? undefined : 'polite'}
				className={`text-center body-sm ${STATUS_TEXT[variant]}`}
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
export function LoadingIndicator({ label = 'Loading' }: { label?: string }) {
	return (
		<span className="flex items-center gap-1 body-sm text-tertiary">
			{label}
			<LoadingDots />
		</span>
	)
}

// A dialog's request error renders at the end of its scrolling body while the button that caused it sits in the
// footer, so on a phone it can appear below the fold. `nearest` leaves an error already in view where it is.
// Page errors never scroll: moving the page under the reader is worse than an error they scroll to.
function bringDialogErrorIntoView(node: HTMLDivElement | null) {
	if (node?.closest('[role=dialog],[role=alertdialog]')) node.scrollIntoView({ block: 'nearest' })
}

export function InlineStatus({ children, variant }: { children: ReactNode; variant: 'empty' | 'error' | 'warning' }) {
	return (
		<div
			// Attached only while the status is an error, so a status that turns into one in place scrolls too.
			ref={variant === 'error' ? bringDialogErrorIntoView : undefined}
			role={variant === 'error' ? 'alert' : 'status'}
			className={`rounded-lg border border-medium bg-surface-elevated-1 px-3 py-2 body-sm ${variant === 'warning' ? 'text-warning' : STATUS_TEXT[variant]}`}
		>
			{children}
		</div>
	)
}

export function SurfaceLoadingOverlay({ label }: { label: string }) {
	return (
		<div
			role="status"
			aria-live="polite"
			className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-page/60 backdrop-blur-[1px]"
		>
			<div className="flex items-center gap-2 rounded-lg border border-medium bg-surface-elevated-1 px-3 py-2 body-sm text-secondary shadow-xs">
				<LoadingSpinner size={12} />
				<span>{label}</span>
			</div>
		</div>
	)
}

export function PanelLoadingStatus({ label = 'Loading', className }: { label?: string; className?: string }) {
	return (
		<Panel padding="sm" className={`min-h-[360px] flex-1 items-center justify-center ${className ?? ''}`.trim()}>
			<div role="status" aria-live="polite" className="flex items-center justify-center">
				<LoadingIndicator label={label} />
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

export function SurfaceBodyLoadingStatus({ label = 'Loading', className }: { label?: string; className?: string }) {
	return (
		<div className={`flex min-h-[360px] flex-1 items-center justify-center ${className ?? ''}`.trim()}>
			<div role="status" aria-live="polite" className="flex items-center justify-center">
				<LoadingIndicator label={label} />
			</div>
		</div>
	)
}
