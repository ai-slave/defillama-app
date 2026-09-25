// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Subscription } from '~/auth/useSubscribe'
import pb from '~/utils/pocketbase'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { SubscriptionSection } from '../SubscriptionSection'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/account', query: {} }) }))

const session = installSubscriberSession('account-a')

const apiSubscription: Subscription = {
	id: 'sub-api-1',
	PK: '',
	checkoutUrl: '',
	status: 'active',
	type: 'api',
	provider: 'stripe',
	billing_interval: 'month',
	updatedAt: '',
	expires_at: '2027-01-01T00:00:00Z'
}
const trialSubscription: Subscription = {
	...apiSubscription,
	id: 'sub-trial-1',
	type: 'llamafeed',
	metadata: { isTrial: true }
}
const noSubscription = fixtureStatus(404, { message: 'No active subscription' })

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	// Queries without their own retry policy fail on the first error instead of backing off for seconds.
	session.client.setDefaultOptions({ queries: { retry: false } })
	session.serve({
		'/subscription/status': noSubscription,
		'/subscription/past-due': fixtureStatus(404, { message: 'No past due subscription found' }),
		'/subscription/trial-available': { trialAvailable: false },
		'/user/credits': { credits: 100, maxCredits: 1_000_000, monthKey: '2026-08' },
		'/user/ai-balance': { freeRemaining: '0', toppedUpBalance: '0' },
		'/auth/get-api-key': { apiKey: { api_key: 'test-key' } },
		'/user/usage-stats': { windowDays: 30, stats: [] },
		'/team': { team: null }
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const text = () => document.body.textContent ?? ''
const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent === label)

async function render() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<SubscriptionSection />
			</session.Wrapper>
		)
	)
}

async function waitFor(assertion: () => void) {
	await vi.waitFor(
		async () => {
			await act(async () => {})
			assertion()
		},
		{ timeout: 1500 }
	)
}

test('shows a retry state for a failed subscription read, never Free, and recovers on retry', async () => {
	session.serve({ '/subscription/status': fixtureStatus(500, { message: 'Internal error' }) })
	await render()

	await waitFor(() => expect(text()).toContain("Couldn't load your subscription"))
	expect(text()).not.toContain('Unlock the full power')

	session.serve({ '/subscription/status': noSubscription })
	await act(async () => button('Try again')!.click())

	await waitFor(() => expect(text()).toContain('Unlock the full power'))
	expect(text()).not.toContain("Couldn't load your subscription")
})

test('keeps the plan visible and flags an unknown payment status when the past-due read fails', async () => {
	session.serve({
		'/subscription/status': { subscription: apiSubscription },
		'/subscription/past-due': fixtureStatus(500, { message: 'Internal error' })
	})
	await render()

	await waitFor(() => expect(text()).toContain('Current plan'))
	expect(text()).toContain("Couldn't check payment status")
	expect(text()).not.toContain('Subscription Past Due')
})

test('keeps the upgrade success pane on screen after the upgrade refetches the trial state', async () => {
	const token = pb.authStore.token
	const trialRecord = { ...pb.authStore.record!, flags: { is_trial: true } }
	pb.authStore.save(token, trialRecord)
	session.serve({
		'/api/collections/users/auth-refresh': { token, record: trialRecord },
		'/subscription/status': { subscription: trialSubscription },
		'/subscription/end-trial': () => {
			session.serve({
				'/api/collections/users/auth-refresh': { token, record: { ...trialRecord, flags: {} } },
				'/subscription/status': { subscription: { ...trialSubscription, metadata: {} } }
			})
			return { message: 'ok' }
		}
	})
	await render()

	await waitFor(() => expect(button('Upgrade to Pro')).toBeDefined())
	await act(async () => button('Upgrade to Pro')!.click())
	await waitFor(() => expect(button('Confirm & Upgrade Now')).toBeDefined())
	await act(async () => button('Confirm & Upgrade Now')!.click())

	await waitFor(() => expect(text()).toContain('Monthly ($49/month)'))
	expect(text()).toContain('Upgrade Successful')
})

test('treats a failed team read as unknown billing ownership, not personal billing', async () => {
	session.serve({ '/subscription/status': { subscription: apiSubscription }, '/team': fixtureStatus(500) })
	await render()

	await waitFor(() => expect(text()).toContain("Couldn't load your team"))
	expect(text()).not.toContain('Cancel Subscription')
})
