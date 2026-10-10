// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { useKeyboardInset } from '../useKeyboardInset'

// happy-dom has no visual viewport: a stub that shrinks the way iOS Safari's does when the keyboard opens.
const viewport = Object.assign(new EventTarget(), { height: window.innerHeight, offsetTop: 0, scale: 1 })
let root: Root
let container: HTMLDivElement

function Page() {
	useKeyboardInset()
	return (
		<>
			<input aria-label="Search" />
			<input aria-label="Name" />
			<button type="button">Done</button>
		</>
	)
}

const html = document.documentElement
const sheetVariables = () => [
	html.style.getPropertyValue('--keyboard-inset'),
	html.style.getPropertyValue('--visual-viewport-height')
]

async function resizeViewport(height: number) {
	viewport.height = height
	await act(async () => viewport.dispatchEvent(new Event('resize')))
}

function focusOut(from: string, to: Element) {
	const field = document.querySelector(`[aria-label="${from}"]`)!
	act(() => field.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: to })))
}

beforeEach(async () => {
	viewport.height = window.innerHeight
	Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () => root.render(<Page />))
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	html.removeAttribute('style')
})

test('without a keyboard the sheets keep their CSS fallbacks, even when the viewport fires events', async () => {
	await resizeViewport(window.innerHeight)
	// Past the frame the resize schedules.
	await act(() => new Promise((resolve) => setTimeout(resolve, 50)))

	expect(sheetVariables()).toEqual(['', ''])
})

test('a keyboard covering the page lifts sheets above it and caps them at the visible height', async () => {
	await resizeViewport(window.innerHeight - 300)

	await waitForUi(() => expect(sheetVariables()).toEqual(['300px', `${window.innerHeight - 300}px`]))
})

test('leaving a text field for a button drops the sheets back down before the viewport reports the keyboard gone', async () => {
	await resizeViewport(window.innerHeight - 300)
	await waitForUi(() => expect(sheetVariables()).toEqual(['300px', `${window.innerHeight - 300}px`]))

	focusOut('Search', document.querySelector('button')!)

	expect(sheetVariables()).toEqual(['', ''])
})

test('moving from one text field to another keeps the sheets above the keyboard', async () => {
	await resizeViewport(window.innerHeight - 300)
	await waitForUi(() => expect(sheetVariables()).toEqual(['300px', `${window.innerHeight - 300}px`]))

	focusOut('Search', document.querySelector('[aria-label="Name"]')!)

	expect(sheetVariables()).toEqual(['300px', `${window.innerHeight - 300}px`])
})
