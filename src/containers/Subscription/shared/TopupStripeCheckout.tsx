import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { use } from 'react'
import { STRIPE_PUBLISHABLE_KEY } from '~/constants'
import { TopupCheckoutLoading } from './TopupCheckoutLoading'

// A blocked Stripe script should leave the dialog usable for another method.
const stripeInstance = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY).catch(() => null) : null

export default function TopupStripeCheckout({
	fetchClientSecret,
	isPending
}: {
	fetchClientSecret: () => Promise<string>
	isPending: boolean
}) {
	const stripe = stripeInstance ? use(stripeInstance) : null
	if (!stripe) {
		return (
			<div role="alert" className="body-md text-error">
				Card payments are unavailable. Go back and choose another payment method.
			</div>
		)
	}

	return (
		<div className="relative min-h-[400px]" aria-busy={isPending}>
			{isPending ? (
				<div className="absolute inset-0 bg-overlay">
					<TopupCheckoutLoading />
				</div>
			) : null}
			<EmbeddedCheckoutProvider stripe={stripe} options={{ fetchClientSecret }}>
				<EmbeddedCheckout />
			</EmbeddedCheckoutProvider>
		</div>
	)
}
