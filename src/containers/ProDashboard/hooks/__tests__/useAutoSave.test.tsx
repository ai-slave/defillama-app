// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Dashboard } from '../../dashboardTypes'
import { useAutoSave } from '../useAutoSave'

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))
vi.mock('~/utils/pocketbase', () => ({ default: { authStore: { token: 'test-token' } } }))
let root: Root
let container: HTMLDivElement
let autosave: ReturnType<typeof useAutoSave>
const update = vi.fn()
const keepalive = vi.fn()
const saved: Dashboard = { id: 'dashboard', data: { dashboardName: 'Original', items: [] }, created: '', updated: '' }
function Harness({ name = 'Original', mode = 'edit' }: { name?: string; mode?: 'view' | 'edit' }) {
	autosave = useAutoSave({
		dashboardId: saved.id,
		dashboardName: name,
		dashboardVisibility: 'private',
		dashboardTags: [],
		dashboardDescription: '',
		timePeriod: '365d',
		customTimePeriod: null,
		isAuthenticated: true,
		isReadOnly: false,
		currentDashboard: { user: 'owner' },
		userId: 'owner',
		updateDashboard: update,
		toPersistedDashboardItems: (items) => items,
		isFreeUser: false,
		mode,
		delay: 100
	})
	return null
}
beforeEach(() => {
	vi.useFakeTimers()
	vi.clearAllMocks()
	update.mockReset()
	keepalive.mockResolvedValue(new Response('{}'))
	vi.stubGlobal('fetch', keepalive)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.useRealTimers()
	vi.unstubAllGlobals()
})
test('an older save cannot erase the newer edit flushed when leaving the page', async () => {
	const first = Promise.withResolvers<Dashboard>()
	update.mockReturnValueOnce(first.promise)
	await act(async () => root.render(<Harness />))
	autosave.autoSave([])
	await act(async () => vi.advanceTimersByTimeAsync(100))
	expect(update).toHaveBeenCalledOnce()
	await act(async () => root.render(<Harness name="Newer edit" />))
	autosave.autoSave([])
	await act(async () => first.resolve(saved))
	await act(async () => window.dispatchEvent(new Event('pagehide')))
	expect(keepalive).toHaveBeenCalledOnce()
	const request = keepalive.mock.calls[0][1]
	expect(JSON.parse(request.body).data.dashboardName).toBe('Newer edit')
	expect(request.keepalive).toBe(true)
	await act(async () => vi.advanceTimersByTimeAsync(100))
	expect(update).toHaveBeenCalledOnce()
})
test('a completed save is not sent again on pagehide', async () => {
	update.mockResolvedValue(saved)
	await act(async () => root.render(<Harness />))
	autosave.autoSave([])
	await act(async () => vi.advanceTimersByTimeAsync(100))
	await act(async () => window.dispatchEvent(new Event('pagehide')))
	expect(update).toHaveBeenCalledOnce()
	expect(keepalive).not.toHaveBeenCalled()
	expect(toast.error).not.toHaveBeenCalled()
})
test('failed background saves report an error and retain the pending edit for navigation', async () => {
	update.mockRejectedValue(new Error('Offline'))
	await act(async () => root.render(<Harness name="Keep this edit" />))
	autosave.autoSave([])
	await act(async () => vi.advanceTimersByTimeAsync(100))
	expect(toast.error).toHaveBeenCalledExactlyOnceWith('Offline')
	await act(async () => window.dispatchEvent(new Event('pagehide')))
	expect(JSON.parse(keepalive.mock.calls[0][1].body).data.dashboardName).toBe('Keep this edit')
})
