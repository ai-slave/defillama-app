// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { readAppStorage } from '~/contexts/LocalStorage'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
const session = installSubscriberSession('welcome-user')
import { installUmamiSink } from '~/utils/testing/umamiSink'
const track = installUmamiSink()
import { WelcomeOnboarding } from '../WelcomeOnboarding'
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/router', () => ({ default: { push }, useRouter: () => ({ push, isReady: true, query: {} }) }))
let root: Root
let container: HTMLDivElement
beforeEach(async () => {
	vi.clearAllMocks()
	sessionStorage.clear()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<WelcomeOnboarding />
			</session.Wrapper>
		)
	)
	await waitForUi(() => {
		if (!container.textContent?.includes('Pick all that apply')) throw new Error('Onboarding choices have not loaded')
	})
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
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
	expect(readAppStorage().ONBOARDING_INTENT).toBeUndefined()
	expect(readAppStorage().LLAMA_AI_WALKTHROUGH_STATE).toBeUndefined()
})

test('CSV-only intent preserves the return URL and writes once on continue', async () => {
	sessionStorage.setItem('onboarding_returnUrl', '/downloads?mode=sql')
	await space(choice('CSV Downloads'))
	await act(async () => continueButton().click())
	expect(readAppStorage().ONBOARDING_INTENT).toEqual(['csv'])
	expect(push).toHaveBeenCalledExactlyOnceWith('/downloads?mode=sql')
	expect(sessionStorage.getItem('onboarding_returnUrl')).toBeNull()
})

test('multiple features keep routing priority and arm LlamaAI only on continue', async () => {
	await space(choice('CSV Downloads'))
	await space(choice('LlamaAI'))
	expect(readAppStorage().LLAMA_AI_WALKTHROUGH_STATE).toBeUndefined()
	await act(async () => continueButton().click())
	expect(readAppStorage()).toMatchObject({ LLAMA_AI_WALKTHROUGH_STATE: 'armed', ONBOARDING_INTENT: ['csv', 'llamaai'] })
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
	expect(readAppStorage().ONBOARDING_INTENT).toEqual(['exploring'])
})

test('onboarding still renders when browser policy denies session storage', async () => {
	// Reading window.sessionStorage throws by itself when storage is denied, so guarding only the
	// getItem call is not enough: the access has to sit inside the try too.
	const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage')
	Object.defineProperty(window, 'sessionStorage', {
		configurable: true,
		get() {
			throw new Error('The operation is insecure.')
		}
	})
	const deniedContainer = document.body.appendChild(document.createElement('div'))
	const deniedRoot = createRoot(deniedContainer)
	try {
		await act(async () =>
			deniedRoot.render(
				<session.Wrapper>
					<WelcomeOnboarding />
				</session.Wrapper>
			)
		)
		expect(deniedContainer.querySelectorAll('button').length).toBeGreaterThan(0)
		expect(track).not.toHaveBeenCalledWith('llamaai-trial-activated', expect.anything())
	} finally {
		await act(async () => deniedRoot.unmount())
		deniedContainer.remove()
		if (original) Object.defineProperty(window, 'sessionStorage', original)
	}
})
