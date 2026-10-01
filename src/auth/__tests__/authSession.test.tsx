// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com"}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider, useAuthContext } from '~/auth'
import { OtpRequestError, verifyEmailCode } from '~/auth/emailVerification'
import { useTeam } from '~/containers/Account/Team/useTeam'
import pb from '~/utils/pocketbase'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installOAuthBoundary } from '~/utils/testing/oauthBoundary'
import { waitForUi } from '~/utils/testing/waitForUi'

const oauth = installOAuthBoundary()

const token = (id: string) => `e30.${btoa(JSON.stringify({ id, exp: 4_102_444_800 }))}.signature`
const record = (id: string) => ({ id, collectionId: '_pb_users_auth_', collectionName: 'users' })

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

let sessionView: ReturnType<typeof useAuthContext>
function Probe() {
	sessionView = useAuthContext()
	return null
}

let root: Root
let client: QueryClient
let container: HTMLDivElement
let otpCalls: Array<{ path: string; authorization: string | null; resolve: (response: Response) => void }>
let inviteView: ReturnType<typeof useTeam>
function InviteProbe() {
	inviteView = useTeam({ inviteToken: 'invite-token' })
	return (
		<output aria-label="Invite account">
			{inviteView.inviteAccount.data?.verified ? 'Verified' : inviteView.inviteAccount.status}
		</output>
	)
}
let inviteCalls: Array<{ resolve: (response: Response) => void }>
let signupCalls: Array<{ resolve: (response: Response) => void }>
let loginVerified: boolean
let refreshCalls: Array<{ authorization: string | null; resolve: (response: Response) => void }>

beforeEach(() => {
	refreshCalls = []
	otpCalls = []
	loginVerified = false
	signupCalls = []
	inviteCalls = []
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string | URL, config?: RequestInit) => {
			const oauthRoute = oauth.routes[new URL(String(url)).pathname]
			if (oauthRoute) return oauthRoute()
			if (String(url).endsWith('/team/invite/accept'))
				return new Promise<Response>((resolve) => inviteCalls.push({ resolve }))
			if (String(url).endsWith('/team')) return jsonResponse({ team: null })
			if (String(url).endsWith('/auth/signup')) return new Promise<Response>((resolve) => signupCalls.push({ resolve }))
			if (String(url).endsWith('/auth/login')) {
				return jsonResponse({
					token: token('email-user'),
					record: { ...record('email-user'), email: 'person@example.com', verified: loginVerified }
				})
			}
			if (String(url).endsWith('/sendOtp') || String(url).endsWith('/verifyOtp')) {
				return new Promise<Response>((resolve) =>
					otpCalls.push({
						path: String(url),
						authorization: new Headers(config?.headers).get('Authorization'),
						resolve
					})
				)
			}
			if (String(url).endsWith('/subscription/status')) {
				return jsonResponse({ message: 'No active subscription' }, 404)
			}
			if (String(url).endsWith('/auth/google-code-signin')) {
				return jsonResponse({
					isNew: true,
					kind: 'authenticated',
					token: token('google-new'),
					user: { email: 'new@example.com', id: 'google-new', verified: true }
				})
			}
			if (String(url).endsWith('/user/attribution')) {
				return jsonResponse({ ok: true })
			}
			if (!String(url).endsWith('/api/collections/users/auth-refresh')) {
				throw new Error(`Unexpected fetch in test: ${url}`)
			}
			return new Promise<Response>((resolve, reject) => {
				// The PocketBase SDK auto-cancels an in-flight request when another one
				// with the same key starts; a real fetch rejects on abort, so mirror that.
				config?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
				refreshCalls.push({ authorization: new Headers(config?.headers).get('Authorization'), resolve })
			})
		})
	)
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	vi.useRealTimers()
	container.remove()
	vi.unstubAllGlobals()
	pb.authStore.clear()
	localStorage.clear()
	sessionStorage.clear()
})

async function render() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<AuthProvider>
					<Probe />
				</AuthProvider>
			</QueryClientProvider>
		)
	)
}

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

test('fills a token-only session from the refresh and keeps it signed in', async () => {
	pb.authStore.save(token('account-a'))
	await render()

	expect(refreshCalls).toHaveLength(1)
	expect(refreshCalls[0].authorization).toBe(token('account-a'))
	refreshCalls[0].resolve(jsonResponse({ token: token('rotated-a'), record: record('account-a') }))
	await settle()

	expect(pb.authStore.token).toBe(token('rotated-a'))
	expect(sessionView.isAuthenticated).toBe(true)
	expect(sessionView.user?.id).toBe('account-a')
})

test('treats a saved session whose token has expired as signed out', async () => {
	pb.authStore.save(`e30.${btoa(JSON.stringify({ id: 'expired', exp: 1_000_000_000 }))}.signature`, record('expired'))
	await render()
	await settle()

	expect(sessionView.isAuthenticated).toBe(false)
	expect(sessionView.authToken).toBeNull()
	expect(refreshCalls).toHaveLength(0)
})

test('stays signed out when a refresh resolves after logout', async () => {
	pb.authStore.save(token('account-a'), record('account-a'))
	await render()

	expect(refreshCalls).toHaveLength(1)
	await act(async () => sessionView.logout())
	expect(sessionView.isAuthenticated).toBe(false)

	refreshCalls[0].resolve(jsonResponse({ token: token('rotated-a'), record: record('account-a') }))
	await settle()

	expect(pb.authStore.isValid).toBe(false)
	expect(sessionView.isAuthenticated).toBe(false)
	expect(sessionView.user).toBeNull()
})

test('clears the session when its own refresh fails with 401', async () => {
	pb.authStore.save(token('account-a'), record('account-a'))
	await render()

	expect(refreshCalls).toHaveLength(1)
	refreshCalls[0].resolve(
		jsonResponse({ code: 401, message: 'The request requires valid record authorization token.' }, 401)
	)
	await settle()

	expect(pb.authStore.isValid).toBe(false)
	expect(sessionView.isAuthenticated).toBe(false)
})

test('accepts Google identity before one account refresh and keeps onboarding open', async () => {
	await render()

	const signIn = act(async () => {
		await sessionView.signInWithGoogle({
			code: 'popup-code',
			signal: new AbortController().signal,
			canAccept: () => true
		})
	})
	await settle()

	await signIn
	expect(fetch).toHaveBeenCalledWith(
		expect.stringContaining('/auth/google-code-signin'),
		expect.objectContaining({
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XmlHttpRequest' },
			body: JSON.stringify({ code: 'popup-code', signupClient: 'web', source: 'subscription-page' })
		})
	)

	expect(refreshCalls).toHaveLength(1)
	expect(pb.authStore.record?.id).toBe('google-new')
	expect(JSON.parse(localStorage.getItem('last-sign-in')!)).toEqual({ method: 'google' })
	expect(document.body.textContent).toContain('Thanks for signing up!')
	refreshCalls[0].resolve(jsonResponse({ token: token('google-rotated'), record: record('google-new') }))
	await settle()

	expect(sessionView.user?.id).toBe('google-new')
	expect(document.body.textContent).toContain('Thanks for signing up!')
})

test('closes the OAuth welcome dialog when a different account takes over the session', async () => {
	await render()

	await act(async () => {
		await sessionView.signInWithGoogle({
			code: 'popup-code',
			signal: new AbortController().signal,
			canAccept: () => true
		})
	})
	await settle()
	expect(document.body.textContent).toContain('Thanks for signing up!')

	await act(async () => pb.authStore.save(token('account-b'), record('account-b')))
	await settle()

	expect(document.body.textContent).not.toContain('Thanks for signing up!')
})

async function emailLogin(suppressVerifyEmailPrompt = false) {
	await act(async () =>
		sessionView.login({
			email: 'person@example.com',
			password: 'password',
			turnstileToken: 'fixture-token',
			signal: new AbortController().signal,
			canAccept: () => true,
			suppressVerifyEmailPrompt
		})
	)
	await settle()
}
function button(label: string) {
	return Array.from(document.querySelectorAll('button')).find((element) => element.textContent?.includes(label))!
}

test('continues unverified email sign-in in a dismissible sheet and retains the code on reopen', async () => {
	await render()
	await emailLogin()
	expect(sessionView.isAuthenticated).toBe(true)
	expect(document.body.textContent).toContain("You're signed in.")
	expect(otpCalls).toHaveLength(1)
	expect(otpCalls[0].authorization).toBe(`Bearer ${token('email-user')}`)
	otpCalls[0].resolve(jsonResponse({ message: 'OTP sent' }))
	await settle()
	await act(async () => button('Verify later').click())
	expect(sessionView.isAuthenticated).toBe(true)
	expect(document.querySelector('[role="dialog"]')).toBeNull()
	await act(async () => sessionView.promptVerifyEmail('email-user'))
	await settle()
	expect(otpCalls).toHaveLength(1)
	expect(button('Resend code').disabled).toBe(true)

	const input = document.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '123456')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
	await settle()
	expect(otpCalls).toHaveLength(2)
	otpCalls[1].resolve(jsonResponse({ verified: true }))
	await settle()
	expect(sessionView.user?.verified).toBe(true)
	expect(document.querySelector('[role="dialog"]')).toBeNull()
	expect(sessionView.isAuthenticated).toBe(true)
})

test('sends the first code when a signed-in account opens the sheet, and again for a different account', async () => {
	pb.authStore.save(token('account-a'), { ...record('account-a'), email: 'a@example.com', verified: false })
	await render()
	await act(async () => sessionView.promptVerifyEmail('account-a'))
	expect(otpCalls.map((call) => call.authorization)).toEqual([`Bearer ${token('account-a')}`])
	otpCalls[0].resolve(jsonResponse({ message: 'OTP sent' }))
	await settle()
	await act(async () => button('Verify later').click())
	await act(async () => sessionView.promptVerifyEmail('account-a'))
	await settle()
	expect(otpCalls).toHaveLength(1)

	await act(async () =>
		pb.authStore.save(token('account-b'), { ...record('account-b'), email: 'b@example.com', verified: false })
	)
	await act(async () => sessionView.promptVerifyEmail('account-b'))
	expect(otpCalls.map((call) => call.authorization)).toEqual([
		`Bearer ${token('account-a')}`,
		`Bearer ${token('account-b')}`
	])
	expect(document.body.textContent).toContain('b@example.com')
})

test('shows the resend countdown in the first render after a rate limit arrives', async () => {
	await render()
	await emailLogin()
	const labels: Array<string> = []
	const observer = new MutationObserver((records) => {
		for (const mutation of records) if (mutation.type === 'characterData') labels.push(mutation.oldValue ?? '')
	})
	observer.observe(document.body, { subtree: true, characterData: true, characterDataOldValue: true })
	otpCalls[0].resolve(jsonResponse({ error: 'Please wait', details: { retryAfterSeconds: 30 } }, 429))
	await waitForUi(async () => {
		await settle()
		expect(button('Resend code').textContent).toContain('30s')
	})
	observer.disconnect()
	// An uncounted, enabled "Resend code" would have been painted before the countdown caught up.
	expect(labels).not.toContain('Resend code')
	expect(button('Resend code').disabled).toBe(true)
})

test.each(['verified', 'invite'] as const)('does not interrupt the %s sign-in handoff with OTP', async (mode) => {
	loginVerified = mode === 'verified'
	await render()
	await emailLogin(mode === 'invite')
	expect(sessionView.isAuthenticated).toBe(true)
	expect(otpCalls).toHaveLength(0)
	expect(document.querySelector('[role="dialog"]')).toBeNull()
})

test('shows delivery failures inline and respects the server resend delay on retry', async () => {
	await render()
	await emailLogin()
	otpCalls[0].resolve(jsonResponse({ error: 'Failed to send OTP' }, 500))
	await settle()
	await waitForUi(async () => {
		await settle()
		expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not send a code.')
	})
	expect(button('Try again').disabled).toBe(false)
	await act(async () => button('Try again').click())
	await settle()
	otpCalls[1].resolve(jsonResponse({ error: 'Please wait', details: { retryAfterSeconds: 120 } }, 429))
	await settle()
	await waitForUi(async () => {
		await settle()
		expect(document.querySelector('[role="alert"]')?.textContent).toContain('Wait before requesting another code.')
	})
	expect(button('Resend code').disabled).toBe(true)
	expect(button('Resend code').textContent).toContain('120s')
})

test('Try again after a delivery failure moves focus to the code field', async () => {
	await render()
	await emailLogin()
	otpCalls[0].resolve(jsonResponse({ error: 'Failed to send OTP' }, 500))
	await waitForUi(async () => {
		await settle()
		expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not send a code.')
	})
	const retry = [...document.querySelectorAll('button')].find((element) => accessibleName(element) === 'Try again')!
	await act(async () => retry.focus())
	await act(async () => retry.click())

	expect(document.activeElement).toBe(document.querySelector('input[autocomplete="one-time-code"]'))
	otpCalls[1].resolve(jsonResponse({ message: 'OTP sent' }))
	await settle()
	expect(document.activeElement).toBe(document.querySelector('input[autocomplete="one-time-code"]'))
})

test('blocks verification for a replacement token-only session and ignores a late verification response', async () => {
	pb.authStore.save(token('account-a'), { ...record('account-a'), verified: false })
	await render()
	const pending = verifyEmailCode('account-a', '123456')
	expect(otpCalls).toHaveLength(1)
	await act(async () => pb.authStore.save(token('account-b')))
	await expect(verifyEmailCode('account-a', '123456')).rejects.toBeInstanceOf(OtpRequestError)
	expect(otpCalls).toHaveLength(1)
	otpCalls[0].resolve(jsonResponse({ verified: true }))
	await expect(pending).rejects.toThrow('Your account changed')
	expect(pb.authStore.token).toBe(token('account-b'))
	expect(pb.authStore.record).toBeNull()
})

test.each([
	{ body: 'Too many requests', header: null, seconds: 60 },
	{ body: '{}', header: '90', seconds: 90 },
	{ body: '{"details":{"retryAfterSeconds":"invalid"}}', header: 'invalid', seconds: 60 }
])('keeps resend locked for $seconds seconds when a 429 lacks valid body timing', async ({ body, header, seconds }) => {
	await render()
	await emailLogin()
	const headers = header ? { 'Retry-After': header } : undefined
	otpCalls[0].resolve(new Response(body, { status: 429, headers }))
	await waitForUi(async () => {
		await settle()
		expect(document.querySelector('[role="alert"]')?.textContent).toContain('Wait before requesting another code.')
	})
	expect(button('Resend code').disabled).toBe(true)
	expect(button('Resend code').textContent).toContain(`${seconds}s`)
})

const signupRequest = (signal = new AbortController().signal) => ({
	email: 'new@example.com',
	password: 'password123',
	passwordConfirm: 'password123',
	turnstileToken: 'fixture-token',
	promotionalEmails: 'off' as const,
	signal,
	canAccept: () => true
})
const signupResponse = () =>
	jsonResponse(
		{ token: token('signup-user'), user: { id: 'signup-user', email: 'new@example.com', verified: false } },
		201
	)

test.each([false, true])(
	'accepts signup identity before account loading and respects invite handoff=%s',
	async (suppressVerifyEmailPrompt) => {
		await render()
		let pending: ReturnType<typeof sessionView.signup>
		await act(async () => {
			pending = sessionView.signup({ ...signupRequest(), suppressVerifyEmailPrompt })
		})
		expect(signupCalls).toHaveLength(1)
		await act(async () => {
			signupCalls[0].resolve(signupResponse())
			await pending
		})
		await settle()
		expect(sessionView.user?.id).toBe('signup-user')
		expect(JSON.parse(localStorage.getItem('last-sign-in')!)).toEqual({ method: 'email' })
		expect(sessionView.isAuthenticated).toBe(true)
		expect(sessionView.isNewSignup).toBe(true)
		expect(otpCalls).toHaveLength(suppressVerifyEmailPrompt ? 0 : 1)
		// The normal status query owns the follow-up read; signup did not start a competing refresh.
		expect(refreshCalls).toHaveLength(1)
	}
)

test('does not accept a signup response after closing the attempt', async () => {
	await render()
	const controller = new AbortController()
	const pending = sessionView.signup(signupRequest(controller.signal))
	expect(signupCalls).toHaveLength(1)
	controller.abort()
	signupCalls[0].resolve(signupResponse())
	await expect(pending).resolves.toBeNull()
	expect(sessionView.isAuthenticated).toBe(false)
	expect(sessionView.isNewSignup).toBe(false)
	expect(localStorage.getItem('last-sign-in')).toBeNull()
	expect(otpCalls).toHaveLength(0)
})

test('retries the account read after an accepted invite without repeating membership creation', async () => {
	pb.authStore.save(token('invite-user'), { ...record('invite-user'), email: 'invite@example.com', verified: false })
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<AuthProvider>
					<Probe />
					<InviteProbe />
				</AuthProvider>
			</QueryClientProvider>
		)
	)
	await waitForUi(() => expect(inviteCalls).toHaveLength(1))
	inviteCalls[0].resolve(jsonResponse({ team: { id: 'team', name: 'Team' } }))
	await waitForUi(async () => {
		await settle()
		expect(refreshCalls).toHaveLength(2)
	})
	refreshCalls[1].resolve(jsonResponse({ error: 'Temporarily unavailable' }, 503))
	await waitForUi(async () => {
		await settle()
		expect(inviteView.inviteAccount.isError).toBe(true)
	})
	expect(inviteView.inviteAcceptance.isSuccess).toBe(true)
	let retry: Promise<unknown>
	await act(async () => {
		retry = inviteView.inviteAccount.refetch()
	})
	await waitForUi(() => expect(refreshCalls).toHaveLength(3))
	await act(async () => {
		refreshCalls[2].resolve(
			jsonResponse({
				token: token('invite-user'),
				record: { ...record('invite-user'), email: 'invite@example.com', verified: true }
			})
		)
		await retry
	})
	await waitForUi(async () => {
		await settle()
		expect(container.querySelector('output[aria-label="Invite account"]')?.textContent).toBe('Verified')
	})
	expect(inviteCalls).toHaveLength(1)
	expect(otpCalls).toHaveLength(0)
})

test.each([
	{ status: 429, message: 'Wait before requesting another code.', expires: true },
	{ status: 500, message: 'Could not send a code.', expires: false }
])('expires only timed resend errors after $status', async ({ status, message, expires }) => {
	vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
	await render()
	await emailLogin()
	otpCalls[0].resolve(jsonResponse({ error: 'Send failed', details: { retryAfterSeconds: 8 } }, status))
	await waitForUi(async () => {
		await settle()
		expect(document.querySelector('[role="alert"]')?.textContent).toContain(message)
	})
	expect(button(expires ? 'Resend code' : 'Try again').disabled).toBe(expires)
	expect(document.activeElement).not.toBe(document.querySelector('[role="alert"]'))
	const codeInput = document.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!
	await act(async () => codeInput.focus())
	await act(async () => {
		vi.advanceTimersByTime(8000)
	})
	expect(button(expires ? 'Resend code' : 'Try again').disabled).toBe(false)
	expect(document.activeElement).toBe(codeInput)
	expect(document.querySelector('[role="alert"]')?.textContent?.includes(message) ?? null).toBe(expires ? null : true)
	expect(otpCalls).toHaveLength(1)
})

test.each(['cancel', 'replace'] as const)('ignores a late Google session after %s', async (action) => {
	await render()
	let finish!: (response: Response) => void
	vi.mocked(fetch).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve
			})
	)
	const controller = new AbortController()
	const onAuthenticated = vi.fn()
	const result = sessionView.signInWithGoogle({
		code: 'fixture',
		onAuthenticated,
		signal: controller.signal,
		canAccept: () => true
	})
	await settle()
	await act(async () => {
		if (action === 'cancel') controller.abort()
		else pb.authStore.save(token('replacement'))
	})
	finish(
		jsonResponse({
			kind: 'authenticated',
			token: token('abandoned'),
			isNew: true,
			user: { id: 'abandoned', email: 'a@example.com', verified: true }
		})
	)
	await act(async () => {
		expect(await result).toBeNull()
	})
	expect(pb.authStore.token).toBe(action === 'cancel' ? '' : token('replacement'))
	expect(localStorage.getItem('last-sign-in')).toBeNull()
	expect(document.body.textContent).not.toContain('Thanks for signing up!')
	expect(sessionView.isNewSignup).toBe(false)
	expect(onAuthenticated).not.toHaveBeenCalled()
})

test.each(['confirm', 'resend'] as const)('ignores a cancelled Google link %s response', async (operation) => {
	await render()
	let finish!: (response: Response) => void
	vi.mocked(fetch).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve
			})
	)
	const controller = new AbortController()
	const request = { challengeToken: 'challenge', code: '123456', signal: controller.signal, canAccept: () => true }
	const result =
		operation === 'confirm' ? sessionView.confirmGoogleLink(request) : sessionView.resendGoogleLink(request)
	await settle()
	controller.abort()
	finish(
		jsonResponse(
			operation === 'confirm'
				? {
						kind: 'authenticated',
						token: token('abandoned'),
						user: { id: 'abandoned', email: 'a@example.com', verified: true }
					}
				: {
						kind: 'link_verification_required',
						challengeToken: 'resent',
						expiresAt: new Date(Date.now() + 60_000).toISOString(),
						resendAfter: new Date(Date.now() + 30_000).toISOString()
					}
		)
	)
	await act(async () => {
		expect(await result).toBeNull()
	})
	expect(pb.authStore.token).toBe('')
})

test('blocks onboarding Continue if a replacement token arrives before its record', async () => {
	await render()
	await act(async () => {
		await sessionView.signInWithGoogle({
			code: 'fixture',
			signal: new AbortController().signal,
			canAccept: () => true
		})
	})
	await act(async () => document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
	const continueButton = button('Continue')
	const before = vi.mocked(fetch).mock.calls.length
	await act(async () => {
		pb.authStore.save(token('replacement'))
		continueButton.click()
	})
	await settle()
	expect(
		vi
			.mocked(fetch)
			.mock.calls.slice(before)
			.some(([url]) => String(url).endsWith('/user/promotional-emails'))
	).toBe(false)
	expect(pb.authStore.token).toBe(token('replacement'))
	expect(document.body.textContent).not.toContain('Thanks for signing up!')
})

test('ignores an onboarding save after the owning session is replaced', async () => {
	await render()
	await act(async () => {
		await sessionView.signInWithGoogle({
			code: 'fixture',
			signal: new AbortController().signal,
			canAccept: () => true
		})
	})
	await act(async () => document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
	let finish!: (response: Response) => void
	vi.mocked(fetch).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve
			})
	)
	await act(async () => button('Continue').click())
	await settle()
	await act(async () => pb.authStore.save(token('replacement')))
	finish(jsonResponse({ success: true }))
	await waitForUi(async () => {
		await settle()
		expect(document.body.textContent).not.toContain('Thanks for signing up!')
	})
	expect(pb.authStore.token).toBe(token('replacement'))
	expect(pb.authStore.record).toBeNull()
})

test('accepts an onboarding save when the same account refreshes its token', async () => {
	await render()
	await act(async () => {
		await sessionView.signInWithGoogle({
			code: 'fixture',
			signal: new AbortController().signal,
			canAccept: () => true
		})
	})
	await act(async () => document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
	let finish!: (response: Response) => void
	vi.mocked(fetch).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve
			})
	)
	await act(async () => button('Continue').click())
	await settle()
	refreshCalls[0].resolve(
		jsonResponse({ token: token('rotated-google'), record: { ...record('google-new'), promotionalEmails: 'initial' } })
	)
	await settle()
	expect(pb.authStore.token).toBe(token('rotated-google'))
	finish(jsonResponse({ success: true }))
	await waitForUi(async () => {
		await settle()
		expect(document.body.textContent).not.toContain('Thanks for signing up!')
	})
	expect(pb.authStore.token).toBe(token('rotated-google'))
	expect(pb.authStore.record?.promotionalEmails).toBe('on')
})

test('offers sign out from required OAuth onboarding', async () => {
	await render()
	await act(async () => {
		await sessionView.signInWithGoogle({
			code: 'fixture',
			signal: new AbortController().signal,
			canAccept: () => true
		})
	})
	await act(async () => button('Sign out').click())
	expect(pb.authStore.token).toBe('')
	expect(sessionView.isNewSignup).toBe(false)
	expect(document.body.textContent).not.toContain('Thanks for signing up!')
})

test.each([false, true])(
	'defers GitHub email verification to invitation acceptance when suppressed=%s',
	async (suppressVerifyEmailPrompt) => {
		await render()
		let signIn!: Promise<unknown>
		await act(async () => {
			signIn = sessionView.signInWithGithub({
				signal: new AbortController().signal,
				canAccept: () => true,
				popup: oauth.openPopup(),
				suppressVerifyEmailPrompt
			})
		})
		await act(async () => {
			await oauth.github.approve({
				token: token('github-user'),
				record: {
					...record('github-user'),
					email: 'github@example.com',
					verified: false,
					created: '2020-01-01',
					updated: '2020-01-01',
					flags: {},
					has_active_subscription: false
				}
			})
			await signIn
		})
		await settle()
		expect(pb.authStore.record?.id).toBe('github-user')
		expect(JSON.parse(localStorage.getItem('last-sign-in')!)).toEqual({ method: 'github' })
		expect(otpCalls).toHaveLength(suppressVerifyEmailPrompt ? 0 : 1)
		expect(sessionView.isNewSignup).toBe(false)
	}
)

test('welcomes a new GitHub account and attributes its signup to GitHub', async () => {
	await render()
	let signIn!: Promise<unknown>
	await act(async () => {
		signIn = sessionView.signInWithGithub({
			signal: new AbortController().signal,
			canAccept: () => true,
			popup: oauth.openPopup()
		})
	})
	await act(async () => {
		await oauth.github.approve({
			token: token('github-new'),
			record: { ...record('github-new'), email: 'new@example.com', verified: true },
			meta: { isNew: true }
		})
		await signIn
	})
	await settle()
	expect(pb.authStore.record?.id).toBe('github-new')
	expect(sessionView.isNewSignup).toBe(true)
	expect(document.body.textContent).toContain('Thanks for signing up!')
	const attribution = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('/user/attribution'))!
	expect(new Headers(attribution[1]?.headers).get('Authorization')).toBe(`Bearer ${token('github-new')}`)
	expect(JSON.parse(String(attribution[1]?.body))).toMatchObject({ provider: 'github' })
})

test('reloads Google profile fields even when an earlier sign-in left a fresh cache', async () => {
	client.setQueryData(['auth', 'status', 'google-new'], { ...record('google-new'), address: '0xold' })
	await render()
	await act(async () => {
		await sessionView.signInWithGoogle({
			code: 'fixture',
			signal: new AbortController().signal,
			canAccept: () => true
		})
	})
	expect(refreshCalls).toHaveLength(1)
	refreshCalls[0].resolve(
		jsonResponse({ token: token('new-google'), record: { ...record('google-new'), address: '0xcurrent' } })
	)
	await settle()
	expect(sessionView.user?.walletAddress).toBe('0xcurrent')
})

test('does not let an old save finish onboarding for a new login to the same account', async () => {
	await render()
	await act(async () => {
		await sessionView.signInWithGoogle({
			code: 'fixture',
			signal: new AbortController().signal,
			canAccept: () => true
		})
	})
	await act(async () => document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
	let finish!: (response: Response) => void
	vi.mocked(fetch).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve
			})
	)
	await act(async () => button('Continue').click())
	await settle()
	await act(async () => sessionView.logout())
	await act(async () => {
		await sessionView.signInWithGoogle({
			code: 'second-login',
			signal: new AbortController().signal,
			canAccept: () => true
		})
	})
	finish(jsonResponse({ success: true }))
	await settle()
	expect(document.body.textContent).toContain('Thanks for signing up!')
	expect(document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false)
	expect(button('Continue').disabled).toBe(true)
})

test('backs off a Google-link resend when the endpoint gives a 429 without timing', async () => {
	vi.useFakeTimers({ toFake: ['Date'] })
	await render()
	vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: 'Please wait before requesting another code' }, 429))
	await expect(
		sessionView.resendGoogleLink({
			challengeToken: 'challenge',
			signal: new AbortController().signal,
			canAccept: () => true
		})
	).rejects.toMatchObject({ retryAt: Date.now() + 60_000 })
})

test('remembers Google only after its linking challenge becomes an accepted session', async () => {
	await render()
	localStorage.setItem('last-sign-in', JSON.stringify({ method: 'email' }))
	vi.mocked(fetch).mockResolvedValueOnce(
		jsonResponse({
			kind: 'link_verification_required',
			challengeToken: 'challenge',
			expiresAt: new Date(Date.now() + 120_000).toISOString(),
			resendAfter: new Date(Date.now() + 60_000).toISOString()
		})
	)
	await act(async () => {
		await sessionView.signInWithGoogle({
			code: 'fixture',
			signal: new AbortController().signal,
			canAccept: () => true
		})
	})
	expect(JSON.parse(localStorage.getItem('last-sign-in')!)).toEqual({ method: 'email' })
	expect(pb.authStore.token).toBe('')
	vi.mocked(fetch).mockResolvedValueOnce(
		jsonResponse({
			kind: 'authenticated',
			token: token('linked'),
			user: { id: 'linked', email: 'linked@example.com', verified: true }
		})
	)
	await act(async () => {
		await sessionView.confirmGoogleLink({
			challengeToken: 'challenge',
			code: '123456',
			signal: new AbortController().signal,
			canAccept: () => true
		})
	})
	expect(JSON.parse(localStorage.getItem('last-sign-in')!)).toEqual({ method: 'google' })
	expect(pb.authStore.record?.id).toBe('linked')
})
