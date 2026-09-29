// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { useSqlTabs } from '../useSqlTabs'

let roots: Array<Root> = []

function Editor() {
	const tabs = useSqlTabs()
	return (
		<textarea aria-label="SQL editor" value={tabs.activeTab.sql} onChange={(e) => tabs.setActiveSql(e.target.value)} />
	)
}

async function mountEditor() {
	const container = document.createElement('div')
	document.body.appendChild(container)
	const root = createRoot(container)
	roots.push(root)
	await act(async () => root.render(<Editor />))
	return { root, editor: container.querySelector('textarea')! }
}

async function type(editor: HTMLTextAreaElement, value: string) {
	await act(async () => {
		const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
		setValue.call(editor, value)
		editor.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	localStorage.clear()
})

afterEach(async () => {
	for (const root of roots) await act(async () => root.unmount())
	roots = []
	document.body.innerHTML = ''
})

test('SQL typed just before leaving SQL Studio is there on return', async () => {
	const first = await mountEditor()
	await type(first.editor, 'SELECT 1')
	await act(async () => first.root.unmount())

	const second = await mountEditor()
	expect(second.editor.value).toBe('SELECT 1')
})

test('SQL typed just before the page unloads is there after a reload', async () => {
	const open = await mountEditor()
	await type(open.editor, 'SELECT 2')
	await act(async () => window.dispatchEvent(new Event('pagehide')))

	const reloaded = await mountEditor()
	expect(reloaded.editor.value).toBe('SELECT 2')
})
