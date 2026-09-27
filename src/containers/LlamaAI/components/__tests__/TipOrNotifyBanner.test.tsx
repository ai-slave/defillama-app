// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { TipActionProvider } from '../TipActionContext'
import { TipOrNotifyBanner } from '../TipOrNotifyBanner'

// Browser notification prompt; these tests read only the low balance notice.
vi.mock('../NotificationPermissionBanner', () => ({ NotificationPermissionBanner: () => null }))

const session = installSubscriberSession('reader')
let toppedUp = '0.25'
const openSettings = vi.fn()
let root: Root
let host: HTMLDivElement
beforeEach(() => {
	openSettings.mockReset()
	toppedUp = '0.25'
	session.serve({
		'https://features.llama.fi/user/ai-balance': () =>
			Response.json({ freeRemaining: '0.25', toppedUpBalance: toppedUp, freeLimit: '1', freeSpent: '0.75' }),
		'https://ai.llama.fi/user-settings': { settings: {}, tip: null }
	})
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
})
afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
})
const render = (id?: string) =>
	act(async () =>
		root.render(
			<session.Wrapper>
				<TipActionProvider handlers={{ openSettingsModal: openSettings }}>
					<TipOrNotifyBanner premiumResponseId={id} />
				</TipActionProvider>
			</session.Wrapper>
		)
	)

test('shows low balance only after paid usage and opens the Balance tab', async () => {
	await render()
	expect(host.textContent).not.toContain('balance is low')
	await render('paid-message')
	await act(async () => {
		await waitForUi(() => expect(host.textContent).toContain('balance is low'))
	})
	const topup = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.textContent === 'Top up'
	)!
	await act(async () => topup.click())
	expect(openSettings).toHaveBeenCalledWith('balance')
	await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Dismiss low balance notice"]')!.click())
	expect(host.textContent).not.toContain('balance is low')
	await render('paid-message')
	expect(host.textContent).not.toContain('balance is low')
})

test('a sufficient balance shows the regular tip instead of a top-up notice', async () => {
	toppedUp = '10'
	session.serve({
		'https://ai.llama.fi/user-settings': {
			settings: {},
			tip: {
				id: 'tip-1',
				family: 'alerts',
				variant: 'a',
				title: 'Schedule a daily alert',
				placement: 'banner',
				cta: { kind: 'none' },
				dismissPolicy: { kind: 'permanent' }
			}
		},
		'https://ai.llama.fi/user-tips/tip-1/seen': {}
	})
	await render('paid-message')
	await act(async () => {
		await waitForUi(() => expect(host.textContent).toContain('Schedule a daily alert'))
	})
	await act(async () => {
		await waitForUi(() =>
			expect(session.requests.some((request) => request.url.pathname === '/user/ai-balance')).toBe(true)
		)
	})
	// React Query tells its observers on a timer after the fetch settles; give the answer time to render.
	await act(async () => {
		await waitForUi(() => expect(session.client.isFetching()).toBe(0))
		await new Promise((resolve) => setTimeout(resolve, 20))
	})
	expect(host.textContent).not.toContain('balance is low')
})
