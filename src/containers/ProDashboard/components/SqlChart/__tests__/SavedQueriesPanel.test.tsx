// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { QuerySavedConfig } from '~/containers/Downloads/savedDownloads'
import { SavedQueriesPanel } from '../SavedQueriesPanel'

const renameDownload = vi.fn()
vi.mock('~/contexts/LocalStorage', () => ({
	useSavedDownloads: () => ({ renameDownload, deleteDownload: vi.fn() })
}))

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
	renameDownload.mockClear()
})

const QUERY: QuerySavedConfig = {
	id: 'q1',
	kind: 'query',
	name: 'Weekly volume',
	sql: 'SELECT 1',
	tables: [],
	createdAt: 0
}

async function startRename() {
	await act(async () =>
		root.render(
			<>
				<SavedQueriesPanel queries={[QUERY]} busyTaskId={null} onApply={vi.fn()} />
				<button type="button">Outside</button>
			</>
		)
	)
	await act(async () =>
		container.querySelector<HTMLButtonElement>('button[aria-label="Rename Weekly volume"]')!.click()
	)
	const input = container.querySelector<HTMLInputElement>('input[aria-label="Saved query name"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '  Daily  ')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	return input
}

// The query's own button, which takes the field's place once the rename ends.
const queryButton = () => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('SELECT 1'))

test.each([
	['Enter', [['q1', 'Daily']]],
	['Escape', []]
])('%s ends the rename and hands focus to the query, not the page', async (key, calls) => {
	const input = await startRename()
	await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })))
	expect(renameDownload.mock.calls).toEqual(calls)
	expect(container.querySelector('input')).toBeNull()
	expect(document.activeElement).toBe(queryButton())
})

test('leaving the field with the pointer saves and keeps focus where it went', async () => {
	await startRename()
	const outside = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Outside')!
	await act(async () => outside.focus())
	expect(renameDownload.mock.calls).toEqual([['q1', 'Daily']])
	expect(document.activeElement).toBe(outside)
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
