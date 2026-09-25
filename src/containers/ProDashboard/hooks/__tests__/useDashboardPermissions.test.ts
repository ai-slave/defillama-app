import { expect, test } from 'vitest'
import type { Dashboard } from '../../dashboardTypes'
import { type DashboardViewer, getDashboardPermissions } from '../useDashboardPermissions'

const owner: DashboardViewer = {
	userId: 'owner',
	isAuthenticated: true,
	hasActiveSubscription: true,
	sessionLoading: false
}
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
const teamDashboard: Dashboard = {
	...privateDashboard,
	user: 'creator',
	team: { id: 'team-1', name: 'Growth' }
}

test('a loading session is read-only for the loading reason', () => {
	expect(getDashboardPermissions(privateDashboard, { ...owner, sessionLoading: true })).toMatchObject({
		isReadOnly: true,
		isOwner: false,
		reason: 'loading'
	})
})

test('an owner with an active subscription can edit a private dashboard', () => {
	expect(getDashboardPermissions(privateDashboard, owner)).toEqual({
		isReadOnly: false,
		isOwner: true,
		dashboardOwnerId: 'owner',
		reason: null,
		role: 'owner',
		canEdit: true,
		canDelete: true,
		canMove: true,
		team: null
	})
})

test('a lapsed subscription turns the owner of a private dashboard into a viewer who can still delete it', () => {
	expect(getDashboardPermissions(privateDashboard, { ...owner, hasActiveSubscription: false })).toMatchObject({
		isReadOnly: true,
		isOwner: false,
		reason: 'subscription',
		canEdit: false,
		canDelete: true,
		canMove: true
	})
})

test('someone else’s public dashboard is read-only for not being the owner', () => {
	expect(getDashboardPermissions(publicDashboard, owner)).toMatchObject({
		isReadOnly: true,
		isOwner: false,
		reason: 'not-owner',
		canDelete: false
	})
})

test('someone else’s private dashboard cannot be edited, deleted or moved', () => {
	expect(getDashboardPermissions({ ...privateDashboard, user: 'someone-else' }, owner)).toMatchObject({
		isReadOnly: true,
		isOwner: false,
		reason: 'not-owner',
		canEdit: false,
		canDelete: false,
		canMove: false
	})
})

test('a new dashboard is editable only once signed in', () => {
	expect(getDashboardPermissions(null, owner)).toMatchObject({ isReadOnly: false, isOwner: true, reason: null })
	expect(
		getDashboardPermissions(null, { ...owner, userId: undefined, isAuthenticated: false, hasActiveSubscription: false })
	).toMatchObject({ isReadOnly: true, isOwner: false, reason: 'not-owner' })
})

test('a free owner can still edit their public dashboard', () => {
	expect(getDashboardPermissions(ownPublicDashboard, { ...owner, hasActiveSubscription: false })).toMatchObject({
		isReadOnly: false,
		isOwner: true,
		reason: null
	})
})

test('server access decides team dashboards: a member with a seat edits but cannot delete', () => {
	expect(
		getDashboardPermissions(
			{ ...teamDashboard, access: { role: 'member', canEdit: true, canDelete: false, canMove: false } },
			{ ...owner, userId: 'member' }
		)
	).toEqual({
		isReadOnly: false,
		isOwner: false,
		dashboardOwnerId: 'creator',
		reason: null,
		role: 'member',
		canEdit: true,
		canDelete: false,
		canMove: false,
		team: { id: 'team-1', name: 'Growth' }
	})
})

test('a team viewer without a seat is read-only for the subscription reason', () => {
	expect(
		getDashboardPermissions(
			{ ...teamDashboard, access: { role: 'viewer', canEdit: false, canDelete: false, canMove: false } },
			{ ...owner, userId: 'member', hasActiveSubscription: false }
		)
	).toMatchObject({ isReadOnly: true, reason: 'subscription', role: 'viewer', canEdit: false })
})

test('server access wins over the client owner check', () => {
	expect(
		getDashboardPermissions(
			{ ...teamDashboard, access: { role: 'none', canEdit: false, canDelete: false, canMove: false } },
			{ ...owner, userId: 'creator' }
		)
	).toMatchObject({ isReadOnly: true, isOwner: true, reason: 'not-owner', role: 'none' })
})
