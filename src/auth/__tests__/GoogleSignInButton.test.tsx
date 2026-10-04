// @vitest-environment happy-dom

import { act, createElement, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { GoogleSignInButton, revokeGoogleCredentialSharing } from '../GoogleSignInButton'

vi.mock('next/script', () => ({
	default: function GoogleScript({ onReady }: { onReady: () => void }) {
		useEffect(() => {
			if (window.google) onReady()
		}, [onReady])
		return null
	}
}))

function installGoogleRevocation(
	revoke: (loginHint: string, callback: (response: { error?: string; successful: boolean }) => void) => void
) {
	window.google = {
		accounts: {
			id: {
				revoke
			},
			oauth2: { initCodeClient: vi.fn(() => ({ requestCode: vi.fn() })) }
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

type CodeOptions = Parameters<NonNullable<Window['google']>['accounts']['oauth2']['initCodeClient']>[0]

async function mountButton(props: Omit<Parameters<typeof GoogleSignInButton>[0], 'onStart'>) {
	const container = document.createElement('div')
	document.body.appendChild(container)
	const root = createRoot(container)
	await act(async () => root.render(createElement(GoogleSignInButton, { ...props, onStart: vi.fn() })))
	return {
		container,
		root,
		button: container.querySelector('button')!,
		async unmount() {
			await act(async () => root.unmount())
			container.remove()
		}
	}
}

function installGooglePopup() {
	installGoogleRevocation(vi.fn())
	let options!: CodeOptions
	const requestCode = vi.fn()
	window.google!.accounts.oauth2.initCodeClient = (config) => {
		options = config
		return { requestCode }
	}
	return {
		requestCode,
		get options() {
			return options
		}
	}
}

test('opens the popup from our button and delivers each code only once', async () => {
	const google = installGooglePopup()
	const onCode = vi.fn()
	const view = await mountButton({ loading: false, onCode, lastUsed: true })
	try {
		expect(view.button.textContent).toContain('Continue with Google')
		expect(view.button.textContent).toContain('Last used')
		await act(async () => view.button.click())
		expect(google.requestCode).toHaveBeenCalledOnce()
		expect(google.options).toMatchObject({ scope: 'openid email profile', ux_mode: 'popup' })
		expect(view.button.disabled).toBe(true)
		await act(async () => google.options.callback({ code: 'popup-code' }))
		expect(onCode).toHaveBeenCalledWith('popup-code')
		await act(async () => google.options.callback({ code: 'duplicate' }))
		expect(onCode).toHaveBeenCalledOnce()
	} finally {
		await view.unmount()
	}
})

test.each(['popup_closed', 'popup_failed_to_open'])('recovers after %s so the user can try again', async (type) => {
	const google = installGooglePopup()
	const onCode = vi.fn()
	const view = await mountButton({ loading: false, onCode })
	try {
		await act(async () => view.button.click())
		await act(async () => google.options.error_callback({ type }))
		expect(view.button.disabled).toBe(false)
		expect(Boolean(view.container.querySelector('[role="alert"]'))).toBe(type !== 'popup_closed')
		expect(onCode).not.toHaveBeenCalled()
		await act(async () => view.button.click())
		expect(google.requestCode).toHaveBeenCalledTimes(2)
	} finally {
		await view.unmount()
	}
})

test('does not exchange a denied authorization and keeps its error on screen while the retry waits', async () => {
	const google = installGooglePopup()
	const onCode = vi.fn()
	const view = await mountButton({ loading: false, onCode })
	try {
		await act(async () => view.button.click())
		await act(async () => google.options.callback({ error: 'access_denied' }))
		expect(view.container.querySelector('[role="alert"]')?.textContent).toBe(
			'Google sign-in did not finish. Try again.'
		)
		expect(view.button.disabled).toBe(false)
		expect(onCode).not.toHaveBeenCalled()
		await act(async () => view.button.click())
		expect(view.button.getAttribute('aria-busy')).toBe('true')
		expect(view.button.textContent).toContain('Waiting for Google…')
		expect(view.container.querySelector('[role="alert"]')?.textContent).toBe(
			'Google sign-in did not finish. Try again.'
		)
		await act(async () => google.options.callback({ code: 'retry-code' }))
		expect(onCode).toHaveBeenCalledWith('retry-code')
		expect(view.container.querySelector('[role="alert"]')).toBeNull()
	} finally {
		await view.unmount()
	}
})

test('ignores callbacks after unmount', async () => {
	const google = installGooglePopup()
	const onCode = vi.fn()
	const view = await mountButton({ loading: false, onCode })
	await act(async () => view.button.click())
	await view.unmount()
	google.options.callback({ code: 'late-code' })
	expect(onCode).not.toHaveBeenCalled()
})

test('abandons the old popup when another method takes over but accepts a fresh attempt', async () => {
	const google = installGooglePopup()
	const onCode = vi.fn()
	const view = await mountButton({ loading: false, onCode })
	try {
		await act(async () => view.button.click())
		await act(async () =>
			view.root.render(createElement(GoogleSignInButton, { loading: false, disabled: true, onCode, onStart: vi.fn() }))
		)
		const oldPopup = google.options
		await act(async () =>
			view.root.render(createElement(GoogleSignInButton, { loading: false, onCode, onStart: vi.fn() }))
		)
		await act(async () => oldPopup.callback({ code: 'late-code' }))
		expect(onCode).not.toHaveBeenCalled()
		expect(view.button.disabled).toBe(false)
		await act(async () => view.button.click())
		await act(async () => oldPopup.error_callback({ type: 'popup_closed' }))
		expect(view.button.disabled).toBe(true)
		await act(async () => google.options.callback({ code: 'fresh-code' }))
		expect(onCode).toHaveBeenCalledWith('fresh-code')
		expect(onCode).toHaveBeenCalledOnce()
	} finally {
		await view.unmount()
	}
})

test.each([{ loading: true }, { loading: false, disabled: true }])(
	'does not open Google when disabled: %j',
	async (props) => {
		const google = installGooglePopup()
		const view = await mountButton({ ...props, onCode: vi.fn() })
		try {
			await act(async () => view.button.click())
			expect(google.requestCode).not.toHaveBeenCalled()
			expect(view.button.disabled).toBe(true)
		} finally {
			await view.unmount()
		}
	}
)

test('recovers from a script timeout using the retry button', async () => {
	vi.useFakeTimers()
	const view = await mountButton({ loading: false, onCode: vi.fn() })
	try {
		await act(async () => {
			vi.advanceTimersByTime(10_000)
		})
		expect(view.container.querySelector('[role="alert"]')?.textContent).toContain('Google could not load.')
		let script!: HTMLScriptElement
		vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
			script = node as HTMLScriptElement
			return node
		})
		await act(async () =>
			Array.from(view.container.querySelectorAll('button'))
				.find((button) => button.textContent?.trim() === 'Try again')!
				.click()
		)
		const google = installGooglePopup()
		await act(async () => script.dispatchEvent(new Event('load')))
		expect(view.container.querySelector('[role="alert"]')).toBeNull()
		expect(view.button.disabled).toBe(false)
		await act(async () => view.button.click())
		expect(google.requestCode).toHaveBeenCalledOnce()
	} finally {
		await view.unmount()
	}
})

test('a retry that loads Google moves focus to the Google button', async () => {
	vi.useFakeTimers()
	const view = await mountButton({ loading: false, onCode: vi.fn() })
	try {
		await act(async () => {
			vi.advanceTimersByTime(10_000)
		})
		const retry = [...view.container.querySelectorAll('button')].find(
			(button) => accessibleName(button) === 'Try again'
		)!
		// Google is reachable by the time the visitor retries.
		installGooglePopup()
		await act(async () => retry.focus())
		await act(async () => retry.click())

		expect(document.activeElement).toBe(view.button)
	} finally {
		await view.unmount()
	}
})
