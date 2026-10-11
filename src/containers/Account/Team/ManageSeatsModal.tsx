import * as Ariakit from '@ariakit/react'
import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogCancelButton } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { formatDate } from '~/utils/dateFormat'
import { formatUsd } from '~/utils/numberFormat'
import { seatPrice } from './seatPricing'
import { getCancelAtDate, isCancelingSub } from './subscriptionCancel'
import type { TeamSubscription } from './types'
import { UnconfirmedTeamWriteError, useTeam } from './useTeam'

interface ManageSeatsModalProps {
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

export function ManageSeatsModal({ onClose, subscription }: ManageSeatsModalProps) {
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
	const [submitted, setSubmitted] = useState(false)
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
	const seatMessage =
		seatInput === ''
			? 'Enter a seat count.'
			: !Number.isInteger(seatCount)
				? 'Enter a whole number of seats.'
				: seatCount < minSeats
					? `Enter ${minSeats} or more seats.`
					: null
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

	const seats = subscription.seats.seatCount
	// Not the mutation's own error: that one clears as soon as a retry starts. Kept as the error, not its message: the
	// unconfirmed copy names the seats the team shows now. A cancellation's failure belongs to its confirmation; any
	// other count's to the form.
	const [failure, setFailure] = useState<{ error: Error; cancel: boolean } | null>(null)
	const failedCancel = failure?.cancel === true
	const seatsError = !failure
		? null
		: failure.error instanceof UnconfirmedTeamWriteError
			? `We couldn't confirm this change. Your team currently shows ${seats} ${label} seat${seats === 1 ? '' : 's'}.`
			: failure.error.message

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!canChangeTeamBilling) return
		if (seatMessage) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		setSeatsMutation.mutate(
			{ subscriptionType: subscription.type, seatCount },
			{ onSuccess: onClose, onError: (error) => setFailure({ error, cancel: false }) }
		)
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
				},
				onError: (error) => setFailure({ error, cancel: true })
			}
		)
	}

	return (
		<Dialog size="sm" open onClose={onClose} pending={pending} portal unmountOnHide>
			<form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-auto flex-col">
				<DialogHeader title={`Manage ${label} seats`} />
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

					<Field label="New seat count" hint={floorHint} error={submitted ? seatMessage : null}>
						{(control) => (
							<div className="flex items-center gap-2">
								{/* Focusable at the floor: the press that reaches it keeps focus, and the hint below says why. */}
								<Tooltip
									content="Decrease seats"
									render={
										<Button
											type="button"
											aria-label="Decrease seats"
											size="md"
											square
											disabled={decrementDisabled || !canChangeTeamBilling}
											accessibleWhenDisabled
											onClick={() => setSeatInput(String(Math.max(minSeats, seatCount - 1)))}
										/>
									}
								>
									<Icon name="minus" className="size-4" aria-hidden="true" />
								</Tooltip>
								{/* Ariakit's autoFocus, so the dialog opens on the seat count instead of the header ×. */}
								<Ariakit.Focusable
									autoFocus
									render={
										<Input
											{...control}
											type="number"
											required
											min={minSeats}
											step={1}
											readOnly={!canChangeTeamBilling}
											inputMode="numeric"
											value={seatInput}
											onChange={(e) => setSeatInput(e.target.value)}
											className="w-20 text-center"
										/>
									}
								/>
								<Tooltip
									content="Increase seats"
									render={
										<Button
											type="button"
											aria-label="Increase seats"
											disabled={!canChangeTeamBilling}
											onClick={() => setSeatInput(String(Math.max(minSeats, seatCount + 1)))}
											size="md"
											square
										/>
									}
								>
									<Icon name="plus" className="size-4" aria-hidden="true" />
								</Tooltip>
							</div>
						)}
					</Field>

					{hasChange && !seatMessage && (
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

					{diff < 0 && !seatMessage && (
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
									// A fresh confirmation starts without the last one's failure; a retry inside one keeps it.
									if (failedCancel) setFailure(null)
									setShowCancelConfirm(true)
								}}
								disabled={!canChangeTeamBilling}
							>
								Cancel subscription
							</Button>
						</div>
					) : null}
					{isTeamRefreshError ? (
						<InlineStatus variant="error" retry={{ refetch: refetchTeam, isFetching: isTeamRetrying }}>
							Couldn&apos;t refresh team billing. Refresh before making another change.
						</InlineStatus>
					) : null}
					{seatsError && !failedCancel ? <InlineStatus variant="error">{seatsError}</InlineStatus> : null}
				</DialogBody>
				<DialogFooter
					leading={footerStatus ? <p className="body-sm text-tertiary">{footerStatus}</p> : null}
					dismiss={<DialogCancelButton />}
				>
					<Button
						type="submit"
						variant="primary"
						size="md"
						// While pending the button stays focusable and shows its label instead.
						disabled={!pending && !billingWait && (!canChangeTeamBilling || !hasChange)}
						pendingLabel={pending ? 'Updating…' : (billingWait ?? 'Updating…')}
						pending={pending || billingWait !== null}
					>
						Update seats
					</Button>
				</DialogFooter>
				<span role="status" className="sr-only">
					{pending ? 'Processing request' : ''}
				</span>
			</form>

			<ConfirmDialog
				open={showCancelConfirm}
				onClose={() => setShowCancelConfirm(false)}
				portal
				unmountOnHide
				title={`Cancel ${label} subscription`}
				description={
					occupiedSeats > 0
						? `Cancel this ${label} subscription at the end of the current billing period? Assigned members keep access until the period ends, and you will not be billed again.`
						: `Cancel this ${label} subscription at the end of the current billing period? You will not be billed again.`
				}
				confirmLabel="Cancel subscription"
				cancelLabel="Keep subscription"
				confirmDisabled={!pending && billingLockReason !== null}
				pendingLabel="Canceling subscription…"
				pending={pending}
				waitingLabel={billingWait}
				// A lock blocks the confirm button, so it shows where a failure would, and wins over the failure that
				// led to it: after a failed cancel whose team refresh also fails, retrying is no longer possible.
				error={(pending ? null : billingLockReason) ?? (failedCancel ? seatsError : null)}
				onConfirm={handleConfirmCancel}
			/>
		</Dialog>
	)
}
