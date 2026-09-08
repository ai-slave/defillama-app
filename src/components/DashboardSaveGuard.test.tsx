// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getUnsavedDashboardItems, type DashboardUpdate } from '~/containers/ProDashboard/hooks/useDashboardAPI'
import { DashboardSaveGuard } from './DashboardSaveGuard'

const route = vi.hoisted(() => ({ pathname: '/yields', query: {} as { dashboardId?: string } }))
const auth = vi.hoisted(() => ({ user: { id: 'owner' }, isAuthenticated: true }))
vi.mock('next/router', () => ({ useRouter: () => route }))
vi.mock('~/auth', () => ({ useAuthContext: () => auth }))
let client: QueryClient
let root: Root
let container: HTMLDivElement
const request: DashboardUpdate = {
	id: 'draft',
	source: 'autosave',
	data: { dashboardName: 'Research dashboard', items: [], visibility: 'public', tags: [], description: '' },
	changes: { items: [{ id: 'text', kind: 'text', content: 'Keep this' }] }
}
async function render() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<DashboardSaveGuard />
				<main tabIndex={-1}>Yields page</main>
			</QueryClientProvider>
		)
	)
}
async function fail(userId = 'owner') {
	const mutation = client.getMutationCache().build(client, {
		mutationKey: ['pro-dashboard-update', request.id, userId],
		mutationFn: async (_request: DashboardUpdate) => {
			throw new Error('Offline')
		},
		gcTime: Infinity
	})
	await act(async () => mutation.execute(request).catch(() => {}))
	await render()
}
function button(text: string) {
	return [...document.querySelectorAll('button')].find((el) => el.textContent === text)!
}
function warns() {
	const event = new Event('beforeunload', { cancelable: true })
	window.dispatchEvent(event)
	return event.defaultPrevented
}
beforeEach(async () => {
	auth.user = { id: 'owner' }
	route.pathname = '/yields'
	route.query = {}
	client = new QueryClient()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await render()
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})

test('a failed draft on another page can be reopened, kept, or explicitly discarded', async () => {
	await fail()
	expect(container.querySelector('a')?.getAttribute('href')).toBe('/pro/draft/edit')
	expect(warns()).toBe(true)
	const trigger = button('Discard draft…')
	await act(async () => {
		trigger.focus()
		trigger.click()
	})
	await vi.waitFor(() =>
		expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Discard unsaved dashboard changes?')
	)
	await act(async () => button('Keep draft').click())
	await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
	expect(getUnsavedDashboardItems(client, 'draft', 'owner')).toEqual(request.changes!.items)
	expect(warns()).toBe(true)
	await act(async () => trigger.click())
	await act(async () => button('Discard draft').click())
	await act(async () => {
		await vi.waitFor(() => expect(container.querySelector('section')).toBeNull())
	})
	expect(getUnsavedDashboardItems(client, 'draft', 'owner')).toBeUndefined()
	expect(warns()).toBe(false)
	await vi.waitFor(() => expect(document.activeElement).toBe(container.querySelector('main')))
})

test('the notice is hidden only in its own editor, including slug routes', async () => {
	await fail()
	client.setQueryData(['pro-dashboard', 'dashboard', 'research', true, 'owner'], { id: 'draft' })
	route.pathname = '/pro/[dashboardId]/edit'
	route.query = { dashboardId: 'research' }
	await render()
	expect(container.querySelector('section')).toBeNull()
	expect(warns()).toBe(true)
	route.pathname = '/pro/[dashboardId]'
	await render()
	expect(container.querySelector('section')).not.toBeNull()
	route.pathname = '/pro/[dashboardId]/edit'
	route.query = { dashboardId: 'other' }
	await render()
	expect(container.querySelector('section')).not.toBeNull()
})

test('another account’s failed draft cannot show a notice or arm the warning', async () => {
	await fail('other')
	expect(container.querySelector('section')).toBeNull()
	expect(warns()).toBe(false)
})

test('switching accounts updates recovery notices without another mutation', async () => {
	await fail()
	expect(container.querySelector('section')).not.toBeNull()
	auth.user = { id: 'other' }
	await render()
	expect(container.querySelector('section')).toBeNull()
	expect(warns()).toBe(false)
	auth.user = { id: 'owner' }
	await render()
	expect(container.querySelector('section')).not.toBeNull()
	expect(warns()).toBe(true)
})

test('a newer pending save hides discard and successful recovery clears the warning', async () => {
	await fail()
	const completion = Promise.withResolvers<void>()
	const pending = client.getMutationCache().build(client, {
		mutationKey: ['pro-dashboard-update', request.id, 'owner'],
		mutationFn: (_request: DashboardUpdate) => completion.promise
	})
	let save: Promise<void>
	await act(async () => {
		save = pending.execute({ ...request })
	})
	await render()
	expect(container.querySelector('section')).toBeNull()
	expect(warns()).toBe(true)
	await act(async () => {
		completion.resolve()
		await save
	})
	await render()
	expect(warns()).toBe(false)
	expect(container.querySelector('section')).toBeNull()
})
