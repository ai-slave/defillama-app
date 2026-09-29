// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Dialog, DialogBody, DialogHeader } from '../Dialog'
import { InlineStatus } from '../Status'

// happy-dom does not lay out or scroll, so the test records which alerts asked to be brought into view. Ariakit
// also scrolls the dialog's focused control into view on open; that is not what these tests observe.
const scrolled: Array<{ element: Element; options: unknown }> = []

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	scrolled.length = 0
	Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
		configurable: true,
		writable: true,
		value: vi.fn(function (this: Element, options: unknown) {
			if (this.getAttribute('role') === 'alert') scrolled.push({ element: this, options })
		})
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollIntoView
})

function Form({ inDialog }: { inDialog: boolean }) {
	const [error, setError] = useState<string | null>(null)
	const body = (
		<>
			<button type="button" onClick={() => setError('Could not create the dashboard.')}>
				Create
			</button>
			{error ? <InlineStatus variant="error">{error}</InlineStatus> : null}
		</>
	)
	if (!inDialog) return body
	return (
		<Dialog size="sm" open onClose={() => {}}>
			<DialogHeader title="New dashboard" />
			<DialogBody>{body}</DialogBody>
		</Dialog>
	)
}

async function clickCreate() {
	const button = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent === 'Create')!
	await act(async () => button.click())
	return document.querySelector('[role=alert]')!
}

test('an error that appears inside a dialog brings itself into view without moving an error already visible', async () => {
	await act(async () => root.render(<Form inDialog />))
	const alert = await clickCreate()
	expect(alert.textContent).toBe('Could not create the dashboard.')
	expect(scrolled).toEqual([{ element: alert, options: { block: 'nearest' } }])
})

test('an error rendered on a page does not scroll the page', async () => {
	await act(async () => root.render(<Form inDialog={false} />))
	const alert = await clickCreate()
	expect(alert.textContent).toBe('Could not create the dashboard.')
	expect(scrolled).toEqual([])
})
