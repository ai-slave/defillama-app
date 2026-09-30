// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SavedQueriesPanel } from '../SavedQueriesPanel'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	localStorage.clear()
})

test('Rename selects the whole saved query name, and typing keeps the caret where the typing left it', async () => {
	await act(async () =>
		root.render(
			<SavedQueriesPanel
				queries={[{ id: 'q1', kind: 'query', name: 'Weekly volume', sql: 'SELECT 1', tables: [], createdAt: 0 }]}
				busyTaskId={null}
				onApply={vi.fn()}
			/>
		)
	)
	await act(async () =>
		container.querySelector<HTMLButtonElement>('button[aria-label="Rename Weekly volume"]')!.click()
	)
	const input = container.querySelector<HTMLInputElement>('input[aria-label="Saved query name"]')!
	expect(document.activeElement).toBe(input)
	expect([input.selectionStart, input.selectionEnd]).toEqual([0, 'Weekly volume'.length])

	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Daily')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	expect(input.value).toBe('Daily')
	expect([input.selectionStart, input.selectionEnd]).toEqual(['Daily'.length, 'Daily'.length])
})
