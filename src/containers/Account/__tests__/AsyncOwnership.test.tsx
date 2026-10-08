// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, onTestFinished, test } from 'vitest'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { EmailChangeModal } from '../EmailChangeModal'
import { TeamInfoCard } from '../Team/TeamInfoCard'
import { TeamMembersCard } from '../Team/TeamMembersCard'
import type { Team } from '../Team/types'

const session = installSubscriberSession('user')
const EMAIL_CHANGE = '/api/collections/users/request-email-change'
type Reply = () => unknown
let team: Team
let teamReply: Reply
let renameReply: Reply
let emailReplies: Array<Reply>
const emailSent = () => new Response(null, { status: 204 })
const emailRequests = () =>
	session.requests
		.filter((request) => request.url.pathname === EMAIL_CHANGE)
		.map((request) => JSON.parse(String(request.init!.body)).newEmail)
const renameRequests = () =>
	session.requests
		.filter((request) => request.url.pathname === '/team/update')
		.map((request) => JSON.parse(String(request.init!.body)).name)
const offline = () => fixtureStatus(500, { message: 'Offline' })()

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	session.client.setDefaultOptions({ queries: { retry: false } })
	team = {
		id: 'team',
		name: 'Original',
		isAdmin: true,
		subscriptionType: null,
		members: [],
		subscriptions: [],
		pendingInvites: []
	}
	teamReply = () => ({ team })
	renameReply = () => ({ team })
	emailReplies = []
	session.serve({
		'/team': () => teamReply(),
		'/team/update': () => renameReply(),
		[EMAIL_CHANGE]: () => (emailReplies.shift() ?? emailSent)()
	})
	session.client.setQueryData(['team', 'user'], team)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function mount(element: React.ReactNode) {
	await act(async () => root.render(<session.Wrapper>{element}</session.Wrapper>))
}
function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(e) => (e.getAttribute('aria-label') ?? e.textContent?.trim()) === name
	)!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
async function change(input: HTMLInputElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}
function EmailHarness() {
	const [open, setOpen] = useState(true)
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				Open email
			</button>
			<EmailChangeModal isOpen={open} onClose={() => setOpen(false)} />
		</>
	)
}
test('email confirmation locks the address during submission and identifies the recipient', async () => {
	const request = Promise.withResolvers<Response>()
	emailReplies.push(() => request.promise)
	await mount(<EmailHarness />)
	const input = document.querySelector<HTMLInputElement>('input[type=email]')!
	await waitForUi(() => expect(document.activeElement).toBe(input))
	await change(input, 'first@example.com')
	await click('Confirm email')
	await waitForUi(() => expect(emailRequests()).toHaveLength(1))
	await waitForUi(() => expect(input.readOnly).toBe(true))
	await act(async () => request.resolve(emailSent()))
	await waitForUi(() => expect(document.querySelector('[role=dialog]')?.textContent).toContain('first@example.com'))
})
test('a failed email request can retry unchanged, keeping its error under the field while the retry sends', async () => {
	const retry = Promise.withResolvers<Response>()
	emailReplies.push(offline, () => retry.promise)
	await mount(<EmailHarness />)
	const input = document.querySelector<HTMLInputElement>('input[type=email]')!
	const fieldError = () => document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent
	await change(input, 'first@example.com')
	await click('Confirm email')
	const failure = 'Could not send the confirmation email. Check the address and try again.'
	await waitForUi(() => expect(fieldError()).toBe(failure))
	expect(input.getAttribute('aria-invalid')).toBe('true')
	expect(document.activeElement).toBe(input)
	expect(button('Confirm email').disabled).toBe(false)
	await click('Confirm email')
	await waitForUi(() =>
		expect(document.querySelector('[role=dialog] button[aria-busy=true]')?.textContent).toContain('Sending…')
	)
	expect(fieldError()).toBe(failure)
	await act(async () => retry.resolve(emailSent()))
	await waitForUi(() => expect(document.querySelector('[role=dialog]')?.textContent).toContain('A confirmation link'))
	expect(emailRequests()).toHaveLength(2)
})
test('email change stays open while its request runs', async () => {
	const first = Promise.withResolvers<Response>()
	emailReplies.push(() => first.promise)
	await mount(<EmailHarness />)
	const input = document.querySelector<HTMLInputElement>('input[type=email]')!
	await change(input, 'first@example.com')
	await click('Confirm email')
	await waitForUi(() => expect(emailRequests()).toHaveLength(1))
	expect(button('Close dialog').getAttribute('aria-disabled')).toBe('true')
	await click('Close dialog')
	await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
	expect(input.isConnected).toBe(true)
	await act(async () => first.resolve(emailSent()))
	await waitForUi(() => expect(document.querySelector('[role=dialog]')?.textContent).toContain('first@example.com'))
})
test('the sent step stays on screen while the dialog closes, and a reopened dialog starts from a fresh form', async () => {
	// The dialog fades out as it does in the browser, so its content stays mounted while it closes.
	const fade = document.head.appendChild(document.createElement('style'))
	fade.textContent = '[role="dialog"] { transition-property: opacity; transition-duration: 200ms; }'
	onTestFinished(() => fade.remove())
	const heading = () => document.querySelector('[role=dialog] h2')?.textContent
	await mount(<EmailHarness />)
	await change(document.querySelector<HTMLInputElement>('input[type=email]')!, 'first@example.com')
	await click('Confirm email')
	await waitForUi(() => expect(heading()).toBe('Confirmation link sent'))

	await click('Done')
	expect(heading()).toBe('Confirmation link sent')
	await waitForUi(() => expect(document.querySelector('[role=dialog]')).toBeNull())

	await click('Open email')
	expect(heading()).toBe('Change your email')
	const reopened = document.querySelector<HTMLInputElement>('input[type=email]')!
	expect(reopened.value).toBe('')
	await change(reopened, 'second@example.com')
	await click('Confirm email')
	await waitForUi(() => expect(document.querySelector('[role=dialog]')?.textContent).toContain('second@example.com'))
	expect(emailRequests()).toEqual(['first@example.com', 'second@example.com'])
})
test('team rename keeps the submitted draft stable while pending and returns focus on success', async () => {
	const request = Promise.withResolvers<unknown>()
	renameReply = () => request.promise
	await mount(<TeamInfoCard />)
	await click('Rename team')
	const input = container.querySelector('input')!
	await change(input, 'Renamed')
	await click('Save')
	await waitForUi(() => expect(renameRequests()).toHaveLength(1))
	await waitForUi(() => expect(input.readOnly).toBe(true))
	expect(button('Cancel').disabled).toBe(true)
	team = { ...team, name: 'Renamed' }
	await act(async () => request.resolve({ team }))
	await waitForUi(() => expect(container.querySelector('input')).toBeNull())
	await waitForUi(() => expect(document.activeElement).toBe(button('Rename team')))
	expect(container.textContent).toContain('Renamed')
})
test('failed team rename does not roll back a newer member cache update', async () => {
	const request = Promise.withResolvers<Response>()
	renameReply = () => request.promise
	await mount(
		<>
			<TeamInfoCard />
			<TeamMembersCard />
		</>
	)
	await click('Rename team')
	await change(container.querySelector('input')!, 'Failed rename')
	await click('Save')
	await waitForUi(() => expect(renameRequests()).toHaveLength(1))
	const member = {
		id: 'member',
		userId: 'member-user',
		email: 'member@example.com',
		isAdmin: false,
		subscriptionType: null,
		joinedAt: '2026-09-07'
	}
	await act(async () => session.client.setQueryData<Team>(['team', 'user'], (old) => ({ ...old!, members: [member] })))
	// Hold the reconciliation refetch to inspect rollback before it can hide the lost member.
	const refresh = Promise.withResolvers<unknown>()
	teamReply = () => refresh.promise
	await act(async () => request.resolve(offline()))
	await waitForUi(() => expect(container.querySelector('[role=alert]')).not.toBeNull())
	expect(container.textContent).toContain('Members (1)')
	expect(container.textContent).toContain('member@example.com')
	await click('Cancel')
	expect(container.textContent).toContain('Original')
	expect(container.textContent).not.toContain('Failed rename')
	await act(async () => refresh.resolve({ team: { ...team, members: [member] } }))
})
test('team rename failure preserves its draft and its error through the retry, and Cancel restores the rename control', async () => {
	renameReply = offline
	await mount(<TeamInfoCard />)
	await click('Rename team')
	await change(container.querySelector('input')!, 'Retry name')
	await click('Save')
	await waitForUi(() => expect(container.querySelector('[role=alert]')?.textContent).toBe('Offline'))
	expect(container.querySelector('input')!.value).toBe('Retry name')
	expect(button('Save').disabled).toBe(false)
	const retry = Promise.withResolvers<unknown>()
	renameReply = () => retry.promise
	await click('Save')
	await waitForUi(() => expect(container.querySelector('button[aria-busy=true]')?.textContent).toContain('Saving…'))
	expect(container.querySelector('[role=alert]')?.textContent).toBe('Offline')
	team = { ...team, name: 'Retry name' }
	await act(async () => retry.resolve({ team }))
	await waitForUi(() => expect(container.querySelector('input')).toBeNull())
	await click('Rename team')
	await click('Cancel')
	await waitForUi(() => expect(document.activeElement).toBe(button('Rename team')))
})
test('a team rename cleared to blank keeps the current name without a request, and a padded name is trimmed', async () => {
	await mount(<TeamInfoCard />)
	await click('Rename team')
	await change(container.querySelector('input')!, '   ')
	await click('Save')
	expect(container.querySelector('input')).toBeNull()
	expect(container.textContent).toContain('Original')
	expect(document.activeElement).toBe(button('Rename team'))
	await click('Rename team')
	await change(container.querySelector('input')!, '  A clear name  ')
	await click('Save')
	await waitForUi(() => expect(renameRequests()).toEqual(['A clear name']))
})
