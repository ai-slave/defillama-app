// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { setLlamaAIWalkthroughState, writeAppStorage } from '~/contexts/LocalStorage'
import { WelcomeOnboarding } from '../WelcomeOnboarding'
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/router', () => ({ default: { push }, useRouter: () => ({ push }) }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		isAuthenticated: true,
		hasActiveSubscription: true,
		loaders: { userLoading: false },
		authorizedFetch: vi.fn()
	})
}))
vi.mock('~/contexts/LocalStorage', () => ({
	readAppStorage: vi.fn(() => ({})),
	writeAppStorage: vi.fn(),
	setLlamaAIWalkthroughState: vi.fn()
}))
vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))
let root: Root
let container: HTMLDivElement
let client: QueryClient
beforeEach(async () => {
	vi.clearAllMocks()
	sessionStorage.clear()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	client = new QueryClient()
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<WelcomeOnboarding />
			</QueryClientProvider>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	sessionStorage.clear()
})
function choice(name: string) {
	return [...container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]')].find((el) =>
		el.textContent!.includes(name)
	)!
}
function selected() {
	return [...container.querySelectorAll('[role="checkbox"][aria-checked="true"]')].map((el) => el.textContent)
}
function continueButton() {
	return [...container.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.textContent === 'Get started')!
}
async function space(el: HTMLElement) {
	await act(async () => {
		el.focus()
		el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
		el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }))
	})
}

test('multi-select, exclusive exploring and deselection to empty work with Space', async () => {
	expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toContain('Pick all that apply')
	expect(selected()).toHaveLength(0)
	expect(continueButton().disabled).toBe(true)
	await space(choice('CSV Downloads'))
	await space(choice('Pro Dashboards'))
	expect(selected()).toHaveLength(2)
	expect(continueButton().disabled).toBe(false)
	await space(choice('Just exploring'))
	expect(selected()).toEqual([expect.stringContaining('Just exploring')])
	await space(choice('Just exploring'))
	expect(selected()).toHaveLength(0)
	expect(continueButton().disabled).toBe(true)
	await space(choice('Just exploring'))
	await space(choice('CSV Downloads'))
	expect(selected()).toEqual([expect.stringContaining('CSV Downloads')])
	await space(choice('CSV Downloads'))
	expect(selected()).toHaveLength(0)
	expect(document.activeElement).toBe(choice('CSV Downloads'))
	expect(push).not.toHaveBeenCalled()
	expect(writeAppStorage).not.toHaveBeenCalled()
	expect(setLlamaAIWalkthroughState).not.toHaveBeenCalled()
})

test('CSV-only intent preserves the return URL and writes once on continue', async () => {
	sessionStorage.setItem('onboarding_returnUrl', '/downloads?mode=sql')
	await space(choice('CSV Downloads'))
	await act(async () => continueButton().click())
	expect(writeAppStorage).toHaveBeenCalledExactlyOnceWith({ ONBOARDING_INTENT: ['csv'] })
	expect(push).toHaveBeenCalledExactlyOnceWith('/downloads?mode=sql')
	expect(sessionStorage.getItem('onboarding_returnUrl')).toBeNull()
})

test('multiple features keep routing priority and arm LlamaAI only on continue', async () => {
	await space(choice('CSV Downloads'))
	await space(choice('LlamaAI'))
	expect(setLlamaAIWalkthroughState).not.toHaveBeenCalled()
	await act(async () => continueButton().click())
	expect(setLlamaAIWalkthroughState).toHaveBeenCalledExactlyOnceWith('armed', { ONBOARDING_INTENT: ['csv', 'llamaai'] })
	expect(writeAppStorage).not.toHaveBeenCalled()
	expect(push).toHaveBeenCalledExactlyOnceWith('/ai/chat')
})

test('exploring routes home; deselecting it blocks continue', async () => {
	await space(choice('Just exploring'))
	await space(choice('Just exploring'))
	await act(async () => continueButton().click())
	expect(push).not.toHaveBeenCalled()
	await space(choice('Just exploring'))
	await act(async () => continueButton().click())
	expect(push).toHaveBeenCalledExactlyOnceWith('/')
	expect(writeAppStorage).toHaveBeenCalledExactlyOnceWith({ ONBOARDING_INTENT: ['exploring'] })
})
