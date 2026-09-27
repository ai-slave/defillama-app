// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { FormattedName } from '..'

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
test('opens the full name on touch only when it exceeds the character limit', async () => {
	const name = 'A very long protocol name'
	await act(async () => root.render(<FormattedName text={name} maxCharacters={5} />))
	await act(async () => container.firstElementChild!.dispatchEvent(new Event('touchstart', { bubbles: true })))
	await waitForUi(() => expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(name))
	await act(async () => root.render(<FormattedName text={name} />))
	expect(document.querySelector('[role="tooltip"]')).toBeNull()
	expect(container.textContent).toBe(name)
})
