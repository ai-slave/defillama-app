import * as Ariakit from '@ariakit/react'
import { useState, type FormEvent } from 'react'
import { SubscriptionLoadError } from '~/containers/Subscription/shared/SubscriptionLoadError'
import { DialogHeading } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { formatDate } from '~/utils/dateFormat'
import { formatUsd } from '~/utils/numberFormat'
import { ConfirmActionModal } from './ConfirmActionModal'
import type { TeamSubscription } from './types'
import { useTeam } from './useTeam'

interface ManageSeatsModalProps {
	isOpen: boolean
	onClose: () => void
	subscription: TeamSubscription
}

function getSubscriptionLabel(type: string): string {
	if (type === 'api') return 'API'
	if (type === 'llamafeed') return 'Pro'
	return type
}

function getUnitPrice(type: string, billingInterval: 'month' | 'year'): { amount: number; suffix: string } {
	if (type === 'api') {
		return billingInterval === 'year' ? { amount: 3000, suffix: '/year' } : { amount: 300, suffix: '/month' }
	}
	return billingInterval === 'year' ? { amount: 490, suffix: '/year' } : { amount: 49, suffix: '/month' }
}

function formatCancelDate(raw: string | number): string {
	let date: Date
	if (typeof raw === 'number') {
		date = new Date(raw * 1000)
	} else {
		const isoLike = raw.includes('T') ? raw : raw.replace(' ', 'T')
		date = new Date(isoLike)
	}
	return formatDate(date) ?? ''
}

export function ManageSeatsModal({ isOpen, onClose, subscription }: ManageSeatsModalProps) {
	const { canChangeTeamBilling, isTeamRefreshError, isTeamRetrying, refetchTeam, isTeamUpdating, setSeatsMutation } =
		useTeam()
	const [seatInput, setSeatInput] = useState(String(subscription.seats.seatCount))
	const seatCount = Number(seatInput)
	const [showCancelConfirm, setShowCancelConfirm] = useState(false)

	const label = getSubscriptionLabel(subscription.type)
	const unitPrice = getUnitPrice(subscription.type, subscription.billingInterval)
	const diff = seatCount - subscription.seats.seatCount
	const hasChange = diff !== 0
	const cancelAt: string | number | null = subscription.cancelsAt
		? subscription.cancelsAt
		: subscription.canceledAtPeriodEnd && typeof subscription.effectiveAt === 'number'
			? subscription.effectiveAt
			: null
	const isCanceling = subscription.canceledAtPeriodEnd === true || cancelAt !== null
	// When canceling, lock the floor at the current count — only increases (which undo
	// the pending cancel) are allowed.
	const minSeats = isCanceling ? subscription.seats.seatCount : Math.max(1, subscription.seats.occupiedSeats)
	const isValidSeatCount = seatInput !== '' && Number.isInteger(seatCount) && seatCount >= minSeats
	const isAtOccupiedFloor =
		!isCanceling && seatCount <= subscription.seats.occupiedSeats && subscription.seats.occupiedSeats > 0
	const decrementDisabled = seatCount <= minSeats

	const seatsError = setSeatsMutation.isError ? setSeatsMutation.error.message : null

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!canChangeTeamBilling) return
		setSeatsMutation.mutate({ subscriptionType: subscription.type, seatCount }, { onSuccess: onClose })
	}

	const handleConfirmCancel = () => {
		if (!canChangeTeamBilling) return
		setSeatsMutation.mutate(
			{ subscriptionType: subscription.type, seatCount: 0 },
			{
				onSuccess: () => {
					setShowCancelConfirm(false)
					onClose()
				}
			}
		)
	}

	const handleClose = () => {
		if (setSeatsMutation.isPending) return
		setSeatsMutation.reset()
		setSeatInput(String(subscription.seats.seatCount))
		onClose()
	}

	return (
		<Ariakit.DialogProvider open={isOpen} setOpen={(open) => !open && handleClose()}>
			<Ariakit.Dialog
				backdrop={<div className="bg-black/80" />}
				className="dialog h-fit max-h-[90dvh] min-h-0 gap-0 overflow-y-auto rounded-2xl border-0 p-0 md:max-w-[420px]"
				hideOnEscape={!setSeatsMutation.isPending}
				hideOnInteractOutside={!setSeatsMutation.isPending}
				portal
				unmountOnHide
			>
				<form onSubmit={handleSubmit} className="flex flex-col gap-5 bg-white px-5 py-6 dark:bg-sub-surface-dark">
					<div className="flex items-center justify-between">
						<DialogHeading className="text-base font-semibold text-sub-text-primary">
							Manage {label} Seats
						</DialogHeading>
						<Ariakit.DialogDismiss
							aria-label="Close"
							disabled={setSeatsMutation.isPending}
							className="flex size-8 shrink-0 items-center justify-center rounded-full text-sub-text-muted transition-colors hover:text-sub-text-primary"
						>
							<Icon name="x" height={18} width={18} />
						</Ariakit.DialogDismiss>
					</div>

					{isCanceling && cancelAt ? (
						<div className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/5 p-3">
							<Icon name="alert-triangle" height={14} width={14} className="mt-0.5 shrink-0 text-error" />
							<p className="text-xs leading-5 text-sub-text-primary">
								This subscription is scheduled to cancel on {formatCancelDate(cancelAt)}. Increasing the seat count will
								resume billing and undo the pending cancellation.
							</p>
						</div>
					) : null}

					<div className="flex flex-col gap-2 rounded-lg border border-sub-border-slate-100 p-3 dark:border-sub-border-strong">
						<div className="flex items-center justify-between text-xs text-sub-text-muted">
							<span>Current seats</span>
							<span className="text-sub-text-primary">{subscription.seats.seatCount}</span>
						</div>
						<div className="flex items-center justify-between text-xs text-sub-text-muted">
							<span>Occupied</span>
							<span className="text-sub-text-primary">{subscription.seats.occupiedSeats}</span>
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<label htmlFor="manage-seat-count" className="text-xs font-medium text-sub-text-muted">
							New seat count
						</label>
						<div className="flex items-center gap-2">
							<Tooltip
								content={
									isCanceling
										? "Seats can't be reduced while this subscription is scheduled to cancel. Increase the seat count to resume billing, or wait for the cancellation to take effect."
										: isAtOccupiedFloor
											? `You can't reduce below ${subscription.seats.occupiedSeats} seat${subscription.seats.occupiedSeats === 1 ? '' : 's'}. Unassign the users from this subscription first if you want to remove seats.`
											: null
								}
								placement="top"
							>
								<button
									type="button"
									aria-label="Decrease seats"
									onClick={() => setSeatInput(String(Math.max(minSeats, seatCount - 1)))}
									disabled={decrementDisabled || !canChangeTeamBilling}
									className="flex size-10 items-center justify-center rounded-lg border border-sub-border-slate-100 text-sub-text-primary disabled:opacity-30 dark:border-sub-border-strong"
								>
									<Icon name="minus" height={16} width={16} />
								</button>
							</Tooltip>
							<input
								id="manage-seat-count"
								type="number"
								required
								min={minSeats}
								step={1}
								readOnly={!canChangeTeamBilling}
								inputMode="numeric"
								value={seatInput}
								onChange={(e) => setSeatInput(e.target.value)}
								className="h-10 w-20 rounded-lg border border-sub-border-slate-100 bg-white text-center text-sm text-sub-text-primary focus:border-sub-brand-primary focus:outline-hidden dark:border-sub-border-strong dark:bg-sub-surface-dark"
							/>
							<button
								type="button"
								aria-label="Increase seats"
								disabled={!canChangeTeamBilling}
								onClick={() => setSeatInput(String(Math.max(minSeats, seatCount + 1)))}
								className="flex size-10 items-center justify-center rounded-lg border border-sub-border-slate-100 text-sub-text-primary dark:border-sub-border-strong"
							>
								<Icon name="plus" height={16} width={16} />
							</button>
						</div>
					</div>

					{hasChange && isValidSeatCount && (
						<div className="flex flex-col gap-2 rounded-lg bg-sub-brand-primary/5 p-3">
							<div className="flex items-center justify-between">
								<span className="text-sm text-sub-text-muted">
									{diff > 0
										? `Adding ${diff} seat${diff === 1 ? '' : 's'}`
										: `Removing ${-diff} seat${-diff === 1 ? '' : 's'}`}
								</span>
								<span className="text-sm font-semibold text-sub-text-primary">
									{diff > 0 ? '+' : '−'}
									{formatUsd(unitPrice.amount * Math.abs(diff))}
									{unitPrice.suffix}
								</span>
							</div>
							<div className="flex items-center justify-between border-t border-sub-border-slate-100 pt-2 dark:border-sub-border-strong">
								<span className="text-sm text-sub-text-muted">Bill after update</span>
								<span className="text-sm font-semibold text-sub-text-primary">
									{`${formatUsd(unitPrice.amount * seatCount)}${unitPrice.suffix}`}
								</span>
							</div>
						</div>
					)}

					{diff < 0 && isValidSeatCount && (
						<div className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/5 p-3">
							<Icon name="alert-triangle" height={14} width={14} className="mt-0.5 shrink-0 text-error" />
							<p className="text-xs leading-5 text-sub-text-primary">
								Seats will be removed immediately and the payment for the current billing period will not be refunded.
							</p>
						</div>
					)}

					{seatsError && !showCancelConfirm ? (
						<div
							role="alert"
							className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-error"
						>
							<Icon name="alert-warning" height={16} width={16} className="shrink-0" />
							<p className="text-sm">{seatsError}</p>
						</div>
					) : null}

					<Ariakit.Button
						type="submit"
						accessibleWhenDisabled
						disabled={!canChangeTeamBilling || !hasChange}
						className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sub-brand-primary text-sm font-medium text-on-brand disabled:opacity-50 aria-disabled:opacity-50"
					>
						{setSeatsMutation.isPending ? <LoadingSpinner size={14} /> : null}
						{setSeatsMutation.isPending ? 'Updating...' : 'Update Seats'}
					</Ariakit.Button>

					{!isCanceling && subscription.seats.seatCount > 0 ? (
						<button
							type="button"
							onClick={() => {
								setSeatsMutation.reset()
								setShowCancelConfirm(true)
							}}
							disabled={!canChangeTeamBilling}
							className="flex h-10 w-full items-center justify-center rounded-lg border border-error/40 text-sm font-medium text-error hover:bg-error/5 disabled:opacity-50 aria-disabled:opacity-50"
						>
							Cancel subscription
						</button>
					) : null}
					{isTeamRefreshError ? (
						<SubscriptionLoadError
							message="Couldn't refresh team billing. Refresh before making another change."
							isRetrying={isTeamRetrying}
							onRetry={() => void refetchTeam()}
						/>
					) : null}
					<span role="status" className="text-sm text-sub-text-muted">
						{isTeamUpdating && !setSeatsMutation.isPending
							? 'Another team update is in progress. Please wait for the confirmed subscription.'
							: ''}
					</span>
					<span role="status" className="sr-only">
						{setSeatsMutation.isPending ? 'Processing request' : ''}
					</span>
				</form>
			</Ariakit.Dialog>

			<ConfirmActionModal
				confirmDisabled={!canChangeTeamBilling}
				isOpen={showCancelConfirm}
				onClose={() => {
					if (setSeatsMutation.isPending) return
					setSeatsMutation.reset()
					setShowCancelConfirm(false)
				}}
				onConfirm={handleConfirmCancel}
				isLoading={setSeatsMutation.isPending}
				error={showCancelConfirm ? seatsError : null}
				title={`Cancel ${label} Subscription`}
				description={
					subscription.seats.occupiedSeats > 0
						? `Cancel this ${label} subscription at the end of the current billing period? Assigned members keep access until the period ends, and you will not be billed again.`
						: `Cancel this ${label} subscription at the end of the current billing period? You will not be billed again.`
				}
				confirmLabel="Cancel Subscription"
				pendingLabel="Canceling subscription..."
				confirmVariant="danger"
			/>
		</Ariakit.DialogProvider>
	)
}
