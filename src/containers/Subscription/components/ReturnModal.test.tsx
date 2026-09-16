// @vitest-environment happy-dom
import type { NextRouter } from 'next/router'
import { act, type ReactNode, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import Subscription from '~/pages/subscription'

const fixture = vi.hoisted(() => ({
	isNewSignup: false,
	consumeSignupOutcome: vi.fn(),
	router: {} as Pick<NextRouter, 'pathname' | 'query' | 'replace' | 'isReady'>
}))
vi.mock('next/router', () => ({ useRouter: () => fixture.router }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		user: { verified: true },
		loaders: { userLoading: false },
		isNewSignup: fixture.isNewSignup,
		consumeSignupOutcome: fixture.consumeSignupOutcome
	})
}))
vi.mock('~/auth/useSubscribe', () => ({ useSubscribe: () => ({}) }))
vi.mock('~/containers/Subscription/usePageState', () => ({
	useSubscriptionPageState: () => ({ isAuthenticated: true, currentPlan: 'free' })
}))
vi.mock('~/containers/Subscription/sections', () => ({
	SubscriptionBackground: () => null,
	SubscriptionComparisonSection: () => null,
	SubscriptionFaqBlock: () => null,
	SubscriptionFooter: () => null,
	SubscriptionHeader: () => null,
	SubscriptionPricingSection: () => null,
	SubscriptionTrustedBlock: () => null
}))
vi.mock('~/components/SEO', () => ({ SEO: () => null }))
vi.mock('~/components/Toast', () => ({ Toast: () => null }))
vi.mock('~/containers/Subscription/SignInModal', () => ({ SignInModal: () => null }))
vi.mock('~/containers/Account/EndTrialModal', () => ({ EndTrialModal: () => null }))
vi.mock('~/layout/ClientOnly', () => ({ ClientOnly: ({ children }: { children: ReactNode }) => children }))

let root: Root
let container: HTMLDivElement
const destination = '/downloads?mode=sql'
beforeEach(() => {
	fixture.isNewSignup = false
	fixture.consumeSignupOutcome.mockReset().mockImplementation(() => {
		fixture.isNewSignup = false
	})
	fixture.router = {
		pathname: '/subscription',
		query: { returnUrl: destination, billing: 'yearly', source: 'report' },
		isReady: true,
		replace: vi.fn(async (url) => {
			fixture.router = { ...fixture.router, query: (url as { query: NextRouter['query'] }).query }
			return true
		})
	}
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function render() {
	await act(async () =>
		root.render(
			<StrictMode>
				<Subscription />
			</StrictMode>
		)
	)
	await act(async () => new Promise((resolve) => setTimeout(resolve, 30)))
}
async function reload() {
	await act(async () => root.unmount())
	root = createRoot(container)
	await render()
}
function button(text: string) {
	return Array.from(document.querySelectorAll('button')).find(
		(el) => el.textContent === text || el.getAttribute('aria-label') === text
	)!
}
function expectConsumed() {
	expect(fixture.router.query).toEqual({ billing: 'yearly', source: 'report' })
	expect(fixture.router.replace).toHaveBeenCalledExactlyOnceWith(
		{ pathname: '/subscription', query: { billing: 'yearly', source: 'report' } },
		undefined,
		{ shallow: true }
	)
}

test('skips the signup prompt and consumes its URL before a reload loses signup state', async () => {
	fixture.isNewSignup = true
	await render()
	expectConsumed()
	expect(fixture.consumeSignupOutcome).toHaveBeenCalledOnce()
	expect(document.querySelector('[role="dialog"]')).toBeNull()
	await reload()
	expect(document.querySelector('[role="dialog"]')).toBeNull()
})

test.each(['Stay on this page', 'Close', 'Escape'])(
	'consumes the return intent on %s, preserving other query parameters across reload',
	async (action) => {
		await render()
		const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
		expect(dialog).not.toBeNull()
		await act(async () => {
			if (action === 'Escape') {
				dialog.focus()
				dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
			} else button(action).click()
		})
		expectConsumed()
		await reload()
		expect(document.querySelector('[role="dialog"]')).toBeNull()
	}
)

test('keeps an existing user’s return destination until they make a choice', async () => {
	await render()
	expect(document.querySelector('a')?.getAttribute('href')).toBe(destination)
	expect(fixture.router.replace).not.toHaveBeenCalled()
	expect(fixture.consumeSignupOutcome).not.toHaveBeenCalled()
	await reload()
	expect(document.querySelector('[role="dialog"]')).not.toBeNull()
	expect(document.querySelector('a')?.getAttribute('href')).toBe(destination)
})
