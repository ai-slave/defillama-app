// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TextSelectionPopup } from '../TextSelectionPopup'
let root: Root
let container: HTMLDivElement
const selected = vi.fn()
const article = vi.fn()
beforeEach(async () => {
	vi.clearAllMocks()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<>
				<div data-llamaai-prose>
					<p id="selected-prose">
						Read <strong>this formatted passage</strong> now.
					</p>
				</div>
				<TextSelectionPopup onSelect={selected} onAddToArticle={article} />
			</>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	window.getSelection()?.removeAllRanges()
})
async function selectProse() {
	const range = document.createRange()
	range.selectNodeContents(document.getElementById('selected-prose')!)
	const selection = window.getSelection()!
	selection.removeAllRanges()
	selection.addRange(range)
	await act(async () => {
		document.dispatchEvent(new Event('selectionchange'))
		await new Promise((resolve) => setTimeout(resolve, 40))
	})
}
function action(text: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find((e) => e.textContent?.trim() === text)!
}
test('keyboard focus and collapsed browser selection retain the rich article content', async () => {
	await selectProse()
	await act(async () => {
		action('Add to article').focus()
		window.getSelection()!.removeAllRanges()
		document.dispatchEvent(new Event('selectionchange'))
		await new Promise((resolve) => setTimeout(resolve, 40))
	})
	await act(async () => action('Add to article').click())
	expect(article).toHaveBeenCalledExactlyOnceWith('Read <strong>this formatted passage</strong> now.')
	expect(selected).not.toHaveBeenCalled()
})
test('clearing the selection outside the popup dismisses it without running an action', async () => {
	await selectProse()
	await act(async () => {
		window.getSelection()!.removeAllRanges()
		document.dispatchEvent(new Event('selectionchange'))
		await new Promise((resolve) => setTimeout(resolve, 40))
	})
	expect(document.querySelector('[role="dialog"]')).toBeNull()
	expect(article).not.toHaveBeenCalled()
	expect(selected).not.toHaveBeenCalled()
})
test('Escape preserves the text selection without reopening on an unrelated pointer release', async () => {
	await selectProse()
	await act(async () => {
		action('Ask LlamaAI').focus()
		action('Ask LlamaAI').dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
		)
		await new Promise((resolve) => setTimeout(resolve, 40))
	})
	expect(document.querySelector('[role="dialog"]')).toBeNull()
	await act(async () => {
		document.body.dispatchEvent(new Event('pointerup', { bubbles: true }))
		await new Promise((resolve) => setTimeout(resolve, 40))
	})
	expect(document.querySelector('[role="dialog"]')).toBeNull()
	expect(window.getSelection()?.toString()).toBe('Read this formatted passage now.')
	expect(selected).not.toHaveBeenCalled()
})
