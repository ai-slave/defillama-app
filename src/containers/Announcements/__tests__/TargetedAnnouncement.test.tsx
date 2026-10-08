// @vitest-environment happy-dom

import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import type { UserInterestsResponse } from '~/api/users.types'
import { FEATURES_SERVER } from '~/constants'
import { PageClockProvider } from '~/hooks/usePageClock'
import { UMAMI_READY_EVENT } from '~/utils/analytics/umami'
import {
	ANNOUNCEMENT_DISMISSALS_COOKIE_NAME,
	createAnnouncementDismissalToken,
	dismissAnnouncement,
	getDismissedAnnouncements
} from '~/utils/cookies'
import pb from '~/utils/pocketbase'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import { waitForUi } from '~/utils/testing/waitForUi'
import { LLAMAAI_PROMO_ANNOUNCEMENT } from '../LlamaAIPromoAnnouncement'
import { TargetedAnnouncement } from '../TargetedAnnouncement'

const route = { asPath: '/chain/ethereum', pathname: '/chain/[chain]' }
vi.mock('next/router', () => ({ useRouter: () => route }))

const session = installSubscriberSession('user-a')
const track = installUmamiSink()
const INTERESTS_URL = `${FEATURES_SERVER}/profile/interests`
const PROMO_TEXT = 'Ask LlamaAI anything about DeFi'

function serveInterests(profile: UserInterestsResponse) {
	session.serve({ [INTERESTS_URL]: profile })
}
function interestsRequests() {
	return session.urls().filter((url) => url === INTERESTS_URL).length
}

/**
 * Runs the real Umami tracker on this document, so a `data-umami-event` click sends the way it does in
 * production. Its payloads arrive through the `data-before-send` hook instead of the network.
 */
const trackerEvents: Array<[string, unknown]> = []
beforeAll(() => {
	const script = {
		src: 'https://defillama.com/script2.js',
		getAttribute: (name: string) => ({ 'data-website-id': 'test', 'data-before-send': 'captureUmami' })[name] ?? null
	}
	const bound = (target: object, key: string | symbol) => {
		const value = Reflect.get(target, key)
		return typeof value === 'function' ? value.bind(target) : value
	}
	const trackerDocument = new Proxy(document, {
		get: (target, key) => (key === 'currentScript' ? script : bound(target, key))
	})
	const captureUmami = (type: string, payload: { name?: string; data?: unknown }) => {
		if (type === 'event' && payload.name) trackerEvents.push([payload.name, payload.data])
		return null
	}
	const ownKeys: Record<string | symbol, unknown> = {
		document: trackerDocument,
		history: { pushState: () => {}, replaceState: () => {} },
		// The app's own sink stays `window.umami`; the tracker only needs to see one is installed.
		umami: {},
		captureUmami
	}
	const trackerWindow = new Proxy(window, {
		get: (target, key) => (key in ownKeys ? ownKeys[key] : bound(target, key))
	})
	runInNewContext(readFileSync('public/script2.js', 'utf8'), { window: trackerWindow, fetch, setTimeout, URL })
})
beforeEach(() => {
	trackerEvents.length = 0
})
/** Every event Umami receives: from `trackUmamiEvent` and from the tracker's attribute clicks. */
const sent = () => [...track.mock.calls.map(([event, data]) => [event, data] as [string, unknown]), ...trackerEvents]
const impressions = () => sent().filter(([event]) => event === 'announcement-impression')

const clearCookie = () => {
	document.cookie = `${ANNOUNCEMENT_DISMISSALS_COOKIE_NAME}=; expires=${new Date(0).toUTCString()}; path=/`
}

describe('TargetedAnnouncement', () => {
	let container: HTMLDivElement
	let root: Root

	async function render() {
		await act(async () =>
			root.render(
				<PageClockProvider pageClockSec={Math.floor(Date.now() / 1000)}>
					<session.Wrapper>
						<TargetedAnnouncement />
					</session.Wrapper>
				</PageClockProvider>
			)
		)
	}

	const text = () => container.textContent ?? ''
	const waitForText = (expected: string) => waitForUi(() => expect(text()).toContain(expected), { timeout: 1000 })
	const waitForImpression = () => waitForUi(() => expect(impressions()).toHaveLength(1), { timeout: 1000 })

	// Clicks the X's icon, not the button itself, as a reader does.
	function dismiss() {
		const icon = container.querySelector('button svg')!
		return act(async () => icon.dispatchEvent(new MouseEvent('click', { bubbles: true })))
	}

	beforeEach(() => {
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
	})

	describe('while the LlamaAI promo runs', () => {
		test('a signed-out reader gets the promo without an interests request', async () => {
			pb.authStore.clear()
			await render()
			await waitForImpression()
			expect(text()).toContain(PROMO_TEXT)
			expect(interestsRequests()).toBe(0)
			expect(impressions()[0][1]).toMatchObject({ kind: 'launch', id: 'llamaai-promo', page: '/chain/[chain]' })
		})

		test('the promo comes ahead of the banner for a signed-in reader’s interests', async () => {
			serveInterests({ interests: [{ category: 'llamaai', score: 0.9 }], segments: [] })
			await render()
			await waitForImpression()
			expect(text()).toContain(PROMO_TEXT)
			expect(impressions()[0][1]).toMatchObject({ kind: 'launch' })
		})

		test('clicking the CTA sends one click event with the page template', async () => {
			pb.authStore.clear()
			await render()
			await waitForImpression()
			track.mockClear()
			const link = container.querySelector<HTMLAnchorElement>('a[href="/ai"]')!
			await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
			expect(sent()).toEqual([
				[
					'announcement-click',
					{ id: 'llamaai-promo', version: expect.any(String), page: '/chain/[chain]', kind: 'launch' }
				]
			])
		})

		test('dismissing the promo while the profile loads keeps the slot empty and counts no impression', async () => {
			let resolveProfile!: (value: UserInterestsResponse) => void
			const profile = new Promise<UserInterestsResponse>((resolve) => (resolveProfile = resolve))
			session.serve({ [INTERESTS_URL]: () => profile })
			await render()
			await waitForUi(() => expect(interestsRequests()).toBe(1), { timeout: 1000 })
			expect(text()).toContain(PROMO_TEXT)
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

		test('closing the promo persists its dismissal across page views', async () => {
			pb.authStore.clear()
			await render()
			await waitForText(PROMO_TEXT)

			await dismiss()
			expect(getDismissedAnnouncements()).toContain(
				createAnnouncementDismissalToken(LLAMAAI_PROMO_ANNOUNCEMENT.id, LLAMAAI_PROMO_ANNOUNCEMENT.version)
			)

			route.asPath = '/chain/arbitrum'
			await render()
			expect(text()).toBe('')
		})

		test('navigating to another chain resolves again: the closed promo stays hidden and the next banner shows', async () => {
			serveInterests({ interests: [{ category: 'llamaai', score: 0.7 }], segments: [] })
			await render()
			await waitForImpression()
			expect(text()).toContain(PROMO_TEXT)
			await dismiss()
			expect(text()).toBe('')
			track.mockClear()

			route.asPath = '/chain/arbitrum'
			await render()
			await waitForText('LlamaAI is now in the DefiLlama app.')
			await waitForImpression()
			expect(text()).not.toContain(PROMO_TEXT)
			expect(impressions()[0][1]).toMatchObject({ kind: 'targeted', id: 'llamaai-mobile-app', page: '/chain/[chain]' })
		})

		test('clock ticks keep the banner and count one impression', async () => {
			// The page clock ticks on an interval, so the test drives it along with the date.
			vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
			try {
				pb.authStore.clear()
				await render()
				await waitForImpression()

				await act(async () => vi.advanceTimersByTime(90_000))
				expect(text()).toContain(PROMO_TEXT)
				expect(impressions()).toHaveLength(1)
			} finally {
				vi.useRealTimers()
			}
		})

		test('an impression settled before Umami loads is sent once the script is ready, and only once', async () => {
			pb.authStore.clear()
			window.umami = undefined
			await render()
			await waitForText(PROMO_TEXT)

			await act(async () => {
				window.umami = { track, identify: vi.fn() }
				window.dispatchEvent(new Event(UMAMI_READY_EVENT))
				window.dispatchEvent(new Event(UMAMI_READY_EVENT))
			})
			expect(impressions()).toHaveLength(1)
			expect(impressions()[0][1]).toMatchObject({ kind: 'launch' })
		})
	})

	describe('after the reader closed the LlamaAI promo', () => {
		beforeEach(() => {
			dismissAnnouncement(
				createAnnouncementDismissalToken(LLAMAAI_PROMO_ANNOUNCEMENT.id, LLAMAAI_PROMO_ANNOUNCEMENT.version)
			)
		})

		test('a signed-in reader gets the banner for their interests and counts one impression', async () => {
			serveInterests({ interests: [{ category: 'llamaai', score: 0.9 }], segments: [] })
			await render()
			await waitForText('LlamaAI is now in the DefiLlama app.')
			await waitForImpression()
			expect(impressions()[0][1]).toMatchObject({ kind: 'targeted', category: 'llamaai', id: 'llamaai-mobile-app' })
		})

		test('a subscriber reading yields is not shown the Verified APY upsell', async () => {
			serveInterests({ interests: [{ category: 'yields', score: 0.5 }], segments: [] })
			await render()
			await waitForUi(() => expect(interestsRequests()).toBe(1), { timeout: 1000 })
			await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
			expect(text()).toBe('')
			expect(impressions()).toEqual([])
		})

		test('a crypto project reader gets the investor relations link with their referrer id', async () => {
			serveInterests({ interests: [], segments: ['crypto_project'] })
			await render()
			await waitForText('investor relations dashboard for your protocol')
			const link = container.querySelector<HTMLAnchorElement>('a[href^="https://investors.defillama.com"]')!
			expect(link.getAttribute('href')).toBe('https://investors.defillama.com?referrer=user-a')
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
			expect(sent().filter(([event]) => event === 'announcement-dismiss')).toEqual([
				[
					'announcement-dismiss',
					{
						id: 'llamaai-mobile-app',
						version: expect.any(String),
						page: '/chain/[chain]',
						kind: 'targeted',
						category: 'llamaai'
					}
				]
			])
		})

		test('the Verified APY unlock counts one banner click, and clicks inside its modal count none', async () => {
			session.serve({
				'/subscription/status': fixtureStatus(404, { message: 'No active subscription' }),
				'/subscription/trial-available': { trialAvailable: false }
			})
			serveInterests({ interests: [{ category: 'yields', score: 0.5 }], segments: [] })
			await render()
			await waitForText('Verified APY')
			const unlock = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Unlock'))!
			await act(async () => unlock.dispatchEvent(new MouseEvent('click', { bubbles: true })))
			const dialog = await waitForUi(
				() => {
					const element = document.querySelector('[role="dialog"]')
					expect(element).not.toBeNull()
					return element!
				},
				{ timeout: 2000 }
			)
			for (const button of dialog.querySelectorAll('button')) {
				await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
			}
			expect(sent().filter(([event]) => event === 'announcement-click')).toEqual([
				['announcement-click', expect.objectContaining({ id: 'verified-apy', category: 'yields' })]
			])
		})
	})
})
