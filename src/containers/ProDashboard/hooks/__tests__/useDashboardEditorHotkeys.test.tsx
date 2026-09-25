// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { resolveDashboardEditorHotkey, useDashboardEditorHotkeys } from '../useDashboardEditorHotkeys'

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean
}

const undo = vi.fn(() => true)
const redo = vi.fn(() => true)
const openQuickAdd = vi.fn()

function Editor({ enabled = true }: { enabled?: boolean }) {
	useDashboardEditorHotkeys({ enabled, undo, redo, openQuickAdd })
	return (
		<div>
			<div role="presentation" data-testid="card" onKeyDown={(event) => event.stopPropagation()}>
				<button type="button" data-testid="card-button">
					Remove
				</button>
				<input data-testid="input" />
				<textarea data-testid="textarea" />
				<div contentEditable="true" data-testid="rich-text" />
			</div>
			<div role="menu">
				<button type="button" role="menuitem" data-testid="menu-item">
					Duplicate
				</button>
			</div>
			<div role="dialog">
				<button type="button" data-testid="dialog-button">
					Confirm
				</button>
				<input data-testid="dialog-input" />
			</div>
		</div>
	)
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	undo.mockClear().mockReturnValue(true)
	redo.mockClear().mockReturnValue(true)
	openQuickAdd.mockClear()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function byTestId(testId: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
	if (!element) throw new Error(`Missing element ${testId}`)
	return element
}

function keydown(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
	target.dispatchEvent(event)
	return event
}

test('Ctrl+Z dispatched from inside a card that stops propagation still reaches the hook', async () => {
	await act(async () => root.render(<Editor />))
	const event = keydown(byTestId('card-button'), { key: 'z', ctrlKey: true })
	expect(undo).toHaveBeenCalledOnce()
	expect(redo).not.toHaveBeenCalled()
	expect(event.defaultPrevented).toBe(true)
})

test.each([
	['Shift+Ctrl+Z', { key: 'Z', ctrlKey: true, shiftKey: true }],
	['Ctrl+Y', { key: 'y', ctrlKey: true }],
	['Shift+Cmd+Z', { key: 'z', metaKey: true, shiftKey: true }]
] as const)('%s redoes', async (_label, init) => {
	await act(async () => root.render(<Editor />))
	const event = keydown(byTestId('card-button'), init)
	expect(redo).toHaveBeenCalledOnce()
	expect(undo).not.toHaveBeenCalled()
	expect(event.defaultPrevented).toBe(true)
})

test('Cmd+Z undoes on macOS keyboards', async () => {
	await act(async () => root.render(<Editor />))
	keydown(byTestId('card-button'), { key: 'z', metaKey: true })
	expect(undo).toHaveBeenCalledOnce()
})

test.each([
	['a textarea', 'textarea'],
	['a contenteditable region', 'rich-text'],
	['a menu', 'menu-item'],
	['a dialog', 'dialog-button']
])('ignores Ctrl+Z typed inside %s', async (_label, testId) => {
	await act(async () => root.render(<Editor />))
	const event = keydown(byTestId(testId), { key: 'z', ctrlKey: true })
	expect(undo).not.toHaveBeenCalled()
	expect(event.defaultPrevented).toBe(false)
})

test('ignores keystrokes while an IME composition is in progress', async () => {
	await act(async () => root.render(<Editor />))
	const event = keydown(byTestId('card-button'), { key: 'z', ctrlKey: true, isComposing: true })
	expect(event.isComposing).toBe(true)
	expect(undo).not.toHaveBeenCalled()
})

test('leaves the browser default alone when nothing was undone', async () => {
	undo.mockReturnValue(false)
	await act(async () => root.render(<Editor />))
	const event = keydown(byTestId('card-button'), { key: 'z', ctrlKey: true })
	expect(undo).toHaveBeenCalledOnce()
	expect(event.defaultPrevented).toBe(false)
})

test('does nothing while disabled and detaches on unmount', async () => {
	await act(async () => root.render(<Editor enabled={false} />))
	keydown(byTestId('card-button'), { key: 'z', ctrlKey: true })
	expect(undo).not.toHaveBeenCalled()
	await act(async () => root.render(<Editor enabled />))
	keydown(byTestId('card-button'), { key: 'z', ctrlKey: true })
	expect(undo).toHaveBeenCalledOnce()
	await act(async () => root.unmount())
	root = createRoot(container)
	keydown(window, { key: 'z', ctrlKey: true })
	expect(undo).toHaveBeenCalledOnce()
})

test('Ctrl+K and Cmd+K open quick add and swallow the site search shortcut', async () => {
	await act(async () => root.render(<Editor />))
	const bubbleListener = vi.fn()
	window.addEventListener('keydown', bubbleListener)
	const event = keydown(byTestId('card-button'), { key: 'k', metaKey: true })
	expect(openQuickAdd).toHaveBeenCalledOnce()
	expect(event.defaultPrevented).toBe(true)
	expect(bubbleListener).not.toHaveBeenCalled()
	keydown(byTestId('card-button'), { key: 'k', ctrlKey: true })
	expect(openQuickAdd).toHaveBeenCalledTimes(2)
	expect(bubbleListener).not.toHaveBeenCalled()
	expect(undo).not.toHaveBeenCalled()
	expect(redo).not.toHaveBeenCalled()
	window.removeEventListener('keydown', bubbleListener)
})

test('Cmd+K inside the quick add dialog is swallowed instead of reaching the site search', async () => {
	await act(async () => root.render(<Editor />))
	const bubbleListener = vi.fn()
	window.addEventListener('keydown', bubbleListener)
	const event = keydown(byTestId('dialog-input'), { key: 'k', metaKey: true })
	expect(openQuickAdd).not.toHaveBeenCalled()
	expect(event.defaultPrevented).toBe(true)
	expect(bubbleListener).not.toHaveBeenCalled()
	expect(undo).not.toHaveBeenCalled()
	expect(redo).not.toHaveBeenCalled()
	window.removeEventListener('keydown', bubbleListener)
})

test('leaves Cmd+K to the site search while disabled', async () => {
	await act(async () => root.render(<Editor enabled={false} />))
	const event = keydown(byTestId('card-button'), { key: 'k', metaKey: true })
	expect(openQuickAdd).not.toHaveBeenCalled()
	expect(event.defaultPrevented).toBe(false)
})

function resolveFrom(target: EventTarget, init: KeyboardEventInit) {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
	target.dispatchEvent(event)
	return resolveDashboardEditorHotkey(event)
}

test.each([
	['Cmd+K', { key: 'k', metaKey: true }, 'quick-add'],
	['Cmd+K by code', { code: 'KeyK', key: 'л', metaKey: true }, 'quick-add'],
	['Ctrl+K', { key: 'k', ctrlKey: true }, 'quick-add'],
	['Cmd+Shift+K', { key: 'k', metaKey: true, shiftKey: true }, null],
	['Cmd+Alt+K', { key: 'k', metaKey: true, altKey: true }, null],
	['plain K', { key: 'k' }, null],
	['Ctrl+Z', { key: 'z', ctrlKey: true }, 'undo'],
	['Ctrl+Shift+Z', { key: 'z', ctrlKey: true, shiftKey: true }, 'redo'],
	['Ctrl+Y', { key: 'y', ctrlKey: true }, 'redo'],
	['plain Z', { key: 'z' }, null],
	['Ctrl+Alt+Z', { key: 'z', ctrlKey: true, altKey: true }, null],
	['Ctrl+S', { key: 's', ctrlKey: true }, null]
] as const)('resolveDashboardEditorHotkey maps %s', (_label, init, expected) => {
	expect(resolveFrom(document.createElement('div'), init)).toBe(expected)
})

test('resolveDashboardEditorHotkey ignores Cmd+K aimed at an input', () => {
	expect(resolveFrom(document.createElement('input'), { key: 'k', metaKey: true })).toBe(null)
})

test('resolveDashboardEditorHotkey ignores Cmd+K aimed inside a listbox', () => {
	const listbox = document.createElement('div')
	listbox.setAttribute('role', 'listbox')
	const option = document.createElement('div')
	listbox.appendChild(option)
	expect(resolveFrom(option, { key: 'k', metaKey: true })).toBe(null)
})
