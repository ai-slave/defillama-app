// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com"}

import * as Ariakit from '@ariakit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useSyncExternalStore } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { signInWithPassword } from '~/auth/emailSignIn'
import { signupWithEmail, type SignupRequest } from '~/auth/emailSignup'
import { rememberSignIn } from '~/auth/lastSignIn'
import pb from '~/utils/pocketbase'
import { SignInDialog, SignInFlow } from './SignInDialog'

const oauth = vi.hoisted(() => ({ google: vi.fn(), github: vi.fn() }))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		login: signInWithPassword,
		signup: (request: SignupRequest) => signupWithEmail(request, () => {}),
		signInWithGoogle: oauth.google,
		signInWithGithub: oauth.github,
		loaders: {},
		resetPasswordMutation: { isPending: false }
	})
}))
vi.mock('~/auth/GoogleSignInButton', () => ({
	GoogleSignInButton: ({
		onCredential,
		loading,
		disabled
	}: {
		onCredential: (token: string) => void
		loading: boolean
		disabled: boolean
	}) => (
		<button type="button" disabled={loading || disabled} onClick={() => onCredential('fixture-token')}>
			Continue with Google
		</button>
	)
}))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('~/containers/Subscription/Turnstile', () => ({
	Turnstile: ({ onVerify }: { onVerify: (token: string) => void }) => (
		<button type="button" onClick={() => onVerify('test-captcha')}>
			Test CAPTCHA
		</button>
	)
}))

let root: Root
let container: HTMLDivElement
let client: QueryClient
let dialog: Ariakit.DialogStore
let onAuthenticated: ReturnType<typeof vi.fn<() => void>>
let hideOnAuthentication = false
const subscribe = (notify: () => void) => pb.authStore.onChange(notify)
function Harness() {
	const token = useSyncExternalStore(
		subscribe,
		() => pb.authStore.token,
		() => ''
	)
	dialog = Ariakit.useDialogStore({ defaultOpen: true })
	return (
		<Ariakit.DialogProvider store={dialog}>
			{hideOnAuthentication && token ? null : <SignInFlow dialogStore={dialog} onAuthenticated={onAuthenticated} />}
		</Ariakit.DialogProvider>
	)
}

let requests: Array<{ resolve: (response: Response) => void; reject: (error: Error) => void }>

beforeEach(async () => {
	hideOnAuthentication = false
	localStorage.clear()
	pb.authStore.clear()
	oauth.google.mockReset()
	oauth.github.mockReset()
	requests = []
	vi.stubGlobal(
		'fetch',
		vi.fn(() => new Promise<Response>((resolve, reject) => requests.push({ resolve, reject })))
	)
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	client = new QueryClient()
	onAuthenticated = vi.fn()
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Harness />
			</QueryClientProvider>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
	pb.authStore.clear()
})
const input = (name: string) => container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
async function submit() {
	input('email').value = 'person@example.com'
	input('password').value = 'correct horse battery staple'
	await act(async () =>
		container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
	await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
}
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
const success = () => new Response(JSON.stringify({ token: 'accepted-token', record: { id: 'account-a' } }))

test('keeps credentials on network failure, shows it inline, and allows a successful retry', async () => {
	await submit()
	expect(input('email').disabled).toBe(true)
	expect(input('password').disabled).toBe(true)
	expect(container.textContent).toContain('Signing in...')
	requests[0].reject(new TypeError('Failed to fetch'))
	await settle()
	expect(container.querySelector('[role="alert"]')?.textContent).toContain('Check your connection')
	expect(document.activeElement).not.toBe(container.querySelector('[role="alert"]'))
	expect(input('email').value).toBe('person@example.com')
	expect(input('password').value).toBe('correct horse battery staple')
	expect(input('password').disabled).toBe(false)
	expect(localStorage.getItem('last-sign-in')).toBeNull()
	await submit()
	requests[1].resolve(success())
	await settle()
	expect(pb.authStore.record?.id).toBe('account-a')
	expect(JSON.parse(localStorage.getItem('last-sign-in')!)).toEqual({ method: 'email' })
	expect(onAuthenticated).toHaveBeenCalledOnce()
	expect(dialog.getState().open).toBe(false)
})

test('does not sign in when the dialog closes before the response', async () => {
	await act(async () => rememberSignIn({ method: 'github' }))
	await submit()
	await act(async () => dialog.hide())
	requests[0].resolve(success())
	await settle()
	expect(pb.authStore.token).toBe('')
	expect(JSON.parse(localStorage.getItem('last-sign-in')!)).toEqual({ method: 'github' })
	expect(onAuthenticated).not.toHaveBeenCalled()
})

test('ignores the old request after switching screens, without contaminating a new attempt', async () => {
	await submit()
	const reset = Array.from(container.querySelectorAll('button')).find(
		(button) => button.textContent === 'Forgot password?'
	)!
	await act(async () => reset.click())
	expect(input('email').value).toBe('person@example.com')
	const back = Array.from(container.querySelectorAll('button')).find(
		(button) => button.getAttribute('aria-label') === 'Back to sign in'
	)!
	await act(async () => back.click())
	await submit()
	requests[0].resolve(success())
	await settle()
	expect(pb.authStore.token).toBe('')
	expect(onAuthenticated).not.toHaveBeenCalled()
	expect(container.querySelector('[role="alert"]')).toBeNull()
	requests[1].resolve(success())
	await settle()
	expect(onAuthenticated).toHaveBeenCalledOnce()
})

test('preserves signup fields after failure and requires a fresh CAPTCHA for retry', async () => {
	const signupTab = Array.from(container.querySelectorAll('button')).find(
		(button) => button.textContent === 'Create an account'
	)!
	await act(async () => signupTab.click())
	input('email').value = 'new@example.com'
	input('password').value = 'password123'
	input('passwordConfirm').value = 'password123'
	const captcha = () =>
		Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Test CAPTCHA')!
	await act(async () => captcha().click())
	await act(async () =>
		container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
	await settle()
	expect(input('email').disabled).toBe(true)
	requests[0].resolve(new Response(JSON.stringify({ error: 'User with this email already exists' }), { status: 400 }))
	await vi.waitFor(async () => {
		await settle()
		expect(container.querySelector('[role="alert"]')?.textContent).toContain('already exists')
	})
	expect(input('email').value).toBe('new@example.com')
	expect(input('passwordConfirm').value).toBe('password123')
	await act(async () =>
		container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
	expect(requests).toHaveLength(1)
	expect(container.querySelector('[role="alert"]')?.textContent).toContain('CAPTCHA')
	await act(async () => captcha().click())
	await act(async () =>
		container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
	await settle()
	expect(requests).toHaveLength(2)
	requests[1].resolve(
		new Response(
			JSON.stringify({ token: 'new-token', user: { id: 'new-user', email: 'new@example.com', verified: false } })
		)
	)
	await settle()
	expect(onAuthenticated).toHaveBeenCalledOnce()
})

test('keeps password recovery in the sheet with inline retry and an email-link confirmation', async () => {
	await act(async () =>
		Array.from(container.querySelectorAll('button'))
			.find((button) => button.textContent === 'Forgot password?')!
			.click()
	)
	input('email').value = 'person@example.com'
	await act(async () =>
		container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
	await settle()
	expect(input('email').disabled).toBe(true)
	requests[0].reject(new TypeError('Offline'))
	await vi.waitFor(async () => {
		await settle()
		expect(container.querySelector('[role="alert"]')?.textContent).toContain('Check your connection')
	})
	expect(input('email').value).toBe('person@example.com')
	await act(async () =>
		container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
	await settle()
	requests[1].resolve(new Response(null, { status: 204 }))
	await vi.waitFor(async () => {
		await settle()
		expect(container.querySelector('[role="status"]')?.textContent).toContain('password reset link')
	})
	expect(container.textContent).toContain('person@example.com')
	expect(onAuthenticated).not.toHaveBeenCalled()
	expect(pb.authStore.token).toBe('')
})

test.each(['signin', 'signup'] as const)(
	'prevents a repeated %s submission while the request is pending',
	async (mode) => {
		const label = mode === 'signup' ? 'Create an account' : 'Sign in'
		const modeButton = () => container.querySelector<HTMLButtonElement>(`button[type="submit"]`)!
		if (mode === 'signup') {
			await act(async () =>
				Array.from(container.querySelectorAll('button'))
					.find((button) => button.textContent === label)!
					.click()
			)
			input('passwordConfirm').value = 'correct horse battery staple'
			await act(async () =>
				Array.from(container.querySelectorAll('button'))
					.find((button) => button.textContent === 'Test CAPTCHA')!
					.click()
			)
		}
		await submit()
		await act(async () => modeButton().click())
		requests[0].resolve(
			mode === 'signup'
				? new Response(
						JSON.stringify({
							token: 'accepted-token',
							user: { id: 'account-a', email: 'person@example.com', verified: false }
						})
					)
				: success()
		)
		await vi.waitFor(async () => {
			await settle()
			expect(onAuthenticated).toHaveBeenCalledOnce()
		})
		expect(requests).toHaveLength(1)
	}
)

test.each(['person@example.com', ''])(
	'starts recovery with the sign-in email "%s" and allows a different recipient',
	async (email) => {
		input('email').value = email
		await act(async () =>
			Array.from(container.querySelectorAll('button'))
				.find((button) => button.textContent === 'Forgot password?')!
				.click()
		)
		expect(input('email').value).toBe(email)
		expect(requests).toHaveLength(0)
		input('email').value = 'other@example.com'
		await act(async () =>
			container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
		)
		await settle()
		const [, options] = vi.mocked(fetch).mock.calls[0]
		expect(JSON.parse(String(options?.body))).toEqual({ email: 'other@example.com' })
		requests[0].resolve(new Response(null, { status: 204 }))
		await vi.waitFor(async () => {
			await settle()
			expect(container.querySelector('[role="status"]')?.textContent).toContain('other@example.com')
		})
		await act(async () =>
			Array.from(container.querySelectorAll('button'))
				.find((button) => button.textContent === 'Use another email')!
				.click()
		)
		expect(input('email').value).toBe('')
		expect(requests).toHaveLength(1)
	}
)

test.each(['close', 'navigate'])('ignores a Google challenge returned after %s', async (exit) => {
	let finish!: (value: unknown) => void
	oauth.google.mockImplementation(
		() =>
			new Promise((resolve) => {
				finish = resolve
			})
	)
	const google = Array.from(container.querySelectorAll('button')).find(
		(button) => button.textContent === 'Continue with Google'
	)!
	await act(async () => google.click())
	await settle()
	expect(input('email').disabled).toBe(true)
	const signal = oauth.google.mock.calls[0][0].signal as AbortSignal
	if (exit === 'close') await act(async () => root.render(null))
	else
		await act(async () =>
			Array.from(container.querySelectorAll('button'))
				.find((button) => button.textContent === 'Create an account')!
				.click()
		)
	expect(signal.aborted).toBe(true)
	finish({
		kind: 'link_verification_required',
		challengeToken: 'late',
		expiresAt: new Date(Date.now() + 60_000).toISOString(),
		resendAfter: new Date().toISOString()
	})
	await settle()
	expect(container.textContent).not.toContain('Confirm your email')
	expect(onAuthenticated).not.toHaveBeenCalled()
})

test('keeps other sign-in methods available when the GitHub popup is blocked', async () => {
	vi.stubGlobal(
		'open',
		vi.fn(() => null)
	)
	const github = Array.from(container.querySelectorAll('button')).find((button) =>
		button.textContent?.includes('Continue with GitHub')
	)!
	await act(async () => github.click())
	await settle()
	expect(container.querySelector('[role="alert"]')?.textContent).toBe('Allow popups to continue with GitHub.')
	expect(
		github.compareDocumentPosition(container.querySelector('[role="alert"]')!) & Node.DOCUMENT_POSITION_FOLLOWING
	).toBeTruthy()
	expect(oauth.github).not.toHaveBeenCalled()
	expect(input('email').disabled).toBe(false)

	oauth.google.mockRejectedValue(new Error('Could not sign in with Google.'))
	const google = Array.from(container.querySelectorAll('button')).find(
		(button) => button.textContent === 'Continue with Google'
	)!
	await act(async () => google.click())
	await settle()
	expect(container.querySelectorAll('[role="alert"]')).toHaveLength(1)
	expect(
		google.compareDocumentPosition(container.querySelector('[role="alert"]')!) & Node.DOCUMENT_POSITION_FOLLOWING
	).toBeTruthy()
	expect(
		container.querySelector('[role="alert"]')!.compareDocumentPosition(github) & Node.DOCUMENT_POSITION_FOLLOWING
	).toBeTruthy()
	expect(container.querySelector('[role="alert"]')?.textContent).toBe('Could not sign in with Google.')
	expect(container.textContent).not.toContain('Allow popups')
	expect(container.querySelector('form')!.hasAttribute('aria-describedby')).toBe(false)

	await submit()
	expect(container.querySelector('[role="alert"]')).toBeNull()
	requests[0].reject(new TypeError('Failed to fetch'))
	await settle()
	const alert = container.querySelector('[role="alert"]')!
	expect(container.querySelector('form')!.contains(alert)).toBe(true)
	expect(container.querySelector('form')!.getAttribute('aria-describedby')).toBe(alert.id)
})

test('finishes sign-in even when accepting the session unmounts the form', async () => {
	hideOnAuthentication = true
	await submit()
	requests[0].resolve(success())
	await settle()
	expect(onAuthenticated).toHaveBeenCalledOnce()
	expect(dialog.getState().open).toBe(false)
	await act(async () => pb.authStore.clear())
	expect(dialog.getState().open).toBe(false)
})

test.each([
	{ method: 'google', label: 'Continue with Google' },
	{ method: 'github', label: 'Continue with GitHub' },
	{ method: 'email', label: 'Sign in' },
	{ method: 'wallet', connectorId: 'io.rabby', label: 'Sign in with a wallet' }
] as const)(
	'keeps the last successful $method usable and only badges methods outside the Google iframe',
	async ({ label, ...method }) => {
		await act(async () => rememberSignIn(method))
		expect(container.textContent?.match(/Last used/g) ?? []).toHaveLength(method.method === 'google' ? 0 : 1)
		const markedButtons = Array.from(container.querySelectorAll('button')).filter((button) =>
			button.textContent?.includes('Last used')
		)
		expect(markedButtons.map((button) => button.textContent?.includes(label))).toEqual(
			method.method === 'google' ? [] : [true]
		)
		for (const text of ['Continue with Google', 'Continue with GitHub', 'Sign in', 'Sign in with a wallet']) {
			expect(
				Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.startsWith(text))
					?.disabled
			).toBe(false)
		}
		expect(requests).toHaveLength(0)
		expect(input('email').value).toBe('')
		expect(pb.authStore.token).toBe('')
	}
)

test.each(['not json', '{"method":"wallet"}', '{"method":"unknown"}', 'null'])(
	'ignores an invalid remembered method: %s',
	async (value) => {
		await act(async () => {
			localStorage.setItem('last-sign-in', value)
			window.dispatchEvent(new Event('storage'))
		})
		expect(container.textContent).not.toContain('Last used')
		expect(requests).toHaveLength(0)
	}
)

test('unavailable remembered-method storage leaves every method usable without an error', async () => {
	const availableStorage = window.localStorage
	vi.stubGlobal('localStorage', {
		getItem: () => {
			throw new Error('Storage blocked')
		},
		setItem: () => {
			throw new Error('Storage blocked')
		}
	})
	try {
		await act(async () => {
			rememberSignIn({ method: 'email' })
			window.dispatchEvent(new Event('storage'))
		})
		expect(container.textContent).not.toContain('Last used')
		expect(container.querySelector('[role="alert"]')).toBeNull()
		for (const label of ['Continue with Google', 'Continue with GitHub', 'Sign in', 'Sign in with a wallet']) {
			expect(
				Array.from(container.querySelectorAll('button')).find((button) => button.textContent === label)?.disabled
			).toBe(false)
		}
		expect(requests).toHaveLength(0)
	} finally {
		vi.stubGlobal('localStorage', availableStorage)
	}
})

test('focuses the heading on opening and navigation without stealing focus for a last-used update', async () => {
	function DialogHarness() {
		const store = Ariakit.useDialogStore({ defaultOpen: true })
		return <SignInDialog store={store} />
	}
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<DialogHarness />
			</QueryClientProvider>
		)
	)
	await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('Sign in'))
	expect(document.activeElement?.tagName).toBe('H2')
	await act(async () => document.querySelector<HTMLInputElement>('input[name="email"]')!.focus())
	await act(async () => rememberSignIn({ method: 'github' }))
	expect(document.activeElement).toBe(document.querySelector<HTMLInputElement>('input[name="email"]')!)
	await act(async () =>
		Array.from(document.querySelectorAll('button'))
			.find((button) => button.textContent === 'Create an account')!
			.click()
	)
	await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('Create an account'))
	expect(document.activeElement?.tagName).toBe('H2')
})

test.each(['google', 'github'] as const)(
	'offers %s on signup and cancels it when returning to sign-in',
	async (method) => {
		await act(async () =>
			Array.from(container.querySelectorAll('button'))
				.find((button) => button.textContent === 'Create an account')!
				.click()
		)
		expect(container.textContent).not.toContain('Sign in with a wallet')
		const popup = { close: vi.fn() } as unknown as Window
		vi.spyOn(window, 'open').mockReturnValue(popup)
		let finish!: (result: unknown) => void
		oauth[method].mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve
				})
		)
		await act(async () =>
			Array.from(container.querySelectorAll('button'))
				.find(
					(button) => button.textContent === (method === 'google' ? 'Continue with Google' : 'Continue with GitHub')
				)!
				.click()
		)
		await settle()
		expect(input('email').disabled).toBe(true)
		expect(input('password').disabled).toBe(true)
		expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true)
		const request = oauth[method].mock.calls[0][0]
		await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Back to sign in"]')!.click())
		expect(request.signal.aborted).toBe(true)
		finish(null)
		await settle()
		expect(input('email').disabled).toBe(false)
		expect(container.textContent).toContain('Sign in with a wallet')
		expect(container.querySelector('[role="alert"]')).toBeNull()
		expect(onAuthenticated).not.toHaveBeenCalled()
		vi.restoreAllMocks()
	}
)
