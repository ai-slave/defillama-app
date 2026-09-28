// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { Button } from '../Button'
import { Dialog, DialogBody, DialogHeader } from '../Dialog'

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
})

test('a pending submit button keeps focus, shows its pending label and submits nothing until it settles', async () => {
	const submit = vi.fn()
	function Form({ pending }: { pending: boolean }) {
		return (
			<form
				onSubmit={(event) => {
					event.preventDefault()
					submit()
				}}
			>
				<Button type="submit" variant="primary" size="md" pendingLabel={pending ? 'Saving…' : null}>
					Save
				</Button>
			</form>
		)
	}
	await act(async () => root.render(<Form pending={false} />))
	const button = container.querySelector('button')!
	button.focus()
	await act(async () => root.render(<Form pending />))
	expect(document.activeElement).toBe(button)
	expect(button.textContent).toBe('Saving…')
	expect(button.getAttribute('aria-disabled')).toBe('true')
	expect(button.getAttribute('aria-busy')).toBe('true')
	await act(async () => button.click())
	expect(submit).not.toHaveBeenCalled()
	await act(async () => root.render(<Form pending={false} />))
	expect(button.textContent).toBe('Save')
	await act(async () => button.click())
	expect(submit).toHaveBeenCalledOnce()
})

test('a pending dialog ignores Escape and its close button, then closes again once the request settles', async () => {
	function Harness({ pending }: { pending: boolean }) {
		const [open, setOpen] = useState(true)
		return (
			<>
				{open ? null : <p>Closed</p>}
				<Dialog size="sm" open={open} onClose={() => setOpen(false)} pending={pending}>
					<DialogHeader title="Invite" />
					<DialogBody>
						<p>Body</p>
					</DialogBody>
				</Dialog>
			</>
		)
	}
	await act(async () => root.render(<Harness pending />))
	await waitForUi(() => expect(document.querySelector('[role=dialog]')).not.toBeNull())
	const dialog = document.querySelector<HTMLElement>('[role=dialog]')!
	const close = dialog.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!
	expect(close.getAttribute('aria-disabled')).toBe('true')
	await act(async () => close.click())
	await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
	expect(container.textContent).not.toContain('Closed')
	await act(async () => root.render(<Harness pending={false} />))
	await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
	await waitForUi(() => expect(container.textContent).toContain('Closed'))
})
