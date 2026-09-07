// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DashboardSavePayload } from '../../services/DashboardAPI'
import { useDashboardAPI } from '../useDashboardAPI'
const api = vi.hoisted(() => ({ update: vi.fn() }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ isAuthenticated: true, user: { id: 'user' }, authorizedFetch: vi.fn() })
}))
vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))
vi.mock('../../services/DashboardAPI', async (original) => ({
	...(await original<typeof import('../../services/DashboardAPI')>()),
	dashboardAPI: { listDashboards: async () => [], updateDashboard: api.update }
}))
let root: Root
let container: HTMLDivElement
let client: QueryClient
let save: ReturnType<typeof useDashboardAPI>['updateDashboard']
const payload = (name: string): DashboardSavePayload => ({
	dashboardName: name,
	items: [],
	visibility: 'private',
	tags: [],
	description: ''
})
function Harness({ id }: { id: string }) {
	save = useDashboardAPI(id).updateDashboard
	return null
}
async function mount(id: string) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Harness key={id} id={id} />
			</QueryClientProvider>
		)
	)
}
beforeEach(() => {
	vi.clearAllMocks()
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
test.each(['success', 'failure'] as const)(
	'same-dashboard saves stay ordered across remount after %s',
	async (outcome) => {
		const first = Promise.withResolvers<{}>()
		const second = Promise.withResolvers<{}>()
		api.update.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
		await mount('a')
		await act(async () => save.mutate({ id: 'a', data: payload('First') }))
		await vi.waitFor(() => expect(api.update).toHaveBeenCalledOnce())
		await mount('b')
		await mount('a')
		await act(async () => save.mutate({ id: 'a', data: payload('Second') }))
		await vi.waitFor(() => expect(save.isPaused).toBe(true))
		expect(api.update).toHaveBeenCalledOnce()
		await act(async () => {
			if (outcome === 'success') first.resolve({ id: 'a' })
			else first.reject(new Error('Offline'))
		})
		await vi.waitFor(() => expect(api.update).toHaveBeenCalledTimes(2))
		expect(api.update.mock.calls[1][1].dashboardName).toBe('Second')
		await act(async () => second.resolve({ id: 'a' }))
		await vi.waitFor(() => expect(save.isSuccess).toBe(true))
	}
)
test('saving another dashboard does not wait for the current dashboard', async () => {
	const first = Promise.withResolvers<{}>()
	api.update.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ id: 'b' })
	await mount('a')
	await act(async () => save.mutate({ id: 'a', data: payload('First') }))
	await vi.waitFor(() => expect(api.update).toHaveBeenCalledOnce())
	await mount('b')
	await act(async () => save.mutate({ id: 'b', data: payload('Other') }))
	await vi.waitFor(() => expect(api.update).toHaveBeenCalledTimes(2))
	expect(api.update.mock.calls.map(([id]) => id)).toEqual(['a', 'b'])
	await act(async () => first.resolve({ id: 'a' }))
})
