// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import hotToast, { Toaster } from 'react-hot-toast'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FEATURES_SERVER, SERVER_URL } from '~/constants'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import { DASHBOARD_HISTORY_LIMIT } from '../../dashboardReducer'
import type { Dashboard } from '../../dashboardTypes'
import {
	ProDashboardAPIProvider,
	useProDashboardDashboard,
	useProDashboardEditorActions,
	useProDashboardHistory
} from '../../ProDashboardAPIContext'
import { ChartGrid } from '../ChartGrid'

const mocks = vi.hoisted(() => ({
	toast: vi.fn(),
	dismissToast: vi.fn(),
	router: {
		push: vi.fn(),
		replace: vi.fn(),
		pathname: '/pro/[dashboardId]/[[...mode]]',
		asPath: '/pro/dashboard',
		query: {} as Record<string, string | Array<string> | undefined>
	}
}))

vi.mock('next/router', () => ({ useRouter: () => mocks.router }))
// Spies over the real toast store, so a mounted Toaster shows what the grid really shows and dismisses.
vi.mock('react-hot-toast', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react-hot-toast')>()
	mocks.toast.mockImplementation(actual.default)
	mocks.dismissToast.mockImplementation(actual.default.dismiss)
	return { ...actual, default: Object.assign(mocks.toast, { ...actual.default, dismiss: mocks.dismissToast }) }
})
// A chart card loads its series over the network; these tests assert only the grid around it and that the card stays
// mounted. ChartGridReadiness.test.tsx renders the real card.
vi.mock('../ChartCard', () => ({ ChartCard: () => <div data-testid="card-body" /> }))

const session = installSubscriberSession('owner', { resolved: true })
const actions = {
	handleChartsReordered: vi.fn(),
	handleRemoveItem: vi.fn(),
	handleColSpanChange: vi.fn(),
	handleHeightChange: vi.fn(),
	handleEditItem: vi.fn(),
	handleUpdateSection: vi.fn()
}
const undo = vi.fn(() => true)
const onAddChartClick = vi.fn()
const onEditItem = vi.fn()

type GridState = {
	items: Array<DashboardItemConfig>
	isReadOnly?: boolean
	tabQueryParam?: string
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	// Without an observer every card mounts at once, as it does on a browser that lacks one.
	vi.stubGlobal('IntersectionObserver', undefined)
	vi.clearAllMocks()
	mocks.router.query = {}
	window.location.hash = ''
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function renderGrid({ items, isReadOnly = false, tabQueryParam }: GridState) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardTestProvider
					mode={isReadOnly ? 'view' : 'edit'}
					items={items}
					permissions={{ isReadOnly }}
					dashboard={{ dashboardId: 'dashboard' }}
					editorActions={actions}
					history={{ undo }}
				>
					<ChartGrid onAddChartClick={onAddChartClick} onEditItem={onEditItem} tabQueryParam={tabQueryParam} />
				</DashboardTestProvider>
			</session.Wrapper>
		)
	)
	await act(async () => {})
}

const COLLAPSE_SETTLE_MS = 320

async function settle(ms = 0) {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, ms))
	})
}

function buttons() {
	return Array.from(container.querySelectorAll('button'))
}

function buttonLabelled(label: string) {
	const button = buttons().find((node) => node.textContent?.trim() === label)
	expect(button).toBeDefined()
	return button!
}

async function openCardMenu(itemId: string) {
	const trigger = container.querySelector<HTMLButtonElement>(`[data-item-id="${itemId}"] [aria-label="More actions"]`)
	if (!trigger) throw new Error(`Expected a card menu on ${itemId}`)
	await act(async () => trigger.click())
}

/** The item in the most recently opened card menu. */
function menuItem(label: string) {
	const item = Array.from(document.body.querySelectorAll<HTMLElement>('[role^="menuitem"]')).findLast(
		(node) => node.textContent?.trim() === label
	)
	if (!item) throw new Error(`Expected a "${label}" menu item`)
	return item
}

async function renderToastContent(call: number) {
	const [renderToast, options] = mocks.toast.mock.calls[call]
	const toastContainer = document.createElement('div')
	document.body.appendChild(toastContainer)
	const toastRoot = createRoot(toastContainer)
	await act(async () => toastRoot.render(renderToast({ id: 'toast-1' })))
	return {
		options,
		element: toastContainer,
		async remove() {
			await act(async () => toastRoot.unmount())
			toastContainer.remove()
		}
	}
}

const notes = (id: string, content = id): DashboardItemConfig => ({ id, kind: 'text', content })
const chart = (id: string, extra: Partial<DashboardItemConfig> = {}) =>
	({ id, kind: 'chart', type: 'tvl', subjectType: 'chain', chain: 'Ethereum', ...extra }) as DashboardItemConfig

test('a read-only section renders its title as a heading above its cards', async () => {
	await renderGrid({
		isReadOnly: true,
		items: [{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' }, notes('text-1', 'Notes')]
	})
	expect(container.querySelector('h2')?.textContent).toBe('Overview')
	expect(container.querySelector('[data-item-id="text-1"]')?.textContent).toContain('Notes')
})

test('a collapsed heading group keeps its cards mounted but hidden', async () => {
	await renderGrid({
		items: [
			{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading', collapsed: true },
			chart('chart-1')
		]
	})
	const group = container.querySelector<HTMLDivElement>('#section-content-section-1')!
	expect(group.hidden).toBe(true)
	expect(group.querySelector('[data-item-id="chart-1"]')).not.toBeNull()
})

test('collapsing a heading group animates before the group is hidden', async () => {
	await renderGrid({
		items: [{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' }, chart('chart-1')]
	})
	const group = container.querySelector<HTMLDivElement>('#section-content-section-1')!
	expect(group.hidden).toBe(false)
	const collapse = buttons().find((node) => node.getAttribute('aria-label') === 'Collapse section')!
	await act(async () => collapse.click())
	await settle()
	expect(group.dataset.collapsed).toBe('true')
	expect(group.hidden).toBe(false)
	await settle(COLLAPSE_SETTLE_MS)
	expect(group.hidden).toBe(true)
	expect(group.querySelector('[data-item-id="chart-1"]')).not.toBeNull()
})

test('the card menu offers the card widths and saves the one picked', async () => {
	await renderGrid({ items: [notes('text-1', 'Notes')] })
	await openCardMenu('text-1')
	await act(async () => menuItem('Three-quarter width').click())
	expect(actions.handleColSpanChange).toHaveBeenCalledExactlyOnceWith('text-1', 1.5)
})

test('a section row carries no card menu and no drag handle', async () => {
	await renderGrid({
		items: [{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' }, notes('text-1')]
	})
	const section = container.querySelector<HTMLDivElement>('[data-item-id="section-1"]')!
	expect(section.querySelector('[aria-label="More actions"]')).toBeNull()
	expect(section.querySelector('[aria-label="Drag to reorder this card"]')).toBeNull()
	expect(section.getAttribute('aria-roledescription')).toBeNull()
	expect(container.querySelector('[data-item-id="text-1"] [aria-label="Drag to reorder this card"]')).not.toBeNull()
})

test('the drag handle carries the sortable attributes instead of the card root', async () => {
	await renderGrid({ items: [notes('text-1')] })
	const card = container.querySelector<HTMLDivElement>('[data-item-id="text-1"]')!
	const handle = card.querySelector<HTMLButtonElement>('[aria-label="Drag to reorder this card"]')!
	expect(handle.getAttribute('aria-roledescription')).toBe('sortable')
	expect(card.getAttribute('aria-roledescription')).toBeNull()
	expect(card.getAttribute('role')).toBeNull()

	await renderGrid({ items: [notes('text-1')], isReadOnly: true })
	const readOnlyCard = container.querySelector<HTMLDivElement>('[data-item-id="text-1"]')!
	expect(readOnlyCard.querySelector('[aria-label="Drag to reorder this card"]')).toBeNull()
	expect(readOnlyCard.getAttribute('aria-roledescription')).toBeNull()
})

test.each([
	['Move up', ['middle', 'first', 'last']],
	['Move down', ['first', 'last', 'middle']]
] as const)('%s from the card menu reorders within the group', async (label, expected) => {
	await renderGrid({ items: ['first', 'middle', 'last'].map((id) => notes(id)) })
	await openCardMenu(label === 'Move up' ? 'first' : 'last')
	expect(menuItem(label).getAttribute('aria-disabled')).toBe('true')
	await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))

	await openCardMenu('middle')
	await act(async () => menuItem(label).click())
	expect(actions.handleChartsReordered).toHaveBeenCalledOnce()
	expect(actions.handleChartsReordered.mock.calls[0][0].map((item: { id: string }) => item.id)).toEqual(expected)
})

test('a keyboard drag tells a screen reader where the card is, that it did not move, and that it was cancelled', async () => {
	await renderGrid({
		items: [
			{ id: 'fees', kind: 'text', title: 'Fees notes', content: 'a' },
			{ id: 'tvl', kind: 'text', title: 'TVL notes', content: 'b' }
		]
	})
	// The live region shows only the latest message, so record each one as it replaces the last.
	const heard: Array<string> = []
	const observer = new MutationObserver(() => {
		const text = document.body.querySelector('[aria-live="assertive"]')?.textContent
		if (text && heard.at(-1) !== text) heard.push(text)
	})
	observer.observe(document.body, { subtree: true, childList: true, characterData: true })
	const handle = container.querySelector<HTMLButtonElement>(
		'[data-item-id="fees"] [aria-label="Drag to reorder this card"]'
	)!
	const press = async (target: EventTarget, code: string) => {
		await act(async () => target.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true })))
		await settle()
	}
	handle.focus()
	await press(handle, 'Space')
	await press(document, 'Space')
	await press(handle, 'Space')
	await press(document, 'Escape')
	observer.disconnect()
	expect(heard).toEqual([
		'Fees notes is over position 1 of 2.',
		'Fees notes was dropped where it started.',
		'Fees notes is over position 1 of 2.',
		'Moving Fees notes cancelled.'
	])
})

test('removing a card skips confirmation and offers Undo in a toast', async () => {
	await renderGrid({ items: [notes('text-1', 'Notes')] })
	await openCardMenu('text-1')
	await act(async () => menuItem('Remove card').click())
	expect(actions.handleRemoveItem).toHaveBeenCalledWith('text-1')
	expect(container.querySelector('[role="dialog"]')).toBeNull()
	expect(mocks.toast).toHaveBeenCalledOnce()
	const toast = await renderToastContent(0)
	expect(toast.options.ariaProps.role).toBe('status')
	const undoButton = Array.from(toast.element.querySelectorAll('button')).find(
		(node) => node.textContent?.trim() === 'Undo'
	)!
	await act(async () => undoButton.click())
	expect(undo).toHaveBeenCalledOnce()
	expect(mocks.dismissToast).toHaveBeenCalledWith('toast-1')
	await toast.remove()
})

async function mountToaster() {
	const toasterContainer = document.createElement('div')
	document.body.appendChild(toasterContainer)
	const toasterRoot = createRoot(toasterContainer)
	await act(async () => toasterRoot.render(<Toaster toastOptions={{ removeDelay: 0 }} />))
	return {
		text: () => toasterContainer.textContent,
		async unmount() {
			await act(async () => toasterRoot.unmount())
			toasterContainer.remove()
			hotToast.remove()
		}
	}
}

test('a card permalink expands the collapsed heading holding the card', async () => {
	const scrollIntoView = vi.fn()
	HTMLElement.prototype.scrollIntoView = scrollIntoView
	window.location.hash = '#item=text-1'
	await renderGrid({
		items: [
			{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading', collapsed: true },
			notes('text-1', 'Notes')
		]
	})
	await act(async () => {
		await waitForUi(() => expect(scrollIntoView).toHaveBeenCalled())
	})
	expect(localStorage.getItem('pro-dashboard-collapsed:dashboard')).toBe('{"section-1":false}')
	const card = container.querySelector('#item-text-1')!
	expect(card.closest('[hidden]')).toBeNull()
})

test('a text card rendering raw HTML gets no edit affordance', async () => {
	await renderGrid({
		items: [notes('text-1', 'Notes'), { id: 'text-2', kind: 'text', content: '<b>Raw</b>', allowHtml: true }]
	})
	const editButtons = (itemId: string) =>
		container.querySelectorAll(`[data-item-id="${itemId}"] button[aria-label="Edit card"]`)
	expect(editButtons('text-1')).toHaveLength(1)
	expect(editButtons('text-2')).toHaveLength(0)
	expect(container.querySelector('[data-item-id="text-2"] [aria-label="Drag to reorder this card"]')).not.toBeNull()
})

const tabbedItems: Array<DashboardItemConfig> = [
	{ id: 'tab-a', kind: 'section', title: 'First', displayAs: 'tab' },
	notes('text-a', 'In first'),
	{ id: 'tab-b', kind: 'section', title: 'Second', displayAs: 'tab' },
	notes('text-b', 'In second')
]

test('the active tab keeps its editable section card inside the panel', async () => {
	await renderGrid({ items: tabbedItems, tabQueryParam: 'tab' })
	const sectionCards = container.querySelectorAll('[data-testid="dashboard-section"]')
	expect(sectionCards).toHaveLength(1)
	expect(sectionCards[0]?.textContent).toContain('First')
	expect(
		buttons().find(
			(node) => node.getAttribute('aria-label') === 'Delete section' || node.textContent?.includes('Delete section')
		)
	).toBeDefined()
})

test('a tab section carries the deep-link wrapper without a drag handle of its own', async () => {
	await renderGrid({ items: tabbedItems.slice(0, 2), tabQueryParam: 'tab' })
	const wrapper = container.querySelector<HTMLDivElement>('#item-tab-a')!
	expect(wrapper.querySelector('[data-testid="dashboard-section"]')).not.toBeNull()
	expect(wrapper.querySelector('[aria-label="Drag to reorder this card"]')).toBeNull()
	expect(
		container.querySelector<HTMLDivElement>('[data-item-id="tab-a"]')!.getAttribute('aria-roledescription')
	).toBeNull()
})

test('switching tabs writes the active tab to the query string and drops it for the first tab', async () => {
	await renderGrid({ items: tabbedItems, tabQueryParam: 'tab' })
	expect(container.textContent).toContain('In first')
	expect(container.textContent).not.toContain('In second')

	await act(async () => buttonLabelled('Second').click())
	expect(mocks.router.replace).toHaveBeenCalledWith(
		{ pathname: '/pro/[dashboardId]/[[...mode]]', query: { tab: 'tab-b' } },
		undefined,
		{ shallow: true, scroll: false }
	)

	mocks.router.query = { tab: 'tab-b' }
	await renderGrid({ items: tabbedItems, tabQueryParam: 'tab' })
	expect(container.textContent).toContain('In second')
	expect(container.textContent).not.toContain('In first')

	await act(async () => buttonLabelled('First').click())
	expect(mocks.router.replace).toHaveBeenLastCalledWith(
		{ pathname: '/pro/[dashboardId]/[[...mode]]', query: {} },
		undefined,
		{ shallow: true, scroll: false }
	)
})

test('switching read-only off keeps card elements mounted', async () => {
	const items: Array<DashboardItemConfig> = [
		{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' },
		chart('chart-1')
	]
	await renderGrid({ items, isReadOnly: true })
	const card = container.querySelector('[data-item-id="chart-1"]')!
	const cardBody = container.querySelector('[data-testid="card-body"]')!
	const section = container.querySelector('[data-item-id="section-1"]')!

	await renderGrid({ items })

	expect(container.querySelector('[data-item-id="chart-1"]')).toBe(card)
	expect(container.querySelector('[data-testid="card-body"]')).toBe(cardBody)
	expect(container.querySelector('[data-item-id="section-1"]')).toBe(section)
})

test('removing a section keeps its cards, hands focus to the grid and offers Undo in its own toast', async () => {
	await renderGrid({
		items: [{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' }, notes('text-1')]
	})
	const remove = buttons().find((node) => node.getAttribute('aria-label') === 'Delete section')!
	await act(async () => {
		remove.focus()
		remove.click()
	})
	expect(actions.handleChartsReordered.mock.calls[0][0].map((item: { id: string }) => item.id)).toEqual(['text-1'])
	expect(document.activeElement).toBe(container.querySelector('[data-testid="dashboard-grid"]'))
	const toast = await renderToastContent(0)
	expect(toast.options.id).toBe('section-removed')
	expect(toast.element.textContent).toContain('Section removed · cards stay')
	await act(async () => Array.from(toast.element.querySelectorAll('button')).at(-1)!.click())
	expect(undo).toHaveBeenCalledOnce()
	await toast.remove()
})

test('the Heading/Tab segment switches how a section renders', async () => {
	await renderGrid({
		items: [{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' }, notes('text-1')]
	})
	const segment = container.querySelector<HTMLElement>('[aria-label="Section display"]')!
	const option = (label: string) =>
		Array.from(segment.querySelectorAll<HTMLLabelElement>('label')).find((node) => node.textContent === label)!
	expect(option('Heading').querySelector('input')!.checked).toBe(true)
	expect(option('Tab').querySelector('input')!.checked).toBe(false)
	await act(async () => option('Tab').querySelector<HTMLInputElement>('input')!.click())
	expect(actions.handleUpdateSection).toHaveBeenCalledWith('section-1', { displayAs: 'tab' })

	await act(async () => option('Heading').querySelector<HTMLInputElement>('input')!.click())
	expect(actions.handleUpdateSection).toHaveBeenCalledOnce()
})

test('the shared area above tabs is labelled and keeps its own add tile', async () => {
	const items: Array<DashboardItemConfig> = [notes('text-shared', 'Shared'), ...tabbedItems.slice(0, 2)]
	await renderGrid({ items })
	expect(container.textContent).toContain('Shown on every tab')
	const addTiles = buttons().filter((node) => node.textContent?.trim() === 'Add card')
	expect(addTiles).toHaveLength(2)
	await act(async () => addTiles[0].click())
	expect(onAddChartClick).toHaveBeenCalledWith({ beforeItemId: 'tab-a' })
	await act(async () => addTiles[1].click())
	expect(onAddChartClick).toHaveBeenLastCalledWith(undefined)

	await renderGrid({ items, isReadOnly: true })
	expect(container.textContent).not.toContain('Shown on every tab')
})

test('tabs without shared cards still offer the shared area to an editor', async () => {
	const items = tabbedItems.slice(0, 2)
	await renderGrid({ items })
	expect(container.textContent).toContain('Shown on every tab')
	await act(async () => buttonLabelled('Add card').click())
	expect(onAddChartClick).toHaveBeenCalledWith({ beforeItemId: 'tab-a' })

	await renderGrid({ items, isReadOnly: true })
	expect(container.textContent).not.toContain('Shown on every tab')
	expect(buttons().some((node) => node.textContent?.trim() === 'Add card')).toBe(false)
})

test('a card keeps its deep-link id in both modes', async () => {
	await renderGrid({ items: [notes('text-1')] })
	expect(container.querySelector<HTMLDivElement>('[data-item-id="text-1"]')!.id).toBe('item-text-1')

	await renderGrid({ items: [notes('text-1')], isReadOnly: true })
	expect(container.querySelector<HTMLDivElement>('[data-item-id="text-1"]')!.id).toBe('item-text-1')
})

test('an empty tab says so, and only offers the add tile to an editor', async () => {
	const items: Array<DashboardItemConfig> = [
		{ id: 'tab-a', kind: 'section', title: 'First', displayAs: 'tab' },
		...tabbedItems.slice(2)
	]
	await renderGrid({ items })
	expect(container.querySelector('[data-testid="dashboard-grid"] [role="status"]')?.textContent).toBe(
		'This tab has no cards yet'
	)

	await renderGrid({ items, isReadOnly: true })
	expect(container.querySelector('[data-testid="dashboard-grid"] [role="status"]')?.textContent).toBe(
		'Nothing in this tab yet'
	)
	expect(buttons().some((node) => node.textContent?.trim() === 'Add card')).toBe(false)
})

describe('the removal Undo toast in a real editor', () => {
	const saved: Dashboard = {
		id: 'dashboard',
		user: 'owner',
		visibility: 'private',
		created: '',
		updated: '',
		data: { dashboardName: 'Analysis', items: [notes('text-1', 'Notes'), notes('text-2', 'Draft')] }
	}
	let editor: ReturnType<typeof useProDashboardEditorActions>
	let history: ReturnType<typeof useProDashboardHistory>
	let dashboard: ReturnType<typeof useProDashboardDashboard>
	function Probe() {
		editor = useProDashboardEditorActions()
		history = useProDashboardHistory()
		dashboard = useProDashboardDashboard()
		return null
	}

	async function openEditor() {
		session.serve({
			'http://localhost:3000/api/dynamic/pro-dashboard/': () =>
				new Response(`${JSON.stringify({ type: 'dashboard', data: saved })}\n{"type":"done"}\n`),
			'/api/private/pro-dashboard/save': (_url: URL, init?: RequestInit) => {
				const body = JSON.parse(String(init!.body))
				return { ...saved, data: { ...saved.data, ...body.data } }
			},
			'/api/dynamic/pro-dashboard/protocol-catalog-source': [],
			[`${SERVER_URL}/lite/protocols2`]: { protocols: [], chains: [], parentProtocols: [] },
			[`${SERVER_URL}/chains`]: [],
			[`${FEATURES_SERVER}/lite/dashboards`]: { items: [] },
			[`${FEATURES_SERVER}/dashboards`]: { items: [] },
			[`${FEATURES_SERVER}/dashboards/`]: saved
		})
		await act(async () =>
			root.render(
				<session.Wrapper>
					<ProDashboardAPIProvider mode="edit" initialDashboardId={saved.id} initialDashboard={saved}>
						<Probe />
						<ChartGrid onAddChartClick={onAddChartClick} onEditItem={onEditItem} />
					</ProDashboardAPIProvider>
				</session.Wrapper>
			)
		)
		await waitForUi(() => expect(dashboard.streamHasResolved).toBe(true))
	}

	let edits = 0
	const editOnce = (text: string) => act(async () => editor.handleEditItem('text-2', notes('text-2', text)))
	async function editDraft(times: number) {
		for (let step = 0; step < times; step++) {
			edits++
			await editOnce(`Draft ${edits}`)
		}
	}

	async function removeNotes() {
		await openCardMenu('text-1')
		await act(async () => menuItem('Remove card').click())
	}

	test('the toast outlives the removal and the next edit dismisses it', async () => {
		const toaster = await mountToaster()
		await openEditor()
		await editDraft(3)
		await removeNotes()
		await settle(20)
		expect(container.querySelector('[data-item-id="text-1"]')).toBeNull()
		expect(toaster.text()).toContain('Card removed')

		await editDraft(1)
		await waitForUi(() => expect(toaster.text()).not.toContain('Card removed'))
		await toaster.unmount()
	})

	test('once the undo history is full, an edit after a removal still dismisses its toast', async () => {
		const toaster = await mountToaster()
		await openEditor()
		await editDraft(DASHBOARD_HISTORY_LIMIT)
		await removeNotes()
		await settle(20)
		expect(toaster.text()).toContain('Card removed')

		await editDraft(1)
		await waitForUi(() => expect(toaster.text()).not.toContain('Card removed'))
		await toaster.unmount()
	})

	test('an undo made while the removal toast is alive dismisses it', async () => {
		const toaster = await mountToaster()
		await openEditor()
		await removeNotes()
		await settle(20)
		expect(toaster.text()).toContain('Card removed')

		await act(async () => history.undo())
		expect(container.querySelector('[data-item-id="text-1"]')).not.toBeNull()
		await waitForUi(() => expect(toaster.text()).not.toContain('Card removed'))
		await toaster.unmount()
	})
})
