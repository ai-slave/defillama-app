import { expect, test } from 'vitest'
import { getEditorExitPath } from '../editorAccess'

const owned = { user: 'owner', slug: 'test-dashboard' }
const exit = (
	isAuthenticated: boolean,
	userId: string | undefined,
	dashboard: Parameters<typeof getEditorExitPath>[0]['dashboard']
) => getEditorExitPath({ dashboardId: 'test-id', isAuthenticated, userId, dashboard })

test('the owner stays in the editor', () => {
	expect(exit(true, 'owner', owned)).toBeNull()
})

test('a signed-out session leaves for the route it opened', () => {
	expect(exit(false, undefined, owned)).toBe('/pro/test-id')
})

test('another account leaves for the dashboard view', () => {
	expect(exit(true, 'other', owned)).toBe('/pro/test-dashboard')
	expect(exit(true, 'other', { user: 'owner' })).toBe('/pro/test-id')
})

test('a team member with server-resolved edit access stays in the editor', () => {
	const access = { role: 'member', canEdit: true, canDelete: false, canMove: false } as const
	expect(exit(true, 'member', { ...owned, access })).toBeNull()
})

test('server access of none sends a non-member out of the editor', () => {
	const access = { role: 'none', canEdit: false, canDelete: false, canMove: false } as const
	expect(exit(true, 'stranger', { ...owned, access })).toBe('/pro/test-dashboard')
})

test('a signed-in session waits for the dashboard before deciding', () => {
	expect(exit(true, 'other', null)).toBeNull()
})
