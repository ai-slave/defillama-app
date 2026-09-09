// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardSaveGuard } from '~/components/DashboardSaveGuard'
import type { Dashboard } from '../../dashboardTypes'
import type { SqlChartConfig } from '../../types'
import { useAutoSave } from '../useAutoSave'

const api = vi.hoisted(() => ({ update: vi.fn() }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ isAuthenticated: true, user: { id: 'owner' }, authorizedFetch: vi.fn() })
}))
vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), query: {} }) }))
vi.mock('../../services/DashboardAPI', async (original) => ({
	...(await original<typeof import('../../services/DashboardAPI')>()),
	dashboardAPI: { updateDashboard: api.update }
}))
let root: Root
let container: HTMLDivElement
let client: QueryClient
let autosave: ReturnType<typeof useAutoSave>
const saved: Dashboard = {
	id: 'dashboard',
	user: 'owner',
	data: { dashboardName: 'Original', items: [] },
	created: '',
	updated: ''
}
const items = (content: string) => [{ id: 'text', kind: 'text' as const, content }]
function Harness({ dashboard = saved, enabled = true }: { dashboard?: Dashboard; enabled?: boolean }) {
	autosave = useAutoSave({
		dashboard,
		enabled,
		isFreeUser: false,
		timePeriod: '365d',
		customTimePeriod: null,
		delay: 100
	})
	return null
}
async function mount(dashboard = saved, enabled = true) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<DashboardSaveGuard />
				<Harness key={dashboard.id} dashboard={dashboard} enabled={enabled} />
			</QueryClientProvider>
		)
	)
}
async function advance(ms = 100) {
	await act(async () => vi.advanceTimersByTimeAsync(ms))
}
function leaving() {
	const event = new Event('beforeunload', { cancelable: true })
	window.dispatchEvent(event)
	return event.defaultPrevented
}
beforeEach(() => {
	vi.useFakeTimers()
	vi.clearAllMocks()
	api.update.mockReset().mockImplementation(async (id, data) => ({ ...saved, id, data }))
	client = new QueryClient()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
	vi.useRealTimers()
})
test('rapid edits coalesce into one save containing the latest items', async () => {
	await mount()
	await act(async () => autosave.autoSave(items('First')))
	await advance(50)
	await act(async () => autosave.autoSave(items('Latest')))
	await advance(99)
	expect(api.update).not.toHaveBeenCalled()
	await advance(1)
	expect(api.update).toHaveBeenCalledOnce()
	expect(api.update.mock.calls[0][1].items).toEqual(items('Latest'))
})
test('pagehide queues newer edits behind an in-flight save without a separate write', async () => {
	const first = Promise.withResolvers<Dashboard>()
	api.update.mockReturnValueOnce(first.promise)
	await mount()
	await act(async () => autosave.autoSave(items('First')))
	await advance()
	await act(async () => autosave.autoSave(items('Newer')))
	await act(async () => {
		window.dispatchEvent(new Event('pagehide'))
		window.dispatchEvent(new Event('pagehide'))
	})
	await advance()
	expect(api.update).toHaveBeenCalledOnce()
	await act(async () => first.resolve(saved))
	await advance()
	expect(api.update).toHaveBeenCalledTimes(2)
	expect(api.update.mock.calls[1][1].items).toEqual(items('Newer'))
})
test('a completed save is not sent again or warned about when leaving', async () => {
	await mount()
	await act(async () => autosave.autoSave(items('Saved')))
	await advance()
	await act(async () => {
		window.dispatchEvent(new Event('pagehide'))
		expect(leaving()).toBe(false)
	})
	expect(api.update).toHaveBeenCalledOnce()
})
test('failed saves retain the draft for retry and warn before leaving until success', async () => {
	api.update.mockRejectedValueOnce(new Error('Offline'))
	await mount()
	await act(async () => autosave.autoSave(items('Keep this edit')))
	await advance()
	expect(autosave.state?.error?.message).toBe('Offline')
	await act(async () => {
		await vi.waitFor(() => expect(leaving()).toBe(true))
	})
	expect(api.update).toHaveBeenCalledOnce()
	await act(async () => autosave.retry())
	await advance()
	expect(api.update.mock.calls[1][1].items).toEqual(items('Keep this edit'))
	expect(autosave.state?.status).toBe('success')
	expect(leaving()).toBe(false)
})
test.each(['success', 'failure'] as const)(
	'switching dashboards flushes A and keeps its late %s separate from B',
	async (outcome) => {
		const pending = Promise.withResolvers<Dashboard>()
		api.update.mockReturnValueOnce(pending.promise)
		await mount()
		await act(async () => autosave.autoSave(items('A edit')))
		await mount({ ...saved, id: 'other', data: { ...saved.data, dashboardName: 'Other' } })
		await advance()
		expect(api.update.mock.calls[0][0]).toBe('dashboard')
		expect(autosave.state).toBeUndefined()
		await act(async () => autosave.autoSave(items('B edit')))
		await advance()
		expect(api.update.mock.calls[1][0]).toBe('other')
		await act(async () => (outcome === 'success' ? pending.resolve(saved) : pending.reject(new Error('Offline'))))
		await advance()
		expect(autosave.state?.status).toBe('success')
		expect(autosave.state?.data?.id).toBe('other')
		expect(container.querySelector('section')?.getAttribute('aria-label') ?? null).toBe(
			outcome === 'failure' ? 'Unsaved dashboard: Original' : null
		)
	}
)
test('view or read-only mode cannot schedule a write', async () => {
	await mount(saved, false)
	await act(async () => autosave.autoSave(items('Read only')))
	await advance()
	expect(api.update).not.toHaveBeenCalled()
	expect(leaving()).toBe(false)
})

test('a failed draft remains retryable after leaving longer than the default mutation cache lifetime', async () => {
	api.update.mockRejectedValueOnce(new Error('Offline'))
	await mount()
	await act(async () => autosave.autoSave(items('Keep this edit')))
	await advance()
	await mount({ ...saved, id: 'other' })
	await advance(10 * 60 * 1000)
	await mount()
	expect(autosave.state?.status).toBe('error')
	expect(api.update).toHaveBeenCalledOnce()
	await act(async () => autosave.retry())
	await advance()
	expect(api.update.mock.calls[1][1].items).toEqual(items('Keep this edit'))
})

test('unsaved writes still warn when the editor route has unmounted, and stop after recovery', async () => {
	api.update.mockRejectedValueOnce(new Error('Offline'))
	await mount()
	await act(async () => autosave.autoSave(items('Route draft')))
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<DashboardSaveGuard />
				<p>Another page</p>
			</QueryClientProvider>
		)
	)
	await advance()
	expect(leaving()).toBe(true)
	await mount()
	expect(autosave.state?.status).toBe('error')
	await act(async () => autosave.retry())
	await advance()
	expect(leaving()).toBe(false)
})

const sqlItem: SqlChartConfig = {
	id: 'sql-1',
	kind: 'sql',
	name: 'test',
	query: { sql: 'SELECT 1', tableSources: [{ kind: 'dataset', slug: 'protocols' }] },
	chart: {
		chartType: 'bar',
		xCol: null,
		yCols: [],
		splitByCol: null,
		stackMode: 'off',
		rightAxisCols: [],
		seriesKinds: {},
		seriesColors: {},
		numberFormat: 'auto'
	},
	displayMode: 'table',
	rowCap: 500,
	snapshot: {
		columns: [{ name: 'x', type: 'INTEGER' }],
		rows: [{ x: 1 }],
		computedAt: '2026-07-10T00:00:00.000Z',
		rowCount: 1,
		engine: 'server'
	}
}

test('an autosave strips SQL snapshots at the request boundary without mutating the local draft', async () => {
	await mount()
	await act(async () => autosave.autoSave([sqlItem]))
	await advance()
	const sent = api.update.mock.calls[0][1].items[0]
	expect(sent.snapshot).toBeUndefined()
	expect(sent.query).toEqual(sqlItem.query)
	expect(sqlItem.snapshot?.rows).toEqual([{ x: 1 }])
})

test('saves period overrides while retaining the autosave queue and retry contract', async () => {
	await mount()
	expect(autosave.hasPendingSave()).toBe(false)
	await act(async () => autosave.autoSave(items('Period'), { timePeriod: '30d', customTimePeriod: null }))
	expect(autosave.hasPendingSave()).toBe(true)
	await advance()
	expect(api.update.mock.calls[0][1]).toMatchObject({ timePeriod: '30d', customTimePeriod: null })
	expect(autosave.hasPendingSave()).toBe(false)
	const customTimePeriod = { type: 'relative', relativeDays: 14 } as const
	api.update.mockRejectedValueOnce(new Error('Offline'))
	await act(async () => autosave.autoSave(items('Custom'), { timePeriod: 'custom', customTimePeriod }))
	await advance()
	expect(api.update.mock.calls[1][1]).toMatchObject({ timePeriod: 'custom', customTimePeriod })
	expect(autosave.hasPendingSave()).toBe(true)
	await act(async () => autosave.retry())
	await advance()
	expect(autosave.hasPendingSave()).toBe(false)
})

test('finishing an older save cannot clear the newer queued draft', async () => {
	const first = Promise.withResolvers<Dashboard>()
	const second = Promise.withResolvers<Dashboard>()
	api.update.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
	await mount()
	await act(async () => autosave.autoSave(items('First'), { timePeriod: '30d' }))
	await advance()
	await act(async () => autosave.autoSave(items('Second'), { timePeriod: '90d' }))
	await act(async () => first.resolve(saved))
	expect(autosave.hasPendingSave()).toBe(true)
	await advance()
	expect(autosave.hasPendingSave()).toBe(true)
	expect(api.update.mock.calls[1][1].timePeriod).toBe('90d')
	await act(async () => second.resolve(saved))
	await advance()
	expect(autosave.hasPendingSave()).toBe(false)
})
