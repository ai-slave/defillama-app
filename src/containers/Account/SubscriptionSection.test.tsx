// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Subscription } from '~/auth/useSubscribe'
import { SubscriptionSection } from './SubscriptionSection'

const session = vi.hoisted(() => ({
	user: { id: 'account-a', email: 'a@example.com', has_active_subscription: false },
	isAuthenticated: true,
	authToken: 'test-token',
	isTrial: false,
	hasActiveSubscription: false,
	loaders: { userLoading: false }
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({ ...session, authorizedFetch: (url: string, options?: RequestInit) => fetch(url, options) })
}))
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/account', query: {} }) }))
const teamState = vi.hoisted(() => ({ team: null, isTeamError: false, isTeamRetrying: false, refetchTeam: () => {} }))
vi.mock('./Team/useTeam', () => ({ useTeam: () => ({ ...teamState }) }))
vi.mock('~/containers/Subscription/useTopup', () => ({ useAiBalance: () => ({ balance: null, isLoading: false }) }))

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

const json = (body: unknown, status = 200) =>
	Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

const responses = {
	status: () => json({ message: 'No active subscription' }, 404),
	pastDue: () => json({ message: 'No past due subscription found' }, 404),
	endTrial: () => json({ message: 'ok' })
}

let client: QueryClient
let root: Root
let container: HTMLDivElement

beforeEach(() => {
	session.isTrial = false
	teamState.isTeamError = false
	responses.status = () => json({ message: 'No active subscription' }, 404)
	responses.pastDue = () => json({ message: 'No past due subscription found' }, 404)
	responses.endTrial = () => json({ message: 'ok' })
	vi.stubGlobal(
		'fetch',
		vi.fn((url: string | URL) => {
			const u = String(url)
			if (u.endsWith('/subscription/status')) return responses.status()
			if (u.endsWith('/subscription/past-due')) return responses.pastDue()
			if (u.endsWith('/subscription/trial-available')) return json({ trialAvailable: false })
			if (u.endsWith('/user/credits')) return json({ credits: 100, maxCredits: 1_000_000, monthKey: '2026-08' })
			if (u.endsWith('/auth/get-api-key')) return json({ apiKey: { api_key: 'test-key' } })
			if (u.endsWith('/user/usage-stats')) return json({ windowDays: 30, stats: [] })
			if (u.endsWith('/subscription/end-trial')) return responses.endTrial()
			throw new Error(`Unexpected fetch in test: ${u}`)
		})
	)
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
	vi.unstubAllGlobals()
	localStorage.clear()
})

async function render() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<SubscriptionSection />
			</QueryClientProvider>
		)
	)
}

async function waitFor(assertion: () => void) {
	await vi.waitFor(async () => {
		await act(async () => {})
		assertion()
	})
}

it('shows a retry state for a failed read and recovers to the known state', async () => {
	responses.status = () => json({ message: 'Internal error' }, 500)
	await render()

	await waitFor(() => expect(document.body.textContent).toContain("Couldn't load your subscription"))
	// A failed read must not render as Free.
	expect(document.body.textContent).not.toContain('Unlock the full power')

	responses.status = () => json({ message: 'No active subscription' }, 404)
	const retry = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Try again')!
	expect(retry).toBeDefined()
	await act(async () => retry.click())

	await waitFor(() => expect(document.body.textContent).toContain('Unlock the full power'))
	expect(document.body.textContent).not.toContain("Couldn't load your subscription")
})

it('renders the free banner for a confirmed 404', async () => {
	await render()

	await waitFor(() => expect(document.body.textContent).toContain('Unlock the full power'))
	expect(document.body.textContent).not.toContain("Couldn't load your subscription")
})

it('keeps the plan visible and flags an unknown payment status when the past-due read fails', async () => {
	responses.status = () => json({ subscription: apiSubscription })
	responses.pastDue = () => json({ message: 'Internal error' }, 500)
	await render()

	await waitFor(() => expect(document.body.textContent).toContain('Current plan'))
	expect(document.body.textContent).toContain("Couldn't check payment status")
	// Unknown is not "past due" either.
	expect(document.body.textContent).not.toContain('Subscription Past Due')
})

it('keeps the upgrade success pane mounted after its own invalidations land', async () => {
	// Trial state: the auth flag and the subscription record both say trial.
	session.isTrial = true
	responses.status = () => json({ subscription: trialSubscription })
	// A successful upgrade flips both truths; the refetches must not unmount the pane.
	responses.endTrial = () => {
		session.isTrial = false
		responses.status = () => json({ subscription: { ...trialSubscription, metadata: {} } })
		return json({ message: 'ok' })
	}
	await render()

	await waitFor(() => expect(document.body.textContent).toContain('Upgrade to Pro'))
	const openUpgrade = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Upgrade to Pro')!
	await act(async () => openUpgrade.click())

	await waitFor(() => expect(document.body.textContent).toContain('Confirm & Upgrade Now'))
	const confirm = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Confirm & Upgrade Now')!
	await act(async () => confirm.click())

	// The page behind switched from the trial card to the paid layout...
	await waitFor(() => expect(document.body.textContent).toContain('Monthly ($49/month)'))
	// ...and the success pane is still on screen for the user to read.
	expect(document.body.textContent).toContain('Upgrade Successful')
})

it('treats a failed team read as unknown billing ownership, not personal billing', async () => {
	teamState.isTeamError = true
	responses.status = () => json({ subscription: apiSubscription })
	await render()

	await waitFor(() => expect(document.body.textContent).toContain("Couldn't load your team"))
	// No personal billing controls until ownership is known.
	expect(document.body.textContent).not.toContain('Cancel Subscription')
})
