// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import ProDashboard from '.'
import type { DashboardItemConfig } from './dashboardItemConfig'

const mocks = vi.hoisted(() => ({
	items: [] as Array<DashboardItemConfig>,
	mode: 'view' as 'view' | 'edit',
	readOnlyReason: null as null | 'dashboard-loading',
	tags: [] as Array<string>,
	auth: { isAuthenticated: false, user: undefined as { id: string } | undefined },
	currentDashboard: null as { id: string; user: string; slug?: string } | null,
	publishDashboard: vi.fn(async () => {}),
	saveDashboard: vi.fn(async () => {}),
	showCreateDialog: vi.fn(),
	push: vi.fn(),
	undo: vi.fn(),
	undoEdit: vi.fn(() => true),
	appendItems: vi.fn(),
	flush: vi.fn(),
	retry: vi.fn(),
	saving: false,
	saveState: undefined as undefined | { status: 'success' | 'error' },
	refresh: vi.fn(),
	progress: { active: 0, failed: 0, total: 0, bulk: false }
}))
const { useDialogStore } = await vi.hoisted(async () => await import('@ariakit/react'))
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toastMock, toast: toastMock, Toaster: () => null }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		isAuthenticated: mocks.auth.isAuthenticated,
		user: mocks.auth.user,
		hasActiveSubscription: false,
		authorizedFetch: vi.fn()
	})
}))
vi.mock('~/containers/Authors/api', () => ({ getMyDashboardAuthorProfile: vi.fn(async () => null) }))
vi.mock('next/router', () => ({
	useRouter: () => ({ events: { on: vi.fn(), off: vi.fn() }, query: {}, push: mocks.push })
}))
vi.mock('./hooks/useFreeTierStatus', () => ({ useFreeTierStatus: () => ({ canCreateDashboard: true }) }))
vi.mock('./AppMetadataContext', () => ({
	AppMetadataProvider: ({ children }: { children: ReactNode }) => children,
	useAppMetadata: () => ({
		loading: false,
		availableProtocolChartTypes: () => [],
		availableChainChartTypes: () => []
	})
}))
vi.mock('./ProDashboardAPIContext', () => ({
	useDashboardMode: () => mocks.mode,
	useProDashboardItemsState: () => ({ items: mocks.items }),
	useProDashboardCatalog: () => ({ protocolsLoading: false, chains: [], protocols: [], protocolBySlug: new Map() }),
	useProDashboardPermissions: () => ({
		isReadOnly: mocks.mode === 'view' || mocks.readOnlyReason !== null,
		reason: mocks.readOnlyReason
	}),
	useDashboardStreamProgress: () => ({
		readyCount: 0,
		totalCount: 0,
		isStreaming: false,
		isDone: true,
		error: null
	}),
	useProDashboardSave: () => ({
		queued: null,
		state: mocks.saveState,
		saving: mocks.saving,
		retry: mocks.retry,
		flush: mocks.flush
	}),
	useProDashboardTime: () => ({ timePeriod: '365d', customTimePeriod: null }),
	useProDashboardDashboard: () => ({
		dashboardName: 'Fixture',
		dashboardId: 'fixture',
		dashboardVisibility: 'public',
		dashboardTags: mocks.tags,
		dashboardDescription: '',
		currentDashboard: mocks.currentDashboard,
		publishDashboard: mocks.publishDashboard,
		saveDashboard: mocks.saveDashboard,
		copyDashboard: vi.fn(),
		deleteDashboard: vi.fn(),
		getCurrentRatingSession: () => null,
		canUndo: true,
		undoAIGeneration: mocks.undo
	}),
	useProDashboardUI: () => {
		const createDashboardDialogStore = useDialogStore()
		createDashboardDialogStore.show = mocks.showCreateDialog
		return { createDashboardDialogStore }
	},
	useProDashboardEditorActions: () => ({ handleAppendItems: mocks.appendItems }),
	useProDashboardHistory: () => ({ canUndo: false, canRedo: false, undo: mocks.undoEdit, redo: vi.fn(() => false) }),
	useProDashboardVariables: () => ({
		variables: [],
		values: {},
		candidates: [],
		canEditVariables: mocks.mode === 'edit',
		setVariableValue: vi.fn(),
		addVariable: vi.fn(),
		renameVariable: vi.fn(),
		removeVariable: vi.fn(),
		unbindVariable: vi.fn()
	}),
	useProDashboardAnnotations: () => ({ annotations: [], setAnnotations: vi.fn() })
}))
vi.mock('./components/SqlChart/sqlRefreshBus', () => ({
	getInitialSqlRefreshProgress: () => mocks.progress,
	getSqlRefreshProgress: () => mocks.progress,
	subscribeSqlRefreshProgress: () => () => {},
	refreshAllSqlCharts: mocks.refresh
}))
vi.mock('./components/ChartGrid', () => ({
	ChartGrid: ({ onEditItem }: { onEditItem: (item: DashboardItemConfig) => void }) => (
		<button type="button" onClick={() => onEditItem(mocks.items[0])}>
			Edit first card
		</button>
	)
}))
vi.mock('./components/CopyDashboardLinkButton', () => ({
	CopyDashboardLinkButton: ({
		manageAction,
		onMakePublic
	}: {
		manageAction?: { label: string; onSelect: () => void }
		onMakePublic?: () => Promise<void>
	}) => (
		<>
			{onMakePublic ? (
				<button type="button" onClick={() => void onMakePublic()}>
					Make public
				</button>
			) : null}
			{manageAction ? (
				<button type="button" onClick={manageAction.onSelect}>
					{manageAction.label}
				</button>
			) : null}
		</>
	)
}))
vi.mock('./components/LikeDashboardButton', () => ({ LikeDashboardButton: () => null }))
vi.mock('./components/CustomTimePeriodPicker', () => ({ CustomTimePeriodPicker: () => null }))
vi.mock('./components/DashboardSettingsModal', () => ({ DashboardSettingsModal: () => null }))
vi.mock('./components/CreateDashboardPicker', () => ({ CreateDashboardPicker: () => null }))
vi.mock('./components/GenerateDashboardModal', () => ({ GenerateDashboardModal: () => null }))
vi.mock('./components/AddChartModal/AddChartModal', () => ({
	AddChartModal: ({
		draftItem,
		editItem,
		onClose
	}: {
		draftItem?: DashboardItemConfig
		editItem?: DashboardItemConfig | null
		onClose: () => void
	}) => (
		<>
			<p>{`add chart modal:${draftItem?.kind ?? 'none'}`}</p>
			<p>{`editing:${editItem?.id ?? 'none'}`}</p>
			<button type="button" onClick={onClose}>
				Close card editor
			</button>
		</>
	)
}))
vi.mock('./components/QuickAddPalette', () => ({
	QuickAddPalette: ({
		open,
		onOpenFullEditor
	}: {
		open: boolean
		onOpenFullEditor: (options: { draftItem?: DashboardItemConfig }) => void
	}) =>
		open ? (
			<div>
				<p>quick add palette</p>
				<button
					type="button"
					onClick={() => onOpenFullEditor({ draftItem: { id: 'draft', kind: 'text', content: '' } })}
				>
					Customize draft
				</button>
			</div>
		) : null
}))
vi.mock('./components/DashboardPaywallModal', () => ({ DashboardPaywallModal: () => null }))
vi.mock('./components/SimilarDashboards', () => ({
	SimilarDashboards: ({ tags }: { tags: ReadonlyArray<string> }) => <p>{`similar:${tags.join(',')}`}</p>
}))
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	mocks.mode = 'view'
	mocks.readOnlyReason = null
	mocks.tags = []
	mocks.auth = { isAuthenticated: false, user: undefined }
	mocks.currentDashboard = null
	mocks.publishDashboard.mockClear()
	mocks.saveDashboard.mockClear()
	mocks.showCreateDialog.mockClear()
	mocks.push.mockClear()
	mocks.undo.mockClear()
	mocks.undoEdit.mockClear()
	mocks.appendItems.mockClear()
	mocks.flush.mockClear()
	mocks.retry.mockClear()
	toastMock.mockClear()
	toastMock.error.mockClear()
	toastMock.success.mockClear()
	mocks.saving = false
	mocks.saveState = undefined
	mocks.refresh.mockClear()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function renderDashboard() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<ProDashboard />
			</QueryClientProvider>
		)
	)
}
function button(label: string) {
	return Array.from(document.body.querySelectorAll('button')).find((node) => node.textContent?.trim() === label)
}
function menuItem(label: string) {
	return Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(
		(node) => node.textContent?.trim() === label
	)
}
async function openDashboardMenu() {
	await act(async () => document.body.querySelector<HTMLButtonElement>('[aria-label="Dashboard actions"]')!.click())
}
function typeInto(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
	const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
	Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value)
	field.dispatchEvent(new Event('input', { bubbles: true }))
}

test.each(['income-statement', 'unlocks-pie'] as const)(
	'refreshes SQL alongside %s without an irrelevant period strip',
	async (kind) => {
		mocks.items = [{ kind: 'sql' }, { kind }] as Array<DashboardItemConfig>
		await renderDashboard()
		expect(button('30d')).toBeUndefined()
		expect(button('Actions')).toBeUndefined()
		expect(button('Refresh all SQL')).toBeDefined()
		await act(async () => button('Refresh all SQL')!.click())
		expect(mocks.refresh).toHaveBeenCalledOnce()
	}
)
test('a view without SQL or period charts has no toolbar', async () => {
	mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
	await renderDashboard()
	expect(button('Refresh all SQL')).toBeUndefined()
	expect(button('30d')).toBeUndefined()
	expect(button('Actions')).toBeUndefined()
})
test('the editor toolbar reaches parameters and annotations and answers the undo hotkey', async () => {
	mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
	mocks.mode = 'edit'
	await renderDashboard()
	expect(button('Parameter')).toBeDefined()
	expect(button('Annotations')).toBeDefined()
	await act(async () => {
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
	})
	expect(mocks.undoEdit).toHaveBeenCalledOnce()
})
test('the editor opens quick add from the toolbar and from the Ctrl+K hotkey', async () => {
	mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
	mocks.mode = 'edit'
	await renderDashboard()
	expect(document.body.textContent).not.toContain('quick add palette')
	await act(async () => {
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
	})
	expect(document.body.textContent).toContain('quick add palette')
	expect(document.body.textContent).not.toContain('add chart modal')
})

test('customizing a quick add row hands its draft to the full editor', async () => {
	mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
	mocks.mode = 'edit'
	await renderDashboard()
	await act(async () => {
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
	})
	await act(async () => button('Customize draft')?.click())

	expect(document.body.textContent).toContain('add chart modal:text')
})

test('adding text after editing clears the edit target even before the previous sheet finishes closing', async () => {
	mocks.items = [{ id: 'existing-text', kind: 'text', content: 'Keep this note' }]
	mocks.mode = 'edit'
	await renderDashboard()
	await act(async () => button('Edit first card')!.click())
	expect(document.body.textContent).toContain('editing:existing-text')
	await act(async () => button('Close card editor')!.click())

	await act(async () => {
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
	})
	await act(async () => button('Customize draft')!.click())

	expect(document.body.textContent).toContain('add chart modal:text')
	expect(document.body.textContent).toContain('editing:none')
	expect(document.body.textContent).not.toContain('editing:existing-text')
})

test('an empty editor keeps settings in the dashboard menu, its sheet and the empty state', async () => {
	mocks.items = []
	mocks.mode = 'edit'
	await renderDashboard()
	expect(button('Parameter')).toBeUndefined()
	expect(button('Annotations')).toBeUndefined()
	expect(button('Add card')).toBeUndefined()
	expect(button('Add section')).toBeUndefined()
	expect(button('30d')).toBeUndefined()
	expect(document.body.querySelector('[aria-label="Dashboard Settings"]')).toBeNull()
	await openDashboardMenu()
	expect(document.body.querySelector('[aria-label="Dashboard Settings"]')).not.toBeNull()
	expect(button('Add your first card')).toBeDefined()
	expect(document.body.querySelectorAll('[aria-label="What you can add next"] li')).toHaveLength(3)
	await act(async () => button('Actions')!.click())
	const dialog = document.body.querySelector('[role="dialog"]')!
	expect(
		Array.from(dialog.querySelectorAll('button'))
			.map((node) => node.textContent?.trim())
			.filter(Boolean)
	).toEqual(['Add card', 'Settings'])
})
test('an empty dashboard read by a visitor offers no editor hints', async () => {
	mocks.items = []
	await renderDashboard()
	expect(container.textContent).toContain('This dashboard is empty')
	expect(button('Actions')).toBeUndefined()
	expect(document.body.querySelector('[aria-label="Dashboard actions"]')).toBeNull()
	expect(document.body.querySelector('[aria-label="Dashboard Settings"]')).toBeNull()
	expect(document.body.querySelector('[aria-label="What you can add next"]')).toBeNull()
})
test('a tagged public dashboard suggests similar dashboards below the grid', async () => {
	mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
	mocks.tags = ['lending', 'l2']
	await renderDashboard()
	expect(container.textContent).toContain('similar:lending,l2')
	mocks.mode = 'edit'
	await renderDashboard()
	expect(container.textContent).not.toContain('similar:')
})
test('mobile editor actions close the sheet and run the selected action', async () => {
	mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
	mocks.mode = 'edit'
	await renderDashboard()
	await act(async () => button('Actions')!.click())
	const dialog = document.body.querySelector('[role="dialog"]')!
	expect(
		Array.from(dialog.querySelectorAll('button'))
			.map((node) => node.textContent?.trim())
			.filter(Boolean)
	).toEqual(['Add card', 'Add section', 'Edit with LlamaAI', 'Undo AI changes', 'Settings'])
	await act(async () =>
		Array.from(dialog.querySelectorAll('button'))
			.find((node) => node.textContent?.trim() === 'Undo AI changes')!
			.click()
	)
	expect(mocks.undo).toHaveBeenCalledOnce()
	expect(document.body.querySelector('[role="dialog"]')).toBeNull()
})

test('a loading editor lists the card actions in the sheet but refuses them', async () => {
	mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
	mocks.mode = 'edit'
	mocks.readOnlyReason = 'dashboard-loading'
	await renderDashboard()
	await act(async () => button('Actions')!.click())
	const dialog = document.body.querySelector('[role="dialog"]')!
	const rows = Array.from(dialog.querySelectorAll('button')).filter((node) =>
		['Add card', 'Add section'].includes(node.textContent?.trim() ?? '')
	)
	expect(rows.map((node) => node.textContent?.trim())).toEqual(['Add card', 'Add section'])
	expect(rows.map((node) => node.getAttribute('aria-disabled'))).toEqual(['true', 'true'])
	await act(async () => rows[0]!.click())
	await act(async () => rows[1]!.click())
	expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
	expect(mocks.appendItems).not.toHaveBeenCalled()
})

test('a viewing owner publishes from the share popover and is sent to the editor to change settings', async () => {
	mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
	mocks.auth = { isAuthenticated: true, user: { id: 'owner' } }
	mocks.currentDashboard = { id: 'fixture', user: 'owner', slug: 'fixture-slug' }
	await renderDashboard()
	await act(async () => button('Make public')!.click())
	expect(mocks.publishDashboard).toHaveBeenCalledOnce()
	await act(async () => button('Edit dashboard')!.click())
	expect(mocks.push).toHaveBeenCalledWith('/pro/fixture-slug/edit', undefined, { shallow: true })
	expect(button('Open settings')).toBeUndefined()
})

test('an editing owner reaches dashboard settings from the share popover', async () => {
	mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
	mocks.mode = 'edit'
	mocks.auth = { isAuthenticated: true, user: { id: 'owner' } }
	mocks.currentDashboard = { id: 'fixture', user: 'owner', slug: 'fixture-slug' }
	await renderDashboard()
	expect(button('Edit dashboard')).toBeUndefined()
	expect(button('Open settings')).toBeDefined()
	expect(mocks.push).not.toHaveBeenCalled()
})

test('creating a dashboard moved from the header into the dashboard menu', async () => {
	mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
	mocks.auth = { isAuthenticated: true, user: { id: 'owner' } }
	mocks.currentDashboard = { id: 'fixture', user: 'owner', slug: 'fixture-slug' }
	await renderDashboard()
	expect(button('New Dashboard')).toBeUndefined()
	await openDashboardMenu()
	await act(async () => (menuItem('New dashboard') as HTMLElement).click())
	expect(mocks.showCreateDialog).toHaveBeenCalledOnce()
})

test('the editor renames the dashboard from its heading', async () => {
	mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
	mocks.mode = 'edit'
	await renderDashboard()
	const heading = container.querySelector('h1')!
	await act(async () => heading.querySelector('button')!.click())
	const field = heading.querySelector('input')!
	await act(async () => typeInto(field, 'Renamed'))
	await act(async () => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
	expect(mocks.saveDashboard).toHaveBeenCalledExactlyOnceWith({ dashboardName: 'Renamed' })
})

test('a viewed dashboard shows its name as plain heading text', async () => {
	mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
	await renderDashboard()
	const heading = container.querySelector('h1')!
	expect(heading.textContent).toBe('Fixture')
	expect(heading.querySelector('button')).toBeNull()
})

function statusText() {
	return Array.from(document.body.querySelectorAll('[role="status"]'))
		.map((node) => node.textContent?.trim())
		.join('|')
}

function asOwnerEditing() {
	mocks.items = [{ id: 'text', kind: 'text', content: 'Note' }]
	mocks.mode = 'edit'
	mocks.auth = { isAuthenticated: true, user: { id: 'owner' } }
	mocks.currentDashboard = { id: 'fixture', user: 'owner' }
}

test('Done waits for the flush to land before it claims the dashboard is saved', async () => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
	try {
		asOwnerEditing()
		await renderDashboard()
		await act(async () => button('Done')!.click())
		expect(mocks.flush).toHaveBeenCalledOnce()
		expect(mocks.push).toHaveBeenCalledOnce()

		mocks.mode = 'view'
		mocks.saving = true
		await renderDashboard()
		expect(statusText()).toContain('Saving…')
		expect(statusText()).not.toContain('Saved')

		mocks.saving = false
		mocks.saveState = { status: 'success' }
		await renderDashboard()
		expect(statusText()).toContain('Saved')

		await act(async () => {
			vi.advanceTimersByTime(1500)
		})
		expect(statusText()).not.toContain('Saved')
	} finally {
		vi.useRealTimers()
	}
})

test('Done refuses to leave the editor while the last save is in error', async () => {
	asOwnerEditing()
	mocks.saveState = { status: 'error' }
	await renderDashboard()
	await act(async () => button('Done')!.click())
	expect(mocks.flush).not.toHaveBeenCalled()
	expect(mocks.push).not.toHaveBeenCalled()
	expect(toastMock.error).toHaveBeenCalledWith(
		'Changes could not be saved. Retry the save first.',
		expect.objectContaining({ id: 'dashboard-done-blocked' })
	)
})

test('a save that fails after Done keeps the retry affordance in view mode', async () => {
	asOwnerEditing()
	await renderDashboard()
	await act(async () => button('Done')!.click())

	mocks.mode = 'view'
	mocks.saveState = { status: 'error' }
	await renderDashboard()
	expect(button('Retry save')).toBeDefined()
	expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('Changes couldn')
})
