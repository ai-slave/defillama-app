// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useAuthContext } from '~/auth'
import { useSubscribe, type Subscription } from '~/auth/useSubscribe'
import { AUTH_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/account', query: {} }) }))

const session = installSubscriberSession('account-a')

const apiSubscription = {
	id: 'sub-api-1',
	PK: '',
	checkoutUrl: '',
	status: 'active',
	type: 'api',
	provider: 'stripe',
	updatedAt: '',
	expires_at: '2100-01-01T00:00:00Z'
} satisfies Subscription

let view: { apiKey: string | null; logout: () => void }
function Probe() {
	const { apiKey } = useSubscribe()
	const { logout } = useAuthContext()
	view = { apiKey, logout }
	return null
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	session.serve({
		'/subscription/status': { subscription: apiSubscription },
		'/auth/get-api-key': { apiKey: { api_key: 'key-of-account-a' } },
		'/user/credits': { credits: 100, maxCredits: 1_000_000, monthKey: '2026-08' },
		'/subscription/past-due': fixtureStatus(404, { message: 'No past due subscription found' }),
		'/subscription/trial-available': { trialAvailable: false },
		'/user/usage-stats': { windowDays: 30, stats: [] }
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function mountSignedIn() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Probe />
			</session.Wrapper>
		)
	)
}

async function expectApiKey(expected: string) {
	await waitForUi(
		async () => {
			await act(async () => {})
			expect(view.apiKey).toBe(expected)
		},
		{ timeout: 1500 }
	)
}

test('logging out hides the API key, so the next account on this browser never sees it', async () => {
	await mountSignedIn()
	await expectApiKey('key-of-account-a')

	await act(async () => view.logout())

	expect(view.apiKey).toBeNull()
})

test('signing back into the same account shows its API key again', async () => {
	await mountSignedIn()
	await expectApiKey('key-of-account-a')
	await act(async () => view.logout())

	await act(async () => pb.authStore.save(session.token, session.record))

	await expectApiKey('key-of-account-a')
})

test('an API key response that lands after logout stays hidden', async () => {
	let releaseKey!: () => void
	session.serve({
		[`${AUTH_SERVER}/auth/get-api-key`]: () =>
			new Promise<Response>((resolve) => {
				releaseKey = () => resolve(Response.json({ apiKey: { api_key: 'key-of-account-a' } }))
			})
	})
	await mountSignedIn()
	await waitForUi(() => expect(releaseKey).toBeTypeOf('function'), { timeout: 1500 })

	await act(async () => view.logout())
	await act(async () => releaseKey())
	// Read what the page shows only once the response has been handled.
	await waitForUi(async () => {
		await act(async () => {})
		expect(session.client.isFetching()).toBe(0)
	})

	expect(view.apiKey).toBeNull()
})
