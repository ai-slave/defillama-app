// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DashboardSaveGuard } from '~/components/DashboardSaveGuard'
import { FEATURES_SERVER, SERVER_URL } from '~/constants'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { AutosaveStatus } from '../components/AutosaveStatus'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { Dashboard, DashboardAnnotation, DashboardVariable } from '../dashboardTypes'
import { getUnsavedDashboardChanges, useDashboardAPI } from '../hooks/useDashboardAPI'
import {
	ProDashboardAPIProvider,
	useProDashboardDashboard,
	useProDashboardEditorActions,
	useProDashboardItemsState,
	useProDashboardAnnotations,
	useProDashboardSave,
	useProDashboardVariables
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
const toastMock = vi.hoisted(() =>
	Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn(), loading: vi.fn(), custom: vi.fn() })
)
vi.mock('react-hot-toast', () => ({ default: toastMock, toast: toastMock, Toaster: () => null }))

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

/** What the features server holds per dashboard key (id or slug). */
let savedDashboards: Record<string, Dashboard>
/** One-off answers for the next reads of a dashboard key, ahead of the saved dashboard. */
let nextReads: Record<string, Array<() => Promise<Dashboard>>>
/** The payload of every save request, in order. */
let saves: Array<DashboardSavePayload>
/** Answers for the next saves; a save without one is stored as sent. */
let replies: Array<(payload: DashboardSavePayload) => Promise<Dashboard>>
let deleteReplies: Array<() => Promise<unknown>>
const storeAsSent = async ({ visibility, tags, description, aiGenerated, ...data }: DashboardSavePayload) =>
	({ ...original, visibility, tags, description, aiGenerated, data: { ...original.data, ...data } }) as Dashboard
const offline = async (): Promise<never> => {
	throw new Error('Offline')
}
/** Answers a request from a reply that may reject, as the features server would. */
async function answer(reply: () => Promise<unknown>) {
	try {
		return Response.json(await reply())
	} catch (error) {
		return Response.json({ message: (error as Error).message }, { status: 503 })
	}
}

let root: Root
let container: HTMLDivElement
let dashboard: ReturnType<typeof useProDashboardDashboard>
let editor: ReturnType<typeof useProDashboardEditorActions>
let autosave: ReturnType<typeof useProDashboardSave>
let items: Array<DashboardItemConfig>
let variables: ReturnType<typeof useProDashboardVariables>
let annotations: ReturnType<typeof useProDashboardAnnotations>
function Probe() {
	dashboard = useProDashboardDashboard()
	editor = useProDashboardEditorActions()
	items = useProDashboardItemsState().items
	autosave = useProDashboardSave()
	variables = useProDashboardVariables()
	annotations = useProDashboardAnnotations()
	return <AutosaveStatus />
}
async function open(value: Dashboard, key = value.id, withInitial = true) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<ProDashboardAPIProvider
					key={key}
					mode="edit"
					initialDashboardId={key}
					initialDashboard={withInitial ? value : undefined}
				>
					<Probe />
				</ProDashboardAPIProvider>
			</session.Wrapper>
		)
	)
	// Editor actions need the restored session, and the stream re-applies the saved dashboard when it lands.
	await waitForUi(() => {
		expect(session.urls().some((url) => url.includes(`/${key}/stream`))).toBe(true)
		expect(dashboard.streamHasResolved).toBe(true)
	})
}
async function leave() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<p>Elsewhere</p>
			</session.Wrapper>
		)
	)
}
beforeEach(() => {
	savedDashboards = { dashboard: { ...original } }
	nextReads = {}
	saves = []
	replies = []
	deleteReplies = []
	toastMock.mockClear()
	window.sessionStorage.clear()
	session.serve({
		'http://localhost:3000/api/dynamic/pro-dashboard/': (url: URL) => {
			const key = url.pathname.split('/')[4]!
			return new Response(`${JSON.stringify({ type: 'dashboard', data: savedDashboards[key] })}\n{"type":"done"}\n`)
		},
		'/api/private/pro-dashboard/save': (_url: URL, init?: RequestInit) => {
			const body = JSON.parse(String(init!.body))
			const { visibility, tags, description, aiGenerated } = body
			const payload: DashboardSavePayload = { ...body.data, visibility, tags, description, aiGenerated }
			saves.push(payload)
			return answer(() => (replies.shift() ?? storeAsSent)(payload))
		},
		'/api/private/pro-dashboard/delete': () => answer(deleteReplies.shift() ?? (async () => ({ message: 'Deleted' }))),
		[`${FEATURES_SERVER}/dashboards/`]: (url: URL) => {
			const key = url.pathname.split('/')[2]!
			return answer(nextReads[key]?.shift() ?? (async () => savedDashboards[key]))
		},
		// The editor's catalogs and dashboard lists load in the background; these dashboards need none of them.
		'/api/dynamic/pro-dashboard/protocol-catalog-source': [],
		[`${SERVER_URL}/lite/protocols2`]: { protocols: [], chains: [], parentProtocols: [] },
		[`${SERVER_URL}/chains`]: [],
		[`${FEATURES_SERVER}/lite/dashboards`]: { items: [] },
		[`${FEATURES_SERVER}/dashboards`]: { items: [] }
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

/** Reads of the saved dashboard from the features server so far. */
const dashboardReads = () =>
	session.urls().filter((url) => url.startsWith(`${FEATURES_SERVER}/dashboards/${original.id}?`)).length
/** Returns to the tab, and settles whatever refetch that starts. */
async function returnToTab() {
	await act(async () => {
		document.dispatchEvent(new Event('visibilitychange'))
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}

describe('a subscriber editing a dashboard', () => {
	beforeEach(async () => {
		await open(original)
	})

	test('a debounced item edit preserves a newer settings save', async () => {
		await act(async () => editor.handleEditItem('ai', laterItems[0]))
		await act(async () => dashboard.saveDashboard({ dashboardName: 'Renamed', tags: ['Research'] }))
		// Flushing stands in for the debounce timer firing.
		await act(async () => autosave.flush())
		await act(async () => {
			await waitForUi(() => expect(saves).toHaveLength(2))
		})
		expect(saves[1]).toMatchObject({ dashboardName: 'Renamed', tags: ['Research'], items: laterItems })
	})

	test('item edits made while a rating save is pending preserve the saved rating and Undo', async () => {
		const pending = Promise.withResolvers<Dashboard>()
		replies.push(() => pending.promise)
		let completion: Promise<void>
		await act(async () => {
			completion = dashboard.submitRating('session', { rating: 5 })
		})
		await waitForUi(() => expect(saves).toHaveLength(1))
		await act(async () => editor.handleEditItem('ai', laterItems[0]))
		await act(async () => {
			pending.resolve(await storeAsSent(saves[0]!))
			await completion
		})
		await act(async () => autosave.flush())
		await act(async () => {
			await waitForUi(() => expect(saves).toHaveLength(2))
		})
		expect(saves[1]!.aiGenerated?.session?.rating).toBe(5)
		expect(saves[1]!.aiUndoState).toEqual(original.data.aiUndoState)
		expect(saves[1]!.items).toEqual(laterItems)
	})

	test('Retry retains keyboard focus, blocks repeated submission, and saves the failed draft', async () => {
		const retry = Promise.withResolvers<Dashboard>()
		replies.push(offline, () => retry.promise)
		await act(async () => editor.handleEditItem('ai', laterItems[0]))
		await act(async () => autosave.flush())
		await act(async () => {
			await waitForUi(() => expect(autosave.state?.status).toBe('error'))
		})
		expect(saves).toHaveLength(1)
		const button = [...container.querySelectorAll('button')].find((el) => el.textContent === 'Retry save')!
		await act(async () => {
			button.focus()
			button.click()
		})
		await act(async () => {
			await waitForUi(() => expect(button.getAttribute('aria-disabled')).toBe('true'))
		})
		expect(document.activeElement).toBe(button)
		expect(container.querySelector('[role="status"]')?.textContent).toBe('Saving changes')
		await act(async () => button.click())
		expect(saves.map((save) => save.items)).toEqual([laterItems, laterItems])
		await act(async () => retry.resolve({ ...original, data: { ...original.data, items: laterItems } }))
		await act(async () => {
			await waitForUi(() => expect(autosave.state?.status).toBe('success'))
		})
		expect(document.activeElement).toBe(button)
		expect(container.querySelector('[role="alert"]')).toBeNull()
		expect(container.querySelector('[role="status"]')?.textContent).toBe('Changes saved')
	})

	test('a successful manual save includes failed item edits and clears their obsolete retry', async () => {
		replies.push(offline)
		await act(async () => editor.handleEditItem('ai', laterItems[0]))
		await act(async () => autosave.flush())
		await act(async () => {
			await waitForUi(() => expect(autosave.state?.status).toBe('error'))
		})
		await act(async () => dashboard.saveDashboard({ dashboardName: 'Recovered' }))
		expect(saves[1]).toMatchObject({ dashboardName: 'Recovered', items: laterItems })
		// The manual save acknowledged the failed draft, so no autosave outcome is left to show.
		expect(autosave.state).toBeUndefined()
		expect(container.querySelector('[role="alert"]')).toBeNull()
	})

	test('manual acknowledgement does not clear a newer failed item edit', async () => {
		await act(async () => editor.handleEditItem('ai', laterItems[0]))
		const manual = Promise.withResolvers<Dashboard>()
		replies.push(
			async () => ({ ...original, data: { ...original.data, items: laterItems } }),
			() => manual.promise,
			async () => {
				throw new Error('Later edit failed')
			}
		)
		let completion: Promise<void>
		await act(async () => {
			completion = dashboard.saveDashboard({ dashboardName: 'Renamed' })
		})
		await act(async () => {
			await waitForUi(() => expect(saves).toHaveLength(2))
		})
		const latest = { id: 'latest', kind: 'text' as const, content: 'Even newer' }
		await act(async () => editor.handleEditItem('later', latest))
		await act(async () => autosave.flush())
		await act(async () => {
			manual.resolve({ ...original, data: { ...original.data, items: laterItems, dashboardName: 'Renamed' } })
			await completion
		})
		await act(async () => {
			await waitForUi(() => expect(autosave.state?.status).toBe('error'))
		})
		expect(saves[2]).toMatchObject({ dashboardName: 'Renamed', items: [latest] })
		expect(items).toEqual([latest])
	})

	test.each(['pending', 'error'] as const)(
		'returning to a dashboard recovers its %s draft without resubmitting it',
		async (status) => {
			const pending = Promise.withResolvers<Dashboard>()
			replies.push(() => pending.promise)
			await act(async () => editor.handleEditItem('ai', laterItems[0]))
			await act(async () => autosave.flush())
			await act(async () => {
				await waitForUi(() => expect(saves).toHaveLength(1))
			})
			const other: Dashboard = { ...original, id: 'other', data: { ...original.data, dashboardName: 'Other' } }
			savedDashboards.other = other
			await open(other)
			if (status === 'error') await act(async () => pending.reject(new Error('Offline')))
			await open(original, original.id, status === 'pending')
			expect(items).toEqual(laterItems)
			expect(autosave.state?.status).toBe(status)
			expect(saves).toHaveLength(1)
			if (status === 'pending')
				await act(async () => pending.resolve({ ...original, data: { ...original.data, items: laterItems } }))
			else await act(async () => autosave.retry())
			await act(async () => {
				await waitForUi(() => expect(autosave.state?.status).toBe('success'))
			})
			expect(saves.at(-1)!.items).toEqual(laterItems)
		}
	)

	test('retry through a slug route preserves freshly loaded metadata after the old query expires', async () => {
		replies.push(offline)
		await act(async () => editor.handleEditItem('ai', laterItems[0]))
		await act(async () => autosave.flush())
		await act(async () => {
			await waitForUi(() => expect(autosave.state?.status).toBe('error'))
		})
		await leave()
		session.client.removeQueries({ queryKey: ['pro-dashboard', 'dashboard'] })
		const current: Dashboard = {
			...original,
			slug: 'current-analysis',
			tags: ['Current'],
			data: { ...original.data, dashboardName: 'Current analysis' }
		}
		savedDashboards = { dashboard: current, 'current-analysis': current }
		await open(current, 'current-analysis')
		await act(async () => autosave.retry())
		await act(async () => {
			await waitForUi(() => expect(autosave.state?.status).toBe('success'))
		})
		expect(saves[1]).toMatchObject({ dashboardName: 'Current analysis', tags: ['Current'], items: laterItems })
	})

	test.each(['queued', 'pending'] as const)(
		'deletion discards %s autosaves without reviving the deleted cache entry',
		async (phase) => {
			const pending = Promise.withResolvers<Dashboard>()
			replies.push(() => pending.promise)
			await act(async () => editor.handleEditItem('ai', laterItems[0]))
			if (phase === 'pending') await act(async () => autosave.flush())
			await act(async () => dashboard.deleteDashboard(original.id))
			await act(async () =>
				root.render(
					<session.Wrapper>
						<DashboardSaveGuard />
						<p>Dashboard list</p>
					</session.Wrapper>
				)
			)
			await act(async () => pending.resolve({ ...original, data: { ...original.data, items: laterItems } }))
			expect(saves).toHaveLength(phase === 'pending' ? 1 : 0)
			expect(
				session.client.getQueryData<Dashboard | null>(['pro-dashboard', 'dashboard', original.id, true, 'owner'])?.id
			).toBeUndefined()
			const leaving = new Event('beforeunload', { cancelable: true })
			window.dispatchEvent(leaving)
			expect(leaving.defaultPrevented).toBe(false)
		}
	)

	test('failed deletion keeps the unsaved item draft retryable', async () => {
		replies.push(offline)
		deleteReplies.push(async () => {
			throw new Error('Delete failed')
		})
		await act(async () => editor.handleEditItem('ai', laterItems[0]))
		await act(async () => autosave.flush())
		await act(async () => {
			await waitForUi(() => expect(autosave.state?.status).toBe('error'))
		})
		await act(async () => {
			await expect(dashboard.deleteDashboard(original.id)).rejects.toThrow('Delete failed')
		})
		expect(items).toEqual(laterItems)
		expect(autosave.state?.status).toBe('error')
	})

	test('returning to a visible tab refetches the dashboard when nothing is pending', async () => {
		const before = dashboardReads()
		await returnToTab()
		expect(dashboardReads()).toBe(before + 1)
	})

	test('a failed autosave recovers its parameters and annotations, not just its items', async () => {
		const parameter: DashboardVariable = { id: 'chain', kind: 'chain', label: 'Chain', value: 'Ethereum' }
		const annotation: DashboardAnnotation = { id: 'note', date: '2026-09-01', label: 'Event' }
		await act(async () => variables.addVariable(parameter, []))
		await act(async () => annotations.setAnnotations([annotation]))
		replies.push(offline)
		await act(async () => autosave.flush())
		await act(async () => {
			await waitForUi(() => expect(autosave.state?.status).toBe('error'))
		})
		const draft = getUnsavedDashboardChanges(session.client, 'dashboard', 'owner')
		expect(draft?.variables).toEqual([parameter])
		expect(draft?.annotations).toEqual([annotation])
		await leave()
		await open(original)
		expect(variables.variables).toEqual([parameter])
		expect(annotations.annotations).toEqual([annotation])
		await act(async () => editor.handleEditItem('ai', laterItems[0]))
		await act(async () => autosave.flush())
		await act(async () => {
			await waitForUi(() => expect(saves).toHaveLength(2))
		})
		expect(saves[1]!.variables).toEqual([parameter])
		expect(saves[1]!.annotations).toEqual([annotation])
	})
})

describe('a free user editing a dashboard', () => {
	beforeEach(async () => {
		session.serve({ '/subscription/status': fixtureStatus(404) })
		await open(original)
	})

	test('is told once per session that a private choice is saved as public', async () => {
		await act(async () => dashboard.saveDashboard({ visibility: 'private' }))
		expect(saves.at(-1)!.visibility).toBe('public')
		expect(toastMock).toHaveBeenCalledWith(
			'Free dashboards are always public. Upgrade to keep one private.',
			expect.objectContaining({ id: 'free-public' })
		)

		await act(async () => dashboard.saveDashboard({ visibility: 'private' }))
		expect(toastMock).toHaveBeenCalledOnce()
	})

	test('keeps a public save quiet', async () => {
		await act(async () => dashboard.saveDashboard({ visibility: 'public' }))
		expect(saves.at(-1)!.visibility).toBe('public')
		expect(toastMock).not.toHaveBeenCalled()
	})
})

test('loading another id is independent of the hook’s deleted dashboard, while late deleted reads stay discarded', async () => {
	let loader: ReturnType<typeof useDashboardAPI>
	function Loader() {
		loader = useDashboardAPI(original.id)
		return null
	}
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Loader />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(session.urls().some((url) => url.endsWith('/subscription/status'))).toBe(true))
	session.client.setQueryData(['pro-dashboard-deleted', original.id, 'owner'], true)
	const other = { ...original, id: 'other' }
	nextReads.other = [async () => other]
	await expect(loader!.loadDashboard('other')).resolves.toMatchObject({ id: 'other' })
	const late = Promise.withResolvers<Dashboard>()
	nextReads.third = [() => late.promise]
	const loading = loader!.loadDashboard('third')
	session.client.setQueryData(['pro-dashboard-deleted', 'third', 'owner'], true)
	late.resolve({ ...original, id: 'third' })
	await expect(loading).resolves.toBeNull()
})
