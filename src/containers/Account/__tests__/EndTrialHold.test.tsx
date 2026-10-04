// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Subscription } from '~/auth/useSubscribe'
import { AUTH_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { EndTrialModal } from '../EndTrialModal'
import { SubscriptionSection } from '../SubscriptionSection'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/account', query: {} }) }))

const session = installSubscriberSession('trial-account')
const END_TRIAL = `${AUTH_SERVER}/subscription/end-trial`
const APPLYING = 'Your upgrade is being applied. This can take a minute.'

const trialSubscription: Subscription = {
	id: 'sub-trial-1',
	PK: '',
	checkoutUrl: '',
	status: 'active',
	type: 'llamafeed',
	provider: 'stripe',
	billing_interval: 'month',
	updatedAt: '',
	expires_at: '2027-01-01T00:00:00Z',
	metadata: { isTrial: true }
}

let root: Root
let container: HTMLDivElement
let trialRecord: typeof pb.authStore.record
beforeEach(() => {
	session.client.setDefaultOptions({ queries: { retry: false } })
	const token = pb.authStore.token
	trialRecord = { ...pb.authStore.record!, flags: { is_trial: true } }
	pb.authStore.save(token, trialRecord)
	session.serve({
		'/api/collections/users/auth-refresh': { token, record: trialRecord },
		'/subscription/status': { subscription: trialSubscription },
		'/subscription/past-due': fixtureStatus(404, { message: 'No past due subscription found' }),
		'/subscription/trial-available': { trialAvailable: false },
		'/user/credits': { credits: 100, maxCredits: 1_000_000, monthKey: '2026-08' },
		'/user/ai-balance': { freeRemaining: '0', toppedUpBalance: '0' },
		'/user/usage-stats': { windowDays: 30, stats: [] },
		'/team': { team: null },
		// The webhook has not cleared the trial yet, so every read still says trial.
		[END_TRIAL]: { message: 'ok' }
	})
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.useRealTimers()
})

const text = () => document.body.textContent ?? ''
const button = (name: string) => [...document.querySelectorAll('button')].find((b) => accessibleName(b) === name)
const endTrialPosts = () => session.requests.filter((request) => request.url.href === END_TRIAL).length

async function render(secondOpener = false) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<SubscriptionSection />
				{/* Another opener, such as the LlamaAI research limit dialog. */}
				<EndTrialModal isOpen={secondOpener} onClose={() => {}} confirmLabel="Upgrade to Pro now" />
			</session.Wrapper>
		)
	)
}

async function upgradeFromAccount() {
	await render()
	await waitForUi(() => expect(button('Upgrade to Pro')).toBeDefined())
	await act(async () => button('Upgrade to Pro')!.click())
	await waitForUi(() => expect(button('Confirm & upgrade now')).toBeDefined())
	await act(async () => button('Confirm & upgrade now')!.click())
	await waitForUi(() => expect(text()).toContain('Upgrade successful'))
	await act(async () => button('Close')!.click())
	await waitForUi(() => expect(document.querySelector('[role=alertdialog]')).toBeNull())
}

test('an upgrade still being applied disables every upgrade action and sends no second end-trial', async () => {
	await upgradeFromAccount()

	expect(text()).toContain('Active free trial')
	expect(button('Upgrade to Pro')!.disabled).toBe(true)
	expect(text()).toContain(APPLYING)
	await act(async () => button('Upgrade to Pro')!.click())
	expect(document.querySelector('[role=alertdialog]')).toBeNull()

	await render(true)
	await waitForUi(() => expect(button('Upgrade to Pro now')).toBeDefined())
	expect(document.querySelector('[role=alertdialog]')!.textContent).toContain(APPLYING)
	expect(button('Upgrade to Pro now')!.disabled).toBe(true)
	await act(async () => button('Upgrade to Pro now')!.click())

	expect(endTrialPosts()).toBe(1)
})

test('the upgrade actions clear once a later read shows the trial has ended', async () => {
	await upgradeFromAccount()

	session.serve({
		'/api/collections/users/auth-refresh': { token: pb.authStore.token, record: { ...trialRecord, flags: {} } },
		'/subscription/status': { subscription: { ...trialSubscription, metadata: {} } }
	})
	await act(() => vi.advanceTimersByTimeAsync(4000))

	await waitForUi(() => expect(text()).toContain('Monthly ($49/month)'))
	expect(text()).not.toContain('Active free trial')
	expect(text()).not.toContain(APPLYING)
})

test('a reload while the upgrade is being applied keeps the upgrade actions disabled', async () => {
	localStorage.setItem('end-trial-hold:trial-account', String(Date.now()))
	await render()
	await waitForUi(() => expect(button('Upgrade to Pro')).toBeDefined())

	expect(button('Upgrade to Pro')!.disabled).toBe(true)
	expect(text()).toContain(APPLYING)
	await act(async () => button('Upgrade to Pro')!.click())
	expect(endTrialPosts()).toBe(0)
})

test('a hold older than half an hour no longer blocks the upgrade', async () => {
	localStorage.setItem('end-trial-hold:trial-account', String(Date.now() - 31 * 60 * 1000))
	await render()
	await waitForUi(() => expect(button('Upgrade to Pro')).toBeDefined())

	expect(button('Upgrade to Pro')!.disabled).toBe(false)
	expect(text()).not.toContain(APPLYING)
})

test.each([
	['a lost response', () => Promise.reject(new TypeError('Failed to fetch'))],
	['a gateway timeout', fixtureStatus(504, { message: 'Gateway timeout' })]
])('an upgrade whose answer is %s may have charged, so it holds the button too', async (_case, answer) => {
	session.serve({ [END_TRIAL]: answer })
	await render()
	await waitForUi(() => expect(button('Upgrade to Pro')).toBeDefined())
	await act(async () => button('Upgrade to Pro')!.click())
	await waitForUi(() => expect(button('Confirm & upgrade now')).toBeDefined())
	await act(async () => button('Confirm & upgrade now')!.click())

	await waitForUi(() =>
		expect(document.querySelector('[role=alertdialog] [role=alert]')?.textContent).toBe(
			"We couldn't confirm the upgrade, so it may still go through. Check your plan in a minute."
		)
	)
	expect(button('Confirm & upgrade now')!.disabled).toBe(true)
	await act(async () => button('Confirm & upgrade now')!.click())
	expect(endTrialPosts()).toBe(1)
})

test('an upgrade the server refuses leaves the button free to try again, and its reason stays while the retry runs', async () => {
	session.serveInOrder(END_TRIAL, [
		fixtureStatus(400, { message: 'No active trial subscription' }),
		() => new Promise<Response>(() => {})
	])
	await render()
	await waitForUi(() => expect(button('Upgrade to Pro')).toBeDefined())
	await act(async () => button('Upgrade to Pro')!.click())
	await waitForUi(() => expect(button('Confirm & upgrade now')).toBeDefined())
	await act(async () => button('Confirm & upgrade now')!.click())

	await waitForUi(() =>
		expect(document.querySelector('[role=alertdialog] [role=alert]')?.textContent).toBe('No active trial subscription')
	)
	expect(button('Confirm & upgrade now')!.disabled).toBe(false)

	await act(async () => button('Confirm & upgrade now')!.click())
	await waitForUi(() => expect(button('Processing…')!.getAttribute('aria-busy')).toBe('true'))
	expect(document.querySelector('[role=alertdialog] [role=alert]')?.textContent).toBe('No active trial subscription')
})
