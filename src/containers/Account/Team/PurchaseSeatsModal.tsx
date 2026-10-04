import * as Ariakit from '@ariakit/react'
import { useQueryClient } from '@tanstack/react-query'
import { Suspense, useId, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { EmbeddedCardCheckout } from '~/containers/Subscription/shared/EmbeddedCardCheckout'
import { SubscriptionLoadError } from '~/containers/Subscription/shared/SubscriptionLoadError'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogCancelButton, DialogDiscardGuard, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
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

// Radio labels host a visually hidden Ariakit.Radio, so the label draws the focus ring.
const radioOptionStyles =
	'relative flex h-10 flex-1 cursor-pointer items-center justify-center rounded-lg label-sm transition-colors has-focus-visible:focus-ring has-[input[aria-disabled=true]]:cursor-not-allowed has-[input[aria-disabled=true]]:opacity-60'
const radioOptionSelectedStyles = 'border border-brand bg-brand-muted text-link-on-tint'
const radioOptionIdleStyles = 'border border-medium text-primary'

export function PurchaseSeatsModal({ onClose }: { onClose: () => void }) {
	const radioId = useId()
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
			<form onSubmit={handlePurchase} className="flex min-h-0 flex-auto flex-col">
				<DialogHeader title={checkoutClientSecret ? 'Complete payment' : 'Purchase seats'} />
				<DialogBody>
					{checkoutClientSecret ? (
						<div className="relative min-h-[400px]">
							<Suspense
								fallback={
									<div role="status" className="absolute inset-0 flex items-center justify-center">
										<LoadingIndicator label="Loading checkout" />
									</div>
								}
							>
								<EmbeddedCardCheckout clientSecret={checkoutClientSecret} />
							</Suspense>
						</div>
					) : (
						<>
							{/* Subscription Type */}
							<div className="flex flex-col gap-2">
								<span className="label-sm text-secondary">Subscription type</span>
								<Ariakit.RadioProvider
									value={subscriptionType}
									setValue={(value) => setSubscriptionType(value as 'api' | 'llamafeed')}
								>
									<Ariakit.RadioGroup aria-label="Subscription type" className="flex gap-2">
										<label
											htmlFor={`${radioId}-llamafeed`}
											className={`${radioOptionStyles} ${
												subscriptionType === 'llamafeed' ? radioOptionSelectedStyles : radioOptionIdleStyles
											}`}
										>
											<Ariakit.Radio
												id={`${radioId}-llamafeed`}
												// The dialog opens on the selected option, its first field.
												autoFocus={subscriptionType === 'llamafeed'}
												accessibleWhenDisabled
												disabled={!canChangeTeamBilling}
												value="llamafeed"
												className="sr-only"
											/>
											Pro
										</label>
										<label
											htmlFor={`${radioId}-api`}
											className={`${radioOptionStyles} ${
												subscriptionType === 'api' ? radioOptionSelectedStyles : radioOptionIdleStyles
											}`}
										>
											<Ariakit.Radio
												id={`${radioId}-api`}
												// The dialog opens on the selected option, its first field.
												autoFocus={subscriptionType === 'api'}
												accessibleWhenDisabled
												disabled={!canChangeTeamBilling}
												value="api"
												className="sr-only"
											/>
											API
										</label>
									</Ariakit.RadioGroup>
								</Ariakit.RadioProvider>
							</div>

							{/* Billing Interval */}
							<div className="flex flex-col gap-2">
								<span className="label-sm text-secondary">Billing interval</span>
								<Ariakit.RadioProvider
									value={billingInterval}
									setValue={(value) => setBillingInterval(value as 'month' | 'year')}
								>
									<Ariakit.RadioGroup aria-label="Billing interval" className="flex gap-2">
										<label
											htmlFor={`${radioId}-month`}
											className={`${radioOptionStyles} ${
												billingInterval === 'month' ? radioOptionSelectedStyles : radioOptionIdleStyles
											}`}
										>
											<Ariakit.Radio
												id={`${radioId}-month`}
												accessibleWhenDisabled
												value="month"
												disabled={!canChangeTeamBilling || lockedInterval === 'year'}
												className="sr-only"
											/>
											Monthly
										</label>
										<label
											htmlFor={`${radioId}-year`}
											className={`${radioOptionStyles} ${
												billingInterval === 'year' ? radioOptionSelectedStyles : radioOptionIdleStyles
											}`}
										>
											<Ariakit.Radio
												id={`${radioId}-year`}
												accessibleWhenDisabled
												value="year"
												disabled={!canChangeTeamBilling || lockedInterval === 'month'}
												className="sr-only"
											/>
											Yearly
										</label>
									</Ariakit.RadioGroup>
								</Ariakit.RadioProvider>
								{lockedInterval ? (
									<p className="body-sm text-secondary">
										{lockedInterval === 'year'
											? `You already have a yearly ${subscriptionType === 'api' ? 'API' : 'Pro'} subscription. Monthly and yearly billing can't be mixed for the same plan — cancel the yearly subscription first.`
											: `You already have a monthly ${subscriptionType === 'api' ? 'API' : 'Pro'} subscription. Monthly and yearly billing can't be mixed for the same plan — upgrade the monthly subscription to yearly first.`}
									</p>
								) : null}
							</div>

							{/* Seat Count */}
							<div className="flex flex-col gap-2">
								<label htmlFor="seat-count" className="label-sm text-secondary">
									Number of seats
								</label>
								<div className="flex items-center gap-2">
									{/* Focusable at 1 seat: the press that reaches it keeps focus. */}
									<Button
										type="button"
										aria-label="Decrease seats"
										size="md"
										square
										disabled={seatCount <= 1 || !canChangeTeamBilling}
										accessibleWhenDisabled
										onClick={() => setSeatInput(String(Math.max(1, seatCount - 1)))}
									>
										<Icon name="minus" className="size-4" aria-hidden="true" />
									</Button>
									<Input
										id="seat-count"
										type="number"
										required
										min={1}
										step={1}
										readOnly={!canChangeTeamBilling}
										inputMode="numeric"
										value={seatInput}
										onChange={(e) => setSeatInput(e.target.value)}
										className="w-20 text-center"
									/>
									<Button
										type="button"
										aria-label="Increase seats"
										disabled={!canChangeTeamBilling}
										onClick={() => setSeatInput(String(Math.max(1, seatCount + 1)))}
										size="md"
										square
									>
										<Icon name="plus" className="size-4" aria-hidden="true" />
									</Button>
								</div>
							</div>

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
								<div className="flex items-start gap-2">
									<Icon name="sparkles" height={12} width={12} className="mt-0.5 shrink-0 text-tertiary" />
									<p className="body-sm text-secondary">
										Switch to yearly billing and get 2 months free — save $
										{formatNumber((subscriptionType === 'api' ? 300 * 12 - 3000 : 49 * 12 - 490) * seatCount)}
										/year on these seats.
									</p>
								</div>
							)}

							{isTeamRefreshError ? (
								<SubscriptionLoadError
									isRetrying={isTeamRetrying}
									onRetry={() => void refetchTeam()}
									message="Couldn't refresh team billing. Refresh before making another change."
								/>
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
							pendingLabel={pending ? 'Processing…' : billingWait}
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
