// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Subscription } from '~/auth/useSubscribe'
import pb from '~/utils/pocketbase'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
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
	await waitForUi(
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

	await waitFor(() => expect(alertTexts(container)).toHaveLength(1))
	expect(text()).not.toContain('Unlock the full power')

	session.serve({ '/subscription/status': noSubscription })
	await act(async () => button('Try again')!.click())

	await waitFor(() => expect(text()).toContain('Unlock the full power'))
	expect(alertTexts(container)).toEqual([])
})

test('keeps the plan visible and flags an unknown payment status when the past-due read fails', async () => {
	session.serve({
		'/subscription/status': { subscription: apiSubscription },
		'/subscription/past-due': fixtureStatus(500, { message: 'Internal error' })
	})
	await render()

	await waitFor(() => expect(text()).toContain('Current plan'))
	expect(alertTexts(container)).toHaveLength(1)
	expect(text()).not.toContain('subscription past due')
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
	await waitFor(() => expect(button('Confirm & upgrade now')).toBeDefined())
	await act(async () => button('Confirm & upgrade now')!.click())

	await waitFor(() => expect(text()).toContain('Monthly ($49/month)'))
	expect(text()).toContain('Upgrade successful')
})

test('treats a failed team read as unknown billing ownership, not personal billing', async () => {
	session.serve({ '/subscription/status': { subscription: apiSubscription }, '/team': fixtureStatus(500) })
	await render()

	await waitFor(() => expect(alertTexts(container)).toHaveLength(1))
	expect(text()).not.toContain('Cancel subscription')
})

test('keeps the cancellation result on screen when the refetch after it fails', async () => {
	session.serve({
		'/subscription/status': { subscription: apiSubscription },
		'/subscription/cancel': () => {
			session.serve({ '/subscription/status': fixtureStatus(500, { message: 'Internal error' }) })
			return { message: 'ok' }
		}
	})
	await render()

	await waitFor(() => expect(button('Cancel subscription')).toBeDefined())
	await act(async () => button('Cancel subscription')!.click())
	await waitFor(() => expect(button('Confirm cancellation')).toBeDefined())
	await act(async () => button('Confirm cancellation')!.click())

	await waitFor(() => expect(alertTexts(container)).toHaveLength(1))
	expect(document.querySelector('[role=alertdialog] h2')?.textContent).toBe('Cancellation scheduled')
})

test('shows no personal billing controls until the team read says who owns the billing', async () => {
	let answerTeam!: (response: Response) => void
	session.serve({
		'/subscription/status': { subscription: apiSubscription },
		'/team': () => new Promise<Response>((resolve) => (answerTeam = resolve))
	})
	await render()
	await waitFor(() => expect(answerTeam).toBeTypeOf('function'))
	await waitFor(() => expect(session.urls().some((url) => url.endsWith('/subscription/status'))).toBe(true))

	expect(button('Cancel subscription')).toBeUndefined()
	expect(button('Manage on Stripe')).toBeUndefined()

	await act(async () => answerTeam(Response.json({ team: null })))
	await waitFor(() => expect(button('Cancel subscription')).toBeDefined())
})

test('an open cancel dialog stays open when the team read behind it fails', async () => {
	session.serve({ '/subscription/status': { subscription: apiSubscription } })
	await render()
	await waitFor(() => expect(button('Cancel subscription')).toBeDefined())
	await act(async () => button('Cancel subscription')!.click())
	await waitFor(() => expect(button('Confirm cancellation')).toBeDefined())

	session.serve({ '/team': fixtureStatus(500) })
	await act(async () => session.client.invalidateQueries({ queryKey: ['team'] }))

	await waitFor(() => expect(alertTexts(container)).toHaveLength(1))
	expect(button('Confirm cancellation')).toBeDefined()
})

test("a plan whose latest payment failed promises immediate cancellation from the plan card's Cancel too", async () => {
	session.serve({
		'/subscription/status': { subscription: apiSubscription },
		'/subscription/past-due': { subscription: apiSubscription }
	})
	await render()
	const cancelButtons = () =>
		[...document.querySelectorAll('button')].filter((b) => b.textContent === 'Cancel subscription')
	// The overdue warning's Cancel comes first; the plan card's is the last.
	await waitFor(() => expect(cancelButtons()).toHaveLength(2))

	await act(async () => cancelButtons()[1].click())
	await waitFor(() => expect(document.querySelector('[role=alertdialog]')).not.toBeNull())
	expect(document.querySelector('[role=alertdialog]')!.textContent).toContain(
		'Because the latest payment failed, cancellation takes effect immediately and access ends right away.'
	)
})

test('a plan that is a seat on a team subscription offers no personal Manage or Cancel', async () => {
	session.serve({ '/subscription/status': { subscription: { ...apiSubscription, team_id: 'team-1' } } })
	await render()

	await waitFor(() => expect(text()).toContain("This plan is a seat on your team's subscription"))
	expect(button('Cancel subscription')).toBeUndefined()
	expect(button('Manage on Stripe')).toBeUndefined()
})

const overageSwitch = () =>
	document.querySelector<HTMLButtonElement>('[role=switch][aria-label="Allow extra usage charges"]')

test('the extra usage switch stays locked until the plan read shows the new setting', async () => {
	session.serve({ '/subscription/status': { subscription: { ...apiSubscription, overage: false } } })
	await render()
	await waitFor(() => expect(overageSwitch()).not.toBeNull())

	let answerRead!: (response: Response) => void
	session.serve({
		'/subscription/enable-overage': { message: 'ok' },
		'/subscription/status': () => new Promise<Response>((resolve) => (answerRead = resolve))
	})
	await act(async () => overageSwitch()!.click())
	await waitFor(() => expect(answerRead).toBeTypeOf('function'))

	// Locked but focusable: the press that locked it keeps focus, and another press sends nothing.
	expect(overageSwitch()!.getAttribute('aria-disabled')).toBe('true')
	await act(async () => overageSwitch()!.click())
	expect(session.requests.filter((request) => request.url.href.endsWith('/subscription/enable-overage'))).toHaveLength(
		1
	)

	await act(async () => answerRead(Response.json({ subscription: { ...apiSubscription, overage: true } })))
	await waitFor(() => expect(overageSwitch()!.getAttribute('aria-checked')).toBe('true'))
	expect(overageSwitch()!.hasAttribute('aria-disabled')).toBe(false)
})

const lostAnswers = [
	['is lost', () => Promise.reject(new TypeError('Failed to fetch'))],
	['is a gateway timeout', fixtureStatus(504, { message: 'Gateway timeout' })]
] as const

test.each(lostAnswers)(
	'an extra usage change whose answer %s says it could not confirm it, as an alert',
	async (_case, answer) => {
		session.serve({
			'/subscription/status': { subscription: { ...apiSubscription, overage: false } },
			'/subscription/enable-overage': answer
		})
		await render()
		await waitFor(() => expect(overageSwitch()).not.toBeNull())
		await act(async () => overageSwitch()!.click())

		await waitFor(() =>
			expect(document.querySelector('[role=alert]')?.textContent).toBe(
				"We couldn't confirm the change. The switch shows your current setting."
			)
		)
	}
)

test.each(lostAnswers)('a cancellation whose answer %s says it could not confirm it', async (_case, answer) => {
	session.serve({
		'/subscription/status': { subscription: apiSubscription },
		'/subscription/cancel': answer
	})
	await render()
	await waitFor(() => expect(button('Cancel subscription')).toBeDefined())
	await act(async () => button('Cancel subscription')!.click())
	await waitFor(() => expect(button('Confirm cancellation')).toBeDefined())
	await act(async () => button('Confirm cancellation')!.click())

	await waitFor(() =>
		expect(document.querySelector('[role=alertdialog] [role=alert]')?.textContent).toBe(
			"We couldn't confirm the cancellation. Check your plan before trying again."
		)
	)
})

test('a cancellation retry keeps the unconfirmed error on screen while it runs', async () => {
	session.serve({
		'/subscription/status': { subscription: apiSubscription },
		'/subscription/cancel': fixtureStatus(504, { message: 'Gateway timeout' })
	})
	await render()
	await waitFor(() => expect(button('Cancel subscription')).toBeDefined())
	await act(async () => button('Cancel subscription')!.click())
	await waitFor(() => expect(button('Confirm cancellation')).toBeDefined())
	await act(async () => button('Confirm cancellation')!.click())
	const alerts = () => alertTexts(document.querySelector('[role=alertdialog]')!)
	await waitFor(() => expect(alerts()).toHaveLength(1))

	session.serve({ '/subscription/cancel': () => new Promise<Response>(() => {}) })
	await act(async () => button('Confirm cancellation')!.click())

	await waitFor(() =>
		expect(document.querySelector('[role=alertdialog] [role=status]')?.textContent).toBe('Cancelling…')
	)
	expect(alerts()).toHaveLength(1)
})

test('a LlamaPay top-up opens its checkout in this tab, where no popup blocker can swallow it', async () => {
	window.location.hash = ''
	// A same-page hash stands in for the checkout URL, so happy-dom records the navigation without loading a page.
	const checkoutUrl = `${window.location.href.split('#')[0]}#llamapay-topup`
	session.serve({
		'/subscription/status': { subscription: { ...apiSubscription, provider: 'llamapay' } },
		'/subscription/topup': { checkoutUrl }
	})
	await render()
	await waitFor(() => expect(button('Top up')).toBeDefined())
	await act(async () => button('Top up')!.click())

	await waitFor(() => expect(window.location.hash).toBe('#llamapay-topup'))
	window.location.hash = ''
})
