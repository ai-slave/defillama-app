import * as Ariakit from '@ariakit/react'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useId, useState, type FormEvent } from 'react'
import { STRIPE_PUBLISHABLE_KEY } from '~/constants'
import { SubscriptionLoadError } from '~/containers/Subscription/shared/SubscriptionLoadError'
import { DialogHeading } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber, formatUsd } from '~/utils/numberFormat'
import type { TeamSubscription } from './types'
import { useTeam } from './useTeam'

function getExistingInterval(
	subscriptions: Array<TeamSubscription>,
	type: 'api' | 'llamafeed'
): 'month' | 'year' | null {
	const existing = subscriptions.find(
		(sub) => sub.type === type && (sub.status === undefined || sub.status === 'active')
	)
	return existing?.billingInterval ?? null
}

const stripeInstance = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null

interface PurchaseSeatsModalProps {
	isOpen: boolean
	onClose: () => void
}

export function PurchaseSeatsModal({ isOpen, onClose }: PurchaseSeatsModalProps) {
	const radioId = useId()
	const {
		canChangeTeamBilling,
		isTeamRefreshError,
		isTeamRetrying,
		refetchTeam,
		isTeamUpdating,
		purchaseSeatsMutation,
		teamSubscriptions
	} = useTeam()
	const [subscriptionType, setSubscriptionType] = useState<'api' | 'llamafeed'>('llamafeed')
	const [seatInput, setSeatInput] = useState('1')
	const seatCount = Number(seatInput)
	const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month')
	const checkoutClientSecret =
		purchaseSeatsMutation.data?.action === 'checkout_created' ? purchaseSeatsMutation.data.clientSecret : null

	const lockedInterval = getExistingInterval(teamSubscriptions, subscriptionType)

	// When the selected type has an existing sub, the interval is forced to match it — the backend rejects
	// mixing monthly and yearly for the same subscription type. Written into state, so it is still the
	// chosen interval after switching to a type that has no subscription. Self-terminating: the next render
	// sees the locked value.
	if (lockedInterval && billingInterval !== lockedInterval) {
		setBillingInterval(lockedInterval)
	}

	const handlePurchase = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!canChangeTeamBilling || checkoutClientSecret) return
		purchaseSeatsMutation.mutate(
			{
				subscriptionType,
				seatCount,
				billingInterval,
				redirectUrl: `${window.location.origin}/account?tab=team&team-checkout=success`,
				cancelUrl: `${window.location.origin}/account?tab=team`
			},
			{
				onSuccess: (result) => {
					if (result.action === 'seats_added') onClose()
				}
			}
		)
	}

	const handleClose = () => {
		if (purchaseSeatsMutation.isPending) return
		purchaseSeatsMutation.reset()
		onClose()
	}

	return (
		<Ariakit.DialogProvider open={isOpen} setOpen={(open) => !open && handleClose()}>
			<Ariakit.Dialog
				backdrop={<div className="bg-black/80" />}
				className={`dialog h-fit max-h-[90dvh] min-h-0 gap-0 overflow-y-auto rounded-2xl border-0 p-0 ${
					checkoutClientSecret ? 'md:max-w-[600px]' : 'md:max-w-[420px]'
				}`}
				hideOnEscape={!purchaseSeatsMutation.isPending}
				hideOnInteractOutside={!purchaseSeatsMutation.isPending}
				portal
				unmountOnHide
			>
				<form onSubmit={handlePurchase} className="flex flex-col gap-5 bg-white px-5 py-6 dark:bg-sub-surface-dark">
					<div className="flex items-center justify-between">
						<DialogHeading className="text-base font-semibold text-sub-text-primary">
							{checkoutClientSecret ? 'Complete Payment' : 'Purchase Seats'}
						</DialogHeading>
						<Ariakit.DialogDismiss
							aria-label="Close"
							disabled={purchaseSeatsMutation.isPending}
							className="flex size-8 shrink-0 items-center justify-center rounded-full text-sub-text-muted transition-colors hover:text-sub-text-primary"
						>
							<Icon name="x" height={18} width={18} />
						</Ariakit.DialogDismiss>
					</div>

					{checkoutClientSecret ? (
						<div className="min-h-[400px]">
							{stripeInstance ? (
								<EmbeddedCheckoutProvider stripe={stripeInstance} options={{ clientSecret: checkoutClientSecret }}>
									<EmbeddedCheckout />
								</EmbeddedCheckoutProvider>
							) : (
								<div className="flex flex-col items-center gap-2 py-8 text-center">
									<Icon name="alert-triangle" height={24} width={24} className="text-error" />
									<p className="text-sm text-sub-text-muted">
										Stripe is not configured. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in your environment.
									</p>
								</div>
							)}
						</div>
					) : (
						<>
							{/* Subscription Type */}
							<div className="flex flex-col gap-2">
								<span className="text-xs font-medium text-sub-text-muted">Subscription Type</span>
								<Ariakit.RadioProvider
									value={subscriptionType}
									setValue={(value) => setSubscriptionType(value as 'api' | 'llamafeed')}
								>
									<Ariakit.RadioGroup aria-label="Subscription Type" className="flex gap-2">
										<label
											htmlFor={`${radioId}-llamafeed`}
											className={`relative flex h-10 flex-1 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-sub-brand-primary has-[input[aria-disabled=true]]:opacity-50 ${
												subscriptionType === 'llamafeed'
													? 'border-sub-brand-primary bg-sub-brand-primary/5 text-sub-brand-primary'
													: 'border-sub-border-slate-100 text-sub-text-primary dark:border-sub-border-strong'
											}`}
										>
											<Ariakit.Radio
												id={`${radioId}-llamafeed`}
												accessibleWhenDisabled
												disabled={!canChangeTeamBilling}
												value="llamafeed"
												className="sr-only"
											/>
											Pro
										</label>
										<label
											htmlFor={`${radioId}-api`}
											className={`relative flex h-10 flex-1 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-sub-brand-primary has-[input[aria-disabled=true]]:opacity-50 ${
												subscriptionType === 'api'
													? 'border-sub-brand-primary bg-sub-brand-primary/5 text-sub-brand-primary'
													: 'border-sub-border-slate-100 text-sub-text-primary dark:border-sub-border-strong'
											}`}
										>
											<Ariakit.Radio
												id={`${radioId}-api`}
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
								<span className="text-xs font-medium text-sub-text-muted">Billing Interval</span>
								<Ariakit.RadioProvider
									value={billingInterval}
									setValue={(value) => setBillingInterval(value as 'month' | 'year')}
								>
									<Ariakit.RadioGroup aria-label="Billing Interval" className="flex gap-2">
										<Tooltip
											content={
												lockedInterval === 'year'
													? `You already have a yearly ${subscriptionType === 'api' ? 'API' : 'Pro'} subscription. Monthly and yearly billing can't be mixed for the same plan — upgrade or cancel the yearly subscription first.`
													: null
											}
											placement="top"
											className="flex-1"
										>
											<label
												htmlFor={`${radioId}-month`}
												className={`relative flex h-10 w-full flex-1 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-sub-brand-primary has-[input[aria-disabled=true]]:opacity-50 aria-disabled:opacity-50 ${
													billingInterval === 'month'
														? 'border-sub-brand-primary bg-sub-brand-primary/5 text-sub-brand-primary'
														: 'border-sub-border-slate-100 text-sub-text-primary dark:border-sub-border-strong'
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
										</Tooltip>
										<Tooltip
											content={
												lockedInterval === 'month'
													? `You already have a monthly ${subscriptionType === 'api' ? 'API' : 'Pro'} subscription. Monthly and yearly billing can't be mixed for the same plan — upgrade the monthly subscription to yearly first.`
													: null
											}
											placement="top"
											className="flex-1"
										>
											<label
												htmlFor={`${radioId}-year`}
												className={`relative flex h-10 w-full flex-1 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-sub-brand-primary has-[input[aria-disabled=true]]:opacity-50 aria-disabled:opacity-50 ${
													billingInterval === 'year'
														? 'border-sub-brand-primary bg-sub-brand-primary/5 text-sub-brand-primary'
														: 'border-sub-border-slate-100 text-sub-text-primary dark:border-sub-border-strong'
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
										</Tooltip>
									</Ariakit.RadioGroup>
								</Ariakit.RadioProvider>
							</div>

							{/* Seat Count */}
							<div className="flex flex-col gap-2">
								<label htmlFor="seat-count" className="text-xs font-medium text-sub-text-muted">
									Number of Seats
								</label>
								<div className="flex items-center gap-2">
									<button
										type="button"
										aria-label="Decrease seats"
										onClick={() => setSeatInput(String(Math.max(1, seatCount - 1)))}
										disabled={seatCount <= 1 || !canChangeTeamBilling}
										className="flex size-10 items-center justify-center rounded-lg border border-sub-border-slate-100 text-sub-text-primary disabled:opacity-30 dark:border-sub-border-strong"
									>
										<Icon name="minus" height={16} width={16} />
									</button>
									<input
										id="seat-count"
										type="number"
										required
										min={1}
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
										onClick={() => setSeatInput(String(Math.max(1, seatCount + 1)))}
										className="flex size-10 items-center justify-center rounded-lg border border-sub-border-slate-100 text-sub-text-primary dark:border-sub-border-strong"
									>
										<Icon name="plus" height={16} width={16} />
									</button>
								</div>
							</div>

							{/* Price Summary */}
							<div className="rounded-lg bg-sub-brand-primary/5 p-3">
								<div className="flex items-center justify-between">
									<span className="text-sm text-sub-text-muted">Estimated total</span>
									<span className="text-sm font-semibold text-sub-text-primary">
										{subscriptionType === 'api'
											? billingInterval === 'year'
												? `${formatUsd(3000 * seatCount)}/year`
												: `${formatUsd(300 * seatCount)}/month`
											: billingInterval === 'year'
												? `${formatUsd(490 * seatCount)}/year`
												: `${formatUsd(49 * seatCount)}/month`}
									</span>
								</div>
							</div>

							{billingInterval === 'month' && !lockedInterval && (
								<div className="flex items-start gap-2">
									<Icon name="sparkles" height={12} width={12} className="mt-1 shrink-0 text-sub-text-muted" />
									<p className="text-xs leading-5 text-sub-text-muted">
										Switch to yearly billing and get 2 months free — save $
										{formatNumber((subscriptionType === 'api' ? 300 * 12 - 3000 : 49 * 12 - 490) * seatCount)}
										/year on these seats.
									</p>
								</div>
							)}

							{purchaseSeatsMutation.isError ? (
								<div
									role="alert"
									className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-error"
								>
									<Icon name="alert-warning" height={16} width={16} className="shrink-0" />
									<p className="text-sm">{purchaseSeatsMutation.error.message}</p>
								</div>
							) : null}

							<Ariakit.Button
								type="submit"
								accessibleWhenDisabled
								disabled={!canChangeTeamBilling}
								className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sub-brand-primary text-sm font-medium text-on-brand disabled:opacity-50 aria-disabled:opacity-50"
							>
								{purchaseSeatsMutation.isPending ? <LoadingSpinner size={14} /> : null}
								{purchaseSeatsMutation.isPending ? 'Processing...' : 'Purchase Seats'}
							</Ariakit.Button>
						</>
					)}
					{isTeamRefreshError ? (
						<SubscriptionLoadError
							message="Couldn't refresh team billing. Refresh before making another change."
							isRetrying={isTeamRetrying}
							onRetry={() => void refetchTeam()}
						/>
					) : null}
					<span role="status" className="text-sm text-sub-text-muted">
						{isTeamUpdating && !purchaseSeatsMutation.isPending
							? 'Another team update is in progress. Please wait for the confirmed subscription.'
							: ''}
					</span>
					<span role="status" className="sr-only">
						{purchaseSeatsMutation.isPending ? 'Processing request' : ''}
					</span>
				</form>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
