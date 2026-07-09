import type { ReactNode } from 'react'
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

type PanelLoadingStatusProps = {
	children: ReactNode
	label?: string
	className?: string
}

export function PanelLoadingStatus({ children, label = 'Loading', className }: PanelLoadingStatusProps) {
	return (
		<Panel padding="sm" className={`min-h-[360px] flex-1 items-center justify-center ${className ?? ''}`.trim()}>
			<div role="status" aria-live="polite" className="flex items-center justify-center">
				{children}
				<span className="sr-only">{label}</span>
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
	children: ReactNode
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
				{children}
				<span className="sr-only">{label}</span>
			</div>
		</div>
	)
}
