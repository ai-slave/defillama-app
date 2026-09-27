// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { UserInterestsResponse } from '~/api/users.types'
import { UMAMI_READY_EVENT } from '~/utils/analytics/umami'
import { ANNOUNCEMENT_DISMISSALS_COOKIE_NAME } from '~/utils/cookies'
import pb from '~/utils/pocketbase'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import { waitForUi } from '~/utils/testing/waitForUi'
import { TargetedAnnouncement } from '../TargetedAnnouncement'

const route = { asPath: '/chain/ethereum', pathname: '/chain/[chain]' }
vi.mock('next/router', () => ({ useRouter: () => route }))

const session = installSubscriberSession('user-a')
const track = installUmamiSink()
const INTERESTS_URL = 'https://users-api.llama.team/api/profile/interests'

function serveInterests(profile: UserInterestsResponse | ReturnType<typeof fixtureStatus>) {
	session.serve({ [INTERESTS_URL]: profile })
}
function interestsRequests() {
	return session.urls().filter((url) => url === INTERESTS_URL).length
}
const impressions = () => track.mock.calls.filter(([event]) => event === 'announcement-impression')

const clearCookie = () => {
	document.cookie = `${ANNOUNCEMENT_DISMISSALS_COOKIE_NAME}=; expires=${new Date(0).toUTCString()}; path=/`
}

describe('TargetedAnnouncement', () => {
	let container: HTMLDivElement
	let root: Root

	async function render() {
		await act(async () =>
			root.render(
				<session.Wrapper>
					<TargetedAnnouncement />
				</session.Wrapper>
			)
		)
	}

	const text = () => container.textContent ?? ''
	const waitForText = (expected: string) => waitForUi(() => expect(text()).toContain(expected), { timeout: 1000 })
	const waitForImpression = () => waitForUi(() => expect(impressions()).toHaveLength(1), { timeout: 1000 })

	function dismiss() {
		const button = container.querySelector<HTMLButtonElement>('[data-announcement-dismiss]')!
		return act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
	}

	beforeEach(() => {
		// After the launch window, so the slot is about targeting; the launch path is covered by the resolver tests.
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date('2026-10-10T00:00:00Z'))
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		clearCookie()
		route.asPath = '/chain/ethereum'
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		clearCookie()
		vi.useRealTimers()
	})

	test('a signed-out reader gets the fallback without an interests request', async () => {
		pb.authStore.clear()
		await render()
		await waitForImpression()
		expect(text()).toContain('Universal Token Rating')
		expect(interestsRequests()).toBe(0)
		expect(impressions()[0][1]).toMatchObject({ kind: 'fallback', page: '/chain/[chain]' })
	})

	test('clicking the CTA sends one click event with the page template', async () => {
		pb.authStore.clear()
		await render()
		await waitForImpression()
		track.mockClear()
		const link = container.querySelector<HTMLAnchorElement>('a[href="/universal-token-rating"]')!
		await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
		expect(track.mock.calls).toEqual([
			[
				'announcement-click',
				{ id: 'universal-token-rating', version: expect.any(String), page: '/chain/[chain]', kind: 'fallback' }
			]
		])
	})

	test('a signed-in reader swaps to the banner for their interests and counts one impression', async () => {
		serveInterests({ interests: [{ category: 'llamaai', score: 0.9 }], segments: [] })
		await render()
		await waitForText('LlamaAI is now in the DefiLlama app.')
		await waitForImpression()
		expect(impressions()[0][1]).toMatchObject({ kind: 'targeted', category: 'llamaai', id: 'llamaai-mobile-app' })
	})

	test('a subscriber reading yields is not shown the Verified APY upsell', async () => {
		serveInterests({ interests: [{ category: 'yields', score: 0.5 }], segments: [] })
		await render()
		await waitForImpression()
		expect(impressions()[0][1]).toMatchObject({ kind: 'fallback', id: 'universal-token-rating' })
	})

	test('a crypto project reader gets the investor relations link with their referrer id', async () => {
		serveInterests({ interests: [], segments: ['crypto_project'] })
		await render()
		await waitForText('investor relations dashboard for your protocol')
		const link = container.querySelector<HTMLAnchorElement>('a[href^="https://investors.defillama.com"]')!
		expect(link.getAttribute('href')).toBe('https://investors.defillama.com?referrer=user-a')
	})

	test('a failed interests request leaves the fallback in place', async () => {
		serveInterests(fixtureStatus(503))
		await render()
		await waitForImpression()
		expect(text()).toContain('Universal Token Rating')
	})

	test('a cached profile is used without a request', async () => {
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
		await waitForText('LlamaAI is now in the DefiLlama app.')
		expect(interestsRequests()).toBe(0)
	})

	test('dismissing the chosen banner empties the slot instead of showing the next candidate', async () => {
		serveInterests({ interests: [{ category: 'llamaai', score: 0.7 }], segments: [] })
		await render()
		await waitForText('LlamaAI is now in the DefiLlama app.')

		await dismiss()
		expect(text()).toBe('')
		expect(track).toHaveBeenCalledWith('announcement-dismiss', expect.objectContaining({ id: 'llamaai-mobile-app' }))
	})

	test('dismissing the fallback while the profile loads keeps the slot empty and counts no impression', async () => {
		let resolveProfile!: (value: UserInterestsResponse) => void
		const profile = new Promise<UserInterestsResponse>((resolve) => (resolveProfile = resolve))
		session.serve({ [INTERESTS_URL]: () => profile })
		await render()
		await waitForUi(() => expect(interestsRequests()).toBe(1), { timeout: 1000 })
		expect(text()).toContain('Universal Token Rating')
		expect(impressions()).toEqual([])

		await dismiss()
		await act(async () => {
			resolveProfile({ interests: [{ category: 'llamaai', score: 0.7 }], segments: [] })
			// Let the query settle and the slot re-resolve with the profile.
			await new Promise((resolve) => setTimeout(resolve, 20))
		})
		expect(text()).toBe('')
		expect(impressions()).toEqual([])
	})

	test('navigating to another chain resolves again and skips the banner dismissed earlier', async () => {
		serveInterests({ interests: [{ category: 'llamaai', score: 0.7 }], segments: [] })
		await render()
		await waitForText('LlamaAI is now in the DefiLlama app.')
		await dismiss()
		track.mockClear()

		route.asPath = '/chain/arbitrum'
		await render()
		await waitForImpression()
		expect(text()).toContain('Universal Token Rating')
		expect(impressions()[0][1]).toMatchObject({ kind: 'fallback', id: 'universal-token-rating' })
	})

	test('an impression settled before Umami loads is sent once the script is ready, and only once', async () => {
		pb.authStore.clear()
		window.umami = undefined
		await render()
		await waitForText('Universal Token Rating')

		await act(async () => {
			window.umami = { track, identify: vi.fn() }
			window.dispatchEvent(new Event(UMAMI_READY_EVENT))
			window.dispatchEvent(new Event(UMAMI_READY_EVENT))
		})
		expect(impressions()).toHaveLength(1)
		expect(impressions()[0][1]).toMatchObject({ kind: 'fallback' })
	})
})
