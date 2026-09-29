// @vitest-environment happy-dom
import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast from 'react-hot-toast'
import { afterAll, afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest'
import { AUTH_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { AssignSubscriptionModal } from '../Team/AssignSubscriptionModal'
import { InviteMemberModal } from '../Team/InviteMemberModal'
import { ManageSeatsModal } from '../Team/ManageSeatsModal'
import { PurchaseSeatsModal } from '../Team/PurchaseSeatsModal'
import { TeamInvitesCard } from '../Team/TeamInvitesCard'
import { TeamMembersCard } from '../Team/TeamMembersCard'
import { TeamSeatsCard } from '../Team/TeamSeatsCard'
import { TeamTab } from '../Team/TeamTab'
import type { Team } from '../Team/types'
import { useTeam } from '../Team/useTeam'

vi.hoisted(() => {
	process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_team_preview'
})
afterAll(() => {
	delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
})
const api = vi.hoisted(() => ({
	/** The team service behind `${AUTH_SERVER}/team*`: (url, init) => Response. */
	fetch: vi.fn(),
	/** PocketBase auth-refresh replies with this account record. */
	refresh: vi.fn<() => Promise<object>>(),
	checkout: vi.fn()
}))
const router = vi.hoisted(() => ({
	isReady: true,
	pathname: '/account',
	query: {} as { token?: string },
	replace: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve({}) }))
vi.mock('@stripe/react-stripe-js', () => ({
	EmbeddedCheckoutProvider: ({ children, options }: { children: ReactNode; options: { clientSecret: string } }) => {
		api.checkout(options)
		return children
	},
	EmbeddedCheckout: () => null
}))
const session = installSubscriberSession('user')
const refreshRequests = () =>
	session.requests.filter((request) => request.url.pathname === '/api/collections/users/auth-refresh')
const verifyEmailPrompted = () => document.body.textContent?.includes('Verify your email') ?? false
let root: Root
let container: HTMLDivElement
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
	router.query = {}
	// Team writes must opt out of retries themselves; a retrying default proves they do.
	session.client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: 2 } })
	const record = pb.authStore.record!
	api.refresh.mockImplementation(async () => pb.authStore.record ?? record)
	session.serve({
		[`${AUTH_SERVER}/team`]: (url: URL, init?: RequestInit) => api.fetch(url.href, init),
		'/subscription/past-due': () => Response.json({ message: 'No past due subscription found' }, { status: 404 }),
		'/subscription/trial-available': { trialAvailable: false },
		'/sendOtp': {},
		'/user/credits': { credits: 0, maxCredits: 0, monthKey: '2026-09' },
		'/api/collections/users/auth-refresh': async () => ({ token: pb.authStore.token, record: await api.refresh() })
	})
	// The provider already confirmed the session; only the invite flow reads it again.
	session.client.setQueryData(['auth', 'status', 'user'], record)
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
	session.client.setQueryData(['team', 'user'], team)
	api.fetch.mockImplementation(async () => Response.json({ team }))
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function mount(element: ReactNode) {
	await act(async () => root.render(<session.Wrapper>{element}</session.Wrapper>))
}
function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find((e) => accessibleName(e) === name)!
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
		await waitForUi(() => expect(posts()).toHaveLength(1))
		expect(session.client.getQueryData(['team', 'user'])).toEqual(team)
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
		await act(async () => session.client.setQueryData(['team', 'user'], updated))
		await act(async () => request.reject(new Error('Request failed')))
		await waitForUi(() =>
			expect(
				session.client
					.getMutationCache()
					.getAll()
					.some((m) => m.state.status === 'error')
			).toBe(true)
		)
		// Inspect before reconciliation: a GET must not conceal a destructive rollback.
		expect(session.client.getQueryData(['team', 'user'])).toEqual(updated)
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
		await waitForUi(() => expect(posts()).toHaveLength(1))
		await mount(<Hook key="second" id="second" />)
		await act(async () =>
			hooks.second.assignMemberMutation.mutate({ userId: 'member-user', subscriptionType: 'llamafeed' })
		)
		expect(posts()).toHaveLength(1)
		if (success) {
			await act(async () => first.resolve(Response.json({})))
		} else await act(async () => first.reject(new Error('Declined')))
		await waitForUi(() => expect(api.fetch.mock.calls.some(([url]) => url.endsWith('/team'))).toBe(true))
		await waitForUi(() => expect(posts()).toHaveLength(success ? 1 : 2))
		await act(async () => refresh.resolve(Response.json({ team })))
		await waitForUi(() => expect(posts()).toHaveLength(2))
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
	await waitForUi(() => expect(document.activeElement).toBe(input))
	await click('Send Invite')
	await change(input, 'not-an-email')
	await click('Send Invite')
	expect(posts()).toHaveLength(0)
	await change(input, 'colleague@example.com')
	await click('Send Invite')
	await waitForUi(() => expect(posts()).toHaveLength(1))
	await waitForUi(() => expect(input.readOnly).toBe(true))
	await click('Close dialog')
	expect(dialog()).toBeTruthy()
	await act(async () => first.reject(new Error('Invite unavailable')))
	await waitForUi(() => expect(document.querySelector('[role=alert]')?.textContent).toContain('Invite unavailable'))
	expect(input.value).toBe('colleague@example.com')
	api.fetch.mockImplementation(async () => Response.json({ team }))
	await click('Send Invite')
	await waitForUi(() => expect(dialog()).toBeNull())
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
	await waitForUi(() => expect(posts()).toHaveLength(1))
	expect(JSON.parse(posts()[0][1].body)).toEqual({ subscriptionType: 'llamafeed', seatCount: 4 })
	await waitForUi(() => expect(input.readOnly).toBe(true))
	expect(button('Increase seats').disabled).toBe(true)
	await click('Close dialog')
	expect(dialog()).toBeTruthy()
	await act(async () => request.reject(new Error('Card declined')))
	await waitForUi(() => expect(document.querySelector('[role=alert]')?.textContent).toContain('Card declined'))
	expect(input.value).toBe('4')
})

test('cancellation sends zero only after confirmation and preserves access until period end', async () => {
	await mount(<Harness kind="manage" />)
	await click('Cancel subscription')
	const confirmation = namedDialog('Cancel Pro Subscription')
	expect(confirmation.getAttribute('role')).toBe('alertdialog')
	expect(confirmation.textContent).toContain('Assigned members keep access until the period ends')
	const keep = [...confirmation.querySelectorAll('button')].find((b) => accessibleName(b) === 'Keep subscription')!
	await waitForUi(() => expect(document.activeElement).toBe(keep))
	await act(async () => keep.click())
	await waitForUi(() => expect(namedDialog('Cancel Pro Subscription')).toBeUndefined())
	expect(namedDialog('Manage Pro Seats')).toBeTruthy()
	expect(posts()).toHaveLength(0)
	await click('Cancel subscription')
	await click('Cancel Subscription')
	await waitForUi(() => expect(posts()).toHaveLength(1))
	expect(JSON.parse(posts()[0][1].body)).toEqual({ subscriptionType: 'llamafeed', seatCount: 0 })
})

test('a cancel confirmation locked by a failed team refresh after a failed cancel says why', async () => {
	api.fetch.mockImplementation(async (_url, options) =>
		options?.method === 'POST'
			? Response.json({ message: 'Card declined' }, { status: 402 })
			: Response.json({ message: 'Team unavailable' }, { status: 500 })
	)
	await mount(<Harness kind="manage" />)
	await click('Cancel subscription')
	await click('Cancel Subscription')
	const confirmation = namedDialog('Cancel Pro Subscription')
	const confirm = () =>
		[...confirmation.querySelectorAll('button')].find((b) => accessibleName(b) === 'Cancel Subscription')!
	await waitForUi(() => expect(confirm().disabled).toBe(true))

	expect(confirmation.querySelector('[role=alert]')?.textContent).toBe(
		"Couldn't refresh the team. Close this and try again."
	)
	expect(posts()).toHaveLength(1)
})

test('seat form says why Update Seats and Decrease seats are disabled', async () => {
	await mount(<Harness kind="manage" />)
	expect(button('Update Seats').disabled).toBe(true)
	expect(dialog().textContent).toContain('Change the seat count to update')
	await change(document.querySelector<HTMLInputElement>('input[type=number]')!, '2')
	expect(button('Update Seats').disabled).toBe(false)
	expect(dialog().textContent).not.toContain('Change the seat count to update')
	expect(button('Decrease seats').disabled).toBe(true)
	expect(dialog().textContent).toContain("You can't reduce below 2 seats")
})

test('an upgrade confirmation waits in its button while another team update runs and sends nothing', async () => {
	const other = Promise.withResolvers<Response>()
	api.fetch.mockImplementation((_url, options) =>
		options?.method === 'POST' ? other.promise : Promise.resolve(Response.json({ team }))
	)
	await mount(
		<>
			<TeamSeatsCard />
			<Hook id="other" />
		</>
	)
	await click('Upgrade to Yearly')
	const confirmation = namedDialog('Upgrade Pro to Yearly')
	const confirm = () => [...confirmation.querySelectorAll('button')].at(-1)!
	expect(accessibleName(confirm())).toBe('Upgrade to Yearly')
	await act(async () => hooks.other.setSeatsMutation.mutate({ subscriptionType: 'llamafeed', seatCount: 4 }))
	await waitForUi(() => expect(accessibleName(confirm())).toBe('Updating…'))
	expect(confirmation.querySelector('[role=status]')?.textContent).toBe('Updating…')
	expect(confirm().getAttribute('aria-disabled')).toBe('true')
	expect(confirmation.querySelector('[role=alert]')).toBeNull()
	await act(async () => confirm().click())
	expect(posts().map(([url]) => new URL(url).pathname)).toEqual(['/team/seats'])
	await act(async () => other.resolve(Response.json({})))
})

test.each(['assign', 'revoke'] as const)('%s confirms success only once its dialog has closed', async (action) => {
	team.pendingInvites = [
		{
			id: 'invite',
			email: 'invite@example.com',
			status: 'pending',
			createdAt: '2026-09-07T00:00:00Z',
			expiresAt: '2026-09-14T00:00:00Z'
		}
	]
	const refresh = Promise.withResolvers<Response>()
	api.fetch.mockImplementation((_url, options) =>
		options?.method === 'POST' ? Promise.resolve(Response.json({})) : refresh.promise
	)
	const title = action === 'assign' ? 'Assign Subscription' : 'Revoke Invite'
	if (action === 'assign') {
		await mount(<TeamMembersCard />)
		await click('Assign subscription to member@example.com')
		await act(async () => document.querySelector<HTMLInputElement>('input[type=radio]')!.click())
		await click('Assign')
	} else {
		await mount(<TeamInvitesCard />)
		await click('Revoke')
		await act(async () =>
			[...namedDialog(title).querySelectorAll('button')].find((b) => accessibleName(b) === 'Revoke')!.click()
		)
	}
	// The write succeeded and its reconciliation read is in flight: the dialog is still open.
	await waitForUi(() => expect(api.fetch.mock.calls.some(([url]) => url.endsWith('/team'))).toBe(true))
	expect(namedDialog(title)).toBeTruthy()
	expect(toast.success).not.toHaveBeenCalled()
	team =
		action === 'assign'
			? { ...team, members: [{ ...team.members[0], subscriptionType: 'llamafeed' }] }
			: { ...team, pendingInvites: [] }
	await act(async () => refresh.resolve(Response.json({ team })))
	await waitForUi(() => expect(namedDialog(title)).toBeUndefined())
	expect(toast.success).toHaveBeenCalledExactlyOnceWith(
		action === 'assign' ? 'Subscription assigned' : 'Invite revoked'
	)
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
	await waitForUi(() => expect(posts()).toHaveLength(1))
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
	expect(dialog().textContent).toContain("Monthly and yearly billing can't be mixed for the same plan")
	expect(dialog().textContent).toContain('$490/year')
	await click('Purchase Seats')
	await waitForUi(() => expect(posts()).toHaveLength(1))
	await waitForUi(() =>
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
	await waitForUi(() => expect(namedDialog('Complete Payment')).toBeTruthy())
	expect(api.checkout).toHaveBeenLastCalledWith({ clientSecret: 'test-secret' })
	await act(async () => document.querySelector('form')!.requestSubmit())
	expect(posts()).toHaveLength(1)
	await click('Close dialog')
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
	await waitForUi(() => expect(posts()).toHaveLength(1))
	await mount(<Harness key="new" kind="purchase" />)
	await act(async () => first.resolve(Response.json({ action: 'seats_added', seatsAdded: 1 })))
	await waitForUi(() => expect(button('Purchase Seats').disabled).toBe(false))
	expect(button('Purchase Seats').getAttribute('aria-disabled')).not.toBe('true')
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
	await waitForUi(() => expect(posts()).toHaveLength(1))
	expect(JSON.parse(posts()[0][1].body)).toEqual({ userId: 'member-user', subscriptionType: 'llamafeed' })
	await act(async () => request.reject(new Error('No seats available')))
	await waitForUi(() => expect(document.querySelector('[role=alert]')?.textContent).toContain('No seats available'))
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
	await waitForUi(() => expect(document.querySelector('[role=alert]')?.textContent).toContain('Remove unavailable'))
	expect(namedDialog('Remove Member')).toBeTruthy()
	expect(container.textContent).toContain('member@example.com')
	expect(button('Remove').getAttribute('aria-disabled')).not.toBe('true')
	await click('Cancel')
	await waitForUi(() => expect(document.activeElement).toBe(button('Remove member@example.com')))
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
	await waitForUi(() => expect(posts()).toHaveLength(1))
	await mount(<Harness key="new" kind="purchase" />)
	const submit = () => dialog().querySelector<HTMLButtonElement>('button[type=submit]')!
	expect(accessibleName(submit())).toBe('Updating…')
	await act(async () => submit().click())
	expect(posts()).toHaveLength(1)
	await act(async () => upgrade.resolve(Response.json({})))
	// The upgrade settles only once its team refetch lands, so the purchase keeps waiting.
	expect(submit().getAttribute('aria-busy')).toBe('true')
	const updated = { ...team, subscriptions: [{ ...team.subscriptions[0], billingInterval: 'year' }] }
	await act(async () => refresh.resolve(Response.json({ team: updated })))
	await waitForUi(() => expect(accessibleName(submit())).toBe('Purchase Seats'))
	expect(dialog().textContent).toContain('$490/year')
	await click('Purchase Seats')
	await waitForUi(() => expect(posts()).toHaveLength(2))
	expect(JSON.parse(posts()[1][1].body).billingInterval).toBe('year')
})

test('removing a member returns focus to the surviving members heading', async () => {
	api.fetch.mockImplementation(async (_url, options) => {
		if (options?.method === 'POST') team = { ...team, members: [] }
		return Response.json({ team })
	})
	await mount(<TeamMembersCard />)
	await click('Remove member@example.com')
	await click('Remove')
	await waitForUi(() => expect(container.textContent).toContain('Members (0)'))
	await waitForUi(() => expect(document.activeElement).toBe(container.querySelector('h2')))
})

test('choosing the API plan shows its price without submitting', async () => {
	await mount(<Harness kind="purchase" />)
	const apiRadio = document.querySelector<HTMLInputElement>('input[value=api]')!
	await act(async () => apiRadio.click())
	expect(apiRadio.checked).toBe(true)
	expect(dialog().textContent).toContain('$300/month')
	expect(posts()).toHaveLength(0)
})

test('the seats card says why billing buttons are disabled while the team refreshes', async () => {
	const refresh = Promise.withResolvers<Response>()
	api.fetch.mockImplementation(() => refresh.promise)
	await mount(<TeamSeatsCard />)
	const status = () => container.querySelector('[role=status]')!.textContent
	expect(status()).toBe('')
	await act(async () => void session.client.refetchQueries({ queryKey: ['team', 'user'] }))

	await waitForUi(() => expect(status()).toContain('Refreshing'))
	expect(button('Purchase Seats').disabled).toBe(true)
	await act(async () => refresh.resolve(Response.json({ team })))
	await waitForUi(() => expect(status()).toBe(''))
	expect(button('Purchase Seats').disabled).toBe(false)
})

test('a successful write with a failed refresh blocks another billing change until reconciliation succeeds', async () => {
	api.fetch.mockImplementation(async (_url, options) => {
		if (options?.method === 'POST') return Response.json({ action: 'seats_added', seatsAdded: 1 })
		throw new Error('Refresh offline')
	})
	await mount(<Harness kind="purchase" />)
	await click('Purchase Seats')
	await waitForUi(() => expect(dialog()).toBeNull())
	await click('Open')
	expect(button('Purchase Seats').disabled).toBe(true)
	expect(dialog().textContent).toContain("Couldn't refresh team billing")
	await click('Purchase Seats')
	expect(posts()).toHaveLength(1)
	team = { ...team, subscriptions: [{ ...team.subscriptions[0], billingInterval: 'year' }] }
	api.fetch.mockImplementation(async () => Response.json({ team }))
	await click('Try again')
	await waitForUi(() => expect(button('Purchase Seats').disabled).toBe(false))
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
	await act(async () => [...confirm].find((b) => accessibleName(b) === 'Leave Team')!.click())
	await waitForUi(() => expect(posts()).toHaveLength(1))
	expect(container.textContent).toContain('Original')
	await act(async () => request.resolve(Response.json({})))
	await waitForUi(() => expect(button('Create Team')).toBeTruthy())
	await waitForUi(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Team management'))
})

test('a failed team refresh keeps showing the cached team instead of a load error', async () => {
	api.fetch.mockImplementation(async () => {
		throw new Error('Refresh offline')
	})
	await mount(<TeamTab />)
	await act(async () => {
		await session.client.refetchQueries({ queryKey: ['team', 'user'] })
		// Query observers notify on a zero-delay timer; let the failed state render.
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
	expect(session.client.getQueryState(['team', 'user'])?.status).toBe('error')
	expect(container.textContent).toContain('Original')
	expect(container.textContent).not.toContain("Couldn't load your team")
})

test('a pending invite shows its expiry date as text', async () => {
	// Two days out, where a relative label would read "in 2d".
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(new Date('2099-01-06T12:00:00Z'))
	onTestFinished(() => {
		vi.useRealTimers()
	})
	team.pendingInvites = [
		{
			id: 'invite',
			email: 'invite@example.com',
			status: 'pending',
			createdAt: '2099-01-01T00:00:00Z',
			expiresAt: '2099-01-08T18:00:00Z'
		}
	]
	session.client.setQueryData(['team', 'user'], team)
	await mount(<TeamInvitesCard />)

	expect(container.textContent).toContain('Expires Jan 8, 2099')
	expect(container.querySelector('[title]')).toBeNull()
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
		[...namedDialog('Revoke Invite').querySelectorAll('button')].find((b) => accessibleName(b) === 'Revoke')!.click()
	)
	await waitForUi(() => expect(posts()).toHaveLength(1))
	expect(container.textContent).toContain('invite@example.com')
	team = { ...team, pendingInvites: [] }
	await act(async () => request.resolve(Response.json({})))
	await waitForUi(() => expect(container.textContent).toContain('No pending invites'))
	await waitForUi(() => expect(document.activeElement).toBe(button('Invite Member')))
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
		await waitForUi(() => expect(document.activeElement).toBe(trigger))
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
	await waitForUi(() =>
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

const inviteAccount = {
	id: 'user',
	email: 'invite@example.com',
	verified: false,
	collectionId: '_pb_users_auth_',
	collectionName: 'users'
}

test.each([true, false])(
	'prompts for invite verification only after a fresh account read: verified=%s',
	async (verified) => {
		pb.authStore.save(pb.authStore.token, inviteAccount)
		router.query = { token: 'invite-token' }
		const refresh = Promise.withResolvers<object>()
		api.refresh.mockReturnValue(refresh.promise)
		await mount(<TeamTab />)
		await waitForUi(async () => {
			await act(async () => {})
			expect(refreshRequests()).toHaveLength(1)
		})
		expect(document.body.textContent).toContain('Invite accepted. Loading your account')
		expect(verifyEmailPrompted()).toBe(false)
		expect(router.replace).not.toHaveBeenCalled()
		await act(async () => refresh.resolve({ ...inviteAccount, verified }))
		await waitForUi(async () => {
			await act(async () => {})
			expect(router.replace).toHaveBeenCalled()
		})
		expect(verifyEmailPrompted()).toBe(!verified)
		expect(posts().map(([url]) => new URL(url).pathname)).toEqual(['/team/invite/accept'])
	}
)

test.each([true, false])('recovers a lost invite response by reading membership: joined=%s', async (joined) => {
	pb.authStore.save(pb.authStore.token, inviteAccount)
	router.query = { token: 'invite-token' }
	session.client.removeQueries({ queryKey: ['team', 'user'] })
	team.isAdmin = false
	api.fetch.mockImplementation(async (_url, options) => {
		if (options?.method === 'POST') throw new TypeError('Connection lost after acceptance')
		return Response.json({ team: null })
	})
	await mount(<TeamTab />)
	await waitForUi(async () => {
		await act(async () => {})
		expect(button('Check membership')).toBeDefined()
	})
	expect(refreshRequests()).toHaveLength(0)
	api.fetch.mockRejectedValueOnce(new TypeError('Membership read failed'))
	await click('Check membership')
	await waitForUi(async () => {
		await act(async () => {})
		expect(container.textContent).toContain('Could not check membership')
	})
	api.fetch.mockImplementation(async () => Response.json({ team: joined ? team : null }))
	await click('Check membership')
	await waitForUi(async () => {
		await act(async () => {})
		expect(container.textContent?.includes('Could not check membership')).toBe(false)
		expect(router.replace.mock.calls.length > 0).toBe(joined)
	})
	expect(posts()).toHaveLength(1)
	expect(verifyEmailPrompted()).toBe(joined)
	expect(refreshRequests()).toHaveLength(joined ? 1 : 0)
})

test('manage seats opens on the seat count', async () => {
	await mount(<Harness kind="manage" />)
	await waitForUi(() => expect(document.activeElement).toBe(document.querySelector('input[type=number]')))
})
