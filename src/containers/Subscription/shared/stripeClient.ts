import type { Stripe } from '@stripe/stripe-js'
// The pure entry: the package root injects the Stripe.js script as soon as it is imported.
import { loadStripe } from '@stripe/stripe-js/pure'
import { STRIPE_PUBLISHABLE_KEY } from '~/constants'

let stripePromise: Promise<Stripe | null> | null = null

// One Stripe.js load per page, started by the first card form or payment check, so pages that never take a card never
// fetch the script. A blocked or failed script settles to null instead of rejecting, so every card form says card
// payments are unavailable instead of waiting on a form that never draws.
export function loadStripeOnce() {
	stripePromise ??= STRIPE_PUBLISHABLE_KEY
		? loadStripe(STRIPE_PUBLISHABLE_KEY).catch(() => null)
		: Promise.resolve(null)
	return stripePromise
}

export const CARD_PAYMENTS_UNAVAILABLE = "Card payments couldn't load. Reload the page and try again."
