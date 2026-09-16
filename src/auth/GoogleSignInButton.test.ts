// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { GoogleSignInButton, revokeGoogleCredentialSharing } from './GoogleSignInButton'

vi.mock('next/script', () => ({ default: () => null }))

function installGoogleRevocation(
	revoke: (loginHint: string, callback: (response: { error?: string; successful: boolean }) => void) => void
) {
	window.google = {
		accounts: {
			id: {
				initialize: vi.fn(),
				renderButton: vi.fn(),
				revoke
			}
		}
	}
}

afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
	delete window.google
})

test('revokes Google credential sharing once for the deleted account', async () => {
	const revoke = vi.fn((_loginHint, callback) => callback({ successful: true }))
	installGoogleRevocation(revoke)

	await expect(revokeGoogleCredentialSharing('person@example.com')).resolves.toBeUndefined()

	expect(revoke).toHaveBeenCalledOnce()
	expect(revoke).toHaveBeenCalledWith('person@example.com', expect.any(Function))
})

test('reports the Google revocation response error', async () => {
	installGoogleRevocation((_loginHint, callback) => callback({ error: 'No active Google session', successful: false }))

	await expect(revokeGoogleCredentialSharing('person@example.com')).rejects.toThrow('No active Google session')
})

test('times out when Google never completes credential revocation', async () => {
	vi.useFakeTimers()
	installGoogleRevocation(vi.fn())

	// eslint-disable-next-line vitest/valid-expect -- the assertion promise is awaited below, after the fake timers advance
	const revocation = expect(revokeGoogleCredentialSharing('person@example.com')).rejects.toThrow(
		'Google credential revocation timed out'
	)
	await vi.advanceTimersByTimeAsync(10_000)

	await revocation
})

test('recovers from a failed Google script and ignores credentials after unmount', async () => {
	vi.useFakeTimers()
	const container = document.createElement('div')
	document.body.appendChild(container)
	const root = createRoot(container)
	const onCredential = vi.fn()
	await act(async () => root.render(createElement(GoogleSignInButton, { loading: false, onCredential })))
	await act(async () => {
		vi.advanceTimersByTime(10_000)
	})
	expect(container.querySelector('[role="alert"]')?.textContent).toContain('Google could not load.')
	// Deliver the script load ourselves; the test must not contact Google.
	let script!: HTMLScriptElement
	vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
		script = node as HTMLScriptElement
		return node
	})
	await act(async () => container.querySelector('button')!.click())
	let deliver!: (response: { credential: string; state: string }) => void
	const renderButton = vi.fn()
	window.google = {
		accounts: {
			id: {
				initialize: (options) => {
					deliver = options.callback
				},
				renderButton,
				revoke: vi.fn()
			}
		}
	}
	await act(async () => script.dispatchEvent(new Event('load')))
	expect(container.querySelector('[role="alert"]')).toBeNull()
	const state = renderButton.mock.calls[0][1].state
	deliver({ credential: 'accepted', state })
	expect(onCredential).toHaveBeenCalledWith('accepted')
	await act(async () => root.unmount())
	deliver({ credential: 'late', state })
	expect(onCredential).toHaveBeenCalledOnce()
	script.remove()
	container.remove()
})

test('updates the official Google button for theme and width changes without replaying credentials', async () => {
	const { THEME_SYNC_KEY } = await import('~/contexts/LocalStorage')
	const { notifyKeyChange } = await import('~/contexts/localStorageStore')
	const { setThemeCookie } = await import('~/utils/cookies')
	setThemeCookie(true)
	let resize!: () => void
	const disconnect = vi.fn()
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(callback: () => void) {
				resize = callback
			}
			observe() {}
			disconnect = disconnect
		}
	)
	const container = document.createElement('div')
	document.body.appendChild(container)
	const root = createRoot(container)
	const renderButton = vi.fn()
	const onCredential = vi.fn()
	installGoogleRevocation(vi.fn())
	window.google!.accounts.id.renderButton = renderButton
	try {
		await act(async () => root.render(createElement(GoogleSignInButton, { loading: false, onCredential })))
		expect(renderButton).toHaveBeenLastCalledWith(
			expect.any(HTMLElement),
			expect.objectContaining({ theme: 'outline_dark' })
		)
		const target = renderButton.mock.lastCall![0] as HTMLElement
		Object.defineProperty(target, 'clientWidth', { configurable: true, value: 343 })
		await act(async () => resize())
		expect(renderButton).toHaveBeenLastCalledWith(target, expect.objectContaining({ width: 343 }))
		await act(async () => {
			setThemeCookie(false)
			notifyKeyChange(THEME_SYNC_KEY)
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		expect(renderButton).toHaveBeenLastCalledWith(target, expect.objectContaining({ theme: 'outline', width: 343 }))
		expect(onCredential).not.toHaveBeenCalled()
	} finally {
		await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
		setThemeCookie(true)
	}
	expect(disconnect).toHaveBeenCalled()
})
