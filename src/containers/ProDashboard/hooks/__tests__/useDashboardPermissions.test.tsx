// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Dashboard } from '../../dashboardTypes'
import { useDashboardPermissions } from '../useDashboardPermissions'

const auth = vi.hoisted(() => ({
	current: {
		user: { id: 'owner' } as { id: string } | null,
		isAuthenticated: true,
		hasActiveSubscription: true,
		loaders: { userLoading: false, sessionLoading: false }
	}
}))
vi.mock('~/auth', () => ({ useAuthContext: () => auth.current }))

const privateDashboard: Dashboard = {
	id: 'dashboard',
	user: 'owner',
	visibility: 'private',
	data: { dashboardName: 'Mine', items: [] },
	created: '',
	updated: ''
}
const publicDashboard: Dashboard = { ...privateDashboard, user: 'someone-else', visibility: 'public' }
const ownPublicDashboard: Dashboard = { ...privateDashboard, visibility: 'public' }

let root: Root
let container: HTMLDivElement
let permissions: ReturnType<typeof useDashboardPermissions>

function Harness({ dashboard }: { dashboard: Dashboard | null }) {
	permissions = useDashboardPermissions(dashboard)
	return null
}

async function mount(dashboard: Dashboard | null) {
	await act(async () => root.render(<Harness dashboard={dashboard} />))
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	auth.current = {
		user: { id: 'owner' },
		isAuthenticated: true,
		hasActiveSubscription: true,
		loaders: { userLoading: false, sessionLoading: false }
	}
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('a loading session is read-only for the loading reason', async () => {
	auth.current.loaders = { userLoading: true, sessionLoading: true }
	await mount(privateDashboard)
	expect(permissions).toMatchObject({ isReadOnly: true, isOwner: false, reason: 'loading' })
})

test('an owner with an active subscription can edit a private dashboard', async () => {
	await mount(privateDashboard)
	expect(permissions).toMatchObject({ isReadOnly: false, isOwner: true, reason: null })
})

test('a lapsed subscription turns the owner of a private dashboard into a viewer', async () => {
	auth.current.hasActiveSubscription = false
	await mount(privateDashboard)
	expect(permissions).toMatchObject({ isReadOnly: true, isOwner: false, reason: 'subscription' })
})

test('someone else’s public dashboard is read-only for not being the owner', async () => {
	await mount(publicDashboard)
	expect(permissions).toMatchObject({ isReadOnly: true, isOwner: false, reason: 'not-owner' })
})

test('a new dashboard is editable once the session is known', async () => {
	await mount(null)
	expect(permissions).toMatchObject({ isReadOnly: false, isOwner: true, reason: null })
})

test('a failed subscription lookup still lets the owner edit a public dashboard', async () => {
	auth.current.hasActiveSubscription = false
	auth.current.loaders = { userLoading: true, sessionLoading: false }
	await mount(ownPublicDashboard)
	expect(permissions).toMatchObject({ isReadOnly: false, isOwner: true, reason: null })
})

const teamDashboard: Dashboard = {
	...privateDashboard,
	user: 'creator',
	team: { id: 'team-1', name: 'Growth' }
}

test('server access decides team dashboards: a member with a seat edits but cannot delete', async () => {
	auth.current.user = { id: 'member' }
	await mount({ ...teamDashboard, access: { role: 'member', canEdit: true, canDelete: false, canMove: false } })
	expect(permissions).toMatchObject({
		isReadOnly: false,
		isOwner: false,
		reason: null,
		role: 'member',
		canEdit: true,
		canDelete: false,
		canMove: false,
		team: { id: 'team-1', name: 'Growth' }
	})
})

test('a team viewer without a seat is read-only for the subscription reason', async () => {
	auth.current.user = { id: 'member' }
	auth.current.hasActiveSubscription = false
	await mount({ ...teamDashboard, access: { role: 'viewer', canEdit: false, canDelete: false, canMove: false } })
	expect(permissions).toMatchObject({ isReadOnly: true, reason: 'subscription', role: 'viewer', canEdit: false })
})

test('the admin without a seat may delete and move but not edit', async () => {
	auth.current.user = { id: 'admin' }
	auth.current.hasActiveSubscription = false
	await mount({ ...teamDashboard, access: { role: 'admin', canEdit: false, canDelete: true, canMove: true } })
	expect(permissions).toMatchObject({ isReadOnly: true, role: 'admin', canDelete: true, canMove: true, isOwner: false })
})

test('server access wins over the client owner check', async () => {
	auth.current.user = { id: 'creator' }
	await mount({ ...teamDashboard, access: { role: 'none', canEdit: false, canDelete: false, canMove: false } })
	expect(permissions).toMatchObject({ isReadOnly: true, isOwner: true, reason: 'not-owner', role: 'none' })
})

test('without server access the creator keeps the owner-only rules', async () => {
	await mount(privateDashboard)
	expect(permissions).toMatchObject({ role: 'owner', canEdit: true, canDelete: true, canMove: true, team: null })
})
