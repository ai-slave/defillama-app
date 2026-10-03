import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { use, useState } from 'react'
import { InlineStatus } from '~/ui/Status'
import { CARD_PAYMENTS_UNAVAILABLE, loadStripeOnce } from './stripeClient'

/** Stripe's embedded checkout for a session that already exists. Suspends until Stripe.js settles. */
export function EmbeddedCardCheckout({ clientSecret }: { clientSecret: string }) {
	const stripe = use(loadStripeOnce())
	// Stripe keeps the options it mounted with and warns when they change.
	const [options] = useState(() => ({ fetchClientSecret: () => Promise.resolve(clientSecret) }))
	if (!stripe) return <InlineStatus variant="error">{CARD_PAYMENTS_UNAVAILABLE}</InlineStatus>
	return (
		<EmbeddedCheckoutProvider stripe={stripe} options={options}>
			<EmbeddedCheckout />
		</EmbeddedCheckoutProvider>
	)
}
