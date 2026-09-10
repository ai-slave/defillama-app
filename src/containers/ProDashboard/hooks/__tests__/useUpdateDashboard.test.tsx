// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Dashboard } from '../../dashboardTypes'
import { DashboardError } from '../../services/DashboardAPI'
import { useUpdateDashboard } from '../useDashboardAPI'

const api = vi.hoisted(() => ({ update: vi.fn(), get: vi.fn() }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ isAuthenticated: true, user: { id: 'owner' }, authorizedFetch: vi.fn() })
}))
vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), query: {} }) }))
vi.mock('../../services/DashboardAPI', async (original) => ({
	...(await original<typeof import('../../services/DashboardAPI')>()),
	dashboardAPI: { updateDashboard: api.update, getDashboard: api.get }
}))

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
const conflict = () => new DashboardError('Dashboard was modified elsewhere', 409)

let root: Root
let container: HTMLDivElement
let client: QueryClient
let update: ReturnType<typeof useUpdateDashboard>

function Harness() {
	update = useUpdateDashboard('dashboard', 'manual')
	return null
}

async function mount() {
	client.setQueryData(['pro-dashboard', 'dashboard', 'dashboard', true, 'owner'], cached)
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Harness />
			</QueryClientProvider>
		)
	)
}

function save(data: Dashboard['data'] = { dashboardName: 'Original', items: [a, c] }) {
	return update.mutateAsync({ id: 'dashboard', data })
}

beforeEach(() => {
	api.update.mockReset().mockImplementation(async (id, data, _fetch, baseEditedAt) => ({
		...cached,
		id,
		data,
		editedAt: `after ${baseEditedAt}`
	}))
	api.get.mockReset().mockResolvedValue(remote)
	client = new QueryClient()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})

test('sends the cached editedAt as the conflict baseline', async () => {
	await mount()
	await act(async () => save())
	expect(api.update).toHaveBeenCalledOnce()
	expect(api.update.mock.calls[0][3]).toBe('v1')
	expect(api.get).not.toHaveBeenCalled()
})

test('saves without a conflict baseline when no dashboard is cached', async () => {
	await mount()
	client.removeQueries({ queryKey: ['pro-dashboard', 'dashboard'] })
	await act(async () => save())

	expect(api.update).toHaveBeenCalledOnce()
	expect(api.update.mock.calls[0][3]).toBeUndefined()
	expect(api.get).not.toHaveBeenCalled()
})

test('a conflict re-reads the dashboard, merges items and retries once against the fresh revision', async () => {
	api.update.mockRejectedValueOnce(conflict())
	await mount()
	let result!: Dashboard
	await act(async () => {
		result = await save()
	})
	expect(api.get).toHaveBeenCalledOnce()
	expect(api.update).toHaveBeenCalledTimes(2)
	expect(api.update.mock.calls[1][1].items).toEqual([a, c, b])
	expect(api.update.mock.calls[1][3]).toBe('v2')
	expect(result.data.items).toEqual([a, c, b])
	expect(client.getQueryData<Dashboard>(['pro-dashboard', 'dashboard', 'dashboard', true, 'owner'])).toEqual(result)
})

test('a second conflict propagates', async () => {
	api.update.mockRejectedValueOnce(conflict()).mockRejectedValueOnce(conflict())
	await mount()
	await expect(save()).rejects.toMatchObject({ status: 409 })
	expect(api.update).toHaveBeenCalledTimes(2)
	expect(api.get).toHaveBeenCalledOnce()
})

test('other failures do not trigger a re-read', async () => {
	api.update.mockRejectedValueOnce(new DashboardError('Server error', 500))
	await mount()
	await expect(save()).rejects.toMatchObject({ status: 500 })
	expect(api.update).toHaveBeenCalledOnce()
	expect(api.get).not.toHaveBeenCalled()
})

test('a slug-keyed cache entry still provides the conflict baseline', async () => {
	client.setQueryData(['pro-dashboard', 'dashboard', 'my-slug', true, 'owner'], cached)
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Harness />
			</QueryClientProvider>
		)
	)
	await act(async () => save())
	expect(api.update.mock.calls[0][3]).toBe('v1')
})

test('the retry keeps metadata another client changed', async () => {
	api.update.mockRejectedValueOnce(conflict())
	api.get.mockResolvedValue({ ...remote, data: { ...remote.data, dashboardName: 'Renamed remotely' } })
	await mount()
	await act(async () => save())
	expect(api.update.mock.calls[1][1].dashboardName).toBe('Renamed remotely')
	expect(api.update.mock.calls[1][1].items).toEqual([a, c, b])
})

test('the retry keeps metadata this client changed', async () => {
	api.update.mockRejectedValueOnce(conflict())
	api.get.mockResolvedValue({ ...remote, data: { ...remote.data, dashboardName: 'Renamed remotely' } })
	await mount()
	await act(async () => save({ dashboardName: 'Renamed here', items: [a, c] }))
	expect(api.update.mock.calls[1][1].dashboardName).toBe('Renamed here')
})
