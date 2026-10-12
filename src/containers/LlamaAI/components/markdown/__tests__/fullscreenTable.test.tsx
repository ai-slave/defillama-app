// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ChatMarkdownRenderer } from '../ChatMarkdownRenderer'

let container: HTMLDivElement
let root: Root
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const table = '| Protocol | Revenue |\n| --- | ---: |\n| Aave | 1 |\n| Curve | 2 |\n'
const named = (name: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => accessibleName(button) === name)!

async function escape() {
	await act(async () => {
		document.activeElement!.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
		)
	})
}

test('the fullscreen table opens under a visible title and Escape returns focus to its button', async () => {
	await act(async () => root.render(<ChatMarkdownRenderer content={table} />))
	const open = named('View table fullscreen')
	await act(async () => {
		open.focus()
		open.click()
	})
	await waitForUi(() => expect(document.querySelector('[role=dialog]')).not.toBeNull())
	const dialog = document.querySelector<HTMLElement>('[role=dialog]')!
	const title = document.getElementById(dialog.getAttribute('aria-labelledby')!)
	expect(title?.tagName).toBe('H2')
	expect(title?.textContent).toBe('Table')
	expect([...dialog.querySelectorAll('tbody tr')].map((row) => row.textContent)).toEqual(['Aave1', 'Curve2'])
	await escape()
	await waitForUi(() => expect(document.querySelector('[role=dialog]')).toBeNull())
	expect(document.activeElement).toBe(open)
})

test('a table of 8 rows carries a decorative logo, and a shorter one carries none', async () => {
	const rows = Array.from({ length: 8 }, (_, i) => `| Protocol ${i} | ${i} |\n`).join('')
	await act(async () =>
		root.render(<ChatMarkdownRenderer content={`| Protocol | Revenue |\n| --- | ---: |\n${rows}`} />)
	)
	expect([...container.querySelectorAll('img')].map((img) => img.getAttribute('alt'))).toEqual(['', ''])
	await act(async () => root.render(<ChatMarkdownRenderer content={table} />))
	expect(container.querySelectorAll('img')).toHaveLength(0)
})
