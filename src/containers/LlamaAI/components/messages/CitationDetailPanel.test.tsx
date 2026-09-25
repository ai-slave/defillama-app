// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CitationDetailPanel } from './CitationDetailPanel'
import { CitationSheetProvider, useCitationSheetController } from './CitationSheetContext'

// Heavy child; these tests only move focus through the panel.
vi.mock('./CitationPill', () => ({ PillBody: () => <button type="button">Panel content</button> }))

let root: Root
let container: HTMLDivElement
beforeEach(async () => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () => root.render(<Harness />))
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
function Harness() {
	const sheet = useCitationSheetController()
	return (
		<CitationSheetProvider value={sheet}>
			<button type="button" onClick={() => sheet.open({ id: 1, sourceType: 'data', label: 'First' })}>
				First citation
			</button>
			<button type="button" onClick={() => sheet.open({ id: 2, sourceType: 'data', label: 'Second' })}>
				Second citation
			</button>
			<button type="button">Outside</button>
			<CitationDetailPanel advancedProvenance={false} />
		</CitationSheetProvider>
	)
}
function button(name: string) {
	return [...container.querySelectorAll('button')].find(
		(el) => el.textContent === name || el.getAttribute('aria-label') === name
	)!
}
async function click(name: string) {
	await act(async () => {
		button(name).focus()
		button(name).click()
	})
}
async function escape(name: string) {
	await act(async () => {
		button(name).focus()
		button(name).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
	})
}
test('Escape inside the panel restores focus to the citation', async () => {
	await click('First citation')
	await escape('Panel content')
	expect(container.querySelector('[role="region"]')).toBeNull()
	expect(document.activeElement).toBe(button('First citation'))
})
test('the close button returns focus to the most recently opened citation', async () => {
	await click('First citation')
	await click('Second citation')
	await click('Close source detail')
	expect(container.querySelector('[role="region"]')).toBeNull()
	expect(document.activeElement).toBe(button('Second citation'))
})
test('Escape outside the nonmodal panel preserves the panel and focus', async () => {
	await click('First citation')
	await escape('Outside')
	expect(container.querySelector('[role="region"]')).not.toBeNull()
	expect(document.activeElement).toBe(button('Outside'))
})
