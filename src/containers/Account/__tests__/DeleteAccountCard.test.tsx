// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://defillama.com/account"}

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AUTH_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { DeleteAccountCard } from '../DeleteAccountCard'

const router = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('next/router', () => ({ useRouter: () => router }))

const session = installSubscriberSession('account-a')
const ELIGIBILITY = `${AUTH_SERVER}/user/delete-account/eligibility`
const REQUEST = `${AUTH_SERVER}/user/delete-account/request`
const DELETE = `${AUTH_SERVER}/user/delete-account`
const typed = { text: 'DELETE', type: 'typed_confirmation' as const }
const otp = { text: 'DELETE', type: 'otp' as const }
const eligibility = { blockers: [], canDelete: true, requiredConfirmation: typed, warnings: [] }
const completed = { status: 'completed', deletedAt: '2026-08-30T00:00:00.000Z' }
const record = (id: string) => ({
	id,
	email: 'a@example.com',
	collectionId: '_pb_users_auth_',
	collectionName: 'users'
})
const token = (id: string, n: number) => `e30.${btoa(JSON.stringify({ id, n, exp: 4_102_444_800 }))}.signature`

let root: Root
let container: HTMLDivElement
let sessionToken: string
beforeEach(() => {
	router.replace.mockReset()
	sessionToken = pb.authStore.token
	session.serve({
		[ELIGIBILITY]: eligibility,
		[REQUEST]: { message: 'ready', requiredConfirmation: typed },
		[DELETE]: completed
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	delete window.google
	vi.restoreAllMocks()
	vi.useRealTimers()
})

const text = () => document.body.textContent ?? ''
const button = (label: string) =>
	[...document.querySelectorAll('button')].find((element) => accessibleName(element) === label)
const deleteRequests = () => session.requests.filter((request) => request.url.href === DELETE)
const signedOut = () => pb.authStore.token === ''

async function waitFor(assertion: () => void) {
	await waitForUi(
		async () => {
			await act(async () => {})
			assertion()
		},
		{ timeout: 1000 }
	)
}

function setInput(selector: string, value: string) {
	const input = document.querySelector<HTMLInputElement>(selector)!
	Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
	input.dispatchEvent(new Event('input', { bubbles: true }))
}

function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((done) => (resolve = done))
	return { promise, resolve }
}

async function startDialog() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DeleteAccountCard />
			</session.Wrapper>
		)
	)
	await waitFor(() => expect(button('Delete account')!.disabled).toBe(false))
	await act(async () => button('Delete account')!.click())
	await waitFor(() => expect(text()).toContain('This permanently deletes your DefiLlama account'))
}

async function openDialog() {
	await startDialog()
	await waitFor(() => expect(button('Checking…')).toBeUndefined())
}

async function continueAndSubmit(fill = () => setInput('#delete-account-confirmation', 'DELETE')) {
	await act(async () => button('Continue')!.click())
	await waitFor(() => expect(document.querySelector('#delete-account-confirmation')).not.toBeNull())
	await act(async () => fill())
	await act(async () => button('Delete account permanently')!.click())
}

test('deletes a typed-confirmation account, then signs out', async () => {
	await openDialog()
	await continueAndSubmit()
	await waitFor(() => expect(signedOut()).toBe(true))
	expect(router.replace).toHaveBeenCalledWith('/')
})

test('requires the email code and sends it with the final deletion request', async () => {
	session.serve({
		[ELIGIBILITY]: { ...eligibility, requiredConfirmation: otp },
		[REQUEST]: { message: 'Deletion code sent', requiredConfirmation: otp }
	})
	await openDialog()
	await continueAndSubmit(() => {
		setInput('#delete-account-otp', '123456')
		setInput('#delete-account-confirmation', 'DELETE')
	})
	await waitFor(() => expect(signedOut()).toBe(true))

	expect(JSON.parse(String(deleteRequests()[0]!.init!.body)).otp).toBe('123456')
})

test('shows the warning copy while the account check runs and holds Continue until it passes', async () => {
	const pending = deferred<Response>()
	session.serve({ [ELIGIBILITY]: () => pending.promise })
	await startDialog()

	const checking = button('Checking…')!
	expect(checking.getAttribute('aria-disabled')).toBe('true')
	await act(async () => checking.click())
	expect(session.requests.some((request) => request.url.href === REQUEST)).toBe(false)

	await act(async () => pending.resolve(Response.json(eligibility)))
	await waitFor(() => expect(button('Continue')!.getAttribute('aria-disabled')).toBeNull())
})

test('a failed account check shows its error in the dialog and Try Again recovers', async () => {
	session.serve({ [ELIGIBILITY]: fixtureStatus(503, { error: 'Account service unavailable' }) })
	await startDialog()
	await waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Account service unavailable'))
	expect(button('Continue')).toBeUndefined()

	session.serve({ [ELIGIBILITY]: eligibility })
	await act(async () => button('Try again')!.click())
	await waitFor(() => expect(button('Continue')).toBeDefined())
	expect(text()).not.toContain('Account service unavailable')
})

test('shows team blockers without offering the destructive flow', async () => {
	session.serve({
		[ELIGIBILITY]: {
			...eligibility,
			canDelete: false,
			blockers: [{ code: 'sole_team_admin', message: 'Transfer team ownership before deleting this account.' }]
		}
	})
	await openDialog()

	expect(text()).toContain('Transfer team ownership before deleting this account.')
	expect(button('Continue')).toBeUndefined()
})

test('directs Apple reauthentication to the mobile app', async () => {
	session.serve({ [ELIGIBILITY]: { ...eligibility, requiredConfirmation: { text: 'DELETE', type: 'apple_reauth' } } })
	await openDialog()

	expect(text()).toContain('Open the DefiLlama mobile app and reauthenticate with Apple')
	expect(button('Continue')).toBeUndefined()
})

test.each([
	[
		'fails',
		fixtureStatus(500, { error: 'Failed to remove external subscriptions' }),
		'Failed to remove external subscriptions'
	],
	['does not report completion', { ...completed, status: 'processing' }, 'Account deletion did not complete'],
	['omits the deletion time', { status: 'completed' }, 'Account deletion did not complete'],
	[
		'returns an invalid deletion time',
		{ status: 'completed', deletedAt: 'not-a-date' },
		'Account deletion did not complete'
	]
])('keeps the user signed in when the deletion request %s', async (_case, response, message) => {
	session.serve({ [DELETE]: response })
	await openDialog()
	await continueAndSubmit()
	await waitFor(() => expect(text()).toContain(message))

	expect(signedOut()).toBe(false)
	expect(router.replace).not.toHaveBeenCalled()
})

test('signs a Google account out without waiting for credential revocation, even when revocation fails', async () => {
	vi.spyOn(console, 'error').mockImplementation(() => undefined)
	const revoked: Array<string> = []
	let finishRevocation!: () => void
	window.google = {
		accounts: {
			id: {
				revoke: (hint, callback) => {
					revoked.push(hint)
					finishRevocation = () => callback({ successful: false, error: 'Google is unavailable' })
				}
			},
			oauth2: { initCodeClient: () => ({ requestCode() {} }) }
		}
	}
	const googleRecord = { ...record('account-a'), auth_method: 'google' }
	pb.authStore.save(sessionToken, googleRecord)
	session.serve({ '/api/collections/users/auth-refresh': { token: sessionToken, record: googleRecord } })

	await openDialog()
	await continueAndSubmit()
	await waitFor(() => expect(signedOut()).toBe(true))
	expect(revoked).toEqual(['a@example.com'])
	expect(router.replace).toHaveBeenCalledWith('/')

	await act(async () => finishRevocation())
	expect(console.error).toHaveBeenCalledWith(
		'Account deleted, but Google credential revocation failed:',
		new Error('Google is unavailable')
	)
})

test('ignores a completed deletion after the session switches to another account', async () => {
	const pending = deferred<Response>()
	session.serve({ [DELETE]: () => pending.promise })
	await openDialog()
	await continueAndSubmit()
	await waitFor(() => expect(deleteRequests()).toHaveLength(1))

	const otherToken = token('account-b', 1)
	session.serve({ '/api/collections/users/auth-refresh': { token: otherToken, record: record('account-b') } })
	await act(async () => pb.authStore.save(otherToken, record('account-b')))
	await act(async () => pending.resolve(Response.json(completed)))
	await act(async () => {})

	expect(pb.authStore.token).toBe(otherToken)
	expect(router.replace).not.toHaveBeenCalled()
})

test('signs out the deleted account even after its token refreshed mid-request', async () => {
	const pending = deferred<Response>()
	session.serve({ [DELETE]: () => pending.promise })
	await openDialog()
	await continueAndSubmit()
	await waitFor(() => expect(deleteRequests()).toHaveLength(1))

	await act(async () => pb.authStore.save(token('account-a', 2), record('account-a')))
	await act(async () => pending.resolve(Response.json(completed)))
	await waitFor(() => expect(signedOut()).toBe(true))

	expect(router.replace).toHaveBeenCalledWith('/')
})

test('a retried deletion keeps the last failure on screen while it runs', async () => {
	session.serveInOrder(DELETE, [
		fixtureStatus(500, { error: 'Failed to remove external subscriptions' }),
		() => new Promise<Response>(() => {})
	])
	await openDialog()
	await continueAndSubmit()
	const alert = () => document.querySelector('[role=alertdialog] [role=alert]')?.textContent
	await waitFor(() => expect(alert()).toBe('Failed to remove external subscriptions'))

	await act(async () => button('Delete account permanently')!.click())
	await waitFor(() => expect(button('Deleting account…')!.getAttribute('aria-busy')).toBe('true'))
	expect(alert()).toBe('Failed to remove external subscriptions')
})

test('sends one deletion request when the form is submitted twice while pending', async () => {
	const pending = deferred<Response>()
	session.serve({ [DELETE]: () => pending.promise })
	await openDialog()
	await continueAndSubmit()
	const form = document.querySelector('#delete-account-confirmation')!.closest('form')!
	await act(async () => form.requestSubmit())

	expect(deleteRequests()).toHaveLength(1)
	await act(async () => pending.resolve(Response.json(completed)))
	await waitFor(() => expect(signedOut()).toBe(true))
})

test('refuses to delete through a dialog opened by an older session', async () => {
	await openDialog()
	await act(async () => button('Continue')!.click())
	await waitFor(() => expect(document.querySelector('#delete-account-confirmation')).not.toBeNull())

	await act(async () => pb.authStore.save(token('account-a', 3), record('account-a')))
	await act(async () => setInput('#delete-account-confirmation', 'DELETE'))
	await act(async () => document.querySelector('#delete-account-confirmation')!.closest('form')!.requestSubmit())

	await waitFor(() => expect(text()).toContain('Your session changed'))
	expect(deleteRequests()).toHaveLength(0)
	expect(signedOut()).toBe(false)
})

test('a resent deletion code is confirmed inside the dialog', async () => {
	vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
	session.serve({
		[ELIGIBILITY]: { ...eligibility, requiredConfirmation: otp },
		[REQUEST]: { message: 'Deletion code sent', requiredConfirmation: otp }
	})
	await openDialog()
	await act(async () => button('Continue')!.click())
	await waitFor(() => expect(text()).toContain('Resend code (60s)'))
	await act(async () => vi.advanceTimersByTime(60_000))
	await act(async () => button('Resend code')!.click())

	await waitFor(() =>
		expect(document.querySelector('[role=alertdialog] [role=status]')?.textContent).toBe('Code sent. Check your inbox.')
	)
	expect(session.requests.filter((request) => request.url.href === REQUEST)).toHaveLength(2)
})

test('typing the code while a resend runs keeps the dialog locked until the resend settles', async () => {
	vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
	session.serve({
		[ELIGIBILITY]: { ...eligibility, requiredConfirmation: otp },
		[REQUEST]: { message: 'Deletion code sent', requiredConfirmation: otp }
	})
	await openDialog()
	await act(async () => button('Continue')!.click())
	await waitFor(() => expect(text()).toContain('Resend code (60s)'))
	await act(async () => vi.advanceTimersByTime(60_000))
	const resend = deferred<Response>()
	session.serve({ [REQUEST]: () => resend.promise })
	await act(async () => button('Resend code')!.click())
	await act(async () => setInput('#delete-account-otp', '1'))

	expect(button('Sending code…')).toBeDefined()
	expect(button('Cancel')!.getAttribute('aria-disabled')).toBe('true')
	await act(async () => resend.resolve(Response.json({ message: 'Deletion code sent', requiredConfirmation: otp })))
	await waitFor(() => expect(button('Cancel')!.getAttribute('aria-disabled')).toBeNull())
})
