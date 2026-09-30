// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { MarkdownCell } from '../MarkdownCell'

let root: Root
let container: HTMLDivElement
let setFocused: (focused: boolean) => void
let rerender: () => void

// Stands in for the notebook, which owns which cell is focused and the cell's source.
function Notebook({ initialSource, initialFocused }: { initialSource: string; initialFocused: boolean }) {
	const [source, setSource] = useState(initialSource)
	const [focused, setFocusedState] = useState(initialFocused)
	const [, setRenders] = useState(0)
	setFocused = setFocusedState
	rerender = () => setRenders((count) => count + 1)
	return <MarkdownCell source={source} onChange={setSource} focused={focused} onFocus={() => setFocusedState(true)} />
}

beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function render(initialSource: string, initialFocused: boolean) {
	await act(async () => root.render(<Notebook initialSource={initialSource} initialFocused={initialFocused} />))
}
const editor = () => container.querySelector('textarea')

test('a new empty cell opens its editor with the cursor in it', async () => {
	await render('', true)
	expect(document.activeElement).toBe(editor())
})

test('an empty cell opens its editor when focus moves to it, and Escape keeps it closed until focus returns', async () => {
	await render('', false)
	expect(editor()).toBeNull()
	expect(container.textContent).toBe('Click to write markdown…')

	await act(async () => setFocused(true))
	expect(document.activeElement).toBe(editor())

	await act(async () => editor()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
	expect(editor()).toBeNull()
	await act(async () => rerender())
	expect(editor()).toBeNull()

	await act(async () => setFocused(false))
	await act(async () => setFocused(true))
	expect(document.activeElement).toBe(editor())
})

test('a cell with markdown stays rendered when focus moves to it', async () => {
	await render('# Notes', false)
	await act(async () => setFocused(true))
	expect(editor()).toBeNull()
	expect(container.querySelector('h1')?.textContent).toBe('Notes')
})

test('clicking a cell opens its editor with the caret after the text, and a re-render leaves the caret alone', async () => {
	await render('# Notes', false)
	await act(async () => container.querySelector<HTMLElement>('[role="button"]')!.click())
	const textarea = editor()!
	expect(document.activeElement).toBe(textarea)
	expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([7, 7])

	await act(async () => textarea.setSelectionRange(2, 2))
	await act(async () => rerender())
	expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([2, 2])
})
