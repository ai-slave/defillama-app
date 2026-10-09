import type { ReactNode } from 'react'
import { Button } from '~/ui/Button'
import { focusRegionOnLeave } from '~/ui/focus'
import { InlineStatus } from '~/ui/Status'
import type { QueryRetry } from '~/utils/query'
import { ProCardSkeleton, type ProCardSkeletonVariant } from './ProCardSkeleton'

// Pro cards follow the src/ui/Status.tsx states: body-sm copy, tertiary for empty, text-error when the whole card
// failed. A notice above content the card still shows (a refresh that failed, a partial load) is an InlineStatus.
// Retry and recovery actions are small secondary Buttons, never text links.
interface ProCardStatusAction {
	label: string
	onClick: () => void
}

function ProCardActionButton({ label, onClick, retrying }: ProCardStatusAction & { retrying?: boolean }) {
	return (
		<Button
			ref={focusRegionOnLeave}
			type="button"
			variant="secondary"
			size="sm"
			onClick={onClick}
			pendingLabel={retrying === undefined ? undefined : 'Retrying…'}
			pending={retrying}
		>
			{label}
		</Button>
	)
}

// A retry waits in its button while the read it started runs.
function ProCardRetryButton({ retry }: { retry: QueryRetry }) {
	return <ProCardActionButton label="Try again" onClick={() => void retry.refetch()} retrying={retry.isFetching} />
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
		<div aria-busy="true" className={`flex min-w-0 flex-1 flex-col text-tertiary ${className ?? ''}`.trim()}>
			<ProCardSkeleton kind={variant} />
			<span className="sr-only">{label}</span>
		</div>
	)
}

export function ProCardError({
	title = "Couldn't load this card",
	detail,
	retry,
	action,
	role = 'alert'
}: {
	title?: string
	detail?: ReactNode
	retry?: QueryRetry
	action?: ProCardStatusAction
	role?: 'alert' | 'status'
}) {
	return (
		<div role={role} className="flex flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
			{/* A status is a lasting state of the card (nothing to draw, needs regenerating), not a failure: not red. */}
			<p className={`body-sm ${role === 'alert' ? 'text-error' : 'text-secondary'}`}>{title}</p>
			{detail ? <p className="body-sm text-tertiary">{detail}</p> : null}
			{retry || action ? (
				<div className="mt-1 flex flex-wrap justify-center gap-2">
					{retry ? <ProCardRetryButton retry={retry} /> : null}
					{action ? <ProCardActionButton {...action} /> : null}
				</div>
			) : null}
		</div>
	)
}

export function ProCardEmpty({ message, action }: { message: ReactNode; action?: ProCardStatusAction }) {
	return (
		<div role="status" className="flex flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
			<p className="body-sm text-tertiary">{message}</p>
			{action ? (
				<div className="mt-1">
					<ProCardActionButton {...action} />
				</div>
			) : null}
		</div>
	)
}

export function ProCardRefreshFailed({ retry }: { retry: QueryRetry }) {
	return (
		<ProCardNotice tone="warning" retry={retry}>
			Couldn&apos;t refresh this card. Showing the last loaded data.
		</ProCardNotice>
	)
}

export function ProCardNotice({
	tone,
	children,
	retry,
	action
}: {
	tone: 'warning' | 'error'
	children: ReactNode
	retry?: QueryRetry
	action?: ProCardStatusAction
}) {
	return (
		<div className="px-1 md:px-3">
			<InlineStatus
				variant={tone}
				action={retry ? <ProCardRetryButton retry={retry} /> : action ? <ProCardActionButton {...action} /> : undefined}
			>
				{children}
			</InlineStatus>
		</div>
	)
}
