// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { EmailChangeModal } from '../EmailChangeModal'
import { TeamInfoCard } from '../Team/TeamInfoCard'
import type { Team } from '../Team/types'

const api = vi.hoisted(() => ({ email: vi.fn(), fetch: vi.fn(), refresh: vi.fn() }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ user: { id: 'user' }, isAuthenticated: true, authorizedFetch: api.fetch })
}))
vi.mock('~/auth/authStore', () => ({ refreshSession: api.refresh }))
vi.mock('~/utils/pocketbase', () => ({ default: { collection: () => ({ requestEmailChange: api.email }) } }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
let root: Root
let container: HTMLDivElement
let client: QueryClient
let team: Team
beforeEach(() => {
	vi.resetAllMocks()
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	team = {
		id: 'team',
		name: 'Original',
		isAdmin: true,
		subscriptionType: null,
		members: [],
		subscriptions: [],
		pendingInvites: []
	}
	client.setQueryData(['team', 'user'], team)
	api.fetch.mockImplementation(async () => Response.json({ team }))
	api.refresh.mockResolvedValue(undefined)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})
async function mount(element: React.ReactNode) {
	await act(async () => root.render(<QueryClientProvider client={client}>{element}</QueryClientProvider>))
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
	const request = Promise.withResolvers<void>()
	api.email.mockReturnValueOnce(request.promise)
	await mount(<EmailHarness />)
	const input = document.querySelector<HTMLInputElement>('input[type=email]')!
	await vi.waitFor(() => expect(document.activeElement).toBe(input))
	await change(input, 'first@example.com')
	await click('Confirm Email')
	await vi.waitFor(() => expect(api.email).toHaveBeenCalledWith('first@example.com'))
	await vi.waitFor(() => expect(input.readOnly).toBe(true))
	await act(async () => request.resolve())
	await vi.waitFor(() => expect(document.querySelector('[role=dialog]')?.textContent).toContain('first@example.com'))
})
test('a failed email request can retry unchanged and does not claim the address is already used', async () => {
	api.email.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce(undefined)
	await mount(<EmailHarness />)
	await change(document.querySelector<HTMLInputElement>('input[type=email]')!, 'first@example.com')
	await click('Confirm Email')
	await vi.waitFor(() => expect(document.querySelector('[role=alert]')).not.toBeNull())
	expect(document.body.textContent).not.toContain('already associated')
	expect(button('Confirm Email').disabled).toBe(false)
	await click('Confirm Email')
	await vi.waitFor(() => expect(api.email).toHaveBeenCalledTimes(2))
})
test('team rename keeps the submitted draft stable while pending and returns focus on success', async () => {
	const request = Promise.withResolvers<Response>()
	api.fetch.mockImplementation((url: string) =>
		url.endsWith('/team/update') ? request.promise : Promise.resolve(Response.json({ team }))
	)
	await mount(<TeamInfoCard />)
	await click('Rename team')
	const input = container.querySelector('input')!
	await change(input, 'Renamed')
	await click('Save')
	await vi.waitFor(() => expect(api.fetch).toHaveBeenCalled())
	await vi.waitFor(() => expect(input.readOnly).toBe(true))
	expect(button('Cancel').disabled).toBe(true)
	team = { ...team, name: 'Renamed' }
	await act(async () => request.resolve(Response.json({ team })))
	await vi.waitFor(() => expect(container.querySelector('input')).toBeNull())
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Rename team')))
})
test('failed team rename does not roll back a newer member cache update', async () => {
	const request = Promise.withResolvers<Response>()
	api.fetch.mockImplementation((url: string) =>
		url.endsWith('/team/update') ? request.promise : Promise.resolve(Response.json({ team }))
	)
	await mount(<TeamInfoCard />)
	await click('Rename team')
	await change(container.querySelector('input')!, 'Failed rename')
	await click('Save')
	await vi.waitFor(() => expect(api.fetch).toHaveBeenCalled())
	const member = {
		id: 'member',
		userId: 'member-user',
		email: 'member@example.com',
		isAdmin: false,
		subscriptionType: null,
		joinedAt: '2026-09-07'
	}
	await act(async () => client.setQueryData<Team>(['team', 'user'], (old) => ({ ...old!, members: [member] })))
	// Hold the reconciliation refetch to inspect rollback before it can hide the lost member.
	const refresh = Promise.withResolvers<Response>()
	api.fetch.mockReturnValue(refresh.promise)
	await act(async () => request.reject(new Error('Offline')))
	await vi.waitFor(() => expect(container.querySelector('[role=alert]')).not.toBeNull())
	await vi.waitFor(() => expect(client.getQueryData<Team>(['team', 'user'])?.name).toBe('Original'))
	expect(client.getQueryData<Team>(['team', 'user'])?.members).toEqual([member])
	await act(async () => refresh.resolve(Response.json({ team: { ...team, members: [member] } })))
})

test('closing and reopening email change ignores the previous request completion', async () => {
	const first = Promise.withResolvers<void>()
	api.email.mockReturnValueOnce(first.promise).mockResolvedValueOnce(undefined)
	await mount(<EmailHarness />)
	await change(document.querySelector<HTMLInputElement>('input[type=email]')!, 'first@example.com')
	await click('Confirm Email')
	await vi.waitFor(() => expect(api.email).toHaveBeenCalledOnce())
	await click('Close email change')
	await click('Open email')
	const input = document.querySelector<HTMLInputElement>('input[type=email]')!
	await change(input, 'second@example.com')
	await act(async () => first.resolve())
	expect(input.value).toBe('second@example.com')
	expect(input.isConnected).toBe(true)
	await click('Confirm Email')
	await vi.waitFor(() => expect(document.querySelector('[role=dialog]')?.textContent).toContain('second@example.com'))
	expect(api.email.mock.calls.map(([email]) => email)).toEqual(['first@example.com', 'second@example.com'])
})
test('team rename failure preserves its draft for retry and Cancel restores the rename control', async () => {
	api.fetch.mockRejectedValueOnce(new Error('Offline'))
	await mount(<TeamInfoCard />)
	await click('Rename team')
	await change(container.querySelector('input')!, 'Retry name')
	await click('Save')
	await vi.waitFor(() => expect(container.querySelector('[role=alert]')).not.toBeNull())
	expect(container.querySelector('input')!.value).toBe('Retry name')
	expect(button('Save').disabled).toBe(false)
	api.fetch.mockImplementation(async (url: string) => {
		if (url.endsWith('/team/update')) team = { ...team, name: 'Retry name' }
		return Response.json({ team })
	})
	await click('Save')
	await vi.waitFor(() => expect(container.querySelector('input')).toBeNull())
	await click('Rename team')
	await click('Cancel')
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Rename team')))
})

test('team rename rejects blank names and submits a trimmed name', async () => {
	await mount(<TeamInfoCard />)
	await click('Rename team')
	const input = container.querySelector('input')!
	api.fetch.mockClear()
	await change(input, '')
	await click('Save')
	await change(input, '   ')
	await click('Save')
	expect(api.fetch).not.toHaveBeenCalled()
	await change(input, '  A clear name  ')
	await click('Save')
	await vi.waitFor(() => expect(api.fetch).toHaveBeenCalled())
	expect(JSON.parse(api.fetch.mock.calls[0][1].body).name).toBe('A clear name')
})
