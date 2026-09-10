// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ANNOUNCEMENT_DISMISSALS_COOKIE_NAME } from '~/utils/cookies'
import { LlamaAIMobileAppGate } from './LlamaAIMobileAppGate'

const viewport = vi.hoisted(() => ({ mobile: true }))
vi.mock('~/hooks/useMedia', () => ({ useMedia: () => viewport.mobile }))
vi.mock('~/containers/MobileApp', () => ({
	StoreButtons: () => <button type="button">Get app</button>
}))

let host: HTMLDivElement
let root: Root
const render = () => act(async () => root.render(<LlamaAIMobileAppGate interactive>Chat content</LlamaAIMobileAppGate>))

beforeEach(() => {
	viewport.mobile = true
	document.cookie = `${ANNOUNCEMENT_DISMISSALS_COOKIE_NAME}=; Max-Age=0; path=/`
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
})

afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
	document.cookie = `${ANNOUNCEMENT_DISMISSALS_COOKIE_NAME}=; Max-Age=0; path=/`
})

test.each(['Close', 'Continue on the web', 'Get app'])(
	'%s remembers dismissal after a new tab session',
	async (label) => {
		await render()
		expect(document.body.textContent).toContain('DefiLlama App')
		expect(host.textContent).not.toContain('Chat content')
		await act(async () => {
			;[...document.querySelectorAll('button')].find((button) => button.textContent === label)!.click()
		})
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
