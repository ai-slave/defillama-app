import { lazy, Suspense, useState } from 'react'
import { useAuthContext } from '~/auth'
import { useSubscribe } from '~/auth/useSubscribe'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { Icon } from '~/ui/Icon'

const StripeCheckoutModal = lazy(() =>
	import('~/containers/Subscription/shared/StripeCheckoutModal').then((m) => ({ default: m.StripeCheckoutModal }))
)

export function PaymentButton({
	paymentMethod,
	type = 'api',
	billingInterval = 'month'
}: {
	paymentMethod: 'stripe' | 'llamapay'
	type?: 'api' | 'llamafeed'
	billingInterval?: 'year' | 'month'
}) {
	const { handleSubscribe, loading } = useSubscribe()
	const { isAuthenticated, user, promptVerifyEmail } = useAuthContext()
	const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)

	const isStripe = paymentMethod === 'stripe'
	const icon = isStripe ? 'card' : 'wallet'
	const text = isStripe ? 'Pay with Card' : 'Pay with Crypto'

	if (!isAuthenticated) {
		return (
			<SignInModal
				text={text}
				className="group flex w-full items-center justify-center gap-2 rounded-lg border border-sub-purple bg-sub-purple py-3.5 font-medium text-on-brand shadow-xs transition-all duration-200 hover:bg-sub-purple-hover hover:shadow-md dark:border-sub-purple dark:bg-sub-purple dark:hover:bg-sub-purple-hover"
			/>
		)
	}

	const handleClick = () => {
		if (!user?.verified && !user?.walletAddress) {
			promptVerifyEmail(user?.id)
			return
		}
		// For Stripe, use embedded checkout modal
		if (isStripe) {
			setIsCheckoutModalOpen(true)
		} else {
			// For crypto payments, use the legacy flow
			void handleSubscribe(paymentMethod, type, undefined, billingInterval, false)
		}
	}

	return (
		<>
			<button
				type="button"
				onClick={handleClick}
				disabled={loading === paymentMethod}
				className={`group flex w-full items-center justify-center gap-2 rounded-lg border border-sub-purple bg-sub-purple py-3 text-sm font-medium text-on-brand shadow-xs transition-all duration-200 hover:bg-sub-purple-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70 sm:py-3.5 dark:border-sub-purple dark:bg-sub-purple dark:hover:bg-sub-purple-hover ${type === 'api' && !isStripe ? 'shadow-sub-purple-glow-strong' : ''}`}
				data-umami-event={`subscribe-${paymentMethod}-${type ?? ''}`}
			>
				{icon ? <Icon name={icon} height={14} width={14} className="sm:h-4 sm:w-4" /> : null}
				<span className="wrap-break-word">{text}</span>
			</button>

			{isStripe ? (
				<Suspense fallback={null}>
					<StripeCheckoutModal
						isOpen={isCheckoutModalOpen}
						onClose={() => setIsCheckoutModalOpen(false)}
						paymentMethod="stripe"
						type={type}
						billingInterval={billingInterval}
					/>
				</Suspense>
			) : null}
		</>
	)
}
