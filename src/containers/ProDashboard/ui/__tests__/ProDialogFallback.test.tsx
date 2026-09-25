// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { ProDialogFallback } from '../ProDialogFallback'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('the placeholder tells assistive tech a dialog is loading', async () => {
	await act(async () => root.render(<ProDialogFallback />))
	const busy = document.body.querySelector('[aria-busy="true"]')
	expect(busy?.textContent).toBe('Loading dialog')
})
