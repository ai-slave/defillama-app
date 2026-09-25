// @vitest-environment happy-dom

import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createArticleEditorExtensions } from '../extensions'

let editor: Editor
let root: Root
let container: HTMLDivElement
const extensions = createArticleEditorExtensions()
function Harness() {
	const instance = useEditor({
		extensions,
		editorProps: { attributes: { role: 'textbox', 'aria-label': 'Article body' } }
	})
	if (instance) editor = instance
	return <EditorContent editor={instance} />
}
const settle = () =>
	act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
async function type(text: string) {
	await act(async () => {
		editor.commands.insertContent(text)
	})
	await settle()
}
async function pressKey(key: string, options: KeyboardEventInit = {}) {
	await act(async () => {
		editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }))
	})
	await settle()
}
function selected() {
	return document.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')
}
beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entities: [] }) }))
	await act(async () => root.render(<Harness />))
	await settle()
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.unstubAllGlobals()
	window.localStorage.clear()
})

test('connects slash selection to the editor, inserts at the caret, and clears the association', async () => {
	await type('/')
	expect(selected()?.textContent).toContain('Heading 2')
	await pressKey('ArrowDown')
	expect(selected()?.textContent).toContain('Heading 3')
	expect(editor.view.dom.getAttribute('aria-activedescendant')).toBe(selected()?.id)
	await pressKey('Enter')
	expect(editor.getJSON().content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 3 } })
	expect(editor.getText().trim()).toBe('')
	expect(document.querySelector('[role="listbox"]')).toBeNull()
	expect(editor.view.dom.hasAttribute('aria-activedescendant')).toBe(false)
})

test('dismisses on Tab without consuming it and leaves the query intact on Escape', async () => {
	await type('/')
	const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
	await act(async () => {
		editor.view.dom.dispatchEvent(event)
	})
	await settle()
	expect(event.defaultPrevented).toBe(false)
	expect(document.querySelector('[role="listbox"]')).toBeNull()
	expect(editor.getText()).toBe('/')
	await act(async () => {
		editor.commands.setContent('<p></p>')
	})
	await type('/')
	await pressKey('Escape')
	expect(document.querySelector('[role="listbox"]')).toBeNull()
	expect(editor.getText()).toBe('/')
})

test('supports click activation without needing a pointer-down event', async () => {
	await type('/')
	await act(async () => {
		selected()!.click()
	})
	await settle()
	expect(editor.getJSON().content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } })
})

test('fetches each mention query once and ignores a superseded response', async () => {
	const requests: Array<{ resolve: (value: Response) => void }> = []
	vi.mocked(fetch).mockImplementation(() => new Promise((resolve) => requests.push({ resolve })))
	await type('@')
	await type('a')
	expect(fetch).toHaveBeenCalledTimes(2)
	const item = {
		id: 'aave',
		entityType: 'protocol',
		slug: 'aave',
		label: 'Aave',
		route: '/protocol/aave',
		source: 'search'
	}
	await act(async () => {
		requests[1].resolve(new Response(JSON.stringify({ entities: [item] })))
	})
	await settle()
	expect(selected()?.textContent).toContain('Aave')
	await act(async () => {
		requests[0].resolve(new Response(JSON.stringify({ entities: [] })))
	})
	await settle()
	expect(selected()?.textContent).toContain('Aave')
	await pressKey('Enter')
	expect(editor.getText()).toBe('Aave ')
	expect(editor.getJSON().content?.[0].content?.[0].marks?.[0].type).toBe('entityLink')
	await act(async () => {
		editor.commands.undo()
	})
	expect(editor.getJSON().content?.[0].content?.[0]?.marks).toBeUndefined()
})

test('the /bullet command starts a bullet list', async () => {
	await type('/bullet')
	await pressKey('Enter')
	await type('First point')
	expect(editor.getJSON().content?.[0]).toMatchObject({
		type: 'bulletList',
		content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ text: 'First point' }] }] }]
	})
})
