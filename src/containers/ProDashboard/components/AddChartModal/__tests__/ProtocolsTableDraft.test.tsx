// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { DASHBOARD_ITEM_REVEAL_EVENT } from '../../../hooks/useDashboardItemDeepLink'
import type { UnifiedTableConfig } from '../../../unifiedTable/config/current'
import { AddChartModal } from '../AddChartModal'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test', query: {}, push: vi.fn() }) }))
// The Charts tab a new card opens on is a heavy child; these tests assert only the table wizard.
vi.mock('../UnifiedChartTab', () => ({ UnifiedChartTab: () => null }))

const session = installSubscriberSession('u1', { resolved: true })
const editTable = vi.fn()

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	editTable.mockReset()
	session.serve({ '/subscription/trial-available': { trialAvailable: false } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const savedTable: UnifiedTableConfig = {
	id: 'table',
	kind: 'unified-table',
	configVersion: 3,
	strategy: 'protocols',
	rowHeaders: ['chain', 'protocol'],
	params: { chains: ['All'] }
}

const button = (name: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find((element) => element.textContent?.startsWith(name))!
const grouping = (label: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find((element) =>
		element.textContent?.startsWith(label)
	)!
const section = (name: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('[role="tablist"][aria-label="Table section"] [role="tab"]')].find(
		(element) => element.textContent?.startsWith(name)
	)!
const tab = (value: string) => document.querySelector<HTMLButtonElement>(`[role="tab"][id$="-tab-${value}"]`)!
const discardQuestion = () => document.querySelector('[role="alertdialog"]')?.querySelector('h2')?.textContent ?? null

async function click(element: HTMLElement) {
	await act(async () => {
		element.focus()
		element.click()
	})
}
async function pressEscape() {
	await act(async () => {
		document.activeElement!.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
		)
	})
}
async function show(editItem?: UnifiedTableConfig) {
	const onClose = vi.fn()
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardTestProvider editorActions={{ handleEditItem: editTable }}>
					<AddChartModal isOpen onClose={onClose} {...(editItem ? { editItem } : {})} />
				</DashboardTestProvider>
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(grouping('Category')).toBeDefined())
	return onClose
}

test('a grouping change to a saved protocols table asks before Escape drops it', async () => {
	const onClose = await show(savedTable)
	expect(grouping('Category').getAttribute('aria-pressed')).toBe('false')
	await click(grouping('Category'))
	expect(grouping('Category').getAttribute('aria-pressed')).toBe('true')

	await pressEscape()
	await waitForUi(() => expect(discardQuestion()).toBe('Discard your changes?'))
	expect(onClose).not.toHaveBeenCalled()
})

test('a saved protocols table browsed without changes closes at once on Escape', async () => {
	const onClose = await show(savedTable)
	await click(section('Columns ('))
	expect(section('Columns (').getAttribute('aria-selected')).toBe('true')
	const panel = document.getElementById(section('Columns (').getAttribute('aria-controls')!)!
	expect(panel.getAttribute('role')).toBe('tabpanel')
	expect(panel.querySelector('[aria-label="Search columns"]')).not.toBeNull()
	await click(section('Grouping & views'))
	expect(grouping('Category').getAttribute('aria-pressed')).toBe('false')

	await pressEscape()
	expect(onClose).toHaveBeenCalledTimes(1)
	expect(discardQuestion()).toBeNull()
})

test('a new protocols table keeps its grouping after the reader visits another tab', async () => {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardTestProvider editorActions={{ handleEditItem: editTable }}>
					<AddChartModal isOpen onClose={vi.fn()} />
				</DashboardTestProvider>
			</session.Wrapper>
		)
	)
	await click(tab('table'))
	await click(button('Protocols'))
	await waitForUi(() => expect(grouping('Category')).toBeDefined())
	await click(grouping('Category'))

	await click(tab('text'))
	expect(document.querySelector('button[aria-pressed]')).toBeNull()
	await click(tab('table'))
	expect(grouping('Category').getAttribute('aria-pressed')).toBe('true')
})

test('a new protocols table lands where Add card was opened and scrolls into view', async () => {
	const appendItems = vi.fn(
		(createItems: (items: []) => Array<{ id: string }>, _placement?: { afterItemId: string }) => ({
			status: 'saved' as const,
			ids: createItems([]).map((item) => item.id)
		})
	)
	const revealed: Array<string> = []
	const listener = (event: Event) => revealed.push((event as CustomEvent<{ itemId: string }>).detail.itemId)
	window.addEventListener(DASHBOARD_ITEM_REVEAL_EVENT, listener)
	try {
		await act(async () =>
			root.render(
				<session.Wrapper>
					<DashboardTestProvider editorActions={{ handleEditItem: editTable, handleAppendItems: appendItems }}>
						<AddChartModal isOpen onClose={vi.fn()} placement={{ afterItemId: 'first' }} />
					</DashboardTestProvider>
				</session.Wrapper>
			)
		)
		await click(tab('table'))
		await click(button('Protocols'))
		await waitForUi(() => expect(grouping('Category')).toBeDefined())
		await click(
			[...document.querySelectorAll<HTMLButtonElement>('footer button')].find((b) => b.textContent === 'Add card')!
		)

		expect(appendItems).toHaveBeenCalledOnce()
		expect(appendItems.mock.calls[0][1]).toEqual({ afterItemId: 'first' })
		const addedId = appendItems.mock.results[0].value.ids[0]
		expect(addedId).toMatch(/^unified-table-protocols-/)
		await waitForUi(() => expect(revealed).toEqual([addedId]))
	} finally {
		window.removeEventListener(DASHBOARD_ITEM_REVEAL_EVENT, listener)
	}
})

test('opening a saved custom column for editing without changing it leaves without asking', async () => {
	const onClose = await show({
		...savedTable,
		customColumns: [
			{ id: 'fee-yield', name: 'Fee yield', expression: 'fees / tvl', format: 'percent', aggregation: 'recalculate' }
		]
	})
	await click(section('Columns ('))
	await click(document.querySelector<HTMLButtonElement>('[aria-label="Edit Fee yield"]')!)
	const name = document.querySelector<HTMLInputElement>('input[placeholder="e.g., TVL to market cap"]')!
	expect(name.value).toBe('Fee yield')

	// From the form, not the Edit button: a focused icon button shows its tooltip, and Escape dismisses that first.
	await act(async () => name.focus())
	await pressEscape()
	expect(onClose).toHaveBeenCalledTimes(1)
	expect(discardQuestion()).toBeNull()
})

test('a half-typed custom column asks before Escape drops it and survives a visit to another section', async () => {
	const onClose = await show(savedTable)
	await click(section('Columns ('))
	await click(button('Custom column'))
	const name = () => document.querySelector<HTMLInputElement>('input[placeholder="e.g., TVL to market cap"]')!
	await act(async () => {
		name().focus()
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name(), 'Fee yield')
		name().dispatchEvent(new Event('input', { bubbles: true }))
	})

	await pressEscape()
	await waitForUi(() => expect(discardQuestion()).toBe('Discard your changes?'))
	expect(onClose).not.toHaveBeenCalled()
	await click(button('Keep editing'))
	await waitForUi(() => expect(discardQuestion()).toBeNull())

	await click(section('Grouping & views'))
	await click(section('Columns ('))
	await click(button('Custom column'))
	expect(name().value).toBe('Fee yield')
})

test('an edit to a saved custom column survives a visit to another section', async () => {
	await show({
		...savedTable,
		customColumns: [
			{ id: 'fee-yield', name: 'Fee yield', expression: 'fees / tvl', format: 'percent', aggregation: 'recalculate' }
		]
	})
	await click(section('Columns ('))
	await click(document.querySelector<HTMLButtonElement>('[aria-label="Edit Fee yield"]')!)
	const name = () => document.querySelector<HTMLInputElement>('input[placeholder="e.g., TVL to market cap"]')!
	await act(async () => {
		name().focus()
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name(), 'Fee ratio')
		name().dispatchEvent(new Event('input', { bubbles: true }))
	})

	await click(section('Grouping & views'))
	await click(section('Columns ('))
	await click(button('Edit custom column'))
	expect(name().value).toBe('Fee ratio')
})
