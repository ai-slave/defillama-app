// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ANNOUNCEMENT_DISMISSALS_COOKIE_NAME } from '~/utils/cookies'
import { LlamaAIMobileAppGate } from '../LlamaAIMobileAppGate'

const viewport = { mobile: true }

let host: HTMLDivElement
let root: Root
const render = () => act(async () => root.render(<LlamaAIMobileAppGate>Chat content</LlamaAIMobileAppGate>))

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	viewport.mobile = true
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: viewport.mobile,
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {}
	}))
	document.cookie = `${ANNOUNCEMENT_DISMISSALS_COOKIE_NAME}=; Max-Age=0; path=/`
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
})

afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
	vi.unstubAllGlobals()
	document.cookie = `${ANNOUNCEMENT_DISMISSALS_COOKIE_NAME}=; Max-Age=0; path=/`
})

// Store links leave the site; the click is what dismisses, not where it goes.
function clickControl(label: string) {
	const control = [...document.querySelectorAll<HTMLElement>('button, a')].find(
		(element) => element.textContent === label || element.querySelector('img')?.alt === label
	)!
	if (control instanceof HTMLAnchorElement) control.addEventListener('click', (event) => event.preventDefault())
	control.click()
}

test.each(['Close', 'Continue on the web', 'Download on the App Store'])(
	'%s remembers dismissal after a new tab session',
	async (label) => {
		await render()
		expect(document.body.textContent).toContain('DefiLlama App')
		expect(host.textContent).not.toContain('Chat content')
		await act(async () => clickControl(label))
		expect(host.textContent).toContain('Chat content')
		expect(document.cookie).toContain('llamaai-mobile-app-promotion--2026-08-03')
		await act(async () => root.unmount())
		sessionStorage.clear()
		root = createRoot(host)
		await render()
		expect(document.body.textContent).not.toContain('DefiLlama App')
		expect(host.textContent).toContain('Chat content')
	}
)

test('desktop visitors see chat without dismissing the promotion', async () => {
	viewport.mobile = false
	await render()
	expect(host.textContent).toContain('Chat content')
	expect(document.body.textContent).not.toContain('DefiLlama App')
	expect(document.cookie).not.toContain('llamaai-mobile-app-promotion')
})
