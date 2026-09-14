// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createContext } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DashboardItemConfig } from './dashboardItemConfig'
import type { Dashboard, DashboardRatingDecision } from './dashboardTypes'
import {
	ProDashboardAPIProvider,
	useProDashboardDashboard,
	useProDashboardEditorActions,
	useProDashboardItemsState
} from './ProDashboardAPIContext'

const api = vi.hoisted(() => ({ update: vi.fn(), dashboard: null as Dashboard | null }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		isAuthenticated: true,
		user: { id: 'owner' },
		hasActiveSubscription: true,
		authToken: 'test',
		loaders: { userLoading: false },
		authorizedFetch: vi.fn()
	})
}))
vi.mock('~/utils/pocketbase', () => ({ default: { authStore: { isValid: false } } }))
const router = vi.hoisted(() => ({
	push: vi.fn(),
	replace: vi.fn(),
	pathname: '/pro/[dashboardId]',
	asPath: '/pro/dashboard',
	query: {}
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
vi.mock('./hooks/useFreeTierStatus', () => ({
	useFreeTierStatus: () => ({ canCreateDashboard: true, isFreeUser: false })
}))
vi.mock('./hooks/useDashboardStream', () => ({
	useDashboardStream: () => ({
		dashboard: api.dashboard,
		isDone: true,
		isStreaming: false,
		readyItemIds: new Set<string>(),
		error: null
	})
}))
vi.mock('./hooks/useAutoSave', () => {
	const hasPendingSave = () => false
	return { useAutoSave: () => ({ autoSave: vi.fn(), flush: vi.fn(), acknowledge: vi.fn(), hasPendingSave }) }
})
vi.mock('./queries', () => ({
	StreamDoneContext: createContext(true),
	StreamItemReadinessContext: createContext(null),
	ProxyAuthTokenContext: createContext(null),
	useProtocolsAndChains: () => ({ data: { protocols: [], chains: [] } })
}))
vi.mock('./services/DashboardAPI', async (original) => ({
	...(await original<typeof import('./services/DashboardAPI')>()),
	dashboardAPI: { listDashboards: async () => [], getDashboard: async () => api.dashboard, updateDashboard: api.update }
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
let items: Array<DashboardItemConfig>
function Probe() {
	dashboard = useProDashboardDashboard()
	editor = useProDashboardEditorActions()
	items = useProDashboardItemsState().items
	return null
}
beforeEach(async () => {
	api.update.mockReset()
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
test.each(['undo', 'iterate'] as const)('%s merges saved items with edits made while saving', async (action) => {
	const pending = Promise.withResolvers<Dashboard>()
	api.update.mockReturnValueOnce(pending.promise)
	let completion: Promise<void>
	await act(async () => {
		completion =
			action === 'undo'
				? dashboard.undoAIGeneration()
				: dashboard.handleIterateDashboard({
						dashboardName: 'Analysis',
						visibility: 'public',
						tags: [],
						description: '',
						items: oldItems
					})
	})
	await vi.waitFor(() => expect(api.update).toHaveBeenCalledOnce())
	await act(async () => editor.handleEditItem('ai', laterItems[0]))
	const saved = { ...original, data: { ...original.data, ...api.update.mock.calls[0][1] } }
	await act(async () => {
		pending.resolve(saved)
		await completion
	})
	// The saved result adds a different item; accepting it must retain the concurrent local edit.
	expect(items).toEqual([...laterItems, ...oldItems])
	expect(dashboard.currentDashboard?.data.items).toEqual(oldItems)
})
test('undo restores the previous items when no newer edit exists and removes the undo action', async () => {
	api.update.mockImplementation(async (_id, data) => ({
		...original,
		aiGenerated: data.aiGenerated,
		data: { ...original.data, ...data }
	}))
	await act(async () => dashboard.undoAIGeneration())
	expect(items).toEqual(oldItems)
	expect(dashboard.canUndo).toBe(false)
	expect(dashboard.getCurrentRatingSession()).toBeNull()
})
test.each<DashboardRatingDecision>([{ rating: 4, feedback: 'Useful' }, { skipped: true }])(
	'rating decision %j stays retryable after an API failure',
	async (decision) => {
		api.update.mockRejectedValueOnce(new Error('Offline')).mockImplementationOnce(async (_id, data) => ({
			...original,
			aiGenerated: data.aiGenerated,
			data: { ...original.data, ...data }
		}))
		await act(async () => {
			await expect(dashboard.submitRating('session', decision)).rejects.toThrow('Offline')
		})
		expect(dashboard.getCurrentRatingSession()?.sessionId).toBe('session')
		await act(async () => dashboard.submitRating('session', decision))
		expect(dashboard.getCurrentRatingSession()).toBeNull()
		expect(dashboard.currentDashboard?.aiGenerated?.session).toMatchObject(decision)
	}
)

test('a late undo acknowledgement cannot replace the dashboard opened during its save', async () => {
	const pending = Promise.withResolvers<Dashboard>()
	api.update.mockReturnValueOnce(pending.promise)
	let completion: Promise<void>
	await act(async () => {
		completion = dashboard.undoAIGeneration()
	})
	await vi.waitFor(() => expect(api.update).toHaveBeenCalledOnce())
	const another = {
		...original,
		id: 'another',
		data: { ...original.data, dashboardName: 'Another dashboard', items: laterItems }
	}
	api.dashboard = another
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<ProDashboardAPIProvider mode="edit" initialDashboardId="another" initialDashboard={another}>
					<Probe />
				</ProDashboardAPIProvider>
			</QueryClientProvider>
		)
	)
	expect(dashboard.dashboardId).toBe('another')
	await act(async () => {
		pending.resolve({ ...original, data: { ...original.data, items: oldItems } })
		await completion
	})
	expect(dashboard.dashboardId).toBe('another')
	expect(dashboard.dashboardName).toBe('Another dashboard')
	expect(items).toEqual(laterItems)
})
