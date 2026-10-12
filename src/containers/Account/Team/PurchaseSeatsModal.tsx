import { useQueryClient } from '@tanstack/react-query'
import { Suspense, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { EmbeddedCardCheckout } from '~/containers/Subscription/shared/EmbeddedCardCheckout'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogCancelButton, DialogDiscardGuard, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { formatDate } from '~/utils/dateFormat'
import { formatNumber } from '~/utils/numberFormat'
import { scheduleConfirmationReads } from '../utils'
import { readPendingTeamCheckout, TEAM_CHECKOUT_HOLD_MS, teamCheckoutReturnPath } from './pendingTeamCheckout'
import { formatSeatTotal } from './seatPricing'
import { getCancelAtDate, isCancelingSub } from './subscriptionCancel'
import type { TeamSubscription } from './types'
import { UnconfirmedTeamWriteError, useTeam } from './useTeam'

function getExistingInterval(
	subscriptions: Array<TeamSubscription>,
	type: 'api' | 'llamafeed'
): 'month' | 'year' | null {
	const existing = subscriptions.find(
		(sub) => sub.type === type && (sub.status === undefined || sub.status === 'active')
	)
	return existing?.billingInterval ?? null
}

// A purchase without a definite answer names what the team shows now, from the latest successful read.
function getUnconfirmedPurchaseMessage(subscriptions: Array<TeamSubscription>, type: string): string {
	const label = type === 'api' ? 'API' : 'Pro'
	const existing = subscriptions.find((sub) => sub.type === type)
	if (!existing) return `We couldn't confirm this purchase. Your team currently has no ${label} seats.`
	const seats = existing.seats.seatCount
	return `We couldn't confirm this purchase. Your team currently shows ${seats} ${label} seat${seats === 1 ? '' : 's'}.`
}

export function PurchaseSeatsModal({ onClose }: { onClose: () => void }) {
	const queryClient = useQueryClient()
	const { user } = useAuthContext()
	const nowSeconds = useNowSeconds()
	const {
		canChangeTeamBilling,
		billingWait,
		isTeamRefreshError,
		isTeamRetrying,
		refetchTeam,
		purchaseSeatsMutation,
		teamSubscriptions
	} = useTeam()
	const pending = purchaseSeatsMutation.isPending
	const [subscriptionType, setSubscriptionType] = useState<'api' | 'llamafeed'>('llamafeed')
	const [seatInput, setSeatInput] = useState('1')
	const seatCount = Number(seatInput)
	const [submitted, setSubmitted] = useState(false)
	const seatMessage =
		seatInput === ''
			? 'Enter a seat count.'
			: !Number.isInteger(seatCount)
				? 'Enter a whole number of seats.'
				: seatCount < 1
					? 'Enter 1 or more seats.'
					: null
	const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month')
	// Not the mutation's own error: that one clears as soon as a retry starts. Kept as the error and its plan, not
	// a message: the unconfirmed copy names the seats the team shows now.
	const [purchaseError, setPurchaseError] = useState<{ error: Error; subscriptionType: string } | null>(null)
	const checkoutClientSecret =
		purchaseSeatsMutation.data?.action === 'checkout_created' ? purchaseSeatsMutation.data.clientSecret : null

	const lockedInterval = getExistingInterval(teamSubscriptions, subscriptionType)
	const typeLabel = subscriptionType === 'api' ? 'API' : 'Pro'
	const existing = teamSubscriptions.find((sub) => sub.type === subscriptionType)
	// The purchase clears a scheduled cancellation, so every seat renews on the date the plan would have ended.
	const resumedEndDate = existing && isCancelingSub(existing) ? getCancelAtDate(existing) : null
	// A paid checkout returns before its webhook adds the plan, and a second checkout opened meanwhile could be paid
	// too. Once the team shows the plan, a purchase adds seats to it instead of opening a checkout.
	const pendingCheckout = existing || !user ? null : readPendingTeamCheckout(user.id, subscriptionType)
	const holdsForPendingCheckout =
		pendingCheckout !== null && nowSeconds * 1000 - pendingCheckout.startedAt < TEAM_CHECKOUT_HOLD_MS

	// When the selected type has an existing sub, the interval is forced to match it — the backend rejects
	// mixing monthly and yearly for the same subscription type. Written into state, so it is still the
	// chosen interval after switching to a type that has no subscription. Self-terminating: the next render
	// sees the locked value.
	if (lockedInterval && billingInterval !== lockedInterval) {
		setBillingInterval(lockedInterval)
	}

	const handlePurchase = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!canChangeTeamBilling || checkoutClientSecret || holdsForPendingCheckout) return
		if (seatMessage) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		purchaseSeatsMutation.mutate(
			{
				subscriptionType,
				seatCount,
				billingInterval,
				redirectUrl: `${window.location.origin}${teamCheckoutReturnPath(subscriptionType, seatCount)}`,
				cancelUrl: `${window.location.origin}/account?tab=team`
			},
			{
				onSuccess: (result) => {
					setPurchaseError(null)
					if (result.action !== 'seats_added') return
					onClose()
					toast.success(`${result.seatsAdded} seat${result.seatsAdded === 1 ? '' : 's'} added`)
				},
				onError: (error, variables) => setPurchaseError({ error, subscriptionType: variables.subscriptionType })
			}
		)
	}

	const handleClose = () => {
		// A payment submitted just before Leave still completes and its webhook lags, so the team is read a few times.
		if (checkoutClientSecret) scheduleConfirmationReads(queryClient, ['team'])
		onClose()
	}

	return (
		<Dialog size={checkoutClientSecret ? 'md' : 'sm'} open onClose={handleClose} pending={pending} portal unmountOnHide>
			{/* Closing mid-payment asks first: leaving drops the checkout and whatever was entered in it. The guard also
			    ignores outside taps, since Stripe owns the payment's submit state. */}
			<DialogDiscardGuard
				when={checkoutClientSecret !== null}
				title="Leave checkout?"
				description="Your seats aren't purchased until the payment finishes. Leaving closes this checkout."
				cancelLabel="Keep paying"
				confirmLabel="Leave"
			/>
			<form noValidate onSubmit={handlePurchase} className="flex min-h-0 flex-auto flex-col">
				<DialogHeader title={checkoutClientSecret ? 'Complete payment' : 'Purchase seats'} />
				<DialogBody>
					{checkoutClientSecret ? (
						<div className="relative min-h-[400px]">
							<Suspense
								fallback={<SurfaceBodyLoadingStatus label="Loading checkout" className="absolute inset-0 min-h-0" />}
							>
								<EmbeddedCardCheckout clientSecret={checkoutClientSecret} />
							</Suspense>
						</div>
					) : (
						<>
							{/* Subscription Type */}
							<div className="flex flex-col gap-2">
								<span className="label-sm text-secondary">Subscription type</span>
								<SegmentedControl<'llamafeed' | 'api'>
									label="Subscription type"
									variant="field"
									size="md"
									value={subscriptionType}
									onValueChange={setSubscriptionType}
									disabled={!canChangeTeamBilling}
									options={[
										// The dialog opens on the selected option, its first field.
										{ value: 'llamafeed', label: 'Pro', autoFocus: subscriptionType === 'llamafeed' },
										{ value: 'api', label: 'API', autoFocus: subscriptionType === 'api' }
									]}
								/>
							</div>

							{/* Billing Interval */}
							<div className="flex flex-col gap-2">
								<span className="label-sm text-secondary">Billing interval</span>
								<SegmentedControl<'month' | 'year'>
									label="Billing interval"
									variant="field"
									size="md"
									value={billingInterval}
									onValueChange={setBillingInterval}
									disabled={!canChangeTeamBilling}
									options={[
										// A refetch that locks the focused interval drops focus to the dialog's first control (its
										// lost-focus net); it needs a plan bought elsewhere while this dialog is open, so it is accepted.
										{ value: 'month', label: 'Monthly', disabled: lockedInterval === 'year' },
										{ value: 'year', label: 'Yearly', disabled: lockedInterval === 'month' }
									]}
								/>
								{lockedInterval ? (
									<p className="body-sm text-secondary">
										{lockedInterval === 'year'
											? `You already have a yearly ${subscriptionType === 'api' ? 'API' : 'Pro'} subscription. Monthly and yearly billing can't be mixed for the same plan — cancel the yearly subscription first.`
											: `You already have a monthly ${subscriptionType === 'api' ? 'API' : 'Pro'} subscription. Monthly and yearly billing can't be mixed for the same plan — upgrade the monthly subscription to yearly first.`}
									</p>
								) : null}
							</div>

							{/* Seat Count */}
							<Field label="Number of seats" error={submitted ? seatMessage : null}>
								{(control) => (
									<div className="flex items-center gap-2">
										{/* Focusable at 1 seat: the press that reaches it keeps focus. */}
										<Tooltip
											content="Decrease seats"
											render={
												<Button
													type="button"
													aria-label="Decrease seats"
													size="md"
													square
													disabled={seatCount <= 1 || !canChangeTeamBilling}
													accessibleWhenDisabled
													onClick={() => setSeatInput(String(Math.max(1, seatCount - 1)))}
												/>
											}
										>
											<Icon name="minus" className="size-4" aria-hidden="true" />
										</Tooltip>
										<Input
											{...control}
											type="number"
											required
											min={1}
											step={1}
											readOnly={!canChangeTeamBilling}
											inputMode="numeric"
											variant="stepper"
											value={seatInput}
											onChange={(e) => setSeatInput(e.target.value)}
											className="w-20"
										/>
										<Tooltip
											content="Increase seats"
											render={
												<Button
													type="button"
													aria-label="Increase seats"
													disabled={!canChangeTeamBilling}
													onClick={() => setSeatInput(String(Math.max(1, seatCount + 1)))}
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

							{/* Price Summary */}
							<div className="flex items-center justify-between rounded-lg bg-surface-elevated-1 p-3 body-sm text-secondary">
								<span>Estimated total</span>
								<span className="label-sm text-primary">
									{formatSeatTotal(subscriptionType, billingInterval, seatCount)}
								</span>
							</div>

							{existing && resumedEndDate ? (
								<InlineStatus variant="warning">
									This {typeLabel} subscription is set to end on {formatDate(resumedEndDate)}. Buying seats resumes it,
									and all {existing.seats.seatCount + seatCount} seats renew on {formatDate(resumedEndDate)}.
								</InlineStatus>
							) : null}

							{billingInterval === 'month' && !lockedInterval && (
								<div className="flex items-start gap-2 body-sm">
									<span className="flex h-lh shrink-0 items-center">
										<Icon name="sparkles" className="size-3 text-tertiary" />
									</span>
									<p className="text-secondary">
										Switch to yearly billing and get 2 months free — save $
										{formatNumber((subscriptionType === 'api' ? 300 * 12 - 3000 : 49 * 12 - 490) * seatCount)}
										/year on these seats.
									</p>
								</div>
							)}

							{isTeamRefreshError ? (
								<InlineStatus variant="error" retry={{ refetch: refetchTeam, isFetching: isTeamRetrying }}>
									Couldn&apos;t refresh team billing. Refresh before making another change.
								</InlineStatus>
							) : null}
							{holdsForPendingCheckout ? (
								<InlineStatus variant="warning">
									Your earlier payment for {typeLabel} seats is still being confirmed. It can take a few minutes to
									appear.
								</InlineStatus>
							) : null}
							{purchaseError ? (
								<InlineStatus variant="error">
									{purchaseError.error instanceof UnconfirmedTeamWriteError
										? getUnconfirmedPurchaseMessage(teamSubscriptions, purchaseError.subscriptionType)
										: purchaseError.error.message}
								</InlineStatus>
							) : null}
						</>
					)}
				</DialogBody>
				{checkoutClientSecret ? null : (
					<DialogFooter dismiss={<DialogCancelButton />}>
						<Button
							type="submit"
							variant="primary"
							size="md"
							// While pending the button stays focusable and shows its label instead.
							disabled={!pending && !billingWait && (!canChangeTeamBilling || holdsForPendingCheckout)}
							pendingLabel={pending ? 'Processing…' : (billingWait ?? 'Processing…')}
							pending={pending || billingWait !== null}
						>
							Purchase seats
						</Button>
					</DialogFooter>
				)}
				<span role="status" className="sr-only">
					{pending ? 'Processing request' : ''}
				</span>
			</form>
		</Dialog>
	)
}
