// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AssignSubscriptionModal } from '../Team/AssignSubscriptionModal'
import { InviteMemberModal } from '../Team/InviteMemberModal'
import { ManageSeatsModal } from '../Team/ManageSeatsModal'
import { PurchaseSeatsModal } from '../Team/PurchaseSeatsModal'
import { TeamInvitesCard } from '../Team/TeamInvitesCard'
import { TeamMembersCard } from '../Team/TeamMembersCard'
import { TeamTab } from '../Team/TeamTab'
import type { Team } from '../Team/types'
import { useTeam } from '../Team/useTeam'

const api = vi.hoisted(() => ({ fetch: vi.fn(), checkout: vi.fn() }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ user: { id: 'user' }, isAuthenticated: true, authorizedFetch: api.fetch })
}))
vi.mock('next/router', () => ({ useRouter: () => ({ isReady: true, query: {}, replace: vi.fn() }) }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('~/constants', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/constants')>()),
	STRIPE_PUBLISHABLE_KEY: 'pk_test_team_preview'
}))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve({}) }))
vi.mock('@stripe/react-stripe-js', () => ({
	EmbeddedCheckoutProvider: ({ children, options }: { children: ReactNode; options: { clientSecret: string } }) => {
		api.checkout(options)
		return children
	},
	EmbeddedCheckout: () => null
}))
let root: Root
let container: HTMLDivElement
let client: QueryClient
let team: Team
const hooks: Record<string, ReturnType<typeof useTeam>> = {}
function Hook({ id }: { id: string }) {
	hooks[id] = useTeam()
	return null
}
function Harness({ kind }: { kind: 'invite' | 'manage' | 'purchase' | 'assign' }) {
	const [open, setOpen] = useState(true)
	const { team: currentTeam } = useTeam()
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				Open
			</button>
			{open ? (
				kind === 'invite' ? (
					<InviteMemberModal isOpen onClose={() => setOpen(false)} />
				) : kind === 'manage' ? (
					<ManageSeatsModal isOpen onClose={() => setOpen(false)} subscription={currentTeam!.subscriptions[0]} />
				) : kind === 'assign' ? (
					<AssignSubscriptionModal isOpen onClose={() => setOpen(false)} member={currentTeam!.members[0]} />
				) : (
					<PurchaseSeatsModal isOpen onClose={() => setOpen(false)} />
				)
			) : null}
		</>
	)
}
beforeEach(() => {
	vi.resetAllMocks()
	client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 2 } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	team = {
		id: 'team',
		name: 'Original',
		isAdmin: true,
		subscriptionType: null,
		members: [
			{
				id: 'member',
				userId: 'member-user',
				email: 'member@example.com',
				isAdmin: false,
				subscriptionType: null,
				joinedAt: '2026-09-07'
			}
		],
		subscriptions: [
			{
				id: 'sub',
				type: 'llamafeed',
				billingInterval: 'month',
				seats: { seatCount: 3, occupiedSeats: 2, availableSeats: 1 }
			}
		],
		pendingInvites: []
	}
	client.setQueryData(['team', 'user'], team)
	api.fetch.mockImplementation(async () => Response.json({ team }))
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
	vi.restoreAllMocks()
})
async function mount(element: ReactNode) {
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
function posts() {
	return api.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')
}
function dialog() {
	return document.querySelector<HTMLElement>('[role=dialog]')!
}
function namedDialog(name: string) {
	return [...document.querySelectorAll<HTMLElement>('[role=dialog], [role=alertdialog]')].find(
		(d) => document.getElementById(d.getAttribute('aria-labelledby')!)?.textContent === name
	)!
}

test.each(['set', 'cancel', 'assign', 'unassign', 'invite', 'revoke', 'remove', 'leave'] as const)(
	'failed %s keeps newer team data and never retries the write automatically',
	async (action) => {
		const request = Promise.withResolvers<Response>()
		const refresh = Promise.withResolvers<Response>()
		api.fetch.mockImplementation((_url, options) => (options?.method === 'POST' ? request.promise : refresh.promise))
		await mount(<Hook id="first" />)
		await act(async () => {
			const h = hooks.first
			if (action === 'set' || action === 'cancel')
				h.setSeatsMutation.mutate({ subscriptionType: 'llamafeed', seatCount: action === 'cancel' ? 0 : 4 })
			if (action === 'assign') h.assignMemberMutation.mutate({ userId: 'member-user', subscriptionType: 'llamafeed' })
			if (action === 'unassign') h.unassignMemberMutation.mutate({ userId: 'member-user' })
			if (action === 'invite') h.inviteMemberMutation.mutate({ email: 'invite@example.com' })
			if (action === 'revoke') h.revokeInviteMutation.mutate({ inviteId: 'invite' })
			if (action === 'remove') h.removeMemberMutation.mutate({ userId: 'member-user' })
			if (action === 'leave') h.leaveTeamMutation.mutate()
		})
		await vi.waitFor(() => expect(posts()).toHaveLength(1))
		expect(client.getQueryData(['team', 'user'])).toEqual(team)
		const updated = {
			...team,
			name: 'Newer confirmed name',
			pendingInvites: [
				{
					id: 'new',
					email: 'new@example.com',
					status: 'pending' as const,
					createdAt: '2026-09-07',
					expiresAt: '2026-09-14'
				}
			]
		}
		await act(async () => client.setQueryData(['team', 'user'], updated))
		await act(async () => request.reject(new Error('Request failed')))
		await vi.waitFor(() =>
			expect(
				client
					.getMutationCache()
					.getAll()
					.some((m) => m.state.status === 'error')
			).toBe(true)
		)
		// Inspect before reconciliation: a GET must not conceal a destructive rollback.
		expect(client.getQueryData(['team', 'user'])).toEqual(updated)
		expect(posts()).toHaveLength(1)
		await act(async () => refresh.resolve(Response.json({ team: updated })))
	}
)

test.each([true, false])(
	'a seat write outlives its opening and orders a later assignment (success=%s)',
	async (success) => {
		const first = Promise.withResolvers<Response>()
		const refresh = Promise.withResolvers<Response>()
		api.fetch.mockImplementation((url: string, options) =>
			url.endsWith('/team/seats')
				? first.promise
				: options?.method === 'POST'
					? Promise.resolve(Response.json({}))
					: refresh.promise
		)
		await mount(<Hook key="first" id="first" />)
		await act(async () => hooks.first.setSeatsMutation.mutate({ subscriptionType: 'llamafeed', seatCount: 4 }))
		await vi.waitFor(() => expect(posts()).toHaveLength(1))
		await mount(<Hook key="second" id="second" />)
		await act(async () =>
			hooks.second.assignMemberMutation.mutate({ userId: 'member-user', subscriptionType: 'llamafeed' })
		)
		expect(posts()).toHaveLength(1)
		if (success) {
			await act(async () => first.resolve(Response.json({})))
		} else await act(async () => first.reject(new Error('Declined')))
		await vi.waitFor(() => expect(api.fetch.mock.calls.some(([url]) => url.endsWith('/team'))).toBe(true))
		await vi.waitFor(() => expect(posts()).toHaveLength(success ? 1 : 2))
		await act(async () => refresh.resolve(Response.json({ team })))
		await vi.waitFor(() => expect(posts()).toHaveLength(2))
		expect(posts().map(([url]) => new URL(url).pathname)).toEqual(['/team/seats', '/team/member/assign'])
	}
)

test('invite validates the address, preserves a failed draft and retries through native submit', async () => {
	const first = Promise.withResolvers<Response>()
	api.fetch.mockImplementation((_url, options) =>
		options?.method === 'POST' ? first.promise : Promise.resolve(Response.json({ team }))
	)
	await mount(<Harness kind="invite" />)
	expect(namedDialog('Invite Member')).toBeTruthy()
	const input = document.querySelector<HTMLInputElement>('input[type=email]')!
	await vi.waitFor(() => expect(document.activeElement).toBe(input))
	await click('Send Invite')
	await change(input, 'not-an-email')
	await click('Send Invite')
	expect(posts()).toHaveLength(0)
	await change(input, 'colleague@example.com')
	await click('Send Invite')
	await vi.waitFor(() => expect(posts()).toHaveLength(1))
	await vi.waitFor(() => expect(input.readOnly).toBe(true))
	await click('Close')
	expect(dialog()).toBeTruthy()
	await act(async () => first.reject(new Error('Invite unavailable')))
	await vi.waitFor(() => expect(document.querySelector('[role=alert]')?.textContent).toContain('Invite unavailable'))
	expect(input.value).toBe('colleague@example.com')
	api.fetch.mockImplementation(async () => Response.json({ team }))
	await click('Send Invite')
	await vi.waitFor(() => expect(dialog()).toBeNull())
	expect(posts().map(([, options]) => JSON.parse(options.body))).toEqual([
		{ email: 'colleague@example.com' },
		{ email: 'colleague@example.com' }
	])
	await click('Open')
	expect(document.querySelector<HTMLInputElement>('input[type=email]')!.value).toBe('')
	expect(document.querySelector('[role=alert]')).toBeNull()
})

test('seat form locks its submitted amount and preserves it after a failure', async () => {
	const request = Promise.withResolvers<Response>()
	api.fetch.mockImplementation((_url, options) =>
		options?.method === 'POST' ? request.promise : Promise.resolve(Response.json({ team }))
	)
	await mount(<Harness kind="manage" />)
	const input = document.querySelector<HTMLInputElement>('input[type=number]')!
	await change(input, '2')
	expect(dialog().textContent).toContain('$98/month')
	expect(dialog().textContent).toContain('will not be refunded')
	await change(input, '4')
	expect(dialog().textContent).toContain('$196/month')
	expect(dialog().textContent).not.toContain('will not be refunded')
	await click('Update Seats')
	await vi.waitFor(() => expect(posts()).toHaveLength(1))
	expect(JSON.parse(posts()[0][1].body)).toEqual({ subscriptionType: 'llamafeed', seatCount: 4 })
	await vi.waitFor(() => expect(input.readOnly).toBe(true))
	expect(button('Increase seats').disabled).toBe(true)
	await click('Close')
	expect(dialog()).toBeTruthy()
	await act(async () => request.reject(new Error('Card declined')))
	await vi.waitFor(() => expect(document.querySelector('[role=alert]')?.textContent).toContain('Card declined'))
	expect(input.value).toBe('4')
})

test('cancellation sends zero only after confirmation and preserves access until period end', async () => {
	await mount(<Harness kind="manage" />)
	await click('Cancel subscription')
	const confirmation = namedDialog('Cancel Pro Subscription')
	expect(confirmation.textContent).toContain('Assigned members keep access until the period ends')
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Cancel')))
	await click('Cancel')
	expect(posts()).toHaveLength(0)
	await click('Cancel subscription')
	await click('Cancel Subscription')
	await vi.waitFor(() => expect(posts()).toHaveLength(1))
	expect(JSON.parse(posts()[0][1].body)).toEqual({ subscriptionType: 'llamafeed', seatCount: 0 })
})

test('scheduled cancellation locks the current-seat floor and an increase retains the resumption warning', async () => {
	team.subscriptions[0].canceledAtPeriodEnd = true
	team.subscriptions[0].effectiveAt = 1_800_000_000
	await mount(<Harness kind="manage" />)
	const input = document.querySelector<HTMLInputElement>('input[type=number]')!
	expect(button('Decrease seats').disabled).toBe(true)
	expect(button('Cancel subscription')).toBeUndefined()
	await change(input, '2')
	await click('Update Seats')
	expect(posts()).toHaveLength(0)
	await change(input, '4')
	expect(dialog().textContent).toContain('resume billing and undo the pending cancellation')
	await click('Update Seats')
	await vi.waitFor(() => expect(posts()).toHaveLength(1))
	expect(JSON.parse(posts()[0][1].body).seatCount).toBe(4)
})

test('purchase respects the existing billing interval and does not repeat a request after checkout opens', async () => {
	team.subscriptions[0].billingInterval = 'year'
	const request = Promise.withResolvers<Response>()
	api.fetch.mockImplementation((_url, options) =>
		options?.method === 'POST' ? request.promise : Promise.resolve(Response.json({ team }))
	)
	await mount(<Harness kind="purchase" />)
	expect(document.querySelector<HTMLInputElement>('input[value=year]')!.getAttribute('aria-checked')).toBe('true')
	await act(async () => document.querySelector<HTMLInputElement>('input[value=month]')!.click())
	expect(document.querySelector<HTMLInputElement>('input[value=year]')!.getAttribute('aria-checked')).toBe('true')
	expect(dialog().textContent).toContain('$490/year')
	await click('Purchase Seats')
	await vi.waitFor(() => expect(posts()).toHaveLength(1))
	await vi.waitFor(() =>
		expect(document.querySelector<HTMLInputElement>('input[value=api]')!.getAttribute('aria-disabled')).toBe('true')
	)
	await act(async () => document.querySelector<HTMLInputElement>('input[value=api]')!.click())
	expect(document.querySelector<HTMLInputElement>('input[value=llamafeed]')!.getAttribute('aria-checked')).toBe('true')
	expect(JSON.parse(posts()[0][1].body)).toMatchObject({
		subscriptionType: 'llamafeed',
		seatCount: 1,
		billingInterval: 'year'
	})
	await act(async () => request.resolve(Response.json({ action: 'checkout_created', clientSecret: 'test-secret' })))
	await vi.waitFor(() => expect(namedDialog('Complete Payment')).toBeTruthy())
	expect(api.checkout).toHaveBeenLastCalledWith({ clientSecret: 'test-secret' })
	await act(async () => document.querySelector('form')!.requestSubmit())
	expect(posts()).toHaveLength(1)
	await click('Close')
	await click('Open')
	expect(namedDialog('Purchase Seats')).toBeTruthy()
})

test('a late purchase response cannot close a new opening after navigation', async () => {
	const first = Promise.withResolvers<Response>()
	api.fetch.mockImplementation((_url, options) =>
		options?.method === 'POST' ? first.promise : Promise.resolve(Response.json({ team }))
	)
	await mount(<Harness key="old" kind="purchase" />)
	await click('Purchase Seats')
	await vi.waitFor(() => expect(posts()).toHaveLength(1))
	await mount(<Harness key="new" kind="purchase" />)
	await act(async () => first.resolve(Response.json({ action: 'seats_added', seatsAdded: 1 })))
	await vi.waitFor(() => expect(button('Purchase Seats').getAttribute('aria-disabled')).not.toBe('true'))
	expect(namedDialog('Purchase Seats')).toBeTruthy()
})

test('assignment requires a selected available plan and retains it after failure', async () => {
	const request = Promise.withResolvers<Response>()
	api.fetch.mockImplementation((_url, options) =>
		options?.method === 'POST' ? request.promise : Promise.resolve(Response.json({ team }))
	)
	await mount(<Harness kind="assign" />)
	await click('Assign')
	expect(posts()).toHaveLength(0)
	const radio = document.querySelector<HTMLInputElement>('input[type=radio]')!
	await act(async () => radio.click())
	await click('Assign')
	await vi.waitFor(() => expect(posts()).toHaveLength(1))
	expect(JSON.parse(posts()[0][1].body)).toEqual({ userId: 'member-user', subscriptionType: 'llamafeed' })
	await act(async () => request.reject(new Error('No seats available')))
	await vi.waitFor(() => expect(document.querySelector('[role=alert]')?.textContent).toContain('No seats available'))
	expect(radio.checked).toBe(true)
})

test('failed member removal keeps the row and its confirmation available for retry', async () => {
	api.fetch.mockImplementation(async (_url, options) => {
		if (options?.method === 'POST') throw new Error('Remove unavailable')
		return Response.json({ team })
	})
	await mount(<TeamMembersCard />)
	await click('Remove member@example.com')
	await click('Remove')
	await vi.waitFor(() => expect(document.querySelector('[role=alert]')?.textContent).toContain('Remove unavailable'))
	expect(namedDialog('Remove Member')).toBeTruthy()
	expect(container.textContent).toContain('member@example.com')
	expect(button('Remove').getAttribute('aria-disabled')).not.toBe('true')
	await click('Cancel')
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Remove member@example.com')))
})

test('returning during an upgrade waits for confirmed yearly pricing before another seat purchase', async () => {
	const upgrade = Promise.withResolvers<Response>()
	const refresh = Promise.withResolvers<Response>()
	api.fetch.mockImplementation((url: string, options) =>
		url.endsWith('/upgrade')
			? upgrade.promise
			: options?.method === 'POST'
				? Promise.resolve(Response.json({ action: 'seats_added', seatsAdded: 1 }))
				: refresh.promise
	)
	await mount(<Hook key="old" id="upgrade" />)
	await act(async () => hooks.upgrade.upgradeSeatsMutation.mutate({ subscriptionType: 'llamafeed' }))
	await vi.waitFor(() => expect(posts()).toHaveLength(1))
	await mount(<Harness key="new" kind="purchase" />)
	expect(button('Purchase Seats').getAttribute('aria-disabled')).toBe('true')
	expect(dialog().textContent).toContain('Another team update is in progress')
	await click('Purchase Seats')
	expect(posts()).toHaveLength(1)
	await act(async () => upgrade.resolve(Response.json({})))
	expect(button('Purchase Seats').getAttribute('aria-disabled')).toBe('true')
	const updated = { ...team, subscriptions: [{ ...team.subscriptions[0], billingInterval: 'year' }] }
	await act(async () => refresh.resolve(Response.json({ team: updated })))
	await vi.waitFor(() => expect(button('Purchase Seats').getAttribute('aria-disabled')).not.toBe('true'))
	expect(dialog().textContent).toContain('$490/year')
	await click('Purchase Seats')
	await vi.waitFor(() => expect(posts()).toHaveLength(2))
	expect(JSON.parse(posts()[1][1].body).billingInterval).toBe('year')
})

test('removing a member returns focus to the surviving members heading', async () => {
	api.fetch.mockImplementation(async (_url, options) => {
		if (options?.method === 'POST') team = { ...team, members: [] }
		return Response.json({ team })
	})
	await mount(<TeamMembersCard />)
	await act(async () => button('Remove member@example.com').focus())
	await click('Remove member@example.com')
	await click('Close')
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Remove member@example.com')))
	await click('Remove member@example.com')
	await click('Remove')
	await vi.waitFor(() => expect(container.textContent).toContain('Members (0)'))
	await vi.waitFor(() => expect(document.activeElement).toBe(container.querySelector('h2')))
})

test('arrow navigation selects the purchase plan and updates its price without submitting', async () => {
	await mount(<Harness kind="purchase" />)
	const pro = document.querySelector<HTMLInputElement>('input[value=llamafeed]')!
	const apiRadio = document.querySelector<HTMLInputElement>('input[value=api]')!
	await act(async () => {
		pro.focus()
		pro.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
	})
	await vi.waitFor(() => expect(apiRadio.checked).toBe(true))
	expect(dialog().textContent).toContain('$300/month')
	expect(posts()).toHaveLength(0)
})

test('a successful write with a failed refresh blocks another billing change until reconciliation succeeds', async () => {
	api.fetch.mockImplementation(async (_url, options) => {
		if (options?.method === 'POST') return Response.json({ action: 'seats_added', seatsAdded: 1 })
		throw new Error('Refresh offline')
	})
	await mount(<Harness kind="purchase" />)
	await click('Purchase Seats')
	await vi.waitFor(() => expect(dialog()).toBeNull())
	await click('Open')
	expect(button('Purchase Seats').getAttribute('aria-disabled')).toBe('true')
	expect(dialog().textContent).toContain("Couldn't refresh team billing")
	await click('Purchase Seats')
	expect(posts()).toHaveLength(1)
	team = { ...team, subscriptions: [{ ...team.subscriptions[0], billingInterval: 'year' }] }
	api.fetch.mockImplementation(async () => Response.json({ team }))
	await click('Try again')
	await vi.waitFor(() => expect(button('Purchase Seats').getAttribute('aria-disabled')).not.toBe('true'))
	expect(dialog().textContent).toContain('$490/year')
	expect(posts()).toHaveLength(1)
})

test('leaving a team waits for confirmation and focuses the surviving team region', async () => {
	team.isAdmin = false
	const request = Promise.withResolvers<Response>()
	api.fetch.mockImplementation((_url, options) =>
		options?.method === 'POST' ? request.promise : Promise.resolve(Response.json({ team: null }))
	)
	await mount(<TeamTab />)
	await click('Leave Team')
	const confirm = namedDialog('Leave Team').querySelectorAll('button')
	await act(async () => [...confirm].find((b) => b.textContent === 'Leave Team')!.click())
	await vi.waitFor(() => expect(posts()).toHaveLength(1))
	expect(container.textContent).toContain('Original')
	await act(async () => request.resolve(Response.json({})))
	await vi.waitFor(() => expect(button('Create Team')).toBeTruthy())
	await vi.waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Team management'))
})

test('revoking an invite keeps its row until confirmed and returns focus to Invite Member', async () => {
	team.pendingInvites = [
		{
			id: 'invite',
			email: 'invite@example.com',
			status: 'pending',
			createdAt: '2026-09-07T00:00:00Z',
			expiresAt: '2026-09-14T00:00:00Z'
		}
	]
	const request = Promise.withResolvers<Response>()
	api.fetch.mockImplementation((_url, options) =>
		options?.method === 'POST' ? request.promise : Promise.resolve(Response.json({ team }))
	)
	await mount(<TeamInvitesCard />)
	await click('Revoke')
	await act(async () =>
		[...namedDialog('Revoke Invite').querySelectorAll('button')].find((b) => b.textContent === 'Revoke')!.click()
	)
	await vi.waitFor(() => expect(posts()).toHaveLength(1))
	expect(container.textContent).toContain('invite@example.com')
	team = { ...team, pendingInvites: [] }
	await act(async () => request.resolve(Response.json({})))
	await vi.waitFor(() => expect(container.textContent).toContain('No pending invites'))
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Invite Member')))
})

test.each(['', '1', '2.5', '0'])(
	'seat form rejects invalid seat count "%s" without sending a request',
	async (value) => {
		await mount(<Harness kind="manage" />)
		await change(document.querySelector<HTMLInputElement>('input[type=number]')!, value)
		expect(dialog().textContent).not.toContain('Bill after update')
		expect(dialog().textContent).not.toContain('will not be refunded')
		await click('Update Seats')
		expect(posts()).toHaveLength(0)
	}
)

test.each(['assign', 'unassign', 'remove'] as const)(
	'canceling %s returns focus to its member control',
	async (action) => {
		if (action === 'unassign') team.members[0].subscriptionType = 'llamafeed'
		await mount(<TeamMembersCard />)
		const trigger = button(
			action === 'assign'
				? 'Assign subscription to member@example.com'
				: action === 'unassign'
					? 'Unassign subscription from member@example.com'
					: 'Remove member@example.com'
		)
		await act(async () => {
			trigger.focus()
			trigger.click()
		})
		await click('Cancel')
		await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
		expect(posts()).toHaveLength(0)
	}
)

test.each(['assign', 'unassign'] as const)('successful %s focuses the replacement member control', async (action) => {
	if (action === 'unassign') team.members[0].subscriptionType = 'llamafeed'
	api.fetch.mockImplementation(async (_url, options) => {
		if (options?.method === 'POST')
			team = { ...team, members: [{ ...team.members[0], subscriptionType: action === 'assign' ? 'llamafeed' : null }] }
		return Response.json({ team })
	})
	await mount(<TeamMembersCard />)
	await click(
		action === 'assign' ? 'Assign subscription to member@example.com' : 'Unassign subscription from member@example.com'
	)
	if (action === 'assign') await act(async () => document.querySelector<HTMLInputElement>('input[type=radio]')!.click())
	await click(action === 'assign' ? 'Assign' : 'Unassign')
	await vi.waitFor(() =>
		expect(document.activeElement).toBe(
			button(
				action === 'assign'
					? 'Unassign subscription from member@example.com'
					: 'Assign subscription to member@example.com'
			)
		)
	)
	expect(posts()).toHaveLength(1)
})
