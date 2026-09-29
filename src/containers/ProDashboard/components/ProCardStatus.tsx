import type { ReactNode } from 'react'
import { Button } from '~/ui/Button'
import { ProCardSkeleton, type ProCardSkeletonVariant } from './ProCardSkeleton'

// Pro cards follow the Status recipes (design.md): body-sm copy, tertiary
// for empty, data-down for errors, warning text for notices, no icons.
// Retry and recovery actions are small secondary Buttons, never text links.
interface ProCardStatusAction {
	label: string
	onClick: () => void
}

function ProCardActionButton({ action }: { action: ProCardStatusAction }) {
	return (
		<Button type="button" variant="secondary" size="sm" onClick={action.onClick}>
			{action.label}
		</Button>
	)
}

// A dashboard loads many cards at once, so loading is a busy skeleton with a
// screen-reader label, not a live region per card.
export function ProCardLoading({
	label = 'Loading…',
	className,
	variant = 'chart'
}: {
	label?: string
	className?: string
	variant?: ProCardSkeletonVariant
}) {
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
			{/* A status is a lasting state of the card (nothing to draw, needs regenerating), not a failure: not red. */}
			<p className={`body-sm ${role === 'alert' ? 'text-data-down' : 'text-pro-text-secondary'}`}>{title}</p>
			{detail ? <p className="body-sm text-pro-text-tertiary">{detail}</p> : null}
			{onRetry || action ? (
				<div className="mt-1 flex flex-wrap justify-center gap-2">
					{onRetry ? <ProCardActionButton action={{ label: 'Try again', onClick: onRetry }} /> : null}
					{action ? <ProCardActionButton action={action} /> : null}
				</div>
			) : null}
		</div>
	)
}

export function ProCardEmpty({ message, action }: { message: ReactNode; action?: ProCardStatusAction }) {
	return (
		<div role="status" className="flex flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
			<p className="body-sm text-pro-text-tertiary">{message}</p>
			{action ? (
				<div className="mt-1">
					<ProCardActionButton action={action} />
				</div>
			) : null}
		</div>
	)
}

export function ProCardRefreshFailed({ onRetry }: { onRetry: () => void }) {
	return (
		<ProCardNotice tone="warning" action={{ label: 'Try again', onClick: onRetry }}>
			Couldn&apos;t refresh this card. Showing the last loaded data.
		</ProCardNotice>
	)
}

export function ProCardNotice({
	tone,
	children,
	action,
	title
}: {
	tone: 'warning' | 'error'
	children: ReactNode
	action?: ProCardStatusAction
	title?: string
}) {
	const isError = tone === 'error'
	return (
		<div
			role={isError ? 'alert' : 'status'}
			title={title}
			className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-1 body-sm md:px-3 ${isError ? 'text-data-down' : 'text-warning'}`}
		>
			<span>{children}</span>
			{action ? <ProCardActionButton action={action} /> : null}
		</div>
	)
}
