// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { AUTH_SERVER } from '~/constants'
import { DashboardTestProvider, type DashboardTestState } from '~/utils/testing/dashboardContext'
import { installSubscriberSession, type SessionAccount } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import ProDashboard from '..'
import { subscribeSqlRefreshAll } from '../components/SqlChart/sqlRefreshBus'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { Dashboard } from '../dashboardTypes'
// The editor dialogs load lazily. Loading them while the file is collected keeps the first open inside a
// test's wait, and keeps their compile time (about 12s cold for the chart editor) off any hook's timeout.
import '../components/AddChartModal/AddChartModal'
import '../components/DashboardSettingsModal'
import '../components/QuickAddPalette'

const mocks = vi.hoisted(() => ({ push: vi.fn() }))
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toastMock, toast: toastMock, Toaster: () => null }))
vi.mock('next/router', () => ({
	useRouter: () => ({ events: { on: vi.fn(), off: vi.fn() }, query: {}, push: mocks.push, pathname: '/pro/[id]' })
}))
// Cards and dialogs that load their own data; these tests assert nothing about what they render.
vi.mock('../components/SqlChart/SqlChartCard', () => ({ SqlChartCard: () => null }))
vi.mock('../components/IncomeStatementCard', () => ({ IncomeStatementCard: () => null }))
vi.mock('../components/UnlocksPieCard', () => ({ UnlocksPieCard: () => null }))
vi.mock('../components/LikeDashboardButton', () => ({ LikeDashboardButton: () => null }))
vi.mock('../components/CreateDashboardPicker', () => ({ CreateDashboardPicker: () => null }))

const note: DashboardItemConfig = { id: 'text', kind: 'text', content: 'Note' }
const actions = {
	saveDashboard: vi.fn(async () => {}),
	publishDashboard: vi.fn(async () => {}),
	undoAIGeneration: vi.fn()
}
const undoEdit = vi.fn(() => true)
const flush = vi.fn()
const appendItems = vi.fn()

let session: ReturnType<typeof installSubscriberSession>
function signInAs(account: SessionAccount) {
	const installed = installSubscriberSession('owner', { account, resolved: true })
	beforeEach(() => {
		session = installed
		session.serve({
			'/lite/dashboards': { items: [] },
			'/subscription/trial-available': { trialAvailable: false },
			[`${AUTH_SERVER}/team`]: { team: null },
			'/authors/me': { author: null },
			'/dashboards/search': { items: [], page: 1, perPage: 9, totalItems: 0, totalPages: 0, searchParams: {} },
			'https://api.llama.fi/config/smol/appMetadata-protocols.json': {},
			'https://api.llama.fi/config/smol/appMetadata-chains.json': {},
			'/api/public/pro-dashboard/pf-ps-protocols': { pf: [], ps: [] }
		})
	})
}

type ViewState = {
	items: Array<DashboardItemConfig>
	mode?: 'view' | 'edit'
	loading?: boolean
	tags?: Array<string>
	owned?: { slug?: string; visibility?: 'private' | 'public'; user?: string }
	readOnlyReason?: 'subscription'
	save?: DashboardTestState['save']
	createDialog?: Ariakit.DialogStore
}

let root: Root
let container: HTMLDivElement
let createDialog: Ariakit.DialogStore | undefined

function CreateDialogOwner({ children }: { children: (store: Ariakit.DialogStore) => React.ReactNode }) {
	const store = Ariakit.useDialogStore()
	createDialog = store
	return children(store)
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.clearAllMocks()
	createDialog = undefined
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function renderDashboard({
	items,
	mode = 'view',
	loading = false,
	tags = [],
	owned,
	readOnlyReason,
	save
}: ViewState) {
	const currentDashboard = owned
		? ({
				id: 'fixture',
				user: owned.user ?? 'owner',
				data: { items, dashboardName: 'Fixture' },
				created: '',
				updated: '',
				...(owned.slug ? { slug: owned.slug } : {})
			} as Dashboard)
		: null
	await act(async () =>
		root.render(
			<session.Wrapper>
				<CreateDialogOwner>
					{(store) => (
						<DashboardTestProvider
							mode={mode}
							items={items}
							permissions={{
								canEdit: !!owned,
								canDelete: !!owned,
								canMove: !!owned,
								isReadOnly: mode === 'view' || loading,
								reason: readOnlyReason ?? (loading ? 'dashboard-loading' : mode === 'view' ? 'view-mode' : null)
							}}
							dashboard={{
								dashboardName: 'Fixture',
								dashboardId: 'fixture',
								dashboardVisibility: owned?.visibility ?? 'public',
								dashboardTags: tags,
								currentDashboard,
								getCurrentRatingSession: () => null,
								canUndo: true,
								copyDashboard: vi.fn(),
								deleteDashboard: vi.fn(),
								...actions
							}}
							editorActions={{ handleAppendItems: appendItems, handleEditItem: vi.fn() }}
							history={{ undo: undoEdit }}
							variables={{ canEditVariables: mode === 'edit' }}
							ui={{ createDashboardDialogStore: store }}
							save={{ queued: null, state: undefined, saving: false, retry: vi.fn(), flush, ...save }}
						>
							<ProDashboard />
						</DashboardTestProvider>
					)}
				</CreateDialogOwner>
			</session.Wrapper>
		)
	)
	await act(async () => {})
}
function button(label: string) {
	return Array.from(document.body.querySelectorAll('button')).find((node) => node.textContent?.trim() === label)
}
function menuItem(label: string) {
	return Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
		(node) => node.textContent?.trim() === label
	)
}
async function openDashboardMenu() {
	await act(async () => document.body.querySelector<HTMLButtonElement>('[aria-label="Dashboard actions"]')!.click())
}
/** The "Actions" button is the phone trigger; from md the "…" button replaces it. */
async function openPhoneMenu() {
	await act(async () => button('Actions')!.click())
}
function openMenu() {
	return document.body.querySelector<HTMLElement>('[role="menu"]')
}
function menuItemName(item: HTMLElement) {
	const labelledBy = item.getAttribute('aria-labelledby')
	return (
		item.getAttribute('aria-label') ??
		(labelledBy ? document.getElementById(labelledBy)!.textContent : item.textContent)
	)
}
function menuItemNames(menu: HTMLElement) {
	return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')).map((item) => menuItemName(item)?.trim())
}
function phoneMenuItem(name: string) {
	const item = Array.from(openMenu()!.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
		(node) => menuItemName(node)?.trim() === name
	)
	expect(item).toBeDefined()
	return item!
}
async function pressKey(target: EventTarget, key: string, init: KeyboardEventInit = {}) {
	await act(async () => {
		target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
	})
}
function typeInto(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
	const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
	Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value)
	field.dispatchEvent(new Event('input', { bubbles: true }))
}
/** The open card editor, found by its heading so a closing quick add dialog is not mistaken for it. */
function cardEditor() {
	return Array.from(document.querySelectorAll('[role="dialog"]')).find((dialog) =>
		/^(Add card|Edit card)/.test(dialog.querySelector('h2')?.textContent ?? '')
	)
}
function dialogTitle() {
	return cardEditor()?.querySelector('h2')?.textContent
}
async function openQuickAddTextDraft() {
	await pressKey(window, 'k', { ctrlKey: true })
	const input = await waitForUi(() => {
		const field = document.querySelector<HTMLInputElement>('input[aria-label="Quick add"]')
		if (!field) throw new Error('Expected quick add')
		return field
	})
	await act(async () => typeInto(input, 'text'))
	await pressKey(input, 'Enter')
	await waitForUi(() => expect(dialogTitle()).toBe('Add card'))
}

describe('a visitor', () => {
	signInAs('signed-out')

	test.each(['income-statement', 'unlocks-pie'] as const)(
		'refreshes SQL alongside %s without an irrelevant period strip',
		async (kind) => {
			const refreshed = vi.fn()
			const unsubscribe = subscribeSqlRefreshAll(refreshed)
			try {
				await renderDashboard({
					items: [
						{ id: 'sql', kind: 'sql' },
						{ id: kind, kind }
					] as Array<DashboardItemConfig>
				})
				expect(button('30d')).toBeUndefined()
				expect(button('Actions')).toBeUndefined()
				await act(async () => button('Refresh all SQL')!.click())
				expect(refreshed).toHaveBeenCalledOnce()
			} finally {
				unsubscribe()
			}
		}
	)

	test('a view without SQL or period charts has no toolbar', async () => {
		await renderDashboard({ items: [note] })
		expect(container.textContent).toContain('Note')
		expect(button('Refresh all SQL')).toBeUndefined()
		expect(button('30d')).toBeUndefined()
		expect(button('Actions')).toBeUndefined()
	})

	test('an empty dashboard offers no editor hints', async () => {
		await renderDashboard({ items: [] })
		expect(container.textContent).toContain('This dashboard is empty')
		expect(button('Actions')).toBeUndefined()
		expect(document.body.querySelector('[aria-label="Dashboard actions"]')).toBeNull()
		expect(document.body.querySelector('[aria-label="Dashboard Settings"]')).toBeNull()
		expect(document.body.querySelector('[aria-label="What you can add next"]')).toBeNull()
	})

	test('a tagged public dashboard suggests similar dashboards below the grid, but not while editing', async () => {
		const similar = {
			id: 'other',
			tags: ['lending'],
			data: { items: [], dashboardName: 'Other lending' },
			created: '',
			updated: ''
		}
		session.serve({
			'/dashboards/search': { items: [similar], page: 1, perPage: 9, totalItems: 1, totalPages: 1, searchParams: {} }
		})
		await renderDashboard({ items: [note], tags: ['lending', 'l2'] })
		await waitForUi(() => expect(container.textContent).toContain('Similar dashboards'))
		expect(container.textContent).toContain('Other lending')
		expect(
			session.requests.find((request) => request.url.pathname === '/dashboards/search')?.url.searchParams.get('tags')
		).toBe('lending,l2')

		await renderDashboard({ items: [note], tags: ['lending', 'l2'], mode: 'edit' })
		expect(container.textContent).not.toContain('Similar dashboards')
	})

	test('a viewed dashboard shows its name as plain heading text', async () => {
		await renderDashboard({ items: [note] })
		const heading = container.querySelector('h1')!
		expect(heading.textContent).toBe('Fixture')
		expect(heading.querySelector('button')).toBeNull()
	})
})

describe('an owner whose subscription ended', () => {
	signInAs('free')
	const notice = 'Your subscription has ended, so this dashboard is view-only.'

	test('sees an inline notice with a link to renew', async () => {
		await renderDashboard({ items: [note], owned: {}, readOnlyReason: 'subscription' })
		const status = Array.from(container.querySelectorAll('[role="status"]')).find((node) =>
			node.textContent?.startsWith(notice)
		)
		expect(status?.textContent).toBe(`${notice} Renew`)
		expect(status?.querySelector('a')?.getAttribute('href')).toBe('/subscription')
	})

	test('a visitor to someone else’s read-only dashboard sees no renewal notice', async () => {
		await renderDashboard({
			items: [note],
			owned: { user: 'someone-else' },
			readOnlyReason: 'subscription'
		})
		expect(container.textContent).toContain('Note')
		expect(container.textContent).not.toContain(notice)
	})
})

describe('an editor', () => {
	signInAs('subscriber')

	test('the editor toolbar reaches parameters and annotations and answers the undo hotkey', async () => {
		await renderDashboard({ items: [note], mode: 'edit' })
		expect(button('Parameter')).toBeDefined()
		expect(button('Annotations')).toBeDefined()
		await pressKey(window, 'z', { ctrlKey: true })
		expect(undoEdit).toHaveBeenCalledOnce()
	})

	test('Ctrl+K opens quick add, and a quick add row it customizes opens the full editor with its draft', async () => {
		await renderDashboard({ items: [note], mode: 'edit' })
		expect(document.querySelector('input[aria-label="Quick add"]')).toBeNull()
		await openQuickAddTextDraft()
		expect(document.querySelector('input[aria-label="Quick add"]')).toBeNull()
		expect(cardEditor()?.querySelector('textarea')?.value).toBe('')
	})

	test('adding text after editing a card starts from an empty draft, not the edited card', async () => {
		await renderDashboard({ items: [{ id: 'existing-text', kind: 'text', content: 'Keep this note' }], mode: 'edit' })
		await act(async () => button('Edit card')!.click())
		await waitForUi(() => expect(dialogTitle()).toBe('Edit card · Text'))
		expect(cardEditor()?.querySelector('textarea')?.value).toBe('Keep this note')
		await pressKey(cardEditor()!, 'Escape')

		await openQuickAddTextDraft()
		expect(cardEditor()?.querySelector('textarea')?.value).toBe('')
	})

	test('an empty editor reaches settings from the dashboard menu and the empty state', async () => {
		await renderDashboard({ items: [], mode: 'edit' })
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
	})

	test('the phone menu lists the editor actions, then every dashboard action once', async () => {
		await renderDashboard({ items: [note], mode: 'edit', owned: {} })
		const desktopNames = (await openDashboardMenu(), menuItemNames(openMenu()!))
		expect(desktopNames).toEqual(['Dashboard Settings', 'Duplicate', 'New dashboard', 'Delete dashboard…'])
		await pressKey(openMenu()!, 'Escape')
		await openPhoneMenu()
		expect(menuItemNames(openMenu()!)).toEqual([
			'Add card',
			'Add section',
			'Edit with LlamaAI',
			'Undo AI changes',
			...desktopNames
		])
	})

	test('a phone menu action closes the menu and runs', async () => {
		await renderDashboard({ items: [note], mode: 'edit' })
		await openPhoneMenu()
		expect(openMenu()!.textContent).not.toContain('Group cards into a section')
		await act(async () => phoneMenuItem('Undo AI changes').click())
		expect(actions.undoAIGeneration).toHaveBeenCalledOnce()
		await waitForUi(() => expect(openMenu()).toBeNull())
	})

	test('deleting from the phone menu asks first', async () => {
		await renderDashboard({ items: [note], mode: 'edit', owned: {} })
		await openPhoneMenu()
		await act(async () => phoneMenuItem('Delete dashboard…').click())
		const confirm = await waitForUi(() => {
			const dialog = document.body.querySelector('[role="alertdialog"], [role="dialog"]')
			expect(dialog?.querySelector('h2')?.textContent).toBe('Delete dashboard')
			return dialog!
		})
		expect(confirm.textContent).toContain('Deleting “Fixture” cannot be undone.')
	})

	test('a loading editor lists the card actions in the phone menu but refuses them', async () => {
		await renderDashboard({ items: [note], mode: 'edit', loading: true })
		await openPhoneMenu()
		const rows = [phoneMenuItem('Add card'), phoneMenuItem('Add section')]
		expect(rows.map((node) => node.getAttribute('aria-disabled'))).toEqual(['true', 'true'])
		// Phones never show a title tooltip, so the reason is visible text tied to each row.
		expect(rows.map((node) => document.getElementById(node.getAttribute('aria-describedby')!)?.textContent)).toEqual([
			'Loading dashboard…',
			'Loading dashboard…'
		])
		await act(async () => rows[0]!.click())
		await act(async () => rows[1]!.click())
		expect(openMenu()).not.toBeNull()
		expect(appendItems).not.toHaveBeenCalled()
	})

	test('a viewing owner publishes from the share popover and is sent to the editor to change settings', async () => {
		await renderDashboard({ items: [note], owned: { slug: 'fixture-slug', visibility: 'private' } })
		await act(async () => button('Share')!.click())
		await act(async () => button('Make public')!.click())
		expect(actions.publishDashboard).toHaveBeenCalledOnce()
		await act(async () => button('Edit dashboard')!.click())
		expect(mocks.push).toHaveBeenCalledWith('/pro/fixture-slug/edit', undefined, { shallow: true })
		expect(button('Open settings')).toBeUndefined()
	})

	test('an editing owner reaches dashboard settings from the share popover', async () => {
		await renderDashboard({ items: [note], mode: 'edit', owned: { slug: 'fixture-slug', visibility: 'private' } })
		await act(async () => button('Share')!.click())
		expect(button('Edit dashboard')).toBeUndefined()
		expect(button('Open settings')).toBeDefined()
		expect(mocks.push).not.toHaveBeenCalled()
	})

	test('creating a dashboard moved from the header into the dashboard menu', async () => {
		await renderDashboard({ items: [note], owned: { slug: 'fixture-slug' } })
		expect(button('New Dashboard')).toBeUndefined()
		await openDashboardMenu()
		await act(async () => menuItem('New dashboard')!.click())
		expect(createDialog?.getState().open).toBe(true)
	})

	test('the editor renames the dashboard from its heading', async () => {
		await renderDashboard({ items: [note], mode: 'edit' })
		const heading = container.querySelector('h1')!
		await act(async () => heading.querySelector('button')!.click())
		const field = heading.querySelector('input')!
		await act(async () => typeInto(field, 'Renamed'))
		await pressKey(field, 'Enter')
		expect(actions.saveDashboard).toHaveBeenCalledExactlyOnceWith({ dashboardName: 'Renamed' })
	})

	test('Done refuses to leave the editor while the last save is in error', async () => {
		await renderDashboard({ items: [note], mode: 'edit', owned: {}, save: { state: { status: 'error' } as never } })
		await act(async () => button('Done')!.click())
		expect(flush).not.toHaveBeenCalled()
		expect(mocks.push).not.toHaveBeenCalled()
		expect(toastMock.error).toHaveBeenCalledWith(
			'Changes could not be saved. Retry the save first.',
			expect.objectContaining({ id: 'dashboard-done-blocked' })
		)
	})

	test('a save that fails after Done keeps the retry affordance in view mode', async () => {
		await renderDashboard({ items: [note], mode: 'edit', owned: {} })
		await act(async () => button('Done')!.click())

		await renderDashboard({ items: [note], owned: {}, save: { state: { status: 'error' } as never } })
		expect(button('Retry save')).toBeDefined()
		expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('Changes couldn')
	})
})
