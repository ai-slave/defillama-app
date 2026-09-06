// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SqlChartModalSidebar } from '~/containers/ProDashboard/components/SqlChart/SqlChartModalSidebar'
import { DownloadsCatalog } from '../../index'
import { SchemaDrawer } from '../SchemaDrawer'

const mocks = vi.hoisted(() => ({
	router: { pathname: '/downloads', query: {} as Record<string, string>, replace: vi.fn() },
	sqlMount: vi.fn(),
	schemaMount: vi.fn(),
	cookbookMount: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => mocks.router }))
vi.mock('next/dynamic', () => ({
	default: () => () => {
		mocks.sqlMount()
		return <div>SQL workspace</div>
	}
}))
vi.mock('../../DownloadsCatalog', () => ({ DownloadsCatalog: () => <div>Simple catalog</div> }))
vi.mock('../SchemaBrowser', () => ({
	SchemaBrowser: () => {
		mocks.schemaMount()
		return <div>Schema content</div>
	}
}))
vi.mock('../DocsPanel', () => ({
	CookbookTab: () => {
		mocks.cookbookMount()
		return <div>Cookbook content</div>
	},
	ShortcutsTab: () => <div>Shortcuts content</div>
}))
vi.mock('../ExamplesPanel', () => ({ ExamplesPanel: () => <div>Examples content</div> }))
vi.mock('~/containers/ProDashboard/components/SqlChart/SavedQueriesPanel', () => ({
	SavedQueriesPanel: () => <div>Saved content</div>
}))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	vi.clearAllMocks()
	mocks.router.query = {}
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function press(element: HTMLElement, key: string) {
	await act(async () => {
		element.focus()
		element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}
function tabs(label: string) {
	return [...document.querySelectorAll<HTMLButtonElement>(`[role="tablist"][aria-label="${label}"] [role="tab"]`)]
}
function expectPanel(tab: HTMLButtonElement, content: string) {
	const panel = document.getElementById(tab.getAttribute('aria-controls')!)!
	expect(panel.getAttribute('aria-labelledby')).toBe(tab.id)
	expect(panel.textContent).toContain(content)
	expect(tab.getAttribute('aria-selected')).toBe('true')
}

test('Downloads focus leaves SQL unmounted; activation preserves shallow URL replacement and external navigation', async () => {
	mocks.router.query = { filter: 'kept' }
	const render = async () => {
		await act(async () => root.render(<DownloadsCatalog chartOptionsMap={{}} />))
	}
	await render()
	const [simple, sql] = tabs('Downloads mode')
	expect(mocks.sqlMount).not.toHaveBeenCalled()
	await press(simple, 'ArrowRight')
	expect(document.activeElement).toBe(sql)
	expect(mocks.router.replace).not.toHaveBeenCalled()
	expect(mocks.sqlMount).not.toHaveBeenCalled()
	expectPanel(simple, 'Simple catalog')
	await press(sql, 'Enter')
	expect(mocks.router.replace.mock.calls).toEqual([
		[{ pathname: '/downloads', query: { filter: 'kept', mode: 'sql' } }, undefined, { shallow: true }]
	])
	mocks.router.query = { filter: 'kept', mode: 'sql' }
	await render()
	expectPanel(sql, 'SQL workspace')
	expect(document.activeElement).toBe(sql)
	mocks.router.replace.mockClear()
	// Back/forward can update the URL independently of this widget.
	mocks.router.query = { filter: 'kept' }
	await render()
	expectPanel(simple, 'Simple catalog')
	expect(mocks.router.replace).not.toHaveBeenCalled()
	await act(async () => sql.click())
	mocks.router.query = { filter: 'kept', mode: 'sql' }
	await render()
	mocks.router.replace.mockClear()
	await act(async () => simple.click())
	expect(mocks.router.replace.mock.calls).toEqual([
		[{ pathname: '/downloads', query: { filter: 'kept' } }, undefined, { shallow: true }]
	])
})

test('SQL reference arrows preserve its content and actions until explicit activation', async () => {
	const onApplyAndRun = vi.fn()
	await act(async () =>
		root.render(
			<SchemaDrawer
				open
				onClose={vi.fn()}
				totalDatasetCount={0}
				chartOptionsMap={{}}
				loadedTables={[]}
				loading={null}
				onLoad={async () => null}
				onReplaceSql={vi.fn()}
				onInsertAtCursor={vi.fn()}
				onApplyAndRun={onApplyAndRun}
			/>
		)
	)
	const [schema, cookbook, shortcuts] = tabs('SQL reference section')
	await press(schema, 'ArrowRight')
	expect(document.activeElement).toBe(cookbook)
	expectPanel(schema, 'Schema content')
	expect(mocks.cookbookMount).not.toHaveBeenCalled()
	await press(cookbook, 'Enter')
	expectPanel(cookbook, 'Cookbook content')
	expect(document.activeElement).toBe(cookbook)
	await press(cookbook, 'End')
	expectPanel(cookbook, 'Cookbook content')
	await press(shortcuts, ' ')
	expectPanel(shortcuts, 'Shortcuts content')
	expect(onApplyAndRun).not.toHaveBeenCalled()
})

test('SQL chart reference switches only on activation and keeps inactive sections unmounted', async () => {
	const onApply = vi.fn()
	await act(async () =>
		root.render(
			<SqlChartModalSidebar
				chartOptionsMap={{}}
				loadedTables={[]}
				onLoadTable={async () => null}
				schemaLoading={null}
				busyTaskId={null}
				savedQueries={[]}
				onApplyExample={onApply}
				onApplySaved={onApply}
				onReplaceSql={onApply}
				onInsertAtCursor={onApply}
				onApplyAndRun={onApply}
			/>
		)
	)
	const [examples, schema, , saved, shortcuts] = tabs('SQL reference section')
	await press(examples, 'ArrowRight')
	expect(document.activeElement).toBe(schema)
	expectPanel(examples, 'Examples content')
	expect(mocks.schemaMount).not.toHaveBeenCalled()
	await press(schema, 'Enter')
	expectPanel(schema, 'Schema content')
	await press(schema, 'End')
	await press(shortcuts, ' ')
	expectPanel(shortcuts, 'Shortcuts content')
	await press(shortcuts, 'ArrowLeft')
	await press(saved, 'Enter')
	expectPanel(saved, 'Saved content')
	expect(onApply).not.toHaveBeenCalled()
})
