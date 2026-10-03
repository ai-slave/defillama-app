import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { use, useState } from 'react'
import { InlineStatus } from '~/ui/Status'
import { loadStripeOnce } from './stripeClient'
import { TopupCheckoutLoading } from './TopupCheckoutLoading'

export default function TopupStripeCheckout({
	fetchClientSecret,
	isPending
}: {
	fetchClientSecret: () => Promise<string>
	isPending: boolean
}) {
	const stripe = use(loadStripeOnce())
	// Stripe reads its options once and warns when they change. The first fetchClientSecret is enough: the amount is
	// fixed once the card step opens, and mutateAsync stays bound to the same mutation.
	const [options] = useState(() => ({ fetchClientSecret }))
	// A blocked Stripe script should leave the dialog usable for another method.
	if (!stripe) {
		return (
			<InlineStatus variant="error">
				Card payments are unavailable. Go back and choose another payment method.
			</InlineStatus>
		)
	}

	return (
		<div className="relative min-h-[400px]" aria-busy={isPending}>
			{isPending ? (
				<div className="absolute inset-0 bg-overlay">
					<TopupCheckoutLoading />
				</div>
			) : null}
			<EmbeddedCheckoutProvider stripe={stripe} options={options}>
				<EmbeddedCheckout />
			</EmbeddedCheckoutProvider>
		</div>
	)
}
