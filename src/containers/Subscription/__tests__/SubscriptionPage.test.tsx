// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import Subscription from '~/pages/subscription'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

// Stripe.js is a script from Stripe's servers, which Node cannot load.
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: () => Promise.resolve(null) }))
vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/subscription', asPath: '/subscription', isReady: true, query: {}, replace: vi.fn() })
}))

const session = installSubscriberSession('crypto-buyer', { account: 'free', resolved: true })

test('a crypto checkout that fails to start says why under the plan that started it', async () => {
	session.serve({
		'/subscription/trial-available': { trialAvailable: false },
		// A 4xx reason is written for readers, so it shows as the server wrote it.
		'/subscription/create': fixtureStatus(409, { message: 'LlamaPay is unavailable' })
	})
	const host = document.body.appendChild(document.createElement('div'))
	const root = createRoot(host)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Subscription />
			</session.Wrapper>
		)
	)
	try {
		const cryptoButtons = () => [...host.querySelectorAll('button')].filter((b) => b.textContent === 'Pay with Crypto')
		await waitForUi(() => expect(cryptoButtons().length).toBeGreaterThan(0))
		await act(async () => cryptoButtons()[0].click())

		await waitForUi(async () => {
			await act(async () => {})
			expect([...host.querySelectorAll('[role=alert]')].map((alert) => alert.textContent)).toEqual([
				'LlamaPay is unavailable'
			])
		})
	} finally {
		await act(async () => root.unmount())
		host.remove()
	}
})
