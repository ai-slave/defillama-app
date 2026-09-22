// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { UserInterestsResponse } from '~/api/users.types'
import { UMAMI_READY_EVENT } from '~/utils/analytics/umami'
import { ANNOUNCEMENT_DISMISSALS_COOKIE_NAME, dismissAnnouncement } from '~/utils/cookies'

const auth = {
	authToken: null as string | null,
	user: null as { id: string } | null,
	hasActiveSubscription: false,
	loaders: { subscriptionInitialCheck: false }
}
vi.mock('~/auth', () => ({ useAuthContext: () => auth }))

const route = { asPath: '/chain/ethereum', pathname: '/chain/[chain]' }
vi.mock('next/router', () => ({ useRouter: () => route }))

const fetchUserInterests = vi.fn<(token: string) => Promise<UserInterestsResponse>>()
vi.mock('~/api/users', () => ({ fetchUserInterests: (token: string) => fetchUserInterests(token) }))

// The real strip pulls in the Pro modal and entitlement hooks; the slot only needs to know it was chosen.
vi.mock('~/containers/Yields/VerifiedApyAnnouncement', () => ({
	VERIFIED_APY_ANNOUNCEMENT: { id: 'verified-apy', version: '2026-09-03' },
	VerifiedApyAnnouncement: () => <div>VERIFIED-APY-MARKER</div>
}))

const track = vi.fn()
vi.mock('~/utils/analytics/umami', async () => {
	const actual = await vi.importActual<typeof import('~/utils/analytics/umami')>('~/utils/analytics/umami')
	return { UMAMI_READY_EVENT: actual.UMAMI_READY_EVENT, trackUmamiEvent: (...args: Array<unknown>) => track(...args) }
})

vi.mock('../registry', async () => {
	const actual = await vi.importActual<typeof import('../registry')>('../registry')
	// A launch window in the past keeps these tests about targeting; the launch path is covered by the resolver tests.
	return { ANNOUNCEMENT_REGISTRY: { ...actual.ANNOUNCEMENT_REGISTRY, launch: null } }
})

import { TargetedAnnouncement } from '../TargetedAnnouncement'

const clearCookie = () => {
	document.cookie = `${ANNOUNCEMENT_DISMISSALS_COOKIE_NAME}=; expires=${new Date(0).toUTCString()}; path=/`
}

describe('TargetedAnnouncement', () => {
	let container: HTMLDivElement
	let root: Root

	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

	async function render() {
		await act(async () =>
			root.render(
				<QueryClientProvider client={client}>
					<TargetedAnnouncement />
				</QueryClientProvider>
			)
		)
		await settle()
	}

	// Let the interests query settle and the slot re-resolve.
	async function settle() {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
	}

	function dismiss() {
		const button = container.querySelector<HTMLButtonElement>('[data-announcement-dismiss]')!
		return act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		clearCookie()
		localStorage.clear()
		client.clear()
		route.asPath = '/chain/ethereum'
		window.umami = { track: () => {}, identify: () => {} }
		track.mockClear()
		fetchUserInterests.mockReset()
		auth.authToken = null
		auth.user = null
		auth.hasActiveSubscription = false
		auth.loaders.subscriptionInitialCheck = false
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		clearCookie()
	})

	test('a signed-out reader gets the fallback and no request is made', async () => {
		await render()
		expect(container.textContent).toContain('Universal Token Rating')
		expect(fetchUserInterests).not.toHaveBeenCalled()
		expect(track).toHaveBeenCalledWith(
			'announcement-impression',
			expect.objectContaining({ kind: 'fallback', page: '/chain/[chain]' })
		)
	})

	test('clicking the CTA sends one click event with the page template', async () => {
		await render()
		track.mockClear()
		const link = container.querySelector<HTMLAnchorElement>('a[href="/universal-token-rating"]')!
		await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
		expect(track).toHaveBeenCalledTimes(1)
		expect(track).toHaveBeenCalledWith('announcement-click', {
			id: 'universal-token-rating',
			version: expect.any(String),
			page: '/chain/[chain]',
			kind: 'fallback'
		})
		expect(link.hasAttribute('data-umami-event')).toBe(false)
	})

	test('a signed-in yields reader swaps to Verified APY once interests load', async () => {
		auth.authToken = 'token'
		auth.user = { id: 'user-a' }
		fetchUserInterests.mockResolvedValue({
			interests: [
				{ category: 'protocols', score: 0.9 },
				{ category: 'yields', score: 0.5 }
			],
			segments: []
		})
		await render()
		expect(fetchUserInterests).toHaveBeenCalledWith('token')
		expect(container.textContent).toContain('VERIFIED-APY-MARKER')
		expect(container.textContent).not.toContain('Universal Token Rating')
		expect(track).toHaveBeenCalledTimes(1)
		expect(track).toHaveBeenCalledWith(
			'announcement-impression',
			expect.objectContaining({ kind: 'targeted', category: 'yields', id: 'verified-apy' })
		)
	})

	test('a token whose record has not loaded shows the fallback without counting an impression', async () => {
		auth.authToken = 'token'
		auth.user = null
		await render()
		expect(container.textContent).toContain('Universal Token Rating')
		expect(fetchUserInterests).not.toHaveBeenCalled()
		expect(track).not.toHaveBeenCalled()
	})

	test('a subscriber with the same interests is not shown the Verified APY upsell', async () => {
		auth.authToken = 'token'
		auth.user = { id: 'user-a' }
		auth.hasActiveSubscription = true
		fetchUserInterests.mockResolvedValue({ interests: [{ category: 'yields', score: 0.5 }], segments: [] })
		await render()
		expect(container.textContent).toContain('Universal Token Rating')
	})

	test('a failed request leaves the fallback in place', async () => {
		auth.authToken = 'token'
		auth.user = { id: 'user-a' }
		fetchUserInterests.mockRejectedValue(new Error('503'))
		await render()
		expect(container.textContent).toContain('Universal Token Rating')
	})

	test('a cached profile is used without a request', async () => {
		auth.authToken = 'token'
		auth.user = { id: 'user-a' }
		localStorage.setItem(
			'defillama-user-interests',
			JSON.stringify({
				schema: 1,
				userId: 'user-a',
				storedAt: Date.now(),
				value: { interests: [{ category: 'llamaai', score: 0.7 }], segments: [] }
			})
		)
		await render()
		expect(fetchUserInterests).not.toHaveBeenCalled()
		expect(container.textContent).toContain('Get the app')
	})

	test('dismissing the chosen banner empties the slot instead of showing the next candidate', async () => {
		auth.authToken = 'token'
		auth.user = { id: 'user-a' }
		fetchUserInterests.mockResolvedValue({ interests: [{ category: 'llamaai', score: 0.7 }], segments: [] })
		await render()
		expect(container.textContent).toContain('Get the app')

		await dismiss()
		expect(container.textContent).toBe('')
		expect(track).toHaveBeenCalledWith('announcement-dismiss', expect.objectContaining({ id: 'llamaai-mobile-app' }))
	})

	test('a banner dismissed earlier is skipped on the next page view', async () => {
		dismissAnnouncement('llamaai-mobile-app--2026-09-22')
		auth.authToken = 'token'
		auth.user = { id: 'user-a' }
		fetchUserInterests.mockResolvedValue({ interests: [{ category: 'llamaai', score: 0.7 }], segments: [] })
		await render()
		expect(container.textContent).toContain('Universal Token Rating')
	})

	test('dismissing the fallback while the profile is still loading keeps the slot empty when it arrives', async () => {
		auth.authToken = 'token'
		auth.user = { id: 'user-a' }
		let resolveProfile!: (value: UserInterestsResponse) => void
		fetchUserInterests.mockReturnValue(new Promise((resolve) => (resolveProfile = resolve)))
		await render()
		expect(container.textContent).toContain('Universal Token Rating')

		await dismiss()
		resolveProfile({ interests: [{ category: 'llamaai', score: 0.7 }], segments: [] })
		await settle()
		expect(container.textContent).toBe('')
	})

	test('navigating to another chain resolves again and skips the banner dismissed there', async () => {
		auth.authToken = 'token'
		auth.user = { id: 'user-a' }
		fetchUserInterests.mockResolvedValue({ interests: [{ category: 'llamaai', score: 0.7 }], segments: [] })
		await render()
		await dismiss()
		expect(container.textContent).toBe('')

		route.asPath = '/chain/arbitrum'
		await render()
		expect(container.textContent).toContain('Universal Token Rating')
		expect(track).toHaveBeenCalledWith(
			'announcement-impression',
			expect.objectContaining({ kind: 'fallback', id: 'universal-token-rating' })
		)
	})

	test('an impression settled before Umami loads is sent once the script is ready, and only once', async () => {
		window.umami = undefined
		await render()
		expect(track).not.toHaveBeenCalled()

		await act(async () => {
			window.umami = { track: () => {}, identify: () => {} }
			window.dispatchEvent(new Event(UMAMI_READY_EVENT))
			window.dispatchEvent(new Event(UMAMI_READY_EVENT))
		})
		expect(track).toHaveBeenCalledTimes(1)
		expect(track).toHaveBeenCalledWith('announcement-impression', expect.objectContaining({ kind: 'fallback' }))
	})
})
