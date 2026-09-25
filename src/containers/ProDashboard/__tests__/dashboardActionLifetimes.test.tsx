// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER, SERVER_URL } from '~/constants'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { Dashboard, DashboardRatingDecision } from '../dashboardTypes'
import {
	ProDashboardAPIProvider,
	useProDashboardDashboard,
	useProDashboardEditorActions,
	useProDashboardItemsState
} from '../ProDashboardAPIContext'
import type { DashboardSavePayload } from '../services/DashboardAPI'

const router = vi.hoisted(() => ({
	push: vi.fn(),
	replace: vi.fn(),
	pathname: '/pro/[dashboardId]',
	asPath: '/pro/dashboard',
	query: {}
}))
vi.mock('next/router', () => ({ useRouter: () => router }))

const session = installSubscriberSession('owner')

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
const another: Dashboard = {
	...original,
	id: 'another',
	data: { ...original.data, dashboardName: 'Another dashboard', items: laterItems }
}
const savedDashboards: Record<string, Dashboard> = { dashboard: original, another }

/** The payload of every save request, in order. */
let saves: Array<DashboardSavePayload>
/** Answers for the next saves; a save without one is stored as sent. */
let replies: Array<(payload: DashboardSavePayload) => Promise<Dashboard>>
const storeAsSent = async ({ visibility, tags, description, aiGenerated, ...data }: DashboardSavePayload) =>
	({ ...original, visibility, tags, description, aiGenerated, data: { ...original.data, ...data } }) as Dashboard

let root: Root
let container: HTMLDivElement
let dashboard: ReturnType<typeof useProDashboardDashboard>
let editor: ReturnType<typeof useProDashboardEditorActions>
let items: Array<DashboardItemConfig>
/** The dashboard each render showed, to catch a wrong dashboard even when a later render corrects it. */
let renderedDashboardIds: Array<string | null>
function Probe() {
	dashboard = useProDashboardDashboard()
	editor = useProDashboardEditorActions()
	items = useProDashboardItemsState().items
	renderedDashboardIds.push(dashboard.dashboardId)
	return null
}
async function open(value: Dashboard) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<ProDashboardAPIProvider mode="edit" initialDashboardId={value.id} initialDashboard={value}>
					<Probe />
				</ProDashboardAPIProvider>
			</session.Wrapper>
		)
	)
	// Editor actions need the restored session, and the stream re-applies the saved dashboard when it lands.
	await vi.waitFor(() => {
		expect(session.urls().some((url) => url.includes(`/${value.id}/stream`))).toBe(true)
		expect(dashboard.streamHasResolved).toBe(true)
	})
}
beforeEach(async () => {
	saves = []
	replies = []
	renderedDashboardIds = []
	session.serve({
		'http://localhost:3000/api/dynamic/pro-dashboard/': (url: URL) => {
			const id = url.pathname.split('/')[4]!
			return new Response(`${JSON.stringify({ type: 'dashboard', data: savedDashboards[id] })}\n{"type":"done"}\n`)
		},
		'/api/private/pro-dashboard/save': async (_url: URL, init?: RequestInit) => {
			const body = JSON.parse(String(init!.body))
			const { visibility, tags, description, aiGenerated } = body
			const payload: DashboardSavePayload = { ...body.data, visibility, tags, description, aiGenerated }
			saves.push(payload)
			try {
				return Response.json(await (replies.shift() ?? storeAsSent)(payload))
			} catch (error) {
				return Response.json({ message: (error as Error).message }, { status: 503 })
			}
		},
		// The editor's catalogs and dashboard lists load in the background; these dashboards need none of them.
		'/api/dynamic/pro-dashboard/protocol-catalog-source': [],
		[`${SERVER_URL}/lite/protocols2`]: { protocols: [], chains: [], parentProtocols: [] },
		[`${SERVER_URL}/chains`]: [],
		[`${FEATURES_SERVER}/lite/dashboards`]: { items: [] },
		[`${FEATURES_SERVER}/dashboards`]: { items: [] },
		[`${FEATURES_SERVER}/dashboards/`]: (url: URL) => savedDashboards[url.pathname.split('/')[2]!]
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await open(original)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test.each(['undo', 'iterate'] as const)('%s merges saved items with edits made while saving', async (action) => {
	const pending = Promise.withResolvers<Dashboard>()
	replies.push(() => pending.promise)
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
	await vi.waitFor(() => expect(saves).toHaveLength(1))
	await act(async () => editor.handleEditItem('ai', laterItems[0]))
	await act(async () => {
		pending.resolve(await storeAsSent(saves[0]!))
		await completion
	})
	// The saved result adds a different item; accepting it must retain the concurrent local edit.
	expect(items).toEqual([...laterItems, ...oldItems])
	expect(dashboard.currentDashboard?.data.items).toEqual(oldItems)
})

test('undo restores the previous items when no newer edit exists and removes the undo action', async () => {
	await act(async () => dashboard.undoAIGeneration())
	expect(saves.map((save) => save.items)).toEqual([oldItems])
	expect(items).toEqual(oldItems)
	expect(dashboard.canUndo).toBe(false)
	expect(dashboard.getCurrentRatingSession()).toBeNull()
})

test.each<DashboardRatingDecision>([{ rating: 4, feedback: 'Useful' }, { skipped: true }])(
	'rating decision %j stays retryable after an API failure',
	async (decision) => {
		replies.push(async () => {
			throw new Error('Offline')
		})
		await act(async () => {
			await expect(dashboard.submitRating('session', decision)).rejects.toThrow('Offline')
		})
		expect(dashboard.getCurrentRatingSession()?.sessionId).toBe('session')
		await act(async () => dashboard.submitRating('session', decision))
		expect(saves).toHaveLength(2)
		expect(dashboard.getCurrentRatingSession()).toBeNull()
		expect(dashboard.currentDashboard?.aiGenerated?.session).toMatchObject(decision)
	}
)

test('a late undo acknowledgement cannot replace the dashboard opened during its save', async () => {
	const pending = Promise.withResolvers<Dashboard>()
	replies.push(() => pending.promise)
	let completion: Promise<void>
	await act(async () => {
		completion = dashboard.undoAIGeneration()
	})
	await vi.waitFor(() => expect(saves).toHaveLength(1))
	await open(another)
	expect(dashboard.dashboardId).toBe('another')
	renderedDashboardIds = []
	await act(async () => {
		pending.resolve({ ...original, data: { ...original.data, items: oldItems } })
		await completion
	})
	expect(new Set(renderedDashboardIds)).toEqual(new Set(['another']))
	expect(dashboard.dashboardName).toBe('Another dashboard')
	expect(items).toEqual(laterItems)
})
