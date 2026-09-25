// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardSaveGuard } from '~/components/DashboardSaveGuard'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import type { Dashboard } from '../../dashboardTypes'
import type { SqlChartConfig } from '../../types'
import { useAutoSave } from '../useAutoSave'

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toastMock, toast: toastMock }))
vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), query: {} }) }))

const session = installSubscriberSession('owner')
// Each save request takes the next queued reply; without one the server echoes the saved dashboard.
let replies: Array<Promise<Response> | Response>
const offline = () => Response.json({ message: 'Offline' }, { status: 503 })
const saves = () =>
	session.requests
		.filter(({ url }) => url.pathname === '/api/private/pro-dashboard/save')
		.map(({ url, init }) => ({ id: url.searchParams.get('id'), body: JSON.parse(init!.body as string) }))
let root: Root
let container: HTMLDivElement
let autosave: ReturnType<typeof useAutoSave>
const saved: Dashboard = {
	id: 'dashboard',
	user: 'owner',
	data: { dashboardName: 'Original', items: [] },
	created: '',
	updated: ''
}
const items = (content: string) => [{ id: 'text', kind: 'text' as const, content }]
function Harness({
	dashboard = saved,
	enabled = true,
	delay = 100,
	isFreeUser = false
}: {
	dashboard?: Dashboard
	enabled?: boolean
	delay?: number
	isFreeUser?: boolean
}) {
	autosave = useAutoSave({
		dashboard,
		enabled,
		isFreeUser,
		timePeriod: '365d',
		customTimePeriod: null,
		variables: [],
		annotations: [],
		delay
	})
	return null
}
async function mount(dashboard = saved, enabled = true, delay = 100, isFreeUser = false) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardSaveGuard />
				<Harness key={dashboard.id} dashboard={dashboard} enabled={enabled} delay={delay} isFreeUser={isFreeUser} />
			</session.Wrapper>
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
	window.sessionStorage.clear()
	replies = []
	session.serve({
		'/api/private/pro-dashboard/save': (url: URL, init?: RequestInit) =>
			replies.shift() ?? { ...saved, id: url.searchParams.get('id'), data: JSON.parse(init!.body as string).data }
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.useRealTimers()
})
test('rapid edits coalesce into one save containing the latest items', async () => {
	await mount()
	await act(async () => autosave.autoSave(items('First')))
	await advance(50)
	await act(async () => autosave.autoSave(items('Latest')))
	await advance(99)
	expect(saves()).toHaveLength(0)
	await advance(1)
	expect(saves()).toHaveLength(1)
	expect(saves()[0].body.data.items).toEqual(items('Latest'))
})
test('pagehide queues newer edits behind an in-flight save without a separate write', async () => {
	const first = Promise.withResolvers<Response>()
	replies.push(first.promise)
	await mount()
	await act(async () => autosave.autoSave(items('First')))
	await advance()
	await act(async () => autosave.autoSave(items('Newer')))
	await act(async () => {
		window.dispatchEvent(new Event('pagehide'))
		window.dispatchEvent(new Event('pagehide'))
	})
	await advance()
	expect(saves()).toHaveLength(1)
	await act(async () => first.resolve(Response.json(saved)))
	await advance()
	expect(saves()).toHaveLength(2)
	expect(saves()[1].body.data.items).toEqual(items('Newer'))
})
test('a completed save is not sent again or warned about when leaving', async () => {
	await mount()
	await act(async () => autosave.autoSave(items('Saved')))
	await advance()
	await act(async () => {
		window.dispatchEvent(new Event('pagehide'))
		expect(leaving()).toBe(false)
	})
	expect(saves()).toHaveLength(1)
})
test('failed saves retain the draft for retry and warn before leaving until success', async () => {
	replies.push(offline())
	await mount()
	await act(async () => autosave.autoSave(items('Keep this edit')))
	await advance()
	expect(autosave.state?.error?.message).toBe('Offline')
	await act(async () => {
		await vi.waitFor(() => expect(leaving()).toBe(true))
	})
	expect(saves()).toHaveLength(1)
	await act(async () => autosave.retry())
	await advance()
	expect(saves()[1].body.data.items).toEqual(items('Keep this edit'))
	expect(autosave.state?.status).toBe('success')
	expect(leaving()).toBe(false)
})
test.each(['success', 'failure'] as const)(
	'switching dashboards flushes A and keeps its late %s separate from B',
	async (outcome) => {
		const pending = Promise.withResolvers<Response>()
		replies.push(pending.promise)
		await mount()
		await act(async () => autosave.autoSave(items('A edit')))
		await mount({ ...saved, id: 'other', data: { ...saved.data, dashboardName: 'Other' } })
		await advance()
		expect(saves()[0].id).toBe('dashboard')
		expect(autosave.state).toBeUndefined()
		await act(async () => autosave.autoSave(items('B edit')))
		await advance()
		expect(saves()[1].id).toBe('other')
		await act(async () => pending.resolve(outcome === 'success' ? Response.json(saved) : offline()))
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
	expect(saves()).toHaveLength(0)
	expect(leaving()).toBe(false)
})

test('a failed draft remains retryable after leaving longer than the default mutation cache lifetime', async () => {
	replies.push(offline())
	await mount()
	await act(async () => autosave.autoSave(items('Keep this edit')))
	await advance()
	await mount({ ...saved, id: 'other' })
	await advance(10 * 60 * 1000)
	await mount()
	expect(autosave.state?.status).toBe('error')
	expect(saves()).toHaveLength(1)
	await act(async () => autosave.retry())
	await advance()
	expect(saves()[1].body.data.items).toEqual(items('Keep this edit'))
})

test('unsaved writes still warn when the editor route has unmounted, and stop after recovery', async () => {
	replies.push(offline())
	await mount()
	await act(async () => autosave.autoSave(items('Route draft')))
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardSaveGuard />
				<p>Another page</p>
			</session.Wrapper>
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
	const sent = saves()[0].body.data.items[0]
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
	expect(saves()[0].body.data).toMatchObject({ timePeriod: '30d', customTimePeriod: null })
	expect(autosave.hasPendingSave()).toBe(false)
	const customTimePeriod = { type: 'relative', relativeDays: 14 } as const
	replies.push(offline())
	await act(async () => autosave.autoSave(items('Custom'), { timePeriod: 'custom', customTimePeriod }))
	await advance()
	expect(saves()[1].body.data).toMatchObject({ timePeriod: 'custom', customTimePeriod })
	expect(autosave.hasPendingSave()).toBe(true)
	await act(async () => autosave.retry())
	await advance()
	expect(autosave.hasPendingSave()).toBe(false)
})

test('finishing an older save cannot clear the newer queued draft', async () => {
	const first = Promise.withResolvers<Response>()
	const second = Promise.withResolvers<Response>()
	replies.push(first.promise, second.promise)
	await mount()
	await act(async () => autosave.autoSave(items('First'), { timePeriod: '30d' }))
	await advance()
	await act(async () => autosave.autoSave(items('Second'), { timePeriod: '90d' }))
	await act(async () => first.resolve(Response.json(saved)))
	expect(autosave.hasPendingSave()).toBe(true)
	await advance()
	expect(autosave.hasPendingSave()).toBe(true)
	expect(saves()[1].body.data.timePeriod).toBe('90d')
	await act(async () => second.resolve(Response.json(saved)))
	await advance()
	expect(autosave.hasPendingSave()).toBe(false)
})

test('a document above 48 KiB flushes after 300ms while small documents keep the configured delay', async () => {
	await mount(saved, true, 800)
	await act(async () => autosave.autoSave(items('Small')))
	await advance(300)
	expect(saves()).toHaveLength(0)
	await advance(500)
	expect(saves()).toHaveLength(1)

	const largeItems = Array.from({ length: 60 }, (_, index) => ({
		id: `text-${index}`,
		kind: 'text' as const,
		content: 'x'.repeat(1024)
	}))
	expect(JSON.stringify(largeItems).length).toBeGreaterThan(48 * 1024)
	await act(async () => autosave.autoSave(largeItems))
	await advance(299)
	expect(saves()).toHaveLength(1)
	await advance(1)
	expect(saves()).toHaveLength(2)
	expect(saves()[1].body.data.items).toHaveLength(60)
})

test('sends variables and annotations with every autosave, preferring explicit overrides', async () => {
	await mount()
	await act(async () => autosave.autoSave(items('Defaults')))
	await advance()
	expect(saves()[0].body.data).toMatchObject({ variables: [], annotations: [] })
	const variables = [{ id: 'chain', kind: 'chain' as const, label: 'Chain', value: 'Ethereum' }]
	const annotations = [{ id: 'launch', date: '2026-03-01', label: 'Launch' }]
	await act(async () => autosave.autoSave(items('Overrides'), { variables, annotations }))
	await advance()
	expect(saves()[1].body.data).toMatchObject({ variables, annotations })
})

test('a free user autosaves as public and leaves the notice to the save paths', async () => {
	const privateDashboard: Dashboard = { ...saved, visibility: 'private' }
	await mount(privateDashboard, true, 100, true)
	await act(async () => autosave.autoSave(items('First')))
	await advance()
	expect(saves()[0].body.visibility).toBe('public')
	expect(toastMock).not.toHaveBeenCalled()
})
