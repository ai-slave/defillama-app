import { lazy, Suspense } from 'react'
import { useSubscribe } from '~/auth/useSubscribe'
import { PaymentButton } from '~/containers/Subscription/Crypto'
import { useStripeCheckout } from '~/containers/Subscription/shared/useStripeCheckout'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { formatUsd } from '~/utils/numberFormat'

const StripeCheckoutModal = lazy(() =>
	import('~/containers/Subscription/shared/StripeCheckoutModal').then((m) => ({ default: m.StripeCheckoutModal }))
)

export function SubscribeAPICard({
	context = 'page',
	active = false,
	onCancelSubscription,
	isCancelPending = false,
	isLegacyActive = false,
	billingInterval = 'month',
	currentBillingInterval
}: {
	context?: 'page' | 'account'
	active?: boolean
	onCancelSubscription?: () => void
	isCancelPending?: boolean
	isLegacyActive?: boolean
	billingInterval?: 'year' | 'month'
	currentBillingInterval?: 'year' | 'month'
}) {
	const monthlyPrice = 300
	const yearlyPrice = monthlyPrice * 10
	const displayPrice = billingInterval === 'year' ? yearlyPrice / 12 : monthlyPrice
	const displayPeriod = '/month'
	const { loading } = useSubscribe()
	const checkout = useStripeCheckout()

	const handleUpgradeToYearly = () => {
		checkout.open({ type: 'api', billingInterval: 'year', isUpgradeFlow: true })
	}

	return (
		<div className="sub-api-accent contents">
			<h2 className="relative z-10 text-center heading-lg whitespace-nowrap text-sub-purple-text">API</h2>
			<div className="relative z-10 mt-1 flex flex-col items-center justify-center">
				<div className="flex items-center">
					<span className="sub-gradient-text-purple text-center label-xl">{displayPrice} USD</span>
					<span className="ml-1 text-tertiary">{displayPeriod}</span>
				</div>
				{billingInterval === 'year' ? (
					<span className="body-md text-tertiary">{formatUsd(yearlyPrice)}/year</span>
				) : null}
			</div>
			{billingInterval === 'month' ? (
				<p className="relative z-10 mt-1 text-center font-medium text-tertiary">Multiple payment options</p>
			) : null}
			<ul className="mx-auto mb-auto flex w-full flex-col gap-3 py-6 max-sm:body-md">
				<li className="flex flex-nowrap items-start gap-2.5">
					<Icon name="check" height={16} width={16} className="relative top-1 shrink-0 text-success" />
					<span>All features included in Pro tier</span>
				</li>
				<li className="flex flex-nowrap items-start gap-2.5">
					<Icon name="check" height={16} width={16} className="relative top-1 shrink-0 text-success" />
					<span>Access to TVL, revenue/fees and prices API endpoints</span>
				</li>
				<li className="flex flex-nowrap items-start gap-2.5">
					<Icon name="check" height={16} width={16} className="relative top-1 shrink-0 text-success" />
					<span>Access to all data (unlocks, active users, token liq...)</span>
				</li>
				<li className="flex flex-nowrap items-start gap-2.5">
					<Icon name="check" height={16} width={16} className="relative top-1 shrink-0 text-success" />
					<span>Priority support</span>
				</li>
				<li className="flex flex-nowrap items-start gap-2.5">
					<Icon name="check" height={16} width={16} className="relative top-1 shrink-0 text-success" />
					<span>Access to DefiLlama MCP Server for AI agents</span>
				</li>
				<p className="px-6.5 font-medium">
					<a href="https://api-docs.defillama.com/" target="_blank" rel="noreferrer noopener" className="underline">
						Pro API
					</a>{' '}
					limits:
				</p>
				<li className="flex flex-col gap-2 px-6.5">
					<span>1000 requests/minute</span>
				</li>
				<li className="flex flex-col gap-2 px-6.5">
					<span>1M calls/month</span>
				</li>
				<li className="flex flex-col gap-2 px-6.5">
					<span>$0.60 per 1,000 additional calls after 1M limit</span>
				</li>
			</ul>
			<div className="relative z-10 mx-auto flex w-full max-w-[408px] flex-col gap-3">
				{active && !isLegacyActive ? (
					<div className="flex flex-col gap-2">
						<span className="text-center font-bold text-success">Current plan</span>
						{currentBillingInterval === 'month' || !currentBillingInterval ? (
							<div className="flex flex-col gap-2">
								<Button
									variant="primary"
									size="lg"
									className="w-full"
									onClick={handleUpgradeToYearly}
									pendingLabel={loading === 'stripe' ? 'Processing…' : null}
								>
									Upgrade to yearly
								</Button>
								<p className="text-center body-sm text-tertiary">Switch to annual billing and get 2 months free</p>
							</div>
						) : null}
						{isCancelPending ? (
							<p className="text-center body-md text-warning">Cancellation scheduled</p>
						) : onCancelSubscription ? (
							<Button variant="secondary" size="md" className="w-full" onClick={onCancelSubscription}>
								Cancel subscription
							</Button>
						) : null}
					</div>
				) : context === 'account' || isLegacyActive ? (
					<div className="mt-2 flex flex-col gap-6">
						<div className="flex flex-col items-center">
							<div className={`grid w-full gap-3 ${billingInterval === 'year' ? 'grid-cols-1' : 'grid-cols-2'}`}>
								{billingInterval === 'month' ? (
									<PaymentButton paymentMethod="llamapay" type="api" billingInterval={billingInterval} />
								) : null}
								<PaymentButton paymentMethod="stripe" type="api" billingInterval={billingInterval} />
							</div>
						</div>
					</div>
				) : (
					<>
						{context === 'page' ? (
							<>
								{/* Same wrapper as the pricing cards' sign-in link; it collapses once the trigger hides. */}
								<p className="text-center body-sm empty:hidden">
									<SignInModal trigger={<Button variant="link">Already a subscriber? Sign in</Button>} />
								</p>
								<div
									className={`grid gap-3 max-sm:w-full max-sm:grid-cols-1 ${billingInterval === 'year' ? 'grid-cols-1' : 'grid-cols-2'}`}
								>
									{billingInterval === 'month' ? (
										<PaymentButton paymentMethod="llamapay" type="api" billingInterval={billingInterval} />
									) : null}
									<PaymentButton paymentMethod="stripe" type="api" billingInterval={billingInterval} />
								</div>
							</>
						) : null}
					</>
				)}
			</div>

			{checkout.isOpen ? (
				<Suspense fallback={null}>
					<StripeCheckoutModal checkout={checkout} />
				</Suspense>
			) : null}
		</div>
	)
}
