// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FormatSplitButton } from '../FormatSplitButton'
let root: Root
let container: HTMLDivElement
const download = vi.fn()
beforeEach(() => {
	download.mockClear()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
function button(name: string) {
	return [...document.querySelectorAll<HTMLElement>('button, [role="menuitemradio"]')].find(
		(e) => e.getAttribute('aria-label') === name || e.textContent?.trim() === name
	)!
}
async function click(name: string) {
	await act(async () => {
		button(name).click()
		await new Promise((resolve) => setTimeout(resolve, 20))
	})
}
test('each format activation downloads once, including the already selected format', async () => {
	await act(async () => root.render(<FormatSplitButton disabled={false} label="Download" onDownload={download} />))
	expect(download).not.toHaveBeenCalled()
	await click('Choose download format')
	expect(document.querySelector('[role="menuitemradio"][aria-checked="true"]')?.textContent).toBe('CSV')
	await click('CSV')
	expect(download).toHaveBeenCalledExactlyOnceWith('csv')
	await click('Choose download format')
	await click('JSON')
	expect(download.mock.calls).toEqual([['csv'], ['json']])
	await click('Download JSON')
	expect(download.mock.calls).toEqual([['csv'], ['json'], ['json']])
	await click('Choose download format')
	expect(document.querySelector('[role="menuitemradio"][aria-checked="true"]')?.textContent).toBe('JSON')
	await click('JSON')
	expect(download).toHaveBeenCalledTimes(4)
})
test('disabled downloads cannot open the format menu or run an export', async () => {
	await act(async () => root.render(<FormatSplitButton disabled label="Download" onDownload={download} />))
	await click('Download CSV')
	await click('Choose download format')
	expect(download).not.toHaveBeenCalled()
	expect(document.querySelector('[role="menu"]')).toBeNull()
})
