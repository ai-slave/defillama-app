// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createContext, memo } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardSaveGuard } from '~/components/DashboardSaveGuard'
import { AutosaveStatus } from './components/AutosaveStatus'
import type { DashboardItemConfig } from './dashboardItemConfig'
import type { Dashboard } from './dashboardTypes'
import { useDashboardAPI } from './hooks/useDashboardAPI'
import {
	ProDashboardAPIProvider,
	useProDashboardDashboard,
	useProDashboardEditorActions,
	useProDashboardItemsState,
	useProDashboardSave,
	useProDashboardUI
} from './ProDashboardAPIContext'

const api = vi.hoisted(() => ({ update: vi.fn(), remove: vi.fn(), get: vi.fn(), dashboard: null as Dashboard | null }))
vi.mock('~/auth', () => {
	const auth = {
		isAuthenticated: true,
		user: { id: 'owner' },
		hasActiveSubscription: true,
		authToken: 'test',
		loaders: { userLoading: false },
		authorizedFetch: vi.fn()
	}
	return { useAuthContext: () => auth }
})
vi.mock('~/utils/pocketbase', () => ({ default: { authStore: { isValid: false } } }))
vi.mock('next/router', () => {
	const router = { push: vi.fn(), query: {} }
	return { useRouter: () => router }
})
vi.mock('./hooks/useFreeTierStatus', () => ({
	useFreeTierStatus: () => ({ canCreateDashboard: true, isFreeUser: false })
}))
vi.mock('./hooks/useDashboardStream', () => ({
	useDashboardStream: () => ({ dashboard: api.dashboard, isDone: true })
}))
vi.mock('./queries', () => ({
	StreamDoneContext: createContext(true),
	ProxyAuthTokenContext: createContext(null),
	useProtocolsAndChains: () => ({ data: { protocols: [], chains: [] } })
}))
vi.mock('./services/DashboardAPI', async (original) => ({
	...(await original<typeof import('./services/DashboardAPI')>()),
	dashboardAPI: {
		listDashboards: async () => [],
		getDashboard: api.get,
		updateDashboard: api.update,
		deleteDashboard: api.remove
	}
}))
const oldItems: Array<DashboardItemConfig> = [{ id: 'before', kind: 'text', content: 'Before AI' }]
const aiItems: Array<DashboardItemConfig> = [{ id: 'ai', kind: 'text', content: 'AI result' }]
const laterItems: Array<DashboardItemConfig> = [{ id: 'later', kind: 'text', content: 'Written during save' }]
const original: Dashboard = {
	id: 'dashboard',
	user: 'owner',
	visibility: 'public',
	created: '',
	updated: '',
	data: {
		dashboardName: 'Analysis',
		items: aiItems,
		aiUndoState: { items: oldItems, timestamp: '2026-09-07', sessionId: 'session' }
	},
	aiGenerated: {
		session: { mode: 'iterate', timestamp: '2026-09-07', prompt: 'Compare fees', userId: 'owner', rated: false }
	}
}
let root: Root
let container: HTMLDivElement
let client: QueryClient
let dashboard: ReturnType<typeof useProDashboardDashboard>
let editor: ReturnType<typeof useProDashboardEditorActions>
let autosave: ReturnType<typeof useProDashboardSave>
let items: Array<DashboardItemConfig>
let ui: ReturnType<typeof useProDashboardUI>
let saveRenders = 0
const SaveConsumer = memo(({ save }: { save: typeof dashboard.saveDashboard }) => {
	saveRenders++
	return (
		<button type="button" onClick={() => void save()}>
			Save dashboard
		</button>
	)
})
function Probe() {
	dashboard = useProDashboardDashboard()
	editor = useProDashboardEditorActions()
	items = useProDashboardItemsState().items
	autosave = useProDashboardSave()
	ui = useProDashboardUI()
	return (
		<>
			<AutosaveStatus />
			<SaveConsumer save={dashboard.saveDashboard} />
		</>
	)
}
beforeEach(async () => {
	api.get.mockReset().mockImplementation(async () => api.dashboard)
	api.remove.mockReset().mockResolvedValue({ message: 'Deleted' })
	api.update.mockReset()
	api.update.mockImplementation(async (_id, { visibility, tags, description, aiGenerated, ...data }) => ({
		...original,
		data: { ...original.data, ...data },
		visibility,
		tags,
		description,
		aiGenerated
	}))
	api.dashboard = { ...original }
	client = new QueryClient()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<ProDashboardAPIProvider mode="edit" initialDashboardId="dashboard" initialDashboard={original}>
					<Probe />
				</ProDashboardAPIProvider>
			</QueryClientProvider>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})
test('a debounced item edit preserves a newer settings save', async () => {
	await act(async () => editor.handleEditItem('ai', laterItems[0]))
	await act(async () => dashboard.saveDashboard({ dashboardName: 'Renamed', tags: ['Research'] }))
	await act(async () => {
		await vi.waitFor(() => expect(api.update).toHaveBeenCalledTimes(2), { timeout: 2000 })
	})
	const last = api.update.mock.calls.at(-1)![1]
	expect(last.dashboardName).toBe('Renamed')
	expect(last.tags).toEqual(['Research'])
	expect(last.items).toEqual(laterItems)
})

test('item edits made while a rating save is pending preserve the saved rating and Undo', async () => {
	const pending = Promise.withResolvers<Dashboard>()
	api.update.mockReturnValueOnce(pending.promise)
	let completion: Promise<void>
	await act(async () => {
		completion = dashboard.submitRating('session', { rating: 5 })
	})
	await vi.waitFor(() => expect(api.update).toHaveBeenCalledOnce())
	await act(async () => editor.handleEditItem('ai', laterItems[0]))
	const data = api.update.mock.calls[0][1]
	await act(async () => {
		pending.resolve({ ...original, data: { ...original.data, ...data }, aiGenerated: data.aiGenerated })
		await completion
	})
	await act(async () => {
		await vi.waitFor(() => expect(api.update).toHaveBeenCalledTimes(2), { timeout: 2000 })
	})
	const last = api.update.mock.calls[1][1]
	expect(last.aiGenerated.session.rating).toBe(5)
	expect(last.aiUndoState).toEqual(original.data.aiUndoState)
	expect(last.items).toEqual(laterItems)
})

test('Retry retains keyboard focus, blocks repeated submission, and saves the failed draft', async () => {
	const retry = Promise.withResolvers<Dashboard>()
	api.update.mockRejectedValueOnce(new Error('Offline')).mockReturnValueOnce(retry.promise)
	await act(async () => editor.handleEditItem('ai', laterItems[0]))
	await act(async () => {
		await vi.waitFor(() => expect(api.update).toHaveBeenCalledOnce(), { timeout: 2000 })
	})
	await act(async () => {
		await vi.waitFor(() => expect(autosave.state?.status).toBe('error'))
	})
	const button = [...container.querySelectorAll('button')].find((el) => el.textContent === 'Retry save')!
	expect(button).toBeDefined()
	await act(async () => {
		button.focus()
		button.click()
	})
	await act(async () => {
		await vi.waitFor(() => expect(button.getAttribute('aria-disabled')).toBe('true'))
	})
	expect(document.activeElement).toBe(button)
	expect(container.querySelector('[role="status"]')?.textContent).toBe('Saving changes')
	await act(async () => button.click())
	expect(api.update).toHaveBeenCalledTimes(2)
	expect(api.update.mock.calls[1][1].items).toEqual(laterItems)
	await act(async () => retry.resolve({ ...original, data: { ...original.data, items: laterItems } }))
	await act(async () => {
		await vi.waitFor(() => expect(autosave.state?.status).toBe('success'))
	})
	expect(document.activeElement).toBe(button)
	expect(container.querySelector('[role="alert"]')).toBeNull()
	expect(container.querySelector('[role="status"]')?.textContent).toBe('Changes saved')
})

test('a successful manual save includes failed item edits and clears their obsolete retry', async () => {
	api.update.mockRejectedValueOnce(new Error('Offline'))
	await act(async () => editor.handleEditItem('ai', laterItems[0]))
	await act(async () => {
		await vi.waitFor(() => expect(api.update).toHaveBeenCalledOnce(), { timeout: 2000 })
	})
	await act(async () => {
		await vi.waitFor(() => expect(autosave.state?.status).toBe('error'))
	})
	await act(async () => dashboard.saveDashboard({ dashboardName: 'Recovered' }))
	expect(api.update.mock.calls[1][1]).toMatchObject({ dashboardName: 'Recovered', items: laterItems })
	expect(autosave.state?.status).not.toBe('error')
	expect(container.querySelector('[role="alert"]')).toBeNull()
})

test('manual acknowledgement does not clear a newer failed item edit', async () => {
	await act(async () => editor.handleEditItem('ai', laterItems[0]))
	const manual = Promise.withResolvers<Dashboard>()
	api.update.mockResolvedValueOnce({ ...original, data: { ...original.data, items: laterItems } })
	api.update.mockReturnValueOnce(manual.promise).mockRejectedValueOnce(new Error('Later edit failed'))
	let completion: Promise<void>
	await act(async () => {
		completion = dashboard.saveDashboard({ dashboardName: 'Renamed' })
	})
	await act(async () => {
		await vi.waitFor(() => expect(api.update).toHaveBeenCalledTimes(2))
	})
	const latest = { id: 'latest', kind: 'text' as const, content: 'Even newer' }
	await act(async () => editor.handleEditItem('later', latest))
	await act(async () => autosave.flush())
	await act(async () => {
		manual.resolve({ ...original, data: { ...original.data, items: laterItems, dashboardName: 'Renamed' } })
		await completion
	})
	await act(async () => {
		await vi.waitFor(() => expect(autosave.state?.status).toBe('error'))
	})
	expect(api.update.mock.calls[2][1]).toMatchObject({ dashboardName: 'Renamed', items: [latest] })
	expect(items).toEqual([latest])
})

test.each(['pending', 'error'] as const)(
	'returning to a dashboard recovers its %s draft without resubmitting it',
	async (status) => {
		const pending = Promise.withResolvers<Dashboard>()
		api.update.mockReturnValueOnce(pending.promise)
		await act(async () => editor.handleEditItem('ai', laterItems[0]))
		await act(async () => autosave.flush())
		await act(async () => {
			await vi.waitFor(() => expect(api.update).toHaveBeenCalledOnce())
		})
		const other: Dashboard = { ...original, id: 'other', data: { ...original.data, dashboardName: 'Other' } }
		const open = async (value: Dashboard, withInitial = true) => {
			api.dashboard = { ...value }
			await act(async () =>
				root.render(
					<QueryClientProvider client={client}>
						<ProDashboardAPIProvider
							key={value.id}
							mode="edit"
							initialDashboardId={value.id}
							initialDashboard={withInitial ? value : undefined}
						>
							<Probe />
						</ProDashboardAPIProvider>
					</QueryClientProvider>
				)
			)
		}
		await open(other)
		if (status === 'error') await act(async () => pending.reject(new Error('Offline')))
		await open(original, status === 'pending')
		expect(items).toEqual(laterItems)
		expect(autosave.state?.status).toBe(status)
		expect(api.update).toHaveBeenCalledOnce()
		if (status === 'pending')
			await act(async () => pending.resolve({ ...original, data: { ...original.data, items: laterItems } }))
		else await act(async () => autosave.retry())
		await act(async () => {
			await vi.waitFor(() => expect(autosave.state?.status).toBe('success'))
		})
		expect(api.update.mock.calls.at(-1)![1].items).toEqual(laterItems)
	}
)

test('retry through a slug route preserves freshly loaded metadata after the old query expires', async () => {
	api.update.mockRejectedValueOnce(new Error('Offline'))
	await act(async () => editor.handleEditItem('ai', laterItems[0]))
	await act(async () => autosave.flush())
	await act(async () => {
		await vi.waitFor(() => expect(autosave.state?.status).toBe('error'))
	})
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<p>Elsewhere</p>
			</QueryClientProvider>
		)
	)
	client.removeQueries({ queryKey: ['pro-dashboard', 'dashboard'] })
	const current: Dashboard = {
		...original,
		slug: 'current-analysis',
		tags: ['Current'],
		data: { ...original.data, dashboardName: 'Current analysis' }
	}
	api.dashboard = { ...current }
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<ProDashboardAPIProvider mode="edit" initialDashboardId={current.slug} initialDashboard={current}>
					<Probe />
				</ProDashboardAPIProvider>
			</QueryClientProvider>
		)
	)
	await act(async () => autosave.retry())
	await act(async () => {
		await vi.waitFor(() => expect(autosave.state?.status).toBe('success'))
	})
	expect(api.update.mock.calls[1][1]).toMatchObject({
		dashboardName: 'Current analysis',
		tags: ['Current'],
		items: laterItems
	})
})

test.each(['queued', 'pending'] as const)(
	'deletion discards %s autosaves without reviving the deleted cache entry',
	async (phase) => {
		const pending = Promise.withResolvers<Dashboard>()
		api.update.mockReturnValueOnce(pending.promise)
		await act(async () => editor.handleEditItem('ai', laterItems[0]))
		if (phase === 'pending') await act(async () => autosave.flush())
		await act(async () => dashboard.deleteDashboard(original.id))
		await act(async () =>
			root.render(
				<QueryClientProvider client={client}>
					<DashboardSaveGuard />
					<p>Dashboard list</p>
				</QueryClientProvider>
			)
		)
		await act(async () => pending.resolve({ ...original, data: { ...original.data, items: laterItems } }))
		expect(api.update).toHaveBeenCalledTimes(phase === 'pending' ? 1 : 0)
		expect(
			client.getQueryData<Dashboard | null>(['pro-dashboard', 'dashboard', original.id, true, 'owner'])?.id
		).toBeUndefined()
		const leaving = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(leaving)
		expect(leaving.defaultPrevented).toBe(false)
	}
)

test('failed deletion keeps the unsaved item draft retryable', async () => {
	api.update.mockRejectedValueOnce(new Error('Offline'))
	api.remove.mockRejectedValueOnce(new Error('Delete failed'))
	await act(async () => editor.handleEditItem('ai', laterItems[0]))
	await act(async () => autosave.flush())
	await act(async () => {
		await vi.waitFor(() => expect(autosave.state?.status).toBe('error'))
	})
	await act(async () => {
		await expect(dashboard.deleteDashboard(original.id)).rejects.toThrow('Delete failed')
	})
	expect(items).toEqual(laterItems)
	expect(autosave.state?.status).toBe('error')
})

test('opening unrelated dashboard UI does not rerender a memoized save consumer', async () => {
	const before = saveRenders
	await act(async () => ui.setShowGenerateDashboardModal(true))
	expect(saveRenders).toBe(before)
	await act(async () => ui.setShowGenerateDashboardModal(false))
	expect(saveRenders).toBe(before)
})

test('loading another id is independent of the hook’s deleted dashboard, while late deleted reads stay discarded', async () => {
	let loader: ReturnType<typeof useDashboardAPI>
	function Loader() {
		loader = useDashboardAPI(original.id)
		return null
	}
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Loader />
			</QueryClientProvider>
		)
	)
	client.setQueryData(['pro-dashboard-deleted', original.id, 'owner'], true)
	const other = { ...original, id: 'other' }
	api.get.mockResolvedValueOnce(other)
	await expect(loader!.loadDashboard('other')).resolves.toEqual(other)
	const late = Promise.withResolvers<Dashboard>()
	api.get.mockReturnValueOnce(late.promise)
	const loading = loader!.loadDashboard('third')
	client.setQueryData(['pro-dashboard-deleted', 'third', 'owner'], true)
	late.resolve({ ...original, id: 'third' })
	await expect(loading).resolves.toBeNull()
})
