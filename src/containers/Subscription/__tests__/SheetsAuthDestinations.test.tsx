// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com/sheets/auth"}

import { QueryClientProvider } from '@tanstack/react-query'
import Router from 'next/router'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import SheetsAuthPage from '~/pages/sheets/auth'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const route = vi.hoisted(() => ({ query: {} as Record<string, string> }))
vi.mock('next/router', () => ({ default: { push: vi.fn() }, useRouter: () => ({ query: route.query }) }))
vi.mock('next/script', () => ({ default: () => null }))

const SHEETS_CALLBACK_URL =
	'https://script.google.com/macros/d/1QqeBzdso-_WVCAamI1F0uKUhzYGFX9KbG8ufLVJ2AKupWAblK9agpcl4/usercallback'

const session = installSubscriberSession('sheets-user', { resolved: true })

let container: HTMLDivElement
let root: Root
const opener = { postMessage: vi.fn() }

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	session.serve({ '/subscription/trial-available': { trialAvailable: false } })
	vi.mocked(Router.push).mockClear()
	opener.postMessage.mockClear()
	Object.defineProperty(window, 'opener', { value: null, configurable: true })
	vi.spyOn(window, 'close').mockImplementation(() => {})
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
})

async function renderSignedIn() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={session.client}>
				<SheetsAuthPage />
			</QueryClientProvider>
		)
	)
	await waitForUi(() => expect(container.textContent).toContain('Successfully logged in.'))
}

test('returns to the Sheets add-on callback with the subscription and the OAuth state', async () => {
	route.query = { redirect_uri: SHEETS_CALLBACK_URL, state: 'oauth-state' }
	await renderSignedIn()
	await waitForUi(() => expect(Router.push).toHaveBeenCalledTimes(1))
	expect(Router.push).toHaveBeenCalledWith({
		pathname: SHEETS_CALLBACK_URL,
		query: {
			redirect_uri: SHEETS_CALLBACK_URL,
			state: 'oauth-state',
			subscription_id: '',
			subscription_status: 'active',
			expires_at: '2100-01-01',
			provider: ''
		}
	})
})

test.each([
	['another Apps Script project', 'https://script.google.com/macros/d/someone-else/usercallback'],
	['a site outside the add-ons', 'https://evil.example/collect']
])('sends nothing to %s and says why', async (_name, redirectUri) => {
	route.query = { redirect_uri: redirectUri }
	Object.defineProperty(window, 'opener', { value: opener, configurable: true })
	await renderSignedIn()
	await waitForUi(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('was not shared'))
	expect(Router.push).not.toHaveBeenCalled()
	expect(opener.postMessage).not.toHaveBeenCalled()
})

test('posts the subscription to the Excel add-in origin only, never to any opener', async () => {
	route.query = {}
	Object.defineProperty(window, 'opener', { value: opener, configurable: true })
	await renderSignedIn()
	await waitForUi(() => expect(opener.postMessage).toHaveBeenCalled())
	const targets = opener.postMessage.mock.calls.map(([, targetOrigin]) => targetOrigin)
	expect(targets).toEqual(['https://excel.llama.fi'])
	expect(opener.postMessage).toHaveBeenCalledWith(
		{ subscription_id: '', subscription_status: 'active', expires_at: '2100-01-01', provider: '' },
		'https://excel.llama.fi'
	)
	expect(window.close).toHaveBeenCalled()
})
