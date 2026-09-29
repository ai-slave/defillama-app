// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { InvestorsSiteProvider } from '~/containers/Investors/SiteContext'
import { UMAMI_READY_EVENT } from '~/utils/analytics/umami'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { useParentAuthTracker } from '../useParentAuthTracker'
import { useUmamiIdentityTracker } from '../useUmamiIdentityTracker'

const session = installSubscriberSession('user-1', { resolved: true })

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.useFakeTimers()
	sessionStorage.clear()
	window.umami = undefined
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.useRealTimers()
	window.umami = undefined
})

/** Umami's script arrives late: `_app` loads it with `lazyOnload` and announces it with `UMAMI_READY_EVENT`. */
async function loadUmamiAfter(ms: number) {
	await act(async () => vi.advanceTimersByTime(ms))
	const umami = { identify: vi.fn(), track: vi.fn() }
	window.umami = umami
	await act(async () => window.dispatchEvent(new Event(UMAMI_READY_EVENT)))
	// One more poll, so only a tracker that gave up misses it.
	await act(async () => vi.advanceTimersByTime(600))
	return umami
}

function IdentityTracker() {
	useUmamiIdentityTracker()
	return null
}

function ParentAuthTracker() {
	useParentAuthTracker()
	return null
}

test('a signed-in visitor is identified once Umami loads, however late', async () => {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<IdentityTracker />
			</session.Wrapper>
		)
	)

	const umami = await loadUmamiAfter(6000)
	expect(umami.identify.mock.calls).toEqual([['user-1']])
})

async function renderParentAuthTracker() {
	await act(async () =>
		root.render(
			<InvestorsSiteProvider siteId="investors">
				<ParentAuthTracker />
			</InvestorsSiteProvider>
		)
	)
	await act(async () =>
		window.dispatchEvent(
			new MessageEvent('message', {
				origin: 'https://defillama.com',
				data: { type: 'auth-response', user: { id: 'parent-7' } }
			})
		)
	)
}

test('an investor signed in on the parent site is tracked once Umami loads, however late', async () => {
	await renderParentAuthTracker()

	const umami = await loadUmamiAfter(6000)
	expect(umami.track.mock.calls).toEqual([['ir-authenticated-visit', { userId: 'parent-7' }]])
})

test('an investor who leaves before Umami loads is tracked on their next page load', async () => {
	await renderParentAuthTracker()
	await act(async () => root.unmount())
	root = createRoot(container)

	await renderParentAuthTracker()
	const umami = await loadUmamiAfter(0)
	expect(umami.track.mock.calls).toEqual([['ir-authenticated-visit', { userId: 'parent-7' }]])
})
