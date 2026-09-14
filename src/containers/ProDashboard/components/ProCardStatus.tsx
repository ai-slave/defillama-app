import type { ReactNode } from 'react'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { ProCardSkeleton, type ProCardSkeletonVariant } from './ProCardSkeleton'

interface ProCardStatusAction {
	label: string
	onClick: () => void
}

export function ProCardLoading({
	label = 'Loading…',
	className,
	variant = 'chart'
}: {
	label?: string
	className?: string
	variant?: ProCardSkeletonVariant | 'spinner'
}) {
	if (variant === 'spinner') {
		return (
			<div
				aria-busy="true"
				className={`flex flex-1 items-center justify-center text-pro-text-tertiary ${className ?? ''}`.trim()}
			>
				<LoadingSpinner size={24} />
				<span className="sr-only">{label}</span>
			</div>
		)
	}

	return (
		<div aria-busy="true" className={`flex min-w-0 flex-1 flex-col text-pro-text-tertiary ${className ?? ''}`.trim()}>
			<ProCardSkeleton kind={variant} />
			<span className="sr-only">{label}</span>
		</div>
	)
}

export function ProCardError({
	title = "Couldn't load this card",
	detail,
	onRetry,
	action,
	role = 'alert'
}: {
	title?: string
	detail?: ReactNode
	onRetry?: () => void
	action?: ProCardStatusAction
	role?: 'alert' | 'status'
}) {
	return (
		<div role={role} className="flex flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
			<Icon name="alert-triangle" height={24} width={24} className="text-sub-orange" />
			<p className="text-sm text-pro-text-label">{title}</p>
			{detail ? <p className="text-xs text-pro-text-tertiary">{detail}</p> : null}
			{onRetry ? (
				<button type="button" className="text-sm text-link hover:underline" onClick={onRetry}>
					Try again
				</button>
			) : null}
			{action ? (
				<button type="button" className="text-sm text-link hover:underline" onClick={action.onClick}>
					{action.label}
				</button>
			) : null}
		</div>
	)
}

export function ProCardEmpty({
	message,
	detail,
	action
}: {
	message: ReactNode
	detail?: ReactNode
	action?: ProCardStatusAction
}) {
	return (
		<div role="status" className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
			<p className="text-sm text-pro-text-form">{message}</p>
			{detail ? <p className="text-xs text-pro-text-tertiary">{detail}</p> : null}
			{action ? (
				<button type="button" className="text-sm text-link hover:underline" onClick={action.onClick}>
					{action.label}
				</button>
			) : null}
		</div>
	)
}

export function ProCardRefreshFailed({ onRetry }: { onRetry: () => void }) {
	return (
		<ProCardNotice tone="warning" action={{ label: 'Try again', onClick: onRetry }}>
			Couldn&apos;t refresh this card, showing the last loaded data.
		</ProCardNotice>
	)
}

export function ProCardNotice({
	tone,
	children,
	action,
	title,
	className
}: {
	tone: 'warning' | 'error'
	children: ReactNode
	action?: ProCardStatusAction
	title?: string
	className?: string
}) {
	const isError = tone === 'error'
	return (
		<div
			role={isError ? 'alert' : 'status'}
			title={title}
			className={`flex flex-wrap items-center gap-1.5 px-1 text-xs md:px-3 ${
				isError ? 'text-error' : 'text-pro-text-form'
			} ${className ?? ''}`.trim()}
		>
			<Icon name="alert-triangle" height={14} width={14} className={isError ? 'text-error' : 'text-sub-orange'} />
			<span>{children}</span>
			{action ? (
				<button type="button" className="text-link hover:underline" onClick={action.onClick}>
					{action.label}
				</button>
			) : null}
		</div>
	)
}
