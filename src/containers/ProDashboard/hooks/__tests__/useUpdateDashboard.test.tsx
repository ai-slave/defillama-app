// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import type { Dashboard } from '../../dashboardTypes'
import { useUpdateDashboard } from '../useDashboardAPI'

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toastMock, toast: toastMock }))
vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), query: {} }) }))

const session = installSubscriberSession('owner')
// Each save takes the next queued reply; without one the server accepts the save as a new revision.
let saveReplies: Array<Response>
let serverDashboard: Dashboard
const conflict = () => Response.json({ message: 'Dashboard was modified elsewhere' }, { status: 409 })
const saves = () =>
	session.requests
		.filter(({ url }) => url.pathname === '/api/private/pro-dashboard/save')
		.map(({ init }) => JSON.parse(init!.body as string))
const reads = () => session.requests.filter(({ url }) => url.pathname.startsWith('/dashboards/dashboard'))

const a = { id: 'a', kind: 'text' as const, content: 'A' }
const b = { id: 'b', kind: 'text' as const, content: 'B' }
const c = { id: 'c', kind: 'text' as const, content: 'C' }
const cached: Dashboard = {
	id: 'dashboard',
	user: 'owner',
	data: { dashboardName: 'Original', items: [a] },
	created: '',
	updated: '',
	editedAt: 'v1'
}
const remote: Dashboard = { ...cached, data: { ...cached.data, items: [a, b] }, editedAt: 'v2' }

let root: Root
let container: HTMLDivElement
let update: ReturnType<typeof useUpdateDashboard>

function Harness() {
	update = useUpdateDashboard('dashboard', 'manual')
	return null
}

async function mount() {
	session.client.setQueryData(['pro-dashboard', 'dashboard', 'dashboard', true, 'owner'], cached)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Harness />
			</session.Wrapper>
		)
	)
}

function save(data: Dashboard['data'] = { dashboardName: 'Original', items: [a, c] }) {
	return update.mutateAsync({ id: 'dashboard', data })
}

beforeEach(() => {
	saveReplies = []
	serverDashboard = remote
	session.serve({
		'/api/private/pro-dashboard/save': (_url: URL, init?: RequestInit) => {
			const body = JSON.parse(init!.body as string)
			return saveReplies.shift() ?? { ...cached, data: body.data, editedAt: `after ${body.baseEditedAt}` }
		},
		[`${FEATURES_SERVER}/dashboards/dashboard`]: () => serverDashboard
	})
	toastMock.mockClear()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('sends the cached editedAt as the conflict baseline', async () => {
	await mount()
	await act(async () => save())
	expect(saves()).toHaveLength(1)
	expect(saves()[0].baseEditedAt).toBe('v1')
	expect(reads()).toHaveLength(0)
})

test('saves without a conflict baseline when no dashboard is cached', async () => {
	await mount()
	session.client.removeQueries({ queryKey: ['pro-dashboard', 'dashboard'] })
	await act(async () => save())

	expect(saves()).toHaveLength(1)
	expect(saves()[0].baseEditedAt).toBeUndefined()
	expect(reads()).toHaveLength(0)
})

test('a conflict re-reads the dashboard, merges items and retries once against the fresh revision', async () => {
	saveReplies.push(conflict())
	await mount()
	let result!: Dashboard
	await act(async () => {
		result = await save()
	})
	expect(reads()).toHaveLength(1)
	expect(saves()).toHaveLength(2)
	expect(saves()[1].data.items).toEqual([a, c, b])
	expect(saves()[1].baseEditedAt).toBe('v2')
	expect(result.data.items).toEqual([a, c, b])
	expect(session.client.getQueryData<Dashboard>(['pro-dashboard', 'dashboard', 'dashboard', true, 'owner'])).toEqual(
		result
	)
	expect(toastMock).toHaveBeenCalledWith(
		'This dashboard was changed in another tab or session. Your edits were merged.',
		expect.objectContaining({ id: 'dashboard-merged' })
	)
})

test('a conflict that changes nothing stays silent', async () => {
	saveReplies.push(conflict())
	serverDashboard = cached
	await mount()
	await act(async () => save({ dashboardName: 'Original', items: [a] }))
	expect(saves()).toHaveLength(2)
	expect(toastMock).not.toHaveBeenCalled()
})

test('a second conflict propagates', async () => {
	saveReplies.push(conflict(), conflict())
	await mount()
	await expect(save()).rejects.toMatchObject({ status: 409 })
	expect(saves()).toHaveLength(2)
	expect(reads()).toHaveLength(1)
})

test('other failures do not trigger a re-read', async () => {
	saveReplies.push(Response.json({ message: 'Server error' }, { status: 500 }))
	await mount()
	await expect(save()).rejects.toMatchObject({ status: 500 })
	expect(saves()).toHaveLength(1)
	expect(reads()).toHaveLength(0)
})

test('a slug-keyed cache entry still provides the conflict baseline', async () => {
	session.client.setQueryData(['pro-dashboard', 'dashboard', 'my-slug', true, 'owner'], cached)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Harness />
			</session.Wrapper>
		)
	)
	await act(async () => save())
	expect(saves()[0].baseEditedAt).toBe('v1')
})

test('the retry keeps metadata another client changed', async () => {
	saveReplies.push(conflict())
	serverDashboard = { ...remote, data: { ...remote.data, dashboardName: 'Renamed remotely' } }
	await mount()
	await act(async () => save())
	expect(saves()[1].data.dashboardName).toBe('Renamed remotely')
	expect(saves()[1].data.items).toEqual([a, c, b])
})

test('the retry keeps metadata this client changed', async () => {
	saveReplies.push(conflict())
	serverDashboard = { ...remote, data: { ...remote.data, dashboardName: 'Renamed remotely' } }
	await mount()
	await act(async () => save({ dashboardName: 'Renamed here', items: [a, c] }))
	expect(saves()[1].data.dashboardName).toBe('Renamed here')
})
