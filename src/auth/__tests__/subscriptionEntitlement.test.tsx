// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com"}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Storage } from 'happy-dom'
import { act } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider, useAuthContext } from '~/auth'
import type { Subscription } from '~/auth/subscriptionStatus'
import { useSubscribe } from '~/auth/useSubscribe'
import { Account } from '~/components/Nav/Account'
import { PremiumFeatureGate } from '~/containers/ProDashboard/components/PremiumFeatureGate'
import { useVerifiedAccess, type VerifiedAccessStatus } from '~/containers/Yields/useVerifiedAccess'
import pb from '~/utils/pocketbase'
import { waitForUi } from '~/utils/testing/waitForUi'

vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/', asPath: '/', query: {}, isReady: true, replace: vi.fn() })
}))

const token = (id: string) => `e30.${btoa(JSON.stringify({ id, exp: 4_102_444_800 }))}.signature`
const record = (id: string, hasActiveSubscription: boolean) => ({
	id,
	collectionId: '_pb_users_auth_',
	collectionName: 'users',
	has_active_subscription: hasActiveSubscription
})
const activeSubscription = (id: string): Subscription => ({
	id: `subscription-${id}`,
	PK: '',
	checkoutUrl: '',
	status: 'active',
	type: 'llamafeed',
	provider: 'stripe',
	billing_interval: 'month',
	updatedAt: '',
	expires_at: '2027-01-01T00:00:00Z'
})
const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const persistSubscription = (id: string, value: Subscription | null) => {
	localStorage.setItem(`subscription-status:${id}`, JSON.stringify({ userId: id, value, updatedAt: Date.now() }))
}

type PendingStatus = {
	authorization: string | null
	resolve: (response: Response) => void
}

let sessionView: ReturnType<typeof useAuthContext>
let subscribeView: ReturnType<typeof useSubscribe>
let root: Root
let client: QueryClient
let container: HTMLDivElement
let statusRequests: Array<PendingStatus>
let statusHandler: (authorization: string | null) => Promise<Response> | Response
let verifiedStatuses: Array<VerifiedAccessStatus>

function Probe() {
	sessionView = useAuthContext()
	subscribeView = useSubscribe()
	verifiedStatuses.push(useVerifiedAccess().status)
	return <span data-testid="subscription-detail">{subscribeView.subscription.id}</span>
}

function App() {
	return (
		<AuthProvider>
			<Account asPath="/" />
			<PremiumFeatureGate featureName="Premium report">
				<span>Pro content</span>
			</PremiumFeatureGate>
			<Probe />
		</AuthProvider>
	)
}

beforeEach(() => {
	vi.stubGlobal('localStorage', new Storage())
	verifiedStatuses = []
	statusRequests = []
	statusHandler = () => jsonResponse({ message: 'No active subscription' }, 404)
	vi.stubGlobal(
		'fetch',
		vi.fn((url: string | URL, config?: RequestInit) => {
			const path = String(url)
			if (path.endsWith('/subscription/status')) {
				const authorization = new Headers(config?.headers).get('Authorization')
				return statusHandler(authorization)
			}
			if (path.endsWith('/subscription/trial-available')) return jsonResponse({ trialAvailable: false })
			if (path.endsWith('/subscription/cancel')) return jsonResponse({ cancelled_immediately: true })
			if (path.endsWith('/api/collections/users/auth-refresh')) return new Promise<Response>(() => {})
			throw new Error(`Unexpected fetch in test: ${path}`)
		})
	)
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	vi.useRealTimers()
	client.clear()
	container.remove()
	pb.authStore.clear()
	localStorage.clear()
	vi.unstubAllGlobals()
})

async function renderSession(id: string, hasActiveSubscription: boolean, hydrate = false) {
	pb.authStore.save(token(id), record(id, hasActiveSubscription))
	const app = (
		<QueryClientProvider client={client}>
			<App />
		</QueryClientProvider>
	)
	const onRecoverableError = vi.fn()
	if (hydrate) {
		await act(async () => root.unmount())
		container.innerHTML = renderToString(app)
		await act(async () => {
			root = hydrateRoot(container, app, { onRecoverableError })
		})
	} else {
		await act(async () => root.render(app))
	}
	expect(onRecoverableError).not.toHaveBeenCalled()
}

// The canonical status query retries at 250ms and 500ms; fake timers skip those delays.
const useRetryClock = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
const passRetries = () => act(() => vi.advanceTimersByTimeAsync(800))

async function waitFor(assertion: () => void) {
	await waitForUi(async () => {
		await act(async () => {})
		assertion()
	})
}

test('uses canonical active access when the PocketBase projection is false and shares the response', async () => {
	let calls = 0
	statusHandler = () => {
		calls += 1
		return jsonResponse({ subscription: activeSubscription('account-a') })
	}

	await renderSession('account-a', false)

	await waitFor(() => expect(document.body.textContent).toContain('Active Subscription'))
	expect(document.body.textContent).toContain('Pro content')
	expect(document.querySelector('[data-testid="subscription-detail"]')?.textContent).toBe('subscription-account-a')
	expect(sessionView.hasActiveSubscription).toBe(true)
	expect(sessionView.loaders.userLoading).toBe(false)
	expect(calls).toBe(1)
})

test('uses a canonical 404 when the PocketBase projection is stale true', async () => {
	await renderSession('account-a', true)

	await waitFor(() => expect(document.body.textContent).toContain('No Subscription'))
	expect(document.body.textContent).toContain('Upgrade to Pro')
	expect(document.body.textContent).not.toContain('Pro content')
	expect(sessionView.hasActiveSubscription).toBe(false)
	expect(sessionView.loaders.userLoading).toBe(false)
})

test('shows retryable unknown access after a canonical request failure', async () => {
	statusHandler = () => jsonResponse({ message: 'Internal error' }, 500)
	useRetryClock()
	await renderSession('account-a', false)

	await passRetries()
	expect(document.body.textContent).toContain('Subscription unavailable')
	expect(document.body.textContent).not.toContain('No Subscription')
	expect(document.body.textContent).not.toContain('Upgrade to Pro')
	expect(sessionView.loaders.userLoading).toBe(true)
})

test('keeps the public tier while a failed entitlement lookup retries', async () => {
	let statusCalls = 0
	statusHandler = () =>
		// The initial request and its two retries fail; the later refetch then hangs in flight.
		++statusCalls <= 3 ? jsonResponse({ message: 'Internal error' }, 500) : new Promise<Response>(() => {})
	useRetryClock()
	await renderSession('account-a', false)

	await passRetries()
	expect(verifiedStatuses.at(-1)).toBe('denied')
	expect(sessionView.loaders.userLoading).toBe(true)
	expect(sessionView.loaders.subscriptionInitialCheck).toBe(false)

	// The retry has no data to keep, so React Query drops back to pending while it is in flight.
	void client.refetchQueries({ predicate: (query) => query.state.status === 'error' })
	// React Query notifies observers on a macrotask, so let the fetching state reach the render.
	await act(() => vi.advanceTimersByTimeAsync(50))
	expect(statusCalls).toBe(4)
	expect(sessionView.loaders.userLoading).toBe(true)
	expect(sessionView.loaders.subscriptionInitialCheck).toBe(false)
	expect(verifiedStatuses.at(-1)).toBe('denied')
})

test('does not flash the free state while canonical access is loading', async () => {
	statusHandler = (authorization) =>
		new Promise<Response>((resolve) => {
			statusRequests.push({ authorization, resolve })
		})

	await renderSession('account-a', false)

	expect(document.body.textContent).toContain('Loading')
	expect(document.body.textContent).not.toContain('No Subscription')
	expect(document.body.textContent).not.toContain('Upgrade to Pro')
	expect(sessionView.loaders.userLoading).toBe(true)
})

test('renders a returning subscriber as Pro on first paint while revalidating', async () => {
	persistSubscription('account-a', activeSubscription('account-a'))
	statusHandler = (authorization) =>
		new Promise<Response>((resolve) => {
			statusRequests.push({ authorization, resolve })
		})

	await renderSession('account-a', false)

	expect(document.body.textContent).toContain('Active Subscription')
	expect(document.body.textContent).toContain('Pro content')
	expect(sessionView.hasActiveSubscription).toBe(true)
	expect(sessionView.loaders.userLoading).toBe(false)
	expect(statusRequests).toHaveLength(1)
})

test.each([true, false])('checks a persisted denial only for verified yields (active: %s)', async (active) => {
	persistSubscription('account-a', null)
	statusHandler = (authorization) => new Promise<Response>((resolve) => statusRequests.push({ authorization, resolve }))

	await renderSession('account-a', false, true)

	expect(sessionView.loaders.userLoading).toBe(false)
	expect(sessionView.loaders.subscriptionInitialCheck).toBe(true)
	expect(new Set(verifiedStatuses)).toEqual(new Set(['pending']))
	expect(document.body.textContent).toContain('Upgrade to Pro')
	expect(document.body.textContent).toContain('No Subscription')
	expect(statusRequests).toHaveLength(1)

	statusRequests[0].resolve(
		active
			? jsonResponse({ subscription: activeSubscription('account-a') })
			: jsonResponse({ message: 'No active subscription' }, 404)
	)
	await waitFor(() => expect(sessionView.loaders.subscriptionInitialCheck).toBe(false))
	expect(verifiedStatuses.at(-1)).toBe(active ? 'granted' : 'denied')
	expect(verifiedStatuses.includes('denied')).toBe(!active)

	verifiedStatuses = []
	await act(async () => {
		void client.invalidateQueries({ queryKey: ['subscription'] })
	})
	expect(statusRequests).toHaveLength(2)
	expect(sessionView.loaders.userLoading).toBe(false)
	expect(verifiedStatuses).not.toContain('pending')
})

test('settles a persisted denial after a failed initial check without flashing on retry', async () => {
	persistSubscription('account-a', null)
	statusHandler = () => jsonResponse({ message: 'Internal error' }, 500)
	useRetryClock()
	await renderSession('account-a', false)
	expect(sessionView.loaders.userLoading).toBe(false)
	expect(verifiedStatuses.at(-1)).toBe('pending')

	await passRetries()
	expect(sessionView.loaders.subscriptionInitialCheck).toBe(false)
	expect(verifiedStatuses.at(-1)).toBe('denied')
	expect(document.body.textContent).toContain('Subscription unavailable')

	verifiedStatuses = []
	statusHandler = () => new Promise<Response>(() => {})
	await act(async () => {
		void client.invalidateQueries({ queryKey: ['subscription'] })
	})
	expect(sessionView.loaders.userLoading).toBe(false)
	expect(verifiedStatuses).not.toContain('pending')
})

test('keeps cached access visible and warns when background revalidation fails', async () => {
	persistSubscription('account-a', activeSubscription('account-a'))
	statusHandler = () => jsonResponse({ message: 'Internal error' }, 500)
	useRetryClock()

	await renderSession('account-a', false)
	expect(document.body.textContent).toContain('Active Subscription')
	expect(document.body.textContent).toContain('Pro content')

	await passRetries()
	expect(document.body.textContent).toContain('Active Subscription')
	expect(document.body.textContent).toContain('Subscription unavailable · Retry')
	expect(document.body.textContent).not.toContain('Upgrade to Pro')
	expect(sessionView.loaders.userLoading).toBe(false)
})

test("replaces a cancelled subscriber's cached active access with a canonical 404", async () => {
	persistSubscription('account-a', activeSubscription('account-a'))
	statusHandler = (authorization) =>
		new Promise<Response>((resolve) => {
			statusRequests.push({ authorization, resolve })
		})

	await renderSession('account-a', false)
	expect(document.body.textContent).toContain('Pro content')
	expect(statusRequests).toHaveLength(1)

	statusRequests[0].resolve(jsonResponse({ message: 'No active subscription' }, 404))

	await waitFor(() => expect(document.body.textContent).toContain('No Subscription'))
	expect(document.body.textContent).toContain('Upgrade to Pro')
	expect(sessionView.hasActiveSubscription).toBe(false)
	expect(JSON.parse(localStorage.getItem('subscription-status:account-a')!).value).toBeNull()
})

test('keeps a slow account A response from affecting account B', async () => {
	statusHandler = (authorization) =>
		new Promise<Response>((resolve) => {
			statusRequests.push({ authorization, resolve })
		})

	await renderSession('account-a', false)
	expect(statusRequests).toHaveLength(1)

	await act(async () => pb.authStore.save(token('account-b'), record('account-b', true)))
	await waitFor(() => expect(statusRequests).toHaveLength(2))
	expect(statusRequests[1].authorization).toBe(`Bearer ${token('account-b')}`)

	statusRequests[1].resolve(jsonResponse({ message: 'No active subscription' }, 404))
	await waitFor(() => expect(sessionView.loaders.userLoading).toBe(false))

	statusRequests[0].resolve(jsonResponse({ subscription: activeSubscription('account-a') }))
	await act(async () => {})

	expect(sessionView.user?.id).toBe('account-b')
	expect(sessionView.hasActiveSubscription).toBe(false)
})

test('disables effective entitlement on logout', async () => {
	statusHandler = () => jsonResponse({ subscription: activeSubscription('account-a') })
	await renderSession('account-a', false)
	await waitFor(() => expect(sessionView.hasActiveSubscription).toBe(true))

	await act(async () => sessionView.logout())

	expect(sessionView.isAuthenticated).toBe(false)
	expect(sessionView.hasActiveSubscription).toBe(false)
	expect(sessionView.loaders.userLoading).toBe(false)
	expect(localStorage.getItem('subscription-status:account-a')).toBeNull()
})

test('refetches the shared canonical query after cancellation', async () => {
	let calls = 0
	statusHandler = () => {
		calls += 1
		return jsonResponse({ subscription: activeSubscription('account-a') })
	}
	await renderSession('account-a', false)
	await waitFor(() => expect(sessionView.hasActiveSubscription).toBe(true))
	expect(calls).toBe(1)

	await act(async () => subscribeView.cancelSubscriptionMutation.mutateAsync(undefined))

	await waitFor(() => expect(calls).toBe(2))
})
