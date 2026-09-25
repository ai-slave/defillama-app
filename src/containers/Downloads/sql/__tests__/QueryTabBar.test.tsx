// @vitest-environment happy-dom

import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Tabs, TabPanel } from '~/ui/Tabs'
import { QueryTabBar } from '../QueryTabBar'
import { useSqlTabs, type UseSqlTabsReturn } from '../useSqlTabs'

const mocks = { rename: vi.fn(), select: vi.fn() }
const STORAGE_KEY = 'sql-studio:tabs:v2'
const persisted = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!)
let root: Root
let container: HTMLDivElement
let model: UseSqlTabsReturn

function Harness() {
	const tabs = useSqlTabs()
	useLayoutEffect(() => {
		model = tabs
	})
	return (
		<>
			<Tabs
				value={tabs.activeTabId}
				values={tabs.tabs.map((entry) => entry.id)}
				onValueChange={(id) => {
					mocks.select(id)
					tabs.focusTab(id)
				}}
			>
				<QueryTabBar
					tabs={tabs.tabs}
					activeTabId={tabs.activeTabId}
					onClose={tabs.closeTab}
					onNewTab={() => tabs.openTab({})}
					onNewNotebookTab={() => tabs.openNotebookTab({})}
					onRename={(id, title) => {
						mocks.rename(id, title)
						tabs.renameTab(id, title)
					}}
					onDuplicate={tabs.duplicateTab}
					onCloseOthers={tabs.closeOthers}
					onCloseToRight={tabs.closeToRight}
					onConvertToNotebook={tabs.convertTabToNotebook}
				/>
				<TabPanel value={tabs.activeTabId}>
					<textarea
						aria-label="SQL editor"
						value={tabs.activeTab.sql}
						onChange={(e) => tabs.setActiveSql(e.target.value)}
					/>
					<span>{tabs.activeTab.result?.rows.length ?? 0} result rows</span>
				</TabPanel>
			</Tabs>
			<button type="button">Outside</button>
		</>
	)
}
beforeEach(() => {
	vi.clearAllMocks()
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify({
			activeTabId: 'b',
			tabs: ['a', 'b', 'c'].map((id) => ({
				id,
				title: id.toUpperCase(),
				titleAuto: false,
				sql: `SELECT '${id}'`,
				mode: 'query'
			}))
		})
	)
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
	localStorage.clear()
})
async function settle(action: () => void) {
	await act(async () => {
		action()
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}
async function mount() {
	await settle(() => root.render(<Harness />))
}
function tab(name: string) {
	return [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
		(e) => e.getAttribute('aria-label') === name
	)!
}
function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(e) => e.getAttribute('aria-label') === name || e.textContent === name
	)!
}
function item(name: string | RegExp) {
	return [...document.querySelectorAll<HTMLElement>('[role="menu"]:not([hidden]) [role="menuitem"]')].find((e) =>
		typeof name === 'string' ? e.textContent?.trim() === name : name.test(e.textContent ?? '')
	)!
}
async function press(element: HTMLElement, key: string, shiftKey = false) {
	await settle(() => {
		element.focus()
		element.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }))
		element.dispatchEvent(new KeyboardEvent('keyup', { key, shiftKey, bubbles: true, cancelable: true }))
	})
}
async function click(element: HTMLElement) {
	await settle(() => {
		element.focus()
		element.click()
	})
}
async function renameValue(value: string) {
	const input = container.querySelector('input')!
	await settle(() => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	return input
}

test('query tabs use manual activation and linked panels', async () => {
	await mount()
	expect(container.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('SQL query tabs')
	expect([...container.querySelectorAll<HTMLElement>('[role="tab"]')].filter((e) => e.tabIndex === 0)).toHaveLength(1)
	await press(tab('B'), 'ArrowRight')
	expect(document.activeElement).toBe(tab('C'))
	expect(model.activeTabId).toBe('b')
	expect(mocks.select).not.toHaveBeenCalled()
	await press(tab('C'), 'Enter')
	expect(model.activeTabId).toBe('c')
	const panel = document.getElementById(tab('C').getAttribute('aria-controls')!)!
	expect(panel.getAttribute('aria-labelledby')).toBe(tab('C').id)
	expect(document.activeElement).toBe(tab('C'))
	await press(tab('C'), 'Home')
	expect(document.activeElement).toBe(tab('A'))
	await press(tab('A'), ' ')
	expect(model.activeTabId).toBe('a')
	await press(tab('A'), 'End')
	expect(document.activeElement).toBe(tab('C'))
})

test.each(['a', 'b', 'c'])(
	'closing %s preserves the hook selection rule and focuses the surviving selection',
	async (id) => {
		await mount()
		await click(button(`Close ${id.toUpperCase()}`))
		expect(model.activeTabId).toBe(id === 'b' ? 'c' : 'b')
		expect(document.activeElement).toBe(tab(model.activeTab.title))
		expect(model.tabs.map((t) => t.id)).not.toContain(id)
	}
)

test('closing the last selected tab uses its left neighbor and preserves the last-tab guard', async () => {
	await mount()
	await click(tab('C'))
	await click(button('Close C'))
	expect(document.activeElement).toBe(tab('B'))
	await click(button('Close A'))
	expect(button('Close B')).toBeUndefined()
	await click(button('Actions for B'))
	expect(item('Close').getAttribute('aria-disabled')).toBe('true')
	expect(item('Close others').getAttribute('aria-disabled')).toBe('true')
	expect(item('Close tabs to the right').getAttribute('aria-disabled')).toBe('true')
})

test.each(['Enter', 'Escape', 'blur'])('rename %s finishes once and preserves focus intent', async (key) => {
	await mount()
	await click(button('Actions for B'))
	await click(item('Rename'))
	const input = await renameValue('Renamed')
	expect(document.activeElement).toBe(input)
	if (key === 'blur') await click(button('Outside'))
	else await press(input, key)
	expect(mocks.rename.mock.calls).toEqual(key === 'Escape' ? [] : [['b', 'Renamed']])
	expect(model.activeTab.title).toBe(key === 'Escape' ? 'B' : 'Renamed')
	expect(document.activeElement).toBe(key === 'blur' ? button('Outside') : tab(model.activeTab.title))
})

test('actions open from the keyboard and Escape restores their trigger without selecting another query', async () => {
	await mount()
	await press(button('Actions for A'), 'ArrowDown')
	expect(document.querySelector('[role="menu"]:not([hidden])')?.getAttribute('aria-label')).toBe('Actions for A')
	expect(model.activeTabId).toBe('b')
	await press(item('Rename'), 'Escape')
	expect(document.activeElement).toBe(button('Actions for A'))
	await press(tab('C'), 'F10', true)
	expect(document.querySelector('[role="menu"]:not([hidden])')?.getAttribute('aria-label')).toBe('Actions for C')
	await press(item('Rename'), 'Escape')
	expect(document.activeElement).toBe(tab('C'))
})

test('duplicate and new query/notebook actions focus the new selection without losing existing drafts', async () => {
	await mount()
	await click(button('Actions for A'))
	await click(item('Duplicate'))
	expect(model.activeTab.sql).toBe("SELECT 'a'")
	expect(model.activeTab.id).not.toBe('a')
	expect(document.activeElement?.getAttribute('id')).toBe(container.querySelector('[aria-selected="true"]')?.id)
	await click(button('New tab'))
	await click(item(/^New query tab/))
	expect(model.activeTab.sql).toBe('')
	expect(document.activeElement).toBe(tab('Untitled'))
	await click(button('New tab'))
	await click(item('New notebook tab'))
	expect(model.activeTab.mode).toBe('notebook')
	expect(document.activeElement).toBe(tab('Notebook: Untitled notebook'))
	expect(model.tabs.find((t) => t.id === 'b')?.sql).toBe("SELECT 'b'")
})

test('bulk close and conversion keep focus on surviving tabs', async () => {
	await mount()
	await click(button('Actions for A'))
	await click(item('Close tabs to the right'))
	expect(model.tabs.map((t) => t.id)).toEqual(['a'])
	expect(document.activeElement).toBe(tab('A'))
	await click(button('Actions for A'))
	await click(item('Convert to notebook'))
	expect(model.activeTab.mode).toBe('notebook')
	expect(document.activeElement).toBe(tab('Notebook: A'))
	await click(button('New tab'))
	await click(item(/^New query tab/))
	await click(button('Actions for A'))
	await click(item('Close others'))
	expect(model.tabs.map((t) => t.id)).toEqual(['a'])
	expect(document.activeElement).toBe(tab('Notebook: A'))
})

test('query completion and closing an inactive tab with the middle button do not steal editor focus', async () => {
	await mount()
	const editor = container.querySelector('textarea')!
	await settle(() => {
		editor.focus()
		model.updateTab('b', { running: true })
	})
	await settle(() =>
		model.updateTab('b', { running: false, result: { columns: [{ name: 'value', type: 'INTEGER' }], rows: [[1]] } })
	)
	expect(document.activeElement).toBe(editor)
	await settle(() =>
		tab('A').dispatchEvent(new MouseEvent('mousedown', { button: 1, bubbles: true, cancelable: true }))
	)
	expect(document.activeElement).toBe(editor)
	expect(model.activeTabId).toBe('b')
	expect(model.activeTab.result?.rows).toEqual([[1]])
})

test.each(['A', 'B'])('closing %s from its actions menu restores the surviving selection', async (title) => {
	await mount()
	await click(button(`Actions for ${title}`))
	await click(item('Close'))
	expect(document.activeElement).toBe(tab(title === 'B' ? 'C' : 'B'))
})

test('context and new-tab menus restore focus to their trigger on Escape', async () => {
	await mount()
	await settle(() => {
		tab('C').focus()
		tab('C').dispatchEvent(
			new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 40 })
		)
	})
	const menu = document.querySelector<HTMLElement>('[role="menu"]:not([hidden])')!
	expect(menu.getAttribute('aria-label')).toBe('Actions for C')
	expect(document.activeElement).toBe(item('Rename'))
	await press(item('Rename'), 'Escape')
	expect(document.activeElement).toBe(tab('C'))
	await click(button('New tab'))
	await press(item(/^New query tab/), 'Escape')
	expect(document.activeElement).toBe(button('New tab'))
})

test('renaming with IME keeps the draft until composition ends, then saves the renamed tab', async () => {
	await mount()
	await click(button('Actions for B'))
	await click(item('Rename'))
	const input = await renameValue('SQL 日本語')
	await settle(() =>
		input.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })
		)
	)
	expect(mocks.rename).not.toHaveBeenCalled()
	expect(document.activeElement).toBe(input)
	await press(input, 'Enter')
	expect(mocks.rename.mock.calls).toEqual([['b', 'SQL 日本語']])
	await vi.waitFor(() =>
		expect(persisted()).toMatchObject({
			activeTabId: 'b',
			tabs: expect.arrayContaining([expect.objectContaining({ id: 'b', title: 'SQL 日本語', sql: "SELECT 'b'" })])
		})
	)
})
