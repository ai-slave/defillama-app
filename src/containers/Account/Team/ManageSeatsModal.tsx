import * as Ariakit from '@ariakit/react'
import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { SubscriptionLoadError } from '~/containers/Subscription/shared/SubscriptionLoadError'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { formatDate } from '~/utils/dateFormat'
import { formatUsd } from '~/utils/numberFormat'
import { seatPrice } from './seatPricing'
import { getCancelAtDate, isCancelingSub } from './subscriptionCancel'
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
	return { amount: seatPrice(type, billingInterval), suffix: `/${billingInterval}` }
}

// The stepper keeps its 40px controls; control heights move in their own change.
const seatStepperButtonStyles =
	'flex size-10 shrink-0 items-center justify-center rounded-lg border border-medium text-primary not-disabled:hover:bg-hover-row disabled:cursor-not-allowed disabled:opacity-60'

export function ManageSeatsModal({ isOpen, onClose, subscription }: ManageSeatsModalProps) {
	const {
		canChangeTeamBilling,
		billingWait,
		billingLockReason,
		isTeamRefreshError,
		isTeamRetrying,
		refetchTeam,
		setSeatsMutation
	} = useTeam()
	const [seatInput, setSeatInput] = useState(String(subscription.seats.seatCount))
	const seatCount = Number(seatInput)
	const [showCancelConfirm, setShowCancelConfirm] = useState(false)
	const pending = setSeatsMutation.isPending

	const label = getSubscriptionLabel(subscription.type)
	const unitPrice = getUnitPrice(subscription.type, subscription.billingInterval)
	const occupiedSeats = subscription.seats.occupiedSeats
	const diff = seatCount - subscription.seats.seatCount
	const hasChange = diff !== 0
	const cancelAtDate = getCancelAtDate(subscription)
	const isCanceling = isCancelingSub(subscription)
	// When canceling, lock the floor at the current count — only increases (which undo
	// the pending cancel) are allowed.
	const minSeats = isCanceling ? subscription.seats.seatCount : Math.max(1, occupiedSeats)
	const isValidSeatCount = seatInput !== '' && Number.isInteger(seatCount) && seatCount >= minSeats
	const isAtOccupiedFloor = !isCanceling && seatCount <= occupiedSeats && occupiedSeats > 0
	const decrementDisabled = seatCount <= minSeats
	const floorHint = !decrementDisabled
		? null
		: isCanceling
			? "Seats can't be reduced while this subscription is scheduled to cancel."
			: isAtOccupiedFloor
				? `You can't reduce below ${occupiedSeats} seat${occupiedSeats === 1 ? '' : 's'}. Unassign members from this subscription first to remove seats.`
				: 'A subscription keeps at least 1 seat. Cancel the subscription to stop billing.'
	// The load error above the footer already explains a failed refresh and offers the retry.
	const footerStatus =
		pending || isTeamRefreshError || billingWait || hasChange ? null : 'Change the seat count to update'

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
					toast.success('Subscription will cancel at the end of the current period')
				}
			}
		)
	}

	const handleClose = () => {
		if (pending) return
		setSeatsMutation.reset()
		setSeatInput(String(subscription.seats.seatCount))
		onClose()
	}

	return (
		<Dialog size="sm" open={isOpen} onClose={handleClose} pending={pending} portal unmountOnHide>
			<form onSubmit={handleSubmit} className="flex min-h-0 flex-auto flex-col">
				<DialogHeader title={`Manage ${label} Seats`} />
				<DialogBody>
					{isCanceling && cancelAtDate ? (
						<InlineStatus variant="warning">
							This subscription is scheduled to cancel on {formatDate(cancelAtDate)}. Increasing the seat count will
							resume billing and undo the pending cancellation.
						</InlineStatus>
					) : null}

					<div className="flex flex-col gap-2 rounded-lg border border-subtle p-3 body-sm text-secondary">
						<div className="flex items-center justify-between">
							<span>Current seats</span>
							<span className="text-primary">{subscription.seats.seatCount}</span>
						</div>
						<div className="flex items-center justify-between">
							<span>Occupied</span>
							<span className="text-primary">{occupiedSeats}</span>
						</div>
					</div>

					<div className="flex flex-col gap-1.5">
						<label htmlFor="manage-seat-count" className="label-sm text-secondary">
							New seat count
						</label>
						<div className="flex items-center gap-2">
							<button
								type="button"
								aria-label="Decrease seats"
								onClick={() => setSeatInput(String(Math.max(minSeats, seatCount - 1)))}
								disabled={decrementDisabled || !canChangeTeamBilling}
								className={seatStepperButtonStyles}
							>
								<Icon name="minus" height={16} width={16} />
							</button>
							{/* Ariakit's autoFocus, so the dialog opens on the seat count instead of the header ×. */}
							<Ariakit.Focusable
								autoFocus
								render={
									<Input
										id="manage-seat-count"
										type="number"
										required
										min={minSeats}
										step={1}
										readOnly={!canChangeTeamBilling}
										inputMode="numeric"
										value={seatInput}
										onChange={(e) => setSeatInput(e.target.value)}
										aria-describedby={floorHint ? 'manage-seat-floor' : undefined}
										className="h-10 w-20 text-center"
									/>
								}
							/>
							<button
								type="button"
								aria-label="Increase seats"
								disabled={!canChangeTeamBilling}
								onClick={() => setSeatInput(String(Math.max(minSeats, seatCount + 1)))}
								className={seatStepperButtonStyles}
							>
								<Icon name="plus" height={16} width={16} />
							</button>
						</div>
						{floorHint ? (
							<p id="manage-seat-floor" className="body-sm text-secondary">
								{floorHint}
							</p>
						) : null}
					</div>

					{hasChange && isValidSeatCount && (
						<div className="flex flex-col gap-2 rounded-lg bg-surface-elevated-1 p-3 body-sm text-secondary">
							<div className="flex items-center justify-between">
								<span>
									{diff > 0
										? `Adding ${diff} seat${diff === 1 ? '' : 's'}`
										: `Removing ${-diff} seat${-diff === 1 ? '' : 's'}`}
								</span>
								<span className="label-sm text-primary">
									{diff > 0 ? '+' : '−'}
									{formatUsd(unitPrice.amount * Math.abs(diff))}
									{unitPrice.suffix}
								</span>
							</div>
							<div className="flex items-center justify-between border-t border-subtle pt-2">
								<span>Bill after update</span>
								<span className="label-sm text-primary">
									{`${formatUsd(unitPrice.amount * seatCount)}${unitPrice.suffix}`}
								</span>
							</div>
						</div>
					)}

					{diff < 0 && isValidSeatCount && (
						<InlineStatus variant="warning">
							Seats will be removed immediately and the payment for the current billing period will not be refunded.
						</InlineStatus>
					)}

					{!isCanceling && subscription.seats.seatCount > 0 ? (
						<div className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-4">
							<p className="min-w-0 flex-1 body-sm text-secondary">Stop billing at the end of the current period.</p>
							<Button
								type="button"
								variant="destructive"
								size="md"
								onClick={() => {
									setSeatsMutation.reset()
									setShowCancelConfirm(true)
								}}
								disabled={!canChangeTeamBilling}
							>
								Cancel subscription
							</Button>
						</div>
					) : null}
					{isTeamRefreshError ? (
						<SubscriptionLoadError
							isRetrying={isTeamRetrying}
							onRetry={() => void refetchTeam()}
							message="Couldn't refresh team billing. Refresh before making another change."
						/>
					) : null}
					{seatsError && !showCancelConfirm ? <InlineStatus variant="error">{seatsError}</InlineStatus> : null}
				</DialogBody>
				<DialogFooter
					leading={footerStatus ? <p className="body-sm text-tertiary">{footerStatus}</p> : null}
					dismiss={
						<Button type="button" size="md" onClick={handleClose} disabled={pending}>
							Cancel
						</Button>
					}
				>
					<Button
						type="submit"
						variant="primary"
						size="md"
						// While pending the button stays focusable and shows its label instead.
						disabled={!pending && !billingWait && (!canChangeTeamBilling || !hasChange)}
						pendingLabel={pending ? 'Updating…' : billingWait}
					>
						Update Seats
					</Button>
				</DialogFooter>
				<span role="status" className="sr-only">
					{pending ? 'Processing request' : ''}
				</span>
			</form>

			<ConfirmDialog
				open={showCancelConfirm}
				onClose={() => {
					setSeatsMutation.reset()
					setShowCancelConfirm(false)
				}}
				portal
				unmountOnHide
				title={`Cancel ${label} Subscription`}
				description={
					occupiedSeats > 0
						? `Cancel this ${label} subscription at the end of the current billing period? Assigned members keep access until the period ends, and you will not be billed again.`
						: `Cancel this ${label} subscription at the end of the current billing period? You will not be billed again.`
				}
				confirmLabel="Cancel Subscription"
				cancelLabel="Keep subscription"
				confirmDisabled={!pending && billingLockReason !== null}
				pendingLabel={pending ? 'Canceling subscription…' : null}
				waitingLabel={billingWait}
				// A lock blocks the confirm button, so it shows where a failure would, and wins over the failure that
				// led to it: after a failed cancel whose team refresh also fails, retrying is no longer possible.
				error={showCancelConfirm ? ((pending ? null : billingLockReason) ?? seatsError) : null}
				onConfirm={handleConfirmCancel}
			/>
		</Dialog>
	)
}
