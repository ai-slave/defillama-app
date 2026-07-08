import type { ReactNode } from 'react'
import { Panel } from './Panel'

type StatusVariant = 'loading' | 'empty' | 'error'

const STATUS_TEXT = {
	loading: 'text-tertiary',
	empty: 'text-tertiary',
	error: 'text-data-down'
} as const

type PanelStatusProps = {
	children: ReactNode
	variant?: StatusVariant
	className?: string
	textClassName?: string
}

export function PanelStatus({ children, variant = 'empty', className, textClassName }: PanelStatusProps) {
	const role = variant === 'error' ? 'alert' : 'status'

	return (
		<Panel className={`min-h-[360px] flex-1 items-center justify-center p-2 ${className ?? ''}`.trim()}>
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
		<Panel className={`min-h-[360px] flex-1 items-center justify-center p-2 ${className ?? ''}`.trim()}>
			<div role="status" aria-live="polite" className="flex items-center justify-center">
				{children}
				<span className="sr-only">{label}</span>
			</div>
		</Panel>
	)
}
